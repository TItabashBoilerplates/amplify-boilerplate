---
title: "devenvで構築する最強の開発環境 ─ Vibe Coding時代に効くNixベース宣言的セットアップ"
emoji: "⚡"
type: "tech"
topics: ["devenv", "nix", "vibecoding", "ai", "dx"]
published: false
---

## はじめに

Cursor / Claude Code / Codex のようなAIコーディングアシスタントが日常的に手を動かす時代になり、開発の「正解」が変わってきています。

数年前まで開発環境構築は「READMEを見ながら半日かけて手を動かす儀式」でした。いまや AI がコマンドを叩き、依存を入れ、サーバーを起動し、テストを書き、コミットまでする時代です。**人間が触る前に AI が触る環境**になりつつあります。

この前提に立つと、開発環境に求められる要件は大きく変わります。

- **環境差ゼロ**：AI が叩いたコマンドがローカルでも CI でも同じ結果になる
- **コマンドの一貫性**：AI が学習しやすいよう、すべてのコマンドが同じインターフェースで PATH 上にある
- **自己修復性**：依存が壊れたら自動で直る（AI に毎回手順を教えなくていい）
- **観測可能性**：AI が暴走してもログ・プロセス状態を人間がいつでも横から見られる
- **AI ガードレール**：プロジェクト規約・ベストプラクティスを AI に注入する仕組みが組み込まれている

これらをすべて満たす答えが **devenv** でした。本記事では、Next.js 16 + Expo 55 + FastAPI + Supabase + Drizzle ORM のフルスタック・モノレポを **devenv 2.0** で構築した実例を題材に、**Vibe Coding 時代に効く開発環境の作り方**を解説します。

:::message
**この記事でわかること**
- なぜ Docker Compose / asdf / mise ではなく devenv なのか
- devenv 2.0 の processes / tasks / scripts / profiles を使った宣言的セットアップ
- Vibe Coding（AIエージェント主導開発）との具体的な親和性ポイント
- ローカルと CI で同じコマンドが動く CI/CD 統合
- 実運用で踏んだハマりどころと回避策
:::

**対象読者**：モノレポ・フルスタック開発に関わるエンジニアで、AI コーディングアシスタントを日常的に使っている方
**動作環境**：macOS / Linux / WSL2、Docker Desktop、Nix、devenv 1.7+

---

## なぜ devenv なのか

開発環境ツールの選択肢を整理すると、それぞれが解いている課題が違います。

| ツール | 強み | 弱み |
|---|---|---|
| **Docker Compose** | 完全な隔離、本番に近い再現性 | ホスト側ツール（エディタ・LSP）と分断される、起動が重い、ファイル監視がスローダウン |
| **asdf / mise** | ランタイムバージョン管理だけならシンプル | DB・補助プロセス・タスク・hook までは面倒を見ない |
| **direnv 単体** | env 切替だけは強力 | ツールチェイン自体は別途インストール必要 |
| **devenv** | Nix で**ランタイム・DB・タスク・hook・CI を 1 ファイル**に宣言、direnv 連携、process manager 同梱 | Nix の学習コスト、初回ビルドが重い |

特に Vibe Coding 文脈で効くのは「**ホスト OS のシェルから素のコマンドとして全部叩ける**」点です。Docker コンテナの中にいると AI エージェントが叩く `npm run dev` がコンテナ内シェルなのかホストなのかでブレますが、devenv は `cd` した瞬間にホストシェル上の PATH を切り替えるだけなので、**AI が叩くコマンドの実行コンテキストが常に一意**になります。

:::message
**ポイント**：devenv は「Docker の代替」ではなく「Docker と asdf と direnv と Make と pre-commit を 1 ファイルに統合するメタツール」と捉えるのが正しい。Supabase のような Postgres + Auth + Storage を丸ごと立てたい用途は Docker（Supabase CLI）に任せ、それ以外のランタイム・プロセス・タスクを devenv で扱う、というハイブリッドが実用的です。
:::

---

## devenv とは何か

