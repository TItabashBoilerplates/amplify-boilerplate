import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AUTH_SUCCESS_KEYS, AUTH_VALIDATION_KEYS } from '@workspace/auth/validation'
import { describe, expect, it } from 'vitest'

/**
 * 認証の必須導線が消えていないことを機械的に守る（Mobile）。
 *
 * ## なぜこの検査が要るか
 *
 * `.claude/rules/auth.md` が要求する導線は、**消してもアプリは普通に動く**。
 * ビルドも型チェックも lint も Storybook も通る。気づけるのは
 * 「ストア審査でリジェクトされたとき」だけである。
 *
 * とくにモバイルは **OTP のみのログインだと App Store 2.1(a) でリジェクト**され、
 * **アカウント削除が無いと 5.1.1(v) で落ちる**（`.claude/rules/store-review.md` §4）。
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
    ['app/sign-in.tsx', 'ログイン'],
    ['app/sign-up.tsx', 'サインアップ'],
    ['app/forgot-password.tsx', 'パスワード再設定の申請'],
    ['app/account.tsx', 'アカウント設定'],
  ])('%s (%s) がある', (path) => {
    expect(existsSync(join(APP_ROOT, path)), `${path} が無い`).toBe(true)
  })
})

describe('ログイン画面', () => {
  /** OTP のみにすると App Store Review 2.1(a) でリジェクトされる */
  it('パスワードログインを使っている（OTP のみにしない）', () => {
    expect(read('app/sign-in.tsx')).toContain('signInWithPassword')
    expect(read('src/views/auth/ui/SignInScreen.tsx')).toContain('SignInForm')
  })

  /**
   * パスワードを忘れた人は**ログインできない**のだから、再設定導線を
   * 設定画面に置いても到達できない。ログイン画面に無いと詰む。
   */
  it('パスワード再設定への導線がログインフォーム内にある', () => {
    const form = read('src/features/auth/ui/SignInForm.tsx')
    expect(form).toContain('/forgot-password')
    expect(form).toContain('forgotPassword')
  })

  /**
   * 管理者リセット・未確認ユーザーの状態を握りつぶすと、ログイン画面が
   * 行き止まりになる（何をすれば直るのか分からない）。
   */
  it('requiresPasswordReset / requiresConfirmation を導線へ繋いでいる', () => {
    const form = read('src/features/auth/ui/SignInForm.tsx')
    expect(form).toContain('requiresPasswordReset')
    expect(form).toContain('requiresConfirmation')
  })
})

describe('アカウント設定画面', () => {
  const accountScreen = read('src/views/account/ui/AccountScreen.tsx')

  it.each([
    ['ChangeEmailForm', 'メールアドレス再設定（認証方式を問わず必須）'],
    ['ChangePasswordForm', 'パスワード変更'],
    ['DeleteAccountForm', 'アカウント削除（App Store 5.1.1(v)）'],
  ])('%s がある（%s）', (component) => {
    expect(accountScreen).toContain(component)
  })
})

describe('共有 API を使っている', () => {
  /**
   * Cognito を呼ぶ実装を Mobile 側にコピペすると、Web と挙動がズレたときに
   * 片方だけ壊れる（`.claude/rules/auth.md` §5）。
   */
  it('features/auth に api/ を持たない（@workspace/auth/api が正本）', () => {
    expect(existsSync(join(APP_ROOT, 'src/features/auth/api'))).toBe(false)
  })

  it('ルートが @workspace/auth/api から実装を受け取っている', () => {
    for (const route of ['sign-in', 'sign-up', 'forgot-password', 'account']) {
      expect(readCode(`app/${route}.tsx`)).toContain('@workspace/auth/api')
    }
  })
})

describe('キーボード回避', () => {
  /**
   * Android 15+ の edge-to-edge で `adjustResize` がウィンドウをリサイズしなくなり、
   * `react-native` 標準の `KeyboardAvoidingView` は構造的に壊れている
   * （`.claude/rules/mobile-uiux.md` §1.1）。**入力欄がキーボードに隠れたままになる。**
   */
  it.each([
    ['src/views/auth/ui/AuthScreen.tsx'],
    ['src/views/account/ui/AccountScreen.tsx'],
  ])('%s が react-native-keyboard-controller を使っている', (path) => {
    const source = readCode(path)
    expect(source).toContain('react-native-keyboard-controller')
    expect(source, 'RN 標準の KeyboardAvoidingView は使わない').not.toMatch(
      /import\s*\{[^}]*KeyboardAvoidingView[^}]*\}\s*from\s*'react-native'/
    )
  })

  /** 無いと配下のキーボード回避が**エラーも出さずに何もしない** */
  it('KeyboardProvider がアプリのルートに 1 つある', () => {
    expect(readCode('src/app/providers/AppProvider.tsx')).toContain('KeyboardProvider')
  })

  /** 無いとキーボード表示中の 1 タップ目が吸われ「ボタンが効かない」になる */
  it.each([
    ['src/views/auth/ui/AuthScreen.tsx'],
    ['src/views/account/ui/AccountScreen.tsx'],
  ])('%s が keyboardShouldPersistTaps="handled" を付けている', (path) => {
    expect(readCode(path)).toContain('keyboardShouldPersistTaps="handled"')
  })
})

describe('セッションの永続化', () => {
  /**
   * これらが無いと**アプリ再起動のたびにログインさせられる**
   * （`.claude/rules/auth.md` §3.7）。型チェックでは検出できない。
   */
  const pkg = JSON.parse(read('package.json')) as {
    dependencies: Record<string, string>
  }

  it.each([
    ['@aws-amplify/react-native'],
    ['@react-native-async-storage/async-storage'],
    ['@react-native-community/netinfo'],
    ['react-native-get-random-values'],
  ])('%s が依存に入っている', (name) => {
    expect(pkg.dependencies[name], `${name} が package.json に無い`).toBeDefined()
  })

  /** polyfill は aws-amplify より先に読み込まれていなければ認証が落ちる */
  it('react-native-get-random-values を aws-amplify より前に import している', () => {
    const source = readCode('src/shared/lib/amplify.ts')
    expect(source.indexOf('react-native-get-random-values')).toBeLessThan(
      source.indexOf("from 'aws-amplify'")
    )
  })
})

describe('メール変更の安全性', () => {
  /**
   * これが無いと `updateUserAttributes({ email })` を呼んだ瞬間に email が
   * 置き換わり、**旧アドレスでも新アドレスでもログインできなくなる**（アカウント喪失）。
   */
  it('backend が AttributesRequireVerificationBeforeUpdate を設定している', () => {
    const backend = readCode('frontend/packages/backend/amplify/backend.ts', REPO_ROOT)
    expect(backend).toContain('AttributesRequireVerificationBeforeUpdate')
  })
})

describe('i18n', () => {
  const en = read('src/shared/config/i18n/translations/en.ts')
  const ja = read('src/shared/config/i18n/translations/ja.ts')

  /**
   * 片方だけキーを足すと、そのロケールでだけキー文字列が画面に出る。
   * 型チェックも lint も通るので、その画面を踏むまで気づけない。
   */
  it.each([...AUTH_SUCCESS_KEYS])('success.%s が en / ja 両方にある', (key) => {
    expect(en).toContain(`${key}:`)
    expect(ja).toContain(`${key}:`)
  })

  it.each([...AUTH_VALIDATION_KEYS])('errors.%s が en / ja 両方にある', (key) => {
    expect(en).toContain(`${key}:`)
    expect(ja).toContain(`${key}:`)
  })
})
