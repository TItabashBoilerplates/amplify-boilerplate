# shadcn-boilerplate との差分棚卸し（設計・思想のパリティ）

作成日: 2026-08-18 / 対象: `TItabashBoilerplates/amplify-boilerplate` ← `TItabashBoilerplates/shadcn-boilerplate`

## 前提

**amplify-boilerplate は「shadcn-boilerplate のインフラ部分を AWS Amplify に置き換えただけ」であり、
それ以外の設計・思想は完全に同じであるべき**、という方針。本ドキュメントは 2 リポジトリを全ファイル
比較して洗い出した差分を、**(A) インフラ差分＝正しい差分** / **(B) 移植すべき遅れ** に分類したもの。

| 分類 | 意味 |
|---|---|
| ✅ **意図的** | Supabase/Vercel/Doppler/Drizzle 等を AWS へ置換した結果の差分。直さない |
| 🔴 **要対応** | 設計・思想の遅れ。移植する |
| 🟡 **要判断** | 移植すべきだが、方針をユーザーに確認したい |

---

## 1. `.claude/rules`（思想の正本）

| ルール | 状態 | 対応 |
|---|---|---|
| `form-controls.md` | 🔴 欠落 | ✅ **移植済**（インフラ非依存のためそのまま） |
| `mobile-uiux.md` | 🔴 欠落 | ✅ **移植済**（そのまま） |
| `store-review.md` | 🔴 欠落 | ✅ **移植済**（認証導線の記述のみ Cognito 用語へ） |
| `minimal-implementation.md` | 🔴 欠落 | ✅ **移植済**（マネージド既定を AWS に、`bun`→`pnpm`） |
| `auth.md` | 🔴 欠落 | ✅ **移植済**（Cognito へ全面書き換え。§4 に backend 必須設定） |
| `list-pagination.md` | 🔴 欠落 | ✅ **移植済**（`nextToken` カーソル前提に再構成） |
| `storage-images.md` | 🔴 欠落 | ✅ **移植済**（S3 + Amplify Hosting の `next/image` 最適化） |
| `auto-generated.md` | 🔴 欠落 | ✅ **移植済**（`amplify_outputs.json` / Hey API） |
| `env-naming.md` | 🔴 欠落 | ✅ **移植済**（`AWS`/`AMPLIFY_`/`_` prefix・Lambda 予約変数・Amplify secrets） |
| `database.md` | 🔴 欠落 | ✅ **`data-modeling.md` として移植済**（破壊的スキーマ変更＝データ消失） |
| `supabase-first.md` / `supabase-config.md` / `mcp-supabase.md` / `mcp-doppler.md` / `edge-functions.md` | ✅ 意図的 | `aws-first.md` / `backend-architecture.md` / `generative-ai.md` が代替済み |

### 移植時に判明した重大な実装ギャップ（後述 §3 で対応）

1. **`defineAuth` は `otpLogin: true` で「メール+パスワード」と「Email OTP」が両方 first factor になる**
   （公式明記）。**backend は既にパスワードログイン可能なのに、フロントに実装が無い**。
2. **`UserAttributeUpdateSettings.AttributesRequireVerificationBeforeUpdate = ['email']` が未設定**。
   このままメール変更を実装すると、**検証完了前に `email` が置き換わり、旧・新どちらでもログイン
   できなくなる**（アカウント喪失）。
3. **パスワードポリシー未設定**（`cfnUserPool.policies.passwordPolicy`）。

---

## 2. エージェント設定の同期

| 対象 | 状態 | 対応 |
|---|---|---|
| `.claude/CLAUDE.md` | 🔴 遅れ | ✅ 新ルールを反映済 |
| `.agent/rules/`（auth / auto-generated / list-pagination / minimal-implementation） | 🔴 欠落 | 🔴 未対応 |
| `.cursor/rules/`（auth / list-pagination / minimal-implementation） | 🔴 欠落 | 🔴 未対応 |
| `AGENTS.md` / `.codex/AGENTS.md` / `.cursorrules` | 🔴 遅れ | 🔴 未対応 |
| `skills-lock.json` | 🔴 遅れ | 🔴 未対応（§2.1） |

### 2.1 Skill の差分

**shadcn にあって amplify に無い（lock 管理・30 個）** — うち**インフラ非依存で移植すべきもの**:

| 種別 | Skill |
|---|---|
| UI/UX 品質 | `ui-ux-pro-max`(lock化), `baseline-ui`, `improve-ui`, `fixing-motion-performance` |
| Web 品質 | `accessibility`, `core-web-vitals`, `performance`, `next-best-practices` |
| モバイル | **`gluestack-ui-v5`**（amplify は v4 系のまま。§4 参照） |
| 課金（モバイル） | `revenuecat*` 7 個, `adapty-cli` |
| 監視 | `sentry-*` 5 個 |
| 決済 | `stripe-docs`, `upgrade-stripe` |
| 分析 | `instrument-integration`, `instrument-product-analytics`（PostHog） |
| LLM | `framework-selection` |
| ✅ 意図的に不要 | `vercel-microfrontends`（Vercel 依存） |

**自作 skill で移植すべきもの**: `mobile-uiux`, `ai-usage-metering`, `mobile-release`,
`store-screenshots`, `skill-creator`, **`hey-api`**（amplify も Hey API を使っているのに欠落）。

**✅ 意図的に不要**: `drizzle`, `rls`, `pgtap`, `seed`, `edge-functions-mcp`, `supabase-config`,
`doppler`, `vercel-deploy`, `tauri`（desktop app 自体が無い）。
`fal` / `livekit` / `onesignal` は AWS 既定（Bedrock / IVS・Chime / Pinpoint）に置換されるため不要。

**🔴 逆に、消し忘れて残っているもの**（CLAUDE.md は「削除済み」と書いているが実際は存在する）:
`supabase`, `supabase-postgres-best-practices`, `deploy-to-vercel`, `vercel-cli-with-tokens`,
`vercel-optimize`, および大量の AWS データレイク / MSK / RDS 系 skill（このボイラープレートで
使わないものはノイズになる）。

---

## 3. 認証実装（最大のギャップ・ポリシー違反）

`.claude/rules/auth.md` は **モバイルを出すならメール+パスワード必須**、かつ
**メール再設定 / パスワード忘れ / パスワード変更 / アカウント削除の 4 導線を必須**とする。
現状の amplify-boilerplate は **Email OTP のみ**で、4 導線すべてが未実装。

| 項目 | shadcn | amplify | 対応 |
|---|---|---|---|
| `features/auth/api` | 12 関数 | 4 関数（OTP のみ） | 🔴 |
| `signUpWithPassword` / `signInWithPassword` | ✅ | ❌ | 🔴 |
| `requestPasswordReset` / `updatePassword` | ✅ | ❌ | 🔴 |
| `changeEmail` / `changePassword` / `deleteAccount` | ✅ | ❌ | 🔴 |
| `features/auth/ui`（フォーム 12 種 + Storybook） | ✅ | 3 種（+Passkey/Social） | 🔴 |
| `model/required-flows.test.ts`（導線の静的検査） | ✅ | ❌ | 🔴 |
| `views/account` / `app/[locale]/account` | ✅ | ❌ | 🔴 |
| `app/[locale]/signup` / `forgot-password` | ✅ | ❌ | 🔴 |
| mobile `sign-in` / `sign-up` / `forgot-password` / `account` 画面 | ✅ | ❌ | 🔴 |
| backend の `passwordPolicy` / `AttributesRequireVerificationBeforeUpdate` | n/a | ❌ | 🔴 |

---

## 4. フロントエンドのバージョン・構成の遅れ

| 対象 | amplify | shadcn | 備考 |
|---|---|---|---|
| Expo | `55.0.0-canary` | `~57.0.10` | 🔴 2 メジャー遅れ + canary 固定 |
| React Native | `0.82.1` | `0.86.2` | 🔴 |
| gluestack-ui | `core@^3` + `themed@^1.1.73` 混在 | `core@^5` | 🔴 メジャー 2 つ遅れ |
| NativeWind | native-ui `^4.1.23` / mobile `5.0.0-preview.2` | 両方 `5.0.0-preview.4` | 🔴 **リポジトリ内で不整合** |
| Next.js | `^16.0.8` | `^16.3.0` | 🟡 |
| React | `19.2.1` | `19.2.3` | 🟡 |
| TypeScript | `^5` | `6.0.3` | 🟡 shadcn は TS6 へ移行済（`docs/_research/2026-08-17-typescript-7-upgrade.md`） |
| Storybook / vitest / turbo / next-intl / zustand / tailwindcss | いずれも古い | — | 🟡 |

---

## 5. パッケージ / アプリ構成の欠落