[devenv](https://devenv.sh/) は Nix ベースの宣言的開発環境ツールです。`devenv.nix` 1 ファイルに以下をすべて記述できます。

- **languages**：ランタイム（Node.js / Python / Deno など）とそのバージョン
- **packages**：CLI ツール（supabase-cli, maestro など）
- **processes**：常駐サービス（dev server, backend など）
- **tasks**：依存グラフ付きのバッチコマンド（migration, build など）
- **scripts**：PATH に直結する単発スクリプト
- **profiles**：環境ごとの env 切替（local / dev / staging / production）
- **git-hooks**：pre-commit hook の宣言
- **enterShell** / **enterTest**：環境進入時の hook

`devenv.lock` で全パッケージのハッシュが固定されるので、**チームメンバー・CI ランナー全員が同じバイナリ**を使えます。`asdf` の `.tool-versions` と違って、Node.js を入れる Nix derivation のハッシュまで固定されているので「同じ Node 22.x でもパッチが違って動かない」のような事故が起きません。

---

## devenv の主要機能と組み立てパターン

`devenv.nix` で扱う構成要素は **8 つ**に整理できます。スタックが何であれ（Node / Python / Go / Rust / どんな組み合わせでも）、この 8 つの組み立て方さえ押さえれば応用が利きます。

| 構成要素 | 役割 |
|---|---|
| `.envrc` | direnv フック。`cd` で自動アクティベート |
| `languages` | ランタイム宣言（Node / Python / Deno / Go / Rust 等） |
| `packages` | CLI ツール（DB クライアント、E2E ランナー等） |
| `profiles` | 環境別 env ファイルの切替（local / staging / production） |
| `processes` | 常駐サービス（dev server, API, DB 等）と起動順序 |
| `tasks` | 依存グラフ付きバッチ（migration, build, deploy 等） |
| `scripts` | PATH 直結の単発コマンド（lint, format 等） |
| `git-hooks` | コミット時の自動チェック |

ここから順に「**最小限のコードでパターンを示す**」スタイルで紹介します。具体例はフルスタック・モノレポ（フロント + バック + DB + Edge Functions）を想定しますが、同じ構造はどんなスタックでも適用できます。

### 0. プロジェクトの最小構成

```
your-project/
├── devenv.nix          # 開発環境の全宣言
├── devenv.yaml         # 入力ソース定義（nixpkgs 等）
├── devenv.lock         # 依存ハッシュ固定
├── .envrc              # direnv フック
└── env/                # profile 別 env ファイル
    ├── <service>/.env.local
    └── .env.secrets    # gitignore
```

`.envrc` は 2 行だけ。

```bash
#!/usr/bin/env bash
eval "$(devenv direnvrc)"
use devenv
```

`cd your-project` した瞬間に direnv が devenv を起動し、宣言したランタイム・CLI ツールが PATH に揃います。**ローカル開発の起点はこの 1 アクションだけ**になります。

### 1. languages：ランタイムを 1 ファイルで宣言

```nix
languages.javascript = {
  enable = true;
  package = pkgs.nodejs_22;
  bun.enable = true;
};

languages.python = {
  enable = true;
  package = pkgs.python313;
  uv.enable = true;
};

languages.deno.enable = true;
languages.typescript.enable = true;
```

これだけで指定バージョンのランタイム + パッケージマネージャ（bun, uv 等）が **`devenv.lock` 固定**で入ります。`asdf` の `.tool-versions` と違って Nix derivation のハッシュまで固定されているので「同じ Node 22.x でもパッチが違って動かない」事故が起きません。

### 2. profiles：local が既定、後勝ちで上書き

環境ごとに env を切り替えるパターン。base の `enterShell` で local env をロードし、`-P staging` などを付けたときは profile の `enterShell` が後追いで実行され、`set -a; source` の **後勝ち動作で上書き**されます。

```nix
let
  loadEnvForProfile = profileName: ''
    set -a
    for f in env/*/.env.${profileName}; do [ -f "$f" ] && . "$f"; done
    [ -f "env/.env.secrets" ] && . "env/.env.secrets"
    set +a
  '';
in {
  profiles = {
    dev.module.enterShell        = loadEnvForProfile "dev";
    staging.module.enterShell    = loadEnvForProfile "staging";
    production.module.enterShell = loadEnvForProfile "production";
  };

  enterShell = ''
    ${loadEnvForProfile "local"}
  '';
}
```

使い方：

```bash
devenv up                                  # local 環境で起動（既定）
devenv shell -P staging -- <command>       # staging env で何か実行
devenv tasks run -P production deploy      # production にデプロイ
```

:::details なぜ devenv 標準の dotenv.enable を使わないのか
devenv 標準の `dotenv.enable` は `dotenv.filename` が `.env` プレフィックス必須で、`env/<service>/.env.local` のような階層パスを受け付けません（モジュールの assertion）。さらに内蔵パーサが `KEY="value"` のクォートを文字通り保持してしまうため、bash の `set -a; source` を使う方式に統一しています。bash のパーサはクォート・エスケープ・コメントを正しく処理してくれます。
:::

### 3. processes：常駐サービスを TUI で束ねる

devenv 2.0 の **native process manager** は process-compose の代替で、**Rust 実装の TUI が同梱**されています。`devenv up` を叩くと宣言した常駐サービスが立ち上がり、リアルタイムログ閲覧・個別プロセス再起動がキーボード操作でできます。

```nix
processes = {
  api = {
    exec = ''cd backend && exec ./run-server'';
    ready.http.get = { host = "127.0.0.1"; port = 4040; path = "/healthcheck"; };
  };

  docs = {
    exec = ''cd docs && exec npx serve --port 6006'';
    ready.http.get = { host = "127.0.0.1"; port = 6006; path = "/"; };
  };
};
```

`ready.http.get` を指定しておくと「次のプロセスを起動する前に healthcheck エンドポイントが返ってくるまで待つ」処理が自動で挟まります。**起動順序の保証がコードでなく宣言で書ける**のがポイントです。

### 4. tasks：依存グラフ付きバッチ

タスクは Make に近い感覚で書けますが、**`before` / `after` で依存解決**、`execIfModified` で**差分のみ実行**できます。

```nix
# DB 起動 → API は DB の後に起動する
"db:start" = {
  exec = ''docker compose up -d db && wait-for-it db:5432'';
  before = [ "devenv:processes:api" ];
};

# マイグレーション後に型生成、までを 1 タスクに連結
"app:migrate" = {
  exec = ''
    cd db && ./migrate.sh
    cd .. && devenv tasks run model:build
  '';
  after = [ "db:start" ];
};

# 型生成は別タスクに切り出して再利用
"model:build".exec = ''gen-types > types/schema.ts'';
```

`devenv up` 一発で **DB 起動 → API 起動**の順に立ち上がり、`devenv tasks run app:migrate` を叩けば **DB が起動済みであることを保証した上で**マイグレーション → 型生成のパイプラインが流れる、という宣言的な書き方になります。

### 5. CI gate：execIfModified で incremental skip

CI チェックは `devenv test` で起動する **aggregator task** に集約するパターンが効きます。

```nix
"lint-ci:frontend" = {
  exec = ''cd frontend && bun run lint:ci'';
  execIfModified = [ "frontend/**/*.ts" "frontend/**/*.tsx" ];
};

"type-check:backend" = {
  exec = ''cd backend && mypy src/'';
  execIfModified = [ "backend/**/*.py" "backend/pyproject.toml" ];
};

# 全 verify を 1 つに束ねる
"ci:check" = {
  exec = ''echo "✅ All CI checks passed"'';
  before = [ "devenv:enterTest" ];
  after = [
    "lint-ci:frontend"
    "type-check:backend"
    # ... 他の verify task をすべて列挙
  ];
};
```

`execIfModified` は **mtime + content hash** で変更を検知するので、関係ないファイルしか触ってなければ全タスクがキャッシュヒットで秒で終わります。**ローカルでも CI でも同じ `devenv test` 一発**で済むのが大きい。

### 6. scripts：PATH に直結する単発コマンド

「コマンド名そのまま」で叩けるスクリプトを定義できます。**Make の代替として最も効くのがこの仕組み**です。

```nix
scripts = {
  "lint"     = { exec = ''set -e; lint-frontend; lint-backend''; };
  "format"   = { exec = ''set -e; format-frontend; format-backend''; };
  "ci-check" = { exec = ''exec devenv test''; };
  "stop"     = { exec = ''exec devenv tasks run app:stop''; };
};
```

`devenv shell` 内では `lint` / `format` / `ci-check` / `stop` がすべて **PATH に直接生えたコマンド**として叩けます。AI に「何のコマンドを叩けばいいか」を覚えてもらうコストが激減します。

:::message alert
**スクリプト名の地雷**：bash 組み込みコマンドと衝突する名前は避けること。`test` という名前で script を定義すると、bash が builtin の `test`（`[` と等価）を優先して呼ぶため、CI で `run: test` を呼ぶと「引数なしの builtin `test` が exit 1 を返してジョブが落ちる」という事故が起きます。**実際に踏みました**。`unit-test` のようにハイフン付きの名前にすれば安全です。
:::

### 7. git-hooks：prek + ビルトインフック

pre-commit hook は `git-hooks.nix` 経由で**ツール名 1 行で有効化**できます。言語別に有効化したい hook を列挙するだけ。

```nix
git-hooks.hooks = {
  # JS/TS：1 行で有効化（ビルトインが types_or / pass_filenames を適切にプリセット済み）
  biome.enable = true;

  # Python
  ruff.enable        = true;
  ruff-format.enable = true;
  mypy.enable        = true;

  # 必要なら files で対象を絞ったり、entry でコマンドを上書きしたり
  # 例: mypy をプロジェクト単位で実行
  # mypy = {
  #   enable = true;
  #   pass_filenames = false;
  #   entry = lib.mkForce "<command>";
  # };
};
```

`prek`（Rust 実装の pre-commit）が駆動するので Python オーバーヘッドなし、**コミット 1 回 200ms 未満**で全 lint が回ります。

### 8. enterShell：依存自動同期

`setup:*` タスクを `before = [ "devenv:enterShell" ]` に紐付けると、`devenv shell` に入った瞬間（= direnv で `cd` した瞬間）に「lockfile が変わってたら依存を入れ直す」処理が自動で走ります。

```nix
"setup:install-frontend" = {
  exec = ''cd frontend && bun install --frozen-lockfile'';
  execIfModified = [
    "frontend/bun.lock"
    "frontend/package.json"
  ];
  before = [ "devenv:enterShell" ];
};
```

`execIfModified` のおかげで「lockfile に変更が無いときはスキップ」されるので、毎回ターミナルを開くたびに `bun install` が走ることはありません。`--frozen-lockfile` で lockfile の意図しない書き換えも防止しています。

これを言語ごとに 1 つずつ定義すれば、**pull してきた直後の `cd` だけで全依存が同期される**状態になります。新メンバーが入ったときの「動かないんですけど」がほぼ消えます。

---

## Vibe Coding との親和性 ─ ここが本題

ここまでは「便利な開発環境ツール」の話でしたが、**Vibe Coding（AIエージェント主導開発）の観点で何が嬉しいのか**を整理します。これが本記事のキモです。

### 1. AI が叩くコマンドの実行コンテキストが一意

Docker Compose ベースの開発環境では「コンテナの中で `npm install` するの？ ホストで？」が常に曖昧で、AI に指示を出しても外す確率が高い。devenv は **ホストシェル上の PATH を切り替えるだけ**なので、AI が `lint` と叩けばホスト OS 上で `lint` が動きます。コマンドの実行コンテキストが常に「ホストシェル + devenv 環境」の 1 種類しかない。

### 2. PATH 抽象化で AI の学習コストが最小

`lint`、`format`、`ci-check`、`stop`、`dev-web`、`drizzle-studio` ─ プロジェクト内のコマンドが全部 **PATH に直生え**しています。AI が `package.json` を読んで `npm run ...` の正しい呼び出しを組み立てる必要がなく、「単語 1 つで叩ける」状態。プロジェクト固有の知識が CLAUDE.md / AGENTS.md の数行に圧縮できます。

```markdown
# CLAUDE.md (一部抜粋)
| Operation | Command |
|-----------|---------|
| Linting   | `lint`        |
| Formatting | `format`     |
| Type check | `type-check` |
| CI gate   | `ci-check`    |
```

これだけで AI は迷わずに正しいコマンドを選びます。`make` を使う案も最初は検討しましたが、Makefile は表記揺れが多くて AI が間違えやすい（タブ・スペースの差で動かない、`.PHONY` の宣言忘れ、シェルの違いなど）ので、devenv の scripts に統一しました。

### 3. devenv 自体が MCP サーバーになる

`.mcp.json` に devenv を MCP サーバーとして登録できます。

```json
{
  "mcpServers": {
    "devenv": {
      "transport": "stdio",
      "command": "devenv",
      "args": ["mcp"]
    }
  }
}
```

これで Claude Code から **devenv tasks の一覧取得・実行**が MCP 経由でできるようになります。AI が「マイグレーションを実行して」と頼まれたら `app:migrate-dev` を直接呼べる。`Bash` ツール経由で叩くより構造化されていて、何を実行したかが MCP のメッセージとして残るので監査もしやすい。

### 4. lockfile 自動同期で AI が雑に依存を変えても安全

AI が `package.json` に新しい依存を追加しても、次に `cd` した瞬間に `setup:install-frontend` task が走って `bun install --frozen-lockfile` が実行されます。**AI が `bun install` を叩き忘れるという事故が構造的に発生しません**。

`--frozen-lockfile` のおかげで、AI が誤って `package.json` だけ書き換えて lockfile を更新してない状態だとエラーで止まるので、不整合状態を放置することもありません。

### 5. profiles で「うっかり本番 DB を触る」を物理的に防ぐ

```bash
devenv tasks run app:migrate-dev                    # → local DB
devenv tasks run -P production db:migrate-deploy    # → production DB
```

AI に「`-P production` は人間の承認なしに叩くな」と CLAUDE.md で指示するだけで、ガードが効きます。env ファイル自体を分けてあるので、`-P` を付けない限り production の DATABASE_URL がそもそも PATH 上に存在しません。**AI のミスでローカル環境変数のままステージング DB を触る事故が起きない**。

### 6. TUI が人間を「ループの中」に残す

`devenv up` は Rust 製の TUI を自動起動します。**AI がプロセスを立ち上げた状態**で、人間はターミナル 1 枚をモニターとして開いておけば、各サービスのログ・再起動・状態がキーボード操作で全部見えます。

AI が暴走しても物理的に「あ、これ変だな」とすぐ気づける視認性。Vibe Coding は AI に手綱を渡すスタイルですが、**いつでも横から見られる**安心感が継続性を担保します。

### 7. CI と完全に同じコマンドが手元で動く

```yaml
# .github/workflows/ci.yml
defaults:
  run:
    shell: devenv shell bash -- -e {0}

- name: Run verify tasks
  run: |
    devenv tasks run \
      lint-ci:frontend lint-ci:drizzle lint-ci:backend-py \
      lint-ci:functions lint-ci:fsd \
      format-check:frontend ... \
      type-check:frontend ...
```

CI でも `devenv shell bash` を経由するので、**ローカルで通ったコマンドは CI でも通る**。「ローカルでは動くんだけど CI で落ちる…」のデバッグセッションが激減します。AI に「`ci-check` が通るまで直して」と頼めば、ローカルで再現できる以上 AI が責任を持って通せる。

### 8. Skills / Rules で AI ガードレール

このリポジトリでは `.claude/rules/` と `.claude/skills/` に **AI に守らせたいルールとガイダンス**を配置しています。

```
.claude/
├── rules/                  # 常に適用されるポリシー
│   ├── skills-first.md     # タスク開始前に Skill 確認・起動を必須化
│   ├── tdd.md              # テスト駆動開発
│   ├── research.md         # Research-First
│   ├── supabase-first.md   # Supabase優先アーキテクチャ
│   ├── commands.md         # devenv コマンド必須
│   └── ...
└── skills/                 # 質問時に参照するガイダンス
    ├── fsd/                # Feature Sliced Design
    ├── drizzle/            # スキーマ管理
    ├── tanstack-query/     # サーバー状態管理
    └── ...
```

`commands.md` には「品質チェックは必ず devenv の scripts を使うこと（直接 `bun run biome check` するのは禁止）」と書かれています。AI はこのルールを読み込むので、**「環境構築のお作法」が会話のたびに崩れる事態を防げる**。

devenv は「環境のスナップショット」を物理的に担保し、Skills/Rules は「AI の振る舞いのスナップショット」を担保する。**両輪が揃って初めて Vibe Coding が安定して回せる**、というのが私の実感です。

---

## Claude Code から devenv を使うための実践設定

Claude Code を使っている前提で、`.claude/settings.json` を整えると devenv との接続が一気にスムーズになります。実際にこのリポジトリで運用している設定を 5 つ紹介します。

### 1. `SessionStart` hook で direnv を自動有効化

Claude Code セッションを開始した瞬間、direnv が信頼されていないと `lint` / `ci-check` などの devenv scripts が PATH に出てきません。**毎回 `direnv allow` を AI に叩かせるのは無駄**なので、セッション開始時に自動実行します。

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "direnv allow" }
        ]
      }
    ]
  }
}
```

これだけで「Claude Code を開いた直後から devenv 環境が PATH に揃っている」状態を保証できます。Vibe Coding における **最初の摩擦をゼロにする**設定。

### 2. `PostToolUse` hook で編集後の品質チェック自動実行

ファイル編集が走るたびに、該当ドメインの `lint-*` / `format-*` / `type-check-*` を自動で叩きます。**失敗したら `exit 2` で Claude にエラーを返し、修正をリトライさせる**ループが組めます。

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/quality-check.sh",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

`quality-check.sh` の中身（抜粋）：

```bash
# devenv scripts は devenv shell (direnv) 経由で PATH に入っている。
# direnv 未活性のセッション (CI 等) では devenv shell -- 経由でフォールバックする。
run() {
  if command -v "$1" >/dev/null 2>&1; then
    "$@"
  else
    devenv shell -- "$@"
  fi
}

