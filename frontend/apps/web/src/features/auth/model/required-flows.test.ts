import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AUTH_SUCCESS_KEYS, AUTH_VALIDATION_KEYS } from '@workspace/auth/validation'
import { describe, expect, it } from 'vitest'

/**
 * 認証の必須導線が消えていないことを機械的に守る（Web）。
 *
 * ## なぜこの検査が要るか
 *
 * `.claude/rules/auth.md` が要求する導線は、**消してもアプリは普通に動く**。
 * ビルドも型チェックも lint も Storybook も通る。気づけるのは
 * 「メールアドレスを変えたユーザーがサポートに問い合わせてきたとき」や
 * 「ストア審査でリジェクトされたとき」だけである。
 *
 * `.claude/rules/store-review.md` §7 が「実装した導線に対する検査を追加すること」を
 * 求めているのはこのため。実装に対応する検査が無いと、消しても誰も気づかない。
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = resolve(HERE, '../../../..')
const REPO_ROOT = resolve(APP_ROOT, '../../..')

function read(relativePath: string, root = APP_ROOT): string {
  const full = join(root, relativePath)
  expect(existsSync(full), `${relativePath} が存在しない`).toBe(true)
  return readFileSync(full, 'utf8')
}

/**
 * コメントを除いたコード本体。
 *
 * 「この API は使わない」という**注意書き自体**を検出してしまうと、正しく書けている
 * ファイルほど落ちる。禁止 API の検査は必ずコードだけを見る。
 */
