/**
 * リリース自動化の**判断ロジック**を検証する。
 *
 * ここが本体である理由: ストアへの書き込みそのものは HTTP を 1 回投げるだけで、
 * 難しいのは「**今この状態で、その操作をしてよいか**」の判断のほうにある。
 * 人間なら App Store Connect の画面を見て「審査中だから今は触らない」と判断できるが、
 * エージェントは状態を渡されただけでは判断できない。判断を誤ると
 * **審査中の版を壊す / 公開済みの版に書き込もうとする / ロールアウトを取り消せなくする**
 * といった、取り返しのつかない操作になる。
 *
 * だから判断だけを純粋関数に切り出し、ここでテストする。
 * ネットワークを触る部分（`asc-*.mjs` / `play-*.mjs`）にはこの判断を書かない。
 *
 * 実装: `scripts/mobile/release-plan.mjs`
 * 運用: `docs/store/release-runbook.md` / `.claude/skills/mobile-release/`
 */
import { describe, expect, it } from 'vitest'
import {
  APP_STORE_WHATS_NEW_LIMIT,
  PLAY_RELEASE_NOTES_LIMIT,
  pickBuildForRelease,
  planAppStoreVersion,
  planPlayRollout,
  toPlayLocale,
  validateReleaseNotes,
} from '../../../../../../scripts/mobile/release-plan.mjs'

// ─────────────────────────────────────────────────────────────────────────────
// App Store: 版の状態 → 次にしてよいこと
// ─────────────────────────────────────────────────────────────────────────────