# Frontend (TypeScript/JavaScript/JSON)
if [[ "$file_path" =~ /frontend/.*\.(ts|tsx|js|jsx|json)$ ]]; then
  run lint-frontend       || has_error=1
  run format-frontend     || has_error=1
  run type-check-frontend || has_error=1
fi

# Backend Python / Edge Functions / Drizzle も同様...

if [ "$has_error" -eq 1 ]; then
  echo -e "\n📋 Quality Check Results:\n$results" >&2
  exit 2   # ← Claude にエラーを返して修正をリトライさせる
fi
```

ポイントは 2 つ。

- **ファイルパスから対象ドメインを推論**して、影響範囲だけチェックする（編集の度に全体 lint を走らせない）
- **PATH に直接コマンドがあれば直叩き、なければ `devenv shell --` 経由で fallback** ─ direnv が活性化していないセッション（CI からの呼び出し等）でも同じスクリプトが動く

これが効くのは、AI が「実装 → 自動 lint → エラー → 修正 → また lint」という **TDD ライクな自己修復ループ**を回すからです。人間が `ci-check` を叩くまで lint エラーに気づかない、という事態が消えます。

:::message
**Tips**：このスクリプトは `direnv allow` 済みの Claude Code セッションでは PATH 直叩きで動くので**ほぼゼロオーバーヘッド**、direnv 未活性の場面（GitHub Actions、別シェル）では `devenv shell --` 経由で**同じ結果**になります。「devenv の有効/無効を問わず同じ品質チェックが動く」というのが地味に大事。
:::

### 3. `permissions.allow` で頻出 devenv コマンドを事前許可

Claude Code は危険な Bash コマンドを毎回確認しますが、devenv 経由の品質チェック・型生成系は**毎回確認するほうがノイズ**になります。allow リストに入れて確認をスキップ。

```json
{
  "permissions": {
    "allow": [
      "Bash(lint*)",
      "Bash(format*)",
      "Bash(type-check*)",
      "Bash(check-functions)",
      "Bash(ci-check)",
      "Bash(check)",
      "Bash(build-frontend)",
      "Bash(build-storybook)",
      "Bash(test-db)",
      "Bash(e2e*)",
      "Bash(drizzle-validate)",
      "Bash(drizzle-push)",
      "Bash(supabase-start)",
      "Bash(supabase-stop)",
      "Bash(stop)",
      "Bash(devenv tasks list)",
      "Bash(devenv tasks run model:*)",
      "Bash(devenv tasks run setup:*)",
      "Bash(devenv tasks run app:stop)",
      "Bash(devenv shell -- *)"
    ]
  }
}
```

ポイントは **「ローカルで完結する読み取り / 検証 / 型生成系」だけ allow にする**こと。`devenv tasks run model:*` や `setup:*` は冪等で副作用が局所的なので毎回確認は不要、`devenv shell -- *` は direnv 未活性パスでの fallback として包括許可、という設計です。

### 4. `permissions.deny` で破壊系コマンドをハードブロック

逆に「AI に絶対叩かせたくない」コマンドは deny に明記。confirm を出さずに **問答無用で拒否**されます。

```json
{
  "permissions": {
    "deny": [
      "Bash(devenv tasks run db:migrate-deploy*)",
      "Bash(devenv tasks run deploy:*)",
      "mcp__supabase__apply_migration",
      "Bash(git push --force *)",
      "Bash(git reset --hard *)",
      "Bash(sudo *)",
      "Read(~/.ssh/**)",
      "Read(~/.aws/**)"
    ]
  }
}
```

devenv の profile 機構と組み合わせると効果絶大です。

- `db:migrate-deploy` は `-P production` を必要とする本番マイグレーション
- `deploy:*` は Supabase Edge Functions の本番デプロイ
- どちらも **AI が間違っても物理的に叩けない**

CLAUDE.md に「本番デプロイは人間承認必須」と書くだけだと AI が空気を読み損ねたときに事故が起きますが、`permissions.deny` に書けば**ガード機構として確実に効く**。設定 1 つで「AI が本番 DB を吹き飛ばす事故」を構造的に防げます。

### 5. `PreToolUse` hook で `rm -rf` をシェルレベルで検出

最後の砦として、AI が `rm -rf` 系のコマンドを組み立てたら**実行前にブロック**します。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.command' | grep -qE '\\brm\\s+(-[a-zA-Z]*r[a-zA-Z]*\\s+|.*--recursive)' && echo 'Use trash instead of rm -rf. Example: trash <path>' && exit 2 || exit 0"
          }
        ]
      }
    ]
  }
}
```