| 対象 | 状態 | 備考 |
|---|---|---|
| `packages/native-ui` のコンポーネント（avatar / box / hstack / icon / input / pressable / safe-area-view / text / vstack） | 🔴 欠落 | shadcn は gluestack v5 でコンポーネント化済（約 1,200 行） |
| `packages/native-ui/constants/navigation-theme.ts` | 🔴 欠落 | |
| `packages/tokens/src/contract.ts` / `oklch.ts` / `__tests__` | 🔴 欠落 | デザイントークンの契約テストが無い |
| `packages/app/hooks` / `entities/user/model/hooks.ts` + テスト | 🔴 欠落 | |
| `packages/auth/validation` | 🔴 欠落 | 認証バリデーションの共通化 |
| `packages/storage-image` | 🔴 欠落 | `storage-images.md` が要求（新規実装） |
| `apps/web/src/app`（FSD の app レイヤー） | 🔴 欠落 | shadcn は `src/app/styles/globals.css` |
| `apps/web/src/shared/ui` | 🔴 欠落 | |
| `apps/web/src/features/cookie-consent` | 🔴 欠落 | |
| `apps/web/app/{page,icon,manifest,opengraph-image,robots,sitemap}.tsx/ts` | 🔴 欠落 | SEO / PWA メタデータ一式 |
| `apps/web/src/shared/lib/server-actions.policy.test.ts` | 🔴 欠落 | Server Action の静的検査 |
| `apps/web/src/shared/config/app.ts` | 🔴 欠落 | |
| `apps/mobile` の `babel.config.js` / `css.d.ts` / `eas.json` | 🔴 欠落 | |
| `apps/mobile` の `store.config.js` / `play.config.js` / `iap.config.js` + テスト | 🔴 欠落 | `store-review.md` が要求 |
| `apps/desktop`（Tauri） | 🟡 欠落 | 移植するか要判断 |
| ✅ `packages/client`(Supabase) / `db-schema`(Drizzle) / `onesignal` | ✅ 意図的 | `data-client` / `backend` / SNS・Pinpoint が代替 |

### Storybook の欠落

- `.storybook/mocks` / `storybook.css` / `viewports.ts` が無い
- mobile 側の `*.stories.tsx` が **10 本以上欠落**（`ui-testing.md` は UI に Storybook 必須と規定）

---

## 6. スクリプト / CI / E2E / ドキュメント

| 対象 | 状態 | 備考 |
|---|---|---|
| `scripts/mcp/`（`mcp-sync`。`.mcp.json` → `.codex` / `.cursor`） | 🔴 欠落 | 生成物だけあって生成元が無い |
| `scripts/mobile/`（`mobile-release-*` / `store-*` / `screenshots-*`） | 🔴 欠落 | `store-review.md` / `mobile-release` skill が前提にする |
| `scripts/frontend/` | 🔴 欠落 | |
| ✅ `scripts/infra`(Vercel) / `scripts/supabase` | ✅ 意図的 | |
| `e2e/` ディレクトリ | 🔴 欠落 | |
| `.maestro`: `password-reset-flow` / `email-change-flow` / `store/` | 🔴 欠落 | 認証導線の E2E |
| CI が **vitest を実行していない** | 🔴 | `tdd.md` の All Green が CI で担保されていない |
| CI が devenv 経由でない（`pnpm run lint:ci` 直叩き） | 🟡 | `commands.md` と不整合（Actions ランナー都合なら注記が要る） |
| `docs/store/`（submission-checklist / release-runbook / aso） | 🔴 欠落 | |
| `docs/deployment/README.md` | 🔴 欠落 | |

---

## 7. 対応順序（推奨）

1. **`.claude/rules` の移植**（✅ 完了）— 思想の正本を先に揃える
2. **認証の実装パリティ**（§3）— 唯一の "ポリシー違反" 状態。backend の必須設定を含む
3. **エージェント設定の同期**（§2）— `.agent` / `.cursor` / `AGENTS.md` / `skills-lock.json`
4. **web / mobile のアプリ構成**（§5）— account / metadata routes / cookie-consent / shared-ui
5. **`packages/storage-image` と `StorageImage`**（§5）— `storage-images.md` の実装
6. **モバイル基盤の追随**（§4）— Expo 57 / RN 0.86 / gluestack v5 / NativeWind 統一
7. **scripts / E2E / docs / CI**（§6）

> 6 は依存の大移動になるため、独立した PR にしてユーザー確認のうえ実施するのが安全
> （`.claude/rules/data-modeling.md` と同じく「壊れたときの影響が大きい」変更）。
