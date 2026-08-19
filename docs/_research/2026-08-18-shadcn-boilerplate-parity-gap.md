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
| `.claude/CLAUDE.md` | 🔴 遅れ | ✅ **対応済** |
| `.agent/rules/` | 🔴 欠落 + Supabase/Deno の記述が残存 | ✅ **対応済**（auth / auto-generated / list-pagination / minimal-implementation を追加、code-style / research-first を AWS 化） |
| `.cursor/rules/` | 🔴 **Supabase-First / database(Drizzle) / edge-functions(Deno) が `alwaysApply` で残存** | ✅ **対応済**（削除 3・追加 12・書き換え 6） |
| `AGENTS.md` / `.codex/AGENTS.md` / `.cursorrules` / `.agent/AGENT.md` | 🔴 遅れ | ✅ **対応済**。あわせて **「パッケージマネージャは Bun」という正本と矛盾する記述**を pnpm に統一 |
| `skills-lock.json` | 🔴 遅れ | ✅ **対応済**（§2.1） |

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

**🔴 逆に、消し忘れて残っていたもの**（CLAUDE.md は「削除済み」と書いていたが実際は存在した）:
`supabase`, `supabase-postgres-best-practices`, `deploy-to-vercel`, `vercel-cli-with-tokens`,
`vercel-optimize` → ✅ **削除済**。

### 2.1 の対応結果

- ✅ 追加: `accessibility` / `core-web-vitals` / `performance` / `baseline-ui` / `improve-ui` /
  `fixing-motion-performance` / `ui-ux-pro-max`（lock 管理へ）/ `mobile-uiux`（自作を移植）
- ⏸️ 見送り（理由付き）:
  - `sentry-*` / `instrument-*`(PostHog) … `aws-first.md` の既定は CloudWatch / X-Ray
  - `revenuecat-*` / `adapty-cli` … IAP のコードもストア設定も未移植（§6 の後で入れる）
  - `next-best-practices` / `framework-selection` … 上流から取得できなくなっている
  - `gluestack-ui-v5` … 本体が v3/v4 系なので、§4 のアップグレードとセットで入れる
- 🔴 残: `hey-api`（amplify も Hey API を使っているのに skill が無い）、
  `ai-usage-metering` / `mobile-release` / `store-screenshots`（自作。§6 とセット）

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

### 対応結果: ✅ **すべて実装済**（`feat(auth)` コミット）

- backend に `Policies.PasswordPolicy.*`（L1 オーバーライド）/
  `AttributesRequireVerificationBeforeUpdate: ['email']` / `preventUserExistenceErrors` を追加
- `@workspace/auth/validation`（Web/Mobile 共有。63 tests）
- `features/auth` の api を 4 → 15 関数、UI フォーム 9 種 + Storybook 16 本（33 tests）
- `/signup` `/forgot-password` `/account` を追加し、ユーザーメニューから到達可能に
- `required-flows.test.ts` が必須導線・backend 設定・i18n キー集合を静的検査
- **Web のみ。Mobile 側の認証画面は未実装**（§5 に残る）

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
| `apps/web/src/app`（FSD の app レイヤー） | 🔴 欠落 | ✅ **対応済**（`src/app/styles/globals.css`） |
| `apps/web/src/shared/ui` | 🔴 欠落 | |
| `apps/web/src/features/cookie-consent` | ✅ 意図的 | **移植しない**。shadcn 版は PostHog の opt-in ゲートそのもの（判定と永続化を PostHog へ委譲）で、PostHog は `aws-first.md` が排除した外部 SaaS。**同意を取る対象が存在しない同意バナー**は YAGNI。AWS で解析を入れる時点（Pinpoint / CloudWatch）に、その実態に合わせて実装する |
| `apps/web/app/{icon,manifest,opengraph-image,robots,sitemap}` | 🔴 欠落 | ✅ **対応済**（`page.tsx` は `localePrefix: 'always'` のため不要） |
| `apps/web/src/shared/lib/server-actions.policy.test.ts` | 🔴 欠落 | ✅ **対応済**（収集器の生存確認つきで移植。この repo はまだ Server Action を持たないが、最初の 1 本を書いた人が踏むまで誰も気づけない罠なので先に置く） |
| `apps/web/src/shared/config/app.ts` | 🔴 欠落 | ✅ **対応済**（`APP_URL` / `APP_NAME` + `generateMetadata` の i18n 化） |
| `apps/mobile` の `babel.config.js` / `css.d.ts` / `eas.json` | 🔴 欠落 | ✅ **対応済**（`babel.config.js` / `css.d.ts`。`eas.json` はストア配布時） |
| `apps/mobile` の `store.config.js` / `play.config.js` / `iap.config.js` + テスト | 🔴 欠落 | ✅ **対応済**（`store-metadata.test.ts` / `release-plan.test.ts` で 42 件） |
| `apps/desktop`（Tauri） | 🟡 欠落 | ✅ **対応済**（`pnpm dlx` / `tsc` / Amplify server context へ読み替え。`profiles.desktop` で WebKitGTK を opt-in 化） |
| ✅ `packages/client`(Supabase) / `db-schema`(Drizzle) / `onesignal` | ✅ 意図的 | `data-client` / `backend` / SNS・Pinpoint が代替 |