`-rf`、`-fr`、`-r --recursive` のどのバリエーションでも検出します。`exit 2` で Claude にエラーを返し、「`trash` を使え」と誘導するメッセージを返す。

:::message alert
permissions.deny で `Bash(rm -rf *)` を書くだけでは glob のマッチが甘くて漏れます（`Bash(cd somewhere && rm -rf .)` のように複合コマンドだとすり抜ける）。**hook の jq + regex マッチがいちばん堅い**。
:::

### 三重統制 ─ CLAUDE.md + rules + memory

設定だけでなく **AI に対する knowledge layer も三重に重ねて**います。

```
.claude/
├── CLAUDE.md                          # ← セッションごとに常に注入される最上位の規約
├── rules/
│   ├── commands.md                    # ← 「devenv コマンド必須、直接 bun run biome 禁止」
│   ├── skills-first.md
│   ├── tdd.md
│   └── mcp-supabase.md
└── memory/
    └── feedback_use_make_commands.md  # ← 「過去に修正された feedback」として恒久記憶
```

`feedback_use_make_commands.md` の中身は短い feedback です：

> 品質チェック（lint, format, type-check, test, build, ci-check）は **必ず devenv コマンドを使用**すること。
>
> **Why:** 元々 Makefile を使っていたが、2026-04 に devenv tasks/scripts への一本化を実施。直接 `bun run biome`, `uv run ruff`, `npx tsc` 等を叩くと環境差異・CI 不整合・profile (env) 未読み込みのリスクがある。
>
> **How to apply:** `bun run biome`, `uv run ruff`, `npx tsc` 等を直接実行しない。代わりに `lint`, `format`, `type-check`, `ci-check` などの devenv scripts を使う。

