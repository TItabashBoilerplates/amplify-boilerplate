# Contributing to shadcn-boilerplate

shadcn-boilerplateへのコントリビューションに興味を持っていただきありがとうございます！

## 開発環境のセットアップ

### 必要な環境

- AWS 認証情報（`ampx sandbox` / デプロイ用のプロファイル）
- [devenv](https://devenv.sh/getting-started/) (Nix ベースの開発環境)
- [direnv](https://direnv.net/) + シェルフック設定 (`eval "$(direnv hook zsh)"`)

> **`make` は不要です**。日常コマンドはすべて devenv の **scripts** (PATH 直結) と **tasks** (`devenv tasks run <name>`) で提供されます。詳細なツール一覧 / インストール手順は [`README.md` の Setup](README.md#setup) を参照。

### セットアップ手順

1. リポジトリをクローン
   ```bash
   git clone https://github.com/[your-org]/shadcn-boilerplate.git
   cd shadcn-boilerplate
   ```

2. 初回のみ direnv を許可
   ```bash
   direnv allow
   ```

   `cd` するだけで以下が **自動実行** されます (`devenv` の `setup:*` task / `before = [ "devenv:enterShell" ]` + `execIfModified`):

   - Node.js / Bun / Python / uv のツールチェーン提供
   - `bun install --frozen-lockfile` (frontend、lockfile 変更検知時)
   - `uv sync --frozen --group dev` (backend-py)

   シークレットは **Amplify secrets（SSM Parameter Store）管理**。`ampx sandbox secret set NAME` で
   設定し、バックエンド定義から `secret('NAME')` で参照する。

3. Amplify backend (sandbox) を起動（AWS 認証情報が必要）
   ```bash
   sandbox     # ampx sandbox（per-dev クラウド sandbox + amplify_outputs.json 生成、watch）
   ```
   ※ 事前に AWS プロファイル（認証情報）を設定しておく。1 回だけ反映したい場合は `sandbox-once`、破棄は `sandbox-delete`。

4. 開発サーバーを起動

   ```bash
   # Next.js (web)
   dev-web

   # Expo Metro (mobile)
   dev-mobile

   # Storybook
   storybook

   # 任意組み合わせ
   devenv up <names...>
   ```

   停止は `stop` (devenv プロセスを停止)。

> Makefile は deprecated。`make X` は実行不可です（リポジトリ直下に Makefile はありません）。

## コードスタイル

統一規約は [`README.md`](README.md#unified-code-quality) と `.claude/rules/` 配下を参照。

### Frontend & Amplify backend (Biome)

```bash
lint-frontend         # Biome lint (auto-fix)
format-frontend       # Biome format (auto-fix)
type-check-frontend   # tsc --noEmit (キャッシュあり)
```

### Backend Python (Ruff + MyPy)

```bash
lint-backend-py       # Ruff check (auto-fix)
format-backend-py     # Ruff format (auto-fix)
type-check-backend-py # MyPy (キャッシュあり)
```

### 統合コマンド

```bash
lint        # 全プロジェクトの lint (auto-fix)
format      # 全プロジェクトの format (auto-fix)
type-check  # 全プロジェクトの type-check (キャッシュあり、並列)
ci-check    # CI と同じフルゲート (= devenv test、execIfModified キャッシュ)
```

## テスト

```bash
unit-test         # 全 unit test (test-frontend + test-backend-py)
test-frontend     # Vitest
test-backend-py   # pytest
e2e / e2e-web / e2e-mobile   # Maestro E2E
```

詳細な TDD ポリシーは `.claude/rules/tdd.md` を参照。**作業終了時は必ず All Green を確認すること。**

## コミット前の確認

プルリクエストを作成する前に必ず:

```bash
ci-check          # = devenv test (lint + format-check + type-check 全部、キャッシュ済み)
```

git-hooks (prek 駆動) が変更ファイルだけを高速 lint/format/type-check するので、コミット時点でも基本ゲートは通ります。`ci-check` はその上での包括的な確認です。

## 新しいフロントエンドアプリを追加する

`frontend/apps/<name>/` を作成し、`devenv.nix` の `frontendApps` attrset に 1 行追加するだけで:

- `processes.<name>` (opt-in 起動)
- `scripts.dev-<name>` (backend + storybook + 当該アプリの起動プリセット)
- `scripts.dev-all` (全アプリ起動)

がすべて自動連動します。

```nix
# devenv.nix
frontendApps = {
  web    = { port = 3000; };
  mobile = { port = 8081; ready = "/status"; exec = ''…''; };
  admin  = { port = 3001; };   # ← この 1 行を追加するだけ
};
```

## プルリクエストの作成

1. feature branch を作成
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. 変更をコミット (Conventional Commits)
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. `ci-check` を実行してすべてのチェックをパス

4. プッシュしてプルリクエストを作成
   ```bash
   git push origin feature/your-feature-name
   ```

5. GitHub 上でプルリクエストを作成し、詳細な説明を記載

## コミットメッセージのガイドライン

[Conventional Commits](https://www.conventionalcommits.org/) 形式を推奨します:

- `feat:` 新機能追加
- `fix:` バグ修正
- `docs:` ドキュメント変更
- `style:` コードスタイルの変更（機能に影響なし）
- `refactor:` リファクタリング
- `test:` テストの追加・修正
- `chore:` ビルドプロセスやツールの変更

例:

```
feat: add user authentication with Cognito Email OTP
fix: resolve hydration error in DateDisplay component
docs: update setup instructions in README
```

## 質問や問題がある場合

- GitHub Issues で質問を作成してください
- 既存の Issues を確認して、同じ質問がないか確認してください

## ライセンス

このプロジェクトにコントリビュートすることで、あなたの貢献が MIT ライセンスの下でライセンスされることに同意したものとみなされます。