### Storybook の欠落

- `.storybook/mocks` / `storybook.css` / `viewports.ts` が無い → ✅ **対応済**
- mobile 側の `*.stories.tsx` が **10 本以上欠落**（`ui-testing.md` は UI に Storybook 必須と規定）
  → ✅ **対応済**（framework を `@storybook/react-native-web-vite` に替え、描画検査が 45 → 140 ストーリーに）

---

## 6. スクリプト / CI / E2E / ドキュメント

| 対象 | 状態 | 備考 |
|---|---|---|
| `scripts/mcp/`（`mcp-sync`。`.mcp.json` → `.codex` / `.cursor`） | 🔴 欠落 | ✅ **対応済**（Deno → Node へ移植し devenv に配線） |
| `scripts/mobile/`（`mobile-release-*` / `store-*` / `screenshots-*`） | 🔴 欠落 | ✅ **対応済**（Doppler → **AWS SSM Parameter Store** / `bunx` → `pnpm dlx`） |
| `scripts/frontend/` | 🔴 欠落 | ✅ **対応済**（`verify-storybook-render.mjs`） |
| ✅ `scripts/infra`(Vercel) / `scripts/supabase` | ✅ 意図的 | |
| `e2e/` ディレクトリ | 🔴 欠落 | ✅ **対応済**（`scripts/e2e/run-maestro.mjs` + `e2e-results/` 出力） |
| `.maestro`: `password-reset-flow` / `email-change-flow` / `store/` | 🔴 欠落 | ✅ **対応済**（login / password-reset を mobile + web で。`store/` はストア配布時） |
| CI が **vitest / ESLint / Storybook を実行していない** | 🔴 | ✅ **対応済**（3 つとも追加。`verify-storybook-render` の Chromium パスも env で解決するようにした） |
| CI が devenv 経由でない | 🟡 | ✅ **問題は解消**（`scripts/ci/check.sh` を単一の正本にし、`ci-check` と CI の両方が呼ぶ）。devenv shell 化そのものは未対応（ランナーに nix を用意する話であり、検査内容の一致とは別問題） |
| `docs/store/`（submission-checklist / release-runbook / aso） | 🔴 欠落 | ✅ **対応済**（シークレットの記述を Doppler → SSM に読み替え） |
| `docs/deployment/README.md` | 🔴 欠落 | |

---

## 7. 対応状況と残り

### ✅ 対応済み（第 1 弾）