CLAUDE.md は **規約**（「こうする」）、rules は **詳細ルール**（「なぜ・どこで」）、memory は **経験則**（「過去にこういう失敗があった」）。階層を分けることで AI に対する**情報の密度と更新頻度**を適切に管理できます。

**`permissions` / `hooks` は物理的ガード、CLAUDE.md / rules / memory は知識ガード**。両方が揃って初めて Claude Code × devenv は安定動作する、というのがこのリポジトリで運用してきた結論です。

---

## モノレポでの拡張性 ─ 1 行で新規アプリを追加

`frontend/apps/<name>` 配下のアプリを 1 行で増やせる構成にしてあります。

```nix
frontendApps = {
  web   = { port = 3000; };
  mobile = {
    port = 8081;
    ready = "/status";
    exec = ''cd "$DEVENV_ROOT/frontend/apps/mobile" && exec nr start'';
  };
  # admin = { port = 3001; };   # ← 1 行追加するだけ
};
```

この attrset に 1 行追加すると以下が **すべて自動連動**します。

- `processes.<name>` ─ opt-in process として登録
- `scripts.dev-<name>` ─ `backend + storybook + <name>` を起動するプリセット
- `scripts.dev-all` ─ 起動対象に自動追加

AI に「admin アプリを追加して」と頼んだら、`devenv.nix` の 1 行と `frontend/apps/admin/` のテンプレートを作るだけで `dev-admin` コマンドが PATH に生える、という状態。**手動で覚えておくべき配線が消えます**。