function readCode(relativePath: string, root = APP_ROOT): string {
  return read(relativePath, root)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('必須ルート', () => {
  it.each([
    ['app/[locale]/login/page.tsx', 'ログイン'],
    ['app/[locale]/signup/page.tsx', 'サインアップ'],
    ['app/[locale]/forgot-password/page.tsx', 'パスワード再設定の申請'],
    ['app/[locale]/account/page.tsx', 'アカウント設定'],
  ])('%s (%s) がある', (path) => {
    expect(existsSync(join(APP_ROOT, path)), `${path} が無い`).toBe(true)
  })
})

describe('ログイン画面', () => {
  const loginPage = read('src/views/auth/ui/LoginPage.tsx')

  /** OTP のみにすると App Store Review 2.1(a) でリジェクトされる */
  it('パスワードログインを使っている（OTP のみにしない）', () => {
    expect(loginPage).toContain('PasswordLoginForm')
  })

  /**
   * パスワードを忘れた人は**ログインできない**のだから、再設定導線を
   * 設定画面に置いても到達できない。ログイン画面に無いと詰む。
   */
  it('パスワード再設定への導線がログインフォーム内にある', () => {
    const form = read('src/features/auth/ui/PasswordLoginForm.tsx')
    expect(form).toContain('/forgot-password')
    expect(form).toContain('forgotPassword')
  })

  /**
   * 管理者リセット・未確認ユーザーの状態を握りつぶすと、ログイン画面が
   * 行き止まりになる（何をすれば直るのか分からない）。
   */
  it('requiresPasswordReset / requiresConfirmation を導線へ繋いでいる', () => {
    const form = read('src/features/auth/ui/PasswordLoginForm.tsx')
    expect(form).toContain('requiresPasswordReset')
    expect(form).toContain('requiresConfirmation')
  })

  it('signIn の nextStep を分岐している', () => {
    const api = readCode('frontend/packages/auth/api/signInWithPassword.ts', REPO_ROOT)
    expect(api).toContain('CONFIRM_SIGN_UP')
    expect(api).toContain('RESET_PASSWORD')
  })
})

describe('アカウント設定画面', () => {
  const accountPage = read('src/views/account/ui/AccountPage.tsx')

  it.each([
    ['ChangeEmailForm', 'メールアドレス再設定（認証方式を問わず必須）'],
    ['ChangePasswordForm', 'パスワード変更'],
    ['DeleteAccountForm', 'アカウント削除（App Store 5.1.1(v)）'],
  ])('%s がある（%s）', (component) => {
    expect(accountPage).toContain(component)
  })

  it('ユーザーメニューからアカウント設定へ到達できる', () => {
    expect(read('src/widgets/user-menu/ui/UserMenu.tsx')).toContain('/account')
  })
})

describe('パスワード変更の実装', () => {
  /**
   * 現在のパスワードの検証は Cognito に任せる。`signIn` を検証目的で呼ぶのは
   * 新しいセッションが発行される副作用があり誤り（`.claude/rules/auth.md` §3.3）。
   */
  it('updatePassword に oldPassword を渡して Cognito に検証させている', () => {
    const source = readCode('frontend/packages/auth/api/changePassword.ts', REPO_ROOT)
    expect(source).toContain('updatePassword')
    expect(source).toContain('oldPassword')
    expect(source, 'signIn での代用は新セッションが発行される副作用があり誤り').not.toContain(
      'signIn('
    )
  })
})

describe('メール変更の安全性', () => {
  /**
   * これが無いと `updateUserAttributes({ email })` を呼んだ瞬間に email が
   * 置き換わり、**旧アドレスでも新アドレスでもログインできなくなる**（アカウント喪失）。
   * コードではなく backend の設定なので、ここで固定するしかない。
   */
  it('backend が AttributesRequireVerificationBeforeUpdate を設定している', () => {
    const backend = readCode('frontend/packages/backend/amplify/backend.ts', REPO_ROOT)
    expect(backend).toContain('AttributesRequireVerificationBeforeUpdate')
  })

  it('backend がパスワードポリシーを設定している', () => {
    const backend = readCode('frontend/packages/backend/amplify/backend.ts', REPO_ROOT)
    expect(backend).toContain('Policies.PasswordPolicy.MinimumLength')
  })

  /**
   * `otpLogin: true` はパスワードと Email OTP の**両方**を first factor にする設定。
   * サインイン方式は初回デプロイ後 immutable なので、外すと後から戻せない。
   */
  it('defineAuth が otpLogin を有効にしている（password + OTP の併用）', () => {
    const resource = readCode('frontend/packages/backend/amplify/auth/resource.ts', REPO_ROOT)
    expect(resource).toContain('otpLogin: true')
  })
})

describe('サーバー側の認可判断', () => {
  /**
   * クライアントが持っている認証状態をサーバーの判断根拠にしない
   * （`.claude/rules/auth.md` §3.7）。
   */
  it('アカウント設定はサーバーコンテキスト経由でユーザーを解決する', () => {
    const source = readCode('src/views/account/model/loadCurrentUserEmail.ts')
    expect(source).toContain('runWithAmplifyServerContext')
    expect(source).toContain('aws-amplify/auth/server')
  })
})

describe('i18n', () => {
  const en = JSON.parse(read('src/shared/config/i18n/messages/en.json'))
  const ja = JSON.parse(read('src/shared/config/i18n/messages/ja.json'))

  const flatten = (value: unknown, prefix = ''): string[] =>
    typeof value === 'object' && value !== null
      ? Object.entries(value).flatMap(([key, child]) => flatten(child, `${prefix}${key}.`))
      : [prefix]

  it('Auth / Account namespace が両ロケールにある', () => {
    for (const messages of [en, ja]) {
      expect(messages.Auth).toBeDefined()
      expect(messages.Account).toBeDefined()
    }
  })

  it('en と ja のキー集合が一致する（片方だけ足す事故を防ぐ）', () => {
    for (const namespace of ['Auth', 'Account']) {
      expect(flatten(en[namespace]).sort(), `${namespace} のキーが en/ja でずれている`).toEqual(
        flatten(ja[namespace]).sort()
      )
    }
  })

  /**
   * 共有パッケージのキー集合と翻訳ファイルの契約。片方だけ足すと、
   * その画面で `passwordUpdated` のようなキー文字列がそのまま表示される。
   */
  it.each(AUTH_SUCCESS_KEYS)('Auth.success.%s が両ロケールにある', (key) => {
    expect(en.Auth.success[key], `en に success.${key} が無い`).toBeTruthy()
    expect(ja.Auth.success[key], `ja に success.${key} が無い`).toBeTruthy()
  })

  it.each(AUTH_VALIDATION_KEYS)('Auth.errors.%s が両ロケールにある', (key) => {
    expect(en.Auth.errors[key], `en に errors.${key} が無い`).toBeTruthy()
    expect(ja.Auth.errors[key], `ja に errors.${key} が無い`).toBeTruthy()
  })
})