1. **`.claude/rules` の移植**（§1）— 思想の正本
2. **認証の実装パリティ（Web）**（§3）— 唯一の "ポリシー違反" 状態だったもの
3. **エージェント設定の同期**（§2）— `.agent` / `.cursor` / `AGENTS.md` / `.cursorrules` / `skills-lock.json`
4. **Storybook の描画検査**（§6）— `verify-storybook-render` + `ui-testing.md` の完了条件
5. **CI の穴埋め**（§6）— vitest / ESLint / Storybook 描画検査
6. **web の SEO / PWA メタデータ + FSD app レイヤー**（§5）

### ✅ 対応済み（第 2 弾）

| # | 作業 | 実装 |
|---|---|---|
| 1 | **モバイル基盤の追随** | Expo 55-canary → **57 stable** / RN 0.82 → **0.86.2** / React 19.2.1 → **19.2.3** / NativeWind 5 preview.2 → **preview.4** / gluestack v3・v1 混在 → **v5（headless `@gluestack-ui/core`）**。`babel.config.js`（worklets plugin）・`css.d.ts` を追加し、NativeWind v5 の CSS-first 化に伴って `tailwind.config.ts`（存在しない `@workspace/tailwind-config` を参照していた）を削除 |
| 2 | **`packages/tokens` の contract / oklch** | `contract.ts`（バリアント名・セマンティックトークン・`RAW_COLOR_PATTERN`）/ `oklch.ts`（OKLCh → hex。ナビゲーションテーマ等 hex しか受けない API 用）+ テスト 3 本。`generate-css.ts` を `@theme inline` 対応にし、**トークンを single source of truth 化**（`packages/ui/globals.css` と `apps/mobile/global.css` の重複定義を削除。mobile 側は dark 値が既に drift していた） |
| 3 | **`packages/native-ui` のコンポーネント群** | avatar / box / button / hstack / icon / input / pressable / safe-area-view / text / vstack + variants テスト。**生パレット（`bg-zinc-900` / `text-white`）を使っていた旧 Button を撤去**し、バリアント名を Web の shadcn Button と一致させた（`@workspace/tokens/contract` が正本） |
| 4 | **Mobile の認証画面** | sign-in / sign-up（+ 確認コード）/ forgot-password（6 桁コードの往復）/ account（メール変更・パスワード変更・アカウント削除）。`required-flows.test.ts` の mobile 版つき |
| 4b | **認証 API の共有化** | `apps/web/src/features/auth/api/*` を **`@workspace/auth/api`** へ移し、Web / Mobile が同じ実装を使う（`auth.md` §5「Web と Mobile で同じ関数をコピペしない」）。Mobile 側に API 層を作らないことをテストで固定 |
| 4c | **キーボード回避** | `react-native-keyboard-controller` を導入し `KeyboardProvider` をルートに 1 つ。RN 標準の `KeyboardAvoidingView`（Android 15+ の edge-to-edge で構造的に壊れている）を使っていないことを `required-flows.test.ts` が検査 |
| 5 | **Storybook で Mobile を描画** | `@storybook/nextjs`(webpack) → **`@storybook/react-native-web-vite`**。`mocks/`（expo-router / web i18n navigation）・`storybook.css`（RNW のリセットに勝つレイヤー無しユーティリティ）・`viewports.ts` を移植。**描画検査の対象が 45 → 140 ストーリー**になり、mobile UI が初めてカタログに載った |
| 6 | **`packages/storage-image`** | `IMAGE_WIDTH_LADDER` / `snapImageWidth` / `buildDerivativePath` / `createSignedImageUrl` + 単体テスト + **policy テスト**（S3 URL の直書き・`getUrl` の直描画・`unoptimized` を静的検査）。`next.config.ts` の `imageSizes`/`deviceSizes`/`remotePatterns` を段から導出。Web / Mobile の `StorageImage` つき |
| 7 | **`scripts/mcp`（`mcp-sync`）** | Deno 前提だった `scripts/sync-mcp.ts` を **Node（tsx）へ移植**して `scripts/mcp/sync-mcp.ts` に配置、devenv の `mcp-sync` を追加。欠けていた `.codex/config.toml` を生成 |
| 8 | **`.maestro` の認証 E2E** | login / password-reset の往復（mobile + web）。**Cognito のコードはメールにしか出ず Maestro の graaljs は SigV4 を扱えない**ため、`scripts/e2e/run-maestro.mjs` が「テストユーザ作成 → localhost の OTP ブリッジ（`AUTH_E2E_OTP_CAPTURE` の DynamoDB を読む）→ maestro → 後始末」を担う。devenv に `e2e` / `e2e-mobile` / `e2e-web` |
| 9 | **マイナー追随** | Next 16.0.8 → 16.3.0 / next-intl 4.4 → 4.13 / lucide-react 0.539 → 1.28 / tailwindcss 4 → 4.3.3 / zustand 5.0.7 → 5.0.14 / TypeScript ^5 → ^5.9.2 / turbo・vitest・Storybook 10.5.7 |
| 9b | **CI の追加穴埋め** | mobile の ESLint / **リポジトリルートの Biome**（`frontend/biome.json` とは別設定なので `scripts/` `.maestro/` が検査されていなかった）/ mobile 側の `amplify_outputs.json` スタブ |
| 9c | **Next 16.3 の新 lint 対応** | `window.location.assign()` による認証後遷移を next-intl の `useRouter().replace()` + `refresh()` に置換（**ロケール prefix が落ちるバグも同時に解消**）。`error.tsx` も `Link` に変更 |