---

## はまりどころと回避策

実運用で踏んだ地雷を共有します。

### 1. devenv 2.0 native process manager の終了 hook が動かない

`tasks` の `after = [ "devenv:processes:down" ]` も `process.manager.after` も、devenv 2.0 native では動作しません。Rust 実装の shutdown パスに task runner 呼び出しが入ってないためで、Issue 解決待ち。

**回避策**：Supabase の停止は `stop` script で手動運用にしています。中途半端な auto-stop を入れるより明示的にしたほうが事故が減ります。

### 2. dotenv.enable は階層パスを受け付けない

`dotenv.filename` が `.env` プレフィックス必須で、`env/backend/.env.local` のような階層パスを assertion で弾きます。

**回避策**：bash の `set -a; source` で読み込む方式（記事中の `loadEnvForProfile` 参照）。bash のパーサはクォート・エスケープを正しく扱えるので devenv 内蔵パーサより優れています。

### 3. script 名と bash builtin の衝突

`test` という名前のスクリプトを定義したら、CI で `run: test` が builtin の `test` を呼んで exit 1 で落ちました。実話です。

**回避策**：`unit-test` のようにハイフン付きの名前にする。新規 script を定義する前に `type <name>` で組み込みでないことを必ず確認する。

### 4. mypy ビルトイン hook が venv を見つけられない