describe('planAppStoreVersion（App Store の版に対する操作可否）', () => {
  it('PREPARE_FOR_SUBMISSION は編集も提出もできる', () => {
    const plan = planAppStoreVersion({ state: 'PREPARE_FOR_SUBMISSION' })

    expect(plan.canEdit).toBe(true)
    expect(plan.canSubmit).toBe(true)
    expect(plan.action).toBe('submit')
  })

  it('REJECTED / DEVELOPER_REJECTED は編集して出し直せる', () => {
    for (const state of ['REJECTED', 'DEVELOPER_REJECTED', 'METADATA_REJECTED']) {
      const plan = planAppStoreVersion({ state })
      expect(plan.canEdit, state).toBe(true)
      expect(plan.canSubmit, state).toBe(true)
    }
  })

  // 審査中の版に書き込むと、審査を取り下げないと直せない状態になる。
  // 「エラーにならず一部だけ反映される」形で壊れるのが最悪なので、手前で止める。
  it('WAITING_FOR_REVIEW / IN_REVIEW は編集も再提出も禁止', () => {
    for (const state of ['WAITING_FOR_REVIEW', 'IN_REVIEW', 'PENDING_APPLE_RELEASE']) {
      const plan = planAppStoreVersion({ state })
      expect(plan.canEdit, state).toBe(false)
      expect(plan.canSubmit, state).toBe(false)
      expect(plan.action, state).toBe('wait')
      expect(plan.reason, state).toBeTruthy()
    }
  })

  it('READY_FOR_SALE / READY_FOR_DISTRIBUTION は新しい版を作る必要がある', () => {
    for (const state of ['READY_FOR_SALE', 'READY_FOR_DISTRIBUTION']) {
      const plan = planAppStoreVersion({ state })
      expect(plan.canEdit, state).toBe(false)
      expect(plan.action, state).toBe('create-new-version')
    }
  })

  // 手動リリース設定のとき、承認後に「リリース」を押すまで公開されない。
  // ここを wait 扱いにすると、承認されたまま永遠に公開されない。
  it('PENDING_DEVELOPER_RELEASE は公開操作へ進む', () => {
    const plan = planAppStoreVersion({ state: 'PENDING_DEVELOPER_RELEASE' })

    expect(plan.action).toBe('release')
    expect(plan.canSubmit).toBe(false)
  })

  it('版がまだ無いなら作成する', () => {
    expect(planAppStoreVersion(null).action).toBe('create-new-version')
  })

  // 未知の状態を「たぶん大丈夫」で通すと本番を壊す。知らない状態は必ず止める。
  it('未知の状態は wait に倒す', () => {
    const plan = planAppStoreVersion({ state: 'SOME_FUTURE_STATE' })

    expect(plan.action).toBe('wait')
    expect(plan.canEdit).toBe(false)
    expect(plan.reason).toContain('SOME_FUTURE_STATE')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// App Store: 提出に使うビルドの選択
// ─────────────────────────────────────────────────────────────────────────────

describe('pickBuildForRelease（提出に使うビルドの選択）', () => {
  const builds = [
    { id: 'old', version: '41', processingState: 'VALID', uploadedDate: '2026-08-01T00:00:00Z' },
    { id: 'new', version: '43', processingState: 'VALID', uploadedDate: '2026-08-03T00:00:00Z' },
    { id: 'mid', version: '42', processingState: 'VALID', uploadedDate: '2026-08-02T00:00:00Z' },
  ]

  it('VALID のうち最新のアップロードを選ぶ', () => {
    expect(pickBuildForRelease(builds)?.id).toBe('new')
  })

  // PROCESSING のビルドを掴むと紐付けが 409 で落ちる。待つべきときは待つと言わせる。
  it('PROCESSING しか無ければ null を返す（待ちを促す）', () => {
    const processing = [{ id: 'p', version: '44', processingState: 'PROCESSING' }]

    expect(pickBuildForRelease(processing)).toBeNull()
  })

  it('INVALID / FAILED は選ばない', () => {
    const broken = [
      {
        id: 'bad',
        version: '44',
        processingState: 'INVALID',
        uploadedDate: '2026-08-09T00:00:00Z',
      },
      { id: 'ok', version: '43', processingState: 'VALID', uploadedDate: '2026-08-03T00:00:00Z' },
    ]

    expect(pickBuildForRelease(broken)?.id).toBe('ok')
  })

  it('ビルド番号を指定したらそれを選ぶ', () => {
    expect(pickBuildForRelease(builds, { buildVersion: '42' })?.id).toBe('mid')
  })

  it('指定したビルド番号が VALID でなければ落とす', () => {
    const list = [{ id: 'p', version: '44', processingState: 'PROCESSING' }]

    expect(() => pickBuildForRelease(list, { buildVersion: '44' })).toThrow(/PROCESSING/)
  })

  it('存在しないビルド番号を指定したら落とす', () => {
    expect(() => pickBuildForRelease(builds, { buildVersion: '99' })).toThrow(/99/)
  })

  it('空リストは null', () => {
    expect(pickBuildForRelease([])).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Google Play: 段階的公開
// ─────────────────────────────────────────────────────────────────────────────

describe('planPlayRollout（Play の段階的公開）', () => {
  it('割合を指定したら inProgress + userFraction', () => {
    const plan = planPlayRollout({ fraction: 0.1 })

    expect(plan.status).toBe('inProgress')
    expect(plan.userFraction).toBe(0.1)
  })

  it('全公開は completed で userFraction を持たない', () => {
    const plan = planPlayRollout({ fraction: 1 })

    // userFraction を付けたまま completed にすると API が 400 を返す
    expect(plan.status).toBe('completed')
    expect(plan.userFraction).toBeUndefined()
  })

  it('draft は userFraction を持たない', () => {
    expect(planPlayRollout({ status: 'draft' })).toEqual({ status: 'draft' })
  })

  it('halted は進行中のロールアウトを止める', () => {
    const plan = planPlayRollout({ status: 'halted', fraction: 0.2 })

    expect(plan.status).toBe('halted')
    expect(plan.userFraction).toBe(0.2)
  })

  // 0 と 1 は API 上「割合ではない」ので、境界を通すとロールアウトが作れない
  it('0 以下・1 超の割合は落とす', () => {
    expect(() => planPlayRollout({ fraction: 0 })).toThrow()
    expect(() => planPlayRollout({ fraction: -0.1 })).toThrow()
    expect(() => planPlayRollout({ fraction: 1.5 })).toThrow()
  })

  it('割合も status も無ければ落とす（既定で全公開しない）', () => {
    expect(() => planPlayRollout({})).toThrow()
  })

  it('inAppUpdatePriority は 0〜5 のみ', () => {
    expect(planPlayRollout({ fraction: 1, priority: 5 }).inAppUpdatePriority).toBe(5)
    expect(() => planPlayRollout({ fraction: 1, priority: 6 })).toThrow()
    expect(() => planPlayRollout({ fraction: 1, priority: -1 })).toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// リリースノート
// ─────────────────────────────────────────────────────────────────────────────

describe('validateReleaseNotes（リリースノートの検証）', () => {
  it('App Store の上限を超えたら落とす', () => {
    const tooLong = { 'en-US': 'a'.repeat(APP_STORE_WHATS_NEW_LIMIT + 1) }

    expect(() => validateReleaseNotes(tooLong, 'ios')).toThrow(/en-US/)
  })

  // Play は commit のときにまとめて落ちるので、原因が実行箇所から遠い。手前で弾く。
  it('Play の上限を超えたら落とす', () => {
    const tooLong = { ja: 'あ'.repeat(PLAY_RELEASE_NOTES_LIMIT + 1) }

    expect(() => validateReleaseNotes(tooLong, 'android')).toThrow(/ja/)
  })

  it('上限内なら通す', () => {
    const notes = { 'en-US': 'Bug fixes.', ja: '不具合を修正しました。' }

    expect(validateReleaseNotes(notes, 'ios')).toEqual(notes)
  })

  it('空なら落とす（黙って空のノートを出さない）', () => {
    expect(() => validateReleaseNotes({}, 'ios')).toThrow()
  })

  it('空文字のロケールは落とす', () => {
    expect(() => validateReleaseNotes({ ja: '   ' }, 'ios')).toThrow(/ja/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 無人リリースの前提条件（app.json）
// ─────────────────────────────────────────────────────────────────────────────

describe('app.json（人の操作なしでリリースを完了させる前提）', () => {
  /**
   * これが無いと、アップロードのたびに App Store Connect が輸出コンプライアンスを
   * 質問し、**版が WAITING_FOR_EXPORT_COMPLIANCE で止まる**。
   * ビルドも提出も成功して見えるのに TestFlight にも審査にも進まないので、
   * 「なぜか配布されない」という形でしか気づけない。
   *
   * false が正しいのは TLS（HTTPS）や OS 標準の暗号しか使っていない場合。
   * 独自の暗号を実装したら true にし、年次申告が必要になる。
   */
  it('輸出コンプライアンスに毎回答えなくて済むよう宣言してある', async () => {
    const mod = await import('../../../app.json')
    // biome-ignore lint/suspicious/noExplicitAny: app.json は Expo の設定で型を持たない
    const expo = ((mod as any).default ?? mod).expo

    expect(expo.ios.config?.usesNonExemptEncryption).toBe(false)
  })
})

describe('toPlayLocale（ロケール表記の変換）', () => {
  // App Store と Play でロケールの綴りが違う。取り違えると
  // 「その言語だけノートが付かない」形で静かに失敗する。
  it('App Store のロケールを Play の BCP-47 に直す', () => {
    expect(toPlayLocale('ja')).toBe('ja-JP')
    expect(toPlayLocale('en-US')).toBe('en-US')
  })

  it('知らないロケールはそのまま返す（勝手に落とさない）', () => {
    expect(toPlayLocale('fr-FR')).toBe('fr-FR')
  })
})