### ✅ 対応済み（第 3 弾）

| # | 作業 | 実装 |
|---|---|---|
| 1 | **Mobile の画像派生の生成基盤** | `storage-images.md` §1.2 の **方式 A（アップロード時に派生を生成）**を採用。S3 の `OBJECT_CREATED` を `functions/image-derivatives` で受け、`IMAGE_WIDTH_LADDER` の各幅を書き出す。**sharp ではなく jimp**（純 JS なので esbuild でバンドルでき、`ampx sandbox` に Docker もレイヤーも要らない）。派生自身のイベントで再帰しないよう `isDerivativePath()` で弾く。`snapImageWidth` / `buildDerivativePath` は Lambda から `@workspace/storage-image/ladder`（aws-amplify 非依存のサブパス）で共有 |
| 2 | **ストア / リリースのツール群** | `scripts/mobile/`（28 ファイル）・`docs/store/`・`{store,play,iap}.config.js`・`eas.json`・自作 skill `mobile-release` / `store-screenshots`。**Doppler → AWS SSM Parameter Store**（env 優先 → `aws ssm get-parameter --with-decryption`。値は一切ログに出さない）、**`bunx` → `pnpm dlx`**、SDK 検出表を本スタックへ。devenv に store 系 script 16 本と `store-listing` profile |
| 2b | **`ios.config.usesNonExemptEncryption`** | 未設定だとアップロードのたびに輸出コンプライアンスを聞かれ、版が `WAITING_FOR_EXPORT_COMPLIANCE` で止まる（ビルドも提出も成功して見えるのに配布されない）。`release-plan.test.ts` が検査する |
| 3 | **`apps/desktop`（Tauri v2）** | 移植。UI は `@workspace/ui` を共有し、デスクトップ専用の複製を作らない。`pnpm dlx` / 素の `tsc` / Amplify server context へ読み替え。`profiles.desktop` で WebKitGTK を opt-in 化（closure が数 GB になるので web / mobile しか触らない人と CI に負わせない） |
| 4 | **`server-actions.policy.test.ts`** | 移植。この repo はまだ Server Action を持たないので「1 本以上ある」検査は成立しない → **収集器が動いていること**を代わりに固定した（「0 件だから緑」と「検査が壊れて緑」を区別する） |
| 5 | **CI と devenv の drift 解消** | `scripts/ci/check.sh` を検査一覧の**単一の正本**にし、`ci-check`（devenv）と `.github/workflows/ci.yml` の両方が呼ぶ。`commands.md` が約束していたのに存在しなかった 13 個の script を実装し、無いもの（`test-db` / pgTAP / git-hooks の 2 段構成）は記述ごと削除 |
| 5b | **backend-py の `--all-packages`** | uv の virtual workspace では素の `uv run` が member の依存を入れないため、**mypy が third-party を `Any` と見て strict の untyped-decorator を誤爆**（11 件）し、**pytest が 4 ファイルで collection error** になっていた。devenv script と CI の両方を修正 |
| 5c | **backend-py の既存 lint 違反 4 件** | S105（Cognito の `token_use` クレームを「ハードコードされたパスワード」と誤検出）/ E501 / RUF002（日本語 docstring の全角括弧）。ignore を広げず個別に直した |
| 5d | **`lint-fsd` が存在しなかった** | `commands.md` が必須コマンドとして挙げていたのに turbo にも devenv にも無く、**FSD の境界違反が誰にも検出されていなかった**（Biome はレイヤーを見ない）。turbo task + devenv script を追加し `ci-check` に組み込み、desktop の設定はわざと違反を仕込んで落ちることを確認 |
| 5e | **root `biome.json`** | 生成物（`storybook-static` / `.venv`）を除外していなかったため `biome check .` が Biome ごとクラッシュしていた（`HTML_BOGUS` cast panic）。CI が `scripts .maestro` にスコープしていたので誰も踏んでいなかった |
| 6 | **`detailed-design` skill の全面移植** | shadcn から**逐語コピーのまま**で、Drizzle / RLS / pgTAP / Edge Functions / Better Auth / Supabase-first 判定を前提にした設計書テンプレート 9 ファイル（約 2,750 行）だった。**エージェントが書く設計書が丸ごと別スタックのもの**になるため、`a.schema` / `authorization` / DynamoDB のアクセスパターン設計 / Cognito の immutable 項目 / Amplify Data first 判定へ全面的に書き換えた |
| 6b | 同上（周辺 skill） | `storybook`（存在しない `@workspace/client-supabase` alias の手順 → 現行の exports ベースへ）/ `nextjs` / `fastapi` |