`git-hooks.hooks.mypy` のビルトインはプロジェクトルートから `mypy` を直接呼ぶため、`backend-py/app/` の uv venv に入っている fastapi / sqlmodel などを解決できず import-not-found が大量に出ます。

**回避策**：`entry` を `lib.mkForce` で上書きして `cd backend-py/app && uv run mypy src/` の形にする（記事中のコード参照）。`pass_filenames = false` でファイル列を渡さずプロジェクト単位で実行します。

### 5. CI で `devenv test` を直接使うと process phase が走る

`devenv test` は `ci:check` aggregator を起動しますが、native process manager の都合で Supabase Docker / Storybook も起動してしまいます。

**回避策**：CI では `devenv test` ではなく、配下の verify task（`lint-ci:* / format-check:* / type-check:*`）を直接列挙して呼ぶ。ローカルは `devenv test` 一発、CI は task 直叩き、と使い分けます。

### 6. cache-nix-action なしの GHA cache は壊れる

旧構成は `actions/cache@v4` で `.devenv/` を抱えていましたが、`.devenv/profile` や `.devenv/gc/` が `/nix/store/...` への symlink を持つため、別 runner で restore すると参照先実体が無く `no substituter that can build it` で失敗します。

**回避策**：`cache-nix-action` で `/nix/store` 自体をキャッシュする。symlink 先の実体も揃うので壊れません。`cachix/devenv` を併用すれば cold cache でも devenv 共通依存はそこから引けます。