### 🔴 残っている作業

| # | 作業 | なぜ残したか |
|---|---|---|
| 1 | CI を **devenv shell の中で**回す | 🟡 ランナーに nix を用意する話であり、**検査内容の一致という本題は `scripts/ci/check.sh` で解消済み**。cachix / `cache-nix-action` の整備が前提で、この環境からは動作確認できない。切り替えても呼ぶものは変わらない |
| 2 | `apps/desktop` の Rust ビルドを CI で回す | 🟡 `-P desktop`（WebKitGTK。closure 数 GB）が要る。フロント側（`vite build`）は CI で回している |

> 「思想・設計・実装パターン」の差分は解消済み。残り 2 件はどちらも
> **CI ランナーの構成**の話で、リポジトリの設計・思想には影響しない。

---

## 8. 意図的に持ち込まなかったもの（差分ではなく判断）

| shadcn 側にあるもの | 判断 | 理由 |
|---|---|---|
| `packages/client`（Supabase）/ `db-schema`（Drizzle）/ `onesignal` | 移植しない | `data-client` / `backend`(a.schema) / SNS・Pinpoint が代替 |
| `scripts/infra`（Vercel）/ `scripts/supabase` | 移植しない | ホスティングは Amplify Hosting、バックエンドは `ampx` |
| `features/cookie-consent` | 移植しない | PostHog の opt-in ゲートそのもの。**同意を取る対象が無い同意バナー**は作らない |
| Doppler（`doppler` skill / MCP / `mcp-doppler.md`） | 移植しない | シークレットは **Amplify secrets（SSM）**。`aws-first.md` |
| pgTAP / `test-db` | 移植しない | DynamoDB に相当物が無い。認可の検証は **sandbox への統合テスト + Maestro** で行う |
| git-hooks（prek）+ `devenv test` の 2 段構成 | 未導入 | 検査は `ci-check` に単一化した。コミット時の差分チェックを足すかは別途判断 |