---

## まとめ

devenv で構築した開発環境は、**Vibe Coding 時代の要件をほぼすべて満たしてくれる**というのが現時点での結論です。

- ✅ **環境差ゼロ**：Nix で全パッケージ固定、ローカルと CI で同じシェル
- ✅ **コマンド一貫性**：PATH 直結の scripts で AI の学習コスト最小
- ✅ **自己修復性**：`setup:*` task が lockfile 変更を自動検知して `bun install` / `uv sync`
- ✅ **観測可能性**：Rust 実装の TUI でリアルタイムログ・再起動
- ✅ **AI ガードレール**：devenv MCP + Skills/Rules + profiles + 必須コマンド規約

次のステップとして、自分のプロジェクトでも以下を試してみてください。

1. `devenv init` で最小構成を作る
2. ランタイム（Node / Python など）と CLI ツールを `languages` / `packages` に列挙
3. 共通コマンドを `scripts` に移し、`make` を廃止
4. CI を `devenv shell bash --` 経由に切り替え、ローカルと同じコマンドを叩かせる
5. `.claude/rules/commands.md` のような **AI 向けコマンド規約**を 1 枚書く

「環境のスナップショット」を物理的に保証し、「AI の振る舞いのスナップショット」を Skills/Rules で保証する。**両輪が揃って初めて Vibe Coding が継続的に回せる開発体験になる**、という話でした。

## 参考

- [devenv 公式ドキュメント](https://devenv.sh/)
- [git-hooks.nix](https://github.com/cachix/git-hooks.nix)
- [cache-nix-action](https://github.com/nix-community/cache-nix-action)
- [direnv](https://direnv.net/)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [ni (package manager abstraction)](https://github.com/antfu-collective/ni)
