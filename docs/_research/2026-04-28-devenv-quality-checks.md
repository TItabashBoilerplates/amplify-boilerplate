# devenv 品質チェック ベストプラクティス 調査レポート

## 調査情報

- **調査日**: 2026-04-28
- **対象**: devenv 2.0 系列における lint / format / type-check / pre-commit のベストプラクティス
- **一次情報**:
  - 公式 git-hooks: <https://devenv.sh/git-hooks/>
  - 公式 tasks: <https://devenv.sh/tasks/>
  - 公式 tests: <https://devenv.sh/tests/>
  - 公式 monorepo guide: <https://devenv.sh/guides/monorepo/>
  - 公式 release blog: 1.7 / 1.10 / devlog 2025-07-25
  - git-hooks.nix README: <https://github.com/cachix/git-hooks.nix>
  - git-hooks.nix module source: `modules/hooks.nix`
  - tasks.nix module source: `src/modules/tasks.nix`

---

## 1. 公式の推奨アーキテクチャ

git-hooks ドキュメントが明示している推奨パターン (引用):

> 1. **Make sure that commits are well-formatted at commit time** using git-hooks
> 2. **Verify formatting in CI** via `devenv test`

つまり **2 段階構成**:

```
[コミット時] git-hooks (pre-commit) — 変更ファイルだけ高速チェック
[CI/手動]    devenv test (enterTest) — 全プロジェクト verify (キャッシュ込み)
```

両方を tasks/scripts に統合するのは過剰設計。役割を分けるのが公式の意図。

---

## 2. git-hooks (commit-time)

### 2.1 ビルトインフック (大量に揃っている)

git-hooks.nix がカバーする言語別の主要ビルトイン:

| 言語 | ビルトイン |
|---|---|
| **JS/TS** | `biome`, `eslint`, `prettier`, `oxlint`, `oxfmt`, `denofmt`, `denolint` |
| **Python** | `ruff`, `ruff-format`, `mypy`, `black`, `flake8`, `isort`, `pylint`, `pyupgrade` |
| **Rust** | `clippy`, `rustfmt`, `cargo-check` |
| **Nix** | `nixfmt`, `alejandra`, `deadnix`, `nil` |
| **Shell** | `shellcheck`, `shfmt`, `beautysh` |
| **その他** | `markdownlint`, `mdformat`, `lychee`, `dockerfile-lint`, `golangci-lint`, ... |

### 2.2 デフォルト設定の品質

ビルトインは主要ツールの `types_or` / `files` を **適切にプリセット済み**。例 (`modules/hooks.nix`):

```nix
biome = {
  entry = "${binPath} check ${cmdArgs}";
  types_or = [ "javascript" "jsx" "ts" "tsx" "json" ];
  # 設定: write (default true), configPath (default "")
};
```

```nix
ruff = {
  entry = "${tools.ruff}/bin/ruff";
  types_or = [ "python" ];
};
```

### 2.3 prek (Rust 実装) がデフォルト

devenv は `pre-commit` を **prek (Rust 実装)** で置き換え済み (devlog より)。pre-commit の Python オーバーヘッドを排除し起動が高速。

### 2.4 `pass_filenames` のデフォルトは `true`

カスタム hook を書かない限り `pass_filenames = true` で、**変更ファイル一覧だけが渡される**:

> "Set this to false to not pass the changed files to the command (default: true)"

これにより `biome check src/changed.ts src/another.ts` のような呼び出しになり、プロジェクト全体ではなく差分だけスキャン。

### 2.5 アンチパターン (現状)

このプロジェクトの現行設定はカスタム hook で:

```nix
frontend-lint = {
  entry = "devenv tasks run lint-ci:frontend";
  pass_filenames = false;   # ← 全ファイルを舐める
};
```

問題点:
- `devenv tasks run` の起動オーバーヘッド (~200ms) が毎コミット incur
- `pass_filenames = false` で変更ファイル絞り込みが効いていない
- task に `execIfModified` がないので毎回フル lint 実行

---

## 3. tasks (CI gate / verify)

### 3.1 `execIfModified` の実体

tasks.nix module options より:

```nix
execIfModified = lib.mkOption {
  type = types.listOf types.str;
  default = [ ];
  description = ''
    Paths to files that should trigger a task execution if modified.
  '';
};
```

実際の cache 判定は **`devenv-tasks` Rust binary** が担当 (`tasks.nix` から CLI に config 引き渡し):
- `--cache-dir ${config.devenv.dotfile}` (= `.devenv/`)
- mtime + content hash 両方で変更検知 (false positive 抑止)

公式説明 (引用):

> "The system tracks both file modification times and content hashes to detect actual changes."

> "Tasks now skip execution when their input files haven't changed, using the new `execIfModified` option" (1.7 release)

### 3.2 出力キャッシュ復元

> "When a task is skipped due to no file changes, any previous outputs from that task are preserved and passed to dependent tasks, making the caching more efficient."

→ 集約 task で `after = [ "lint-ci:frontend" "lint-ci:drizzle" ... ]` のように依存させると、子タスクのキャッシュヒットを横断的に享受。

### 3.3 制約: `status` と `execIfModified` は **同時指定不可**

`tasks.nix` のアサーション (引用済):

```nix
assertion = lib.all
  (task: task.status == null || task.execIfModified == [ ])
  (lib.attrValues config.tasks);
message = "The 'status' and 'execIfModified' options cannot be used together. ...";
```

→ verify task は `execIfModified`、ファイル存在等の条件分岐は `status` と用途で分ける。

### 3.4 namespace prefix match (1.7+)

```bash
$ devenv tasks run lint-ci    # → lint-ci:frontend, lint-ci:drizzle, ... 全部並列実行
```

依存グラフ内で並列実行可能な task は **devenv-tasks が自動で並列スケジュール**。CPU 効率が上がる。

---

## 4. `devenv test` + `enterTest`

### 4.1 仕組み

> "Running `devenv test` will build your environment and run the tests defined in `enterTest`."

> "If you have processes defined in your environment, they will be started and stopped for you."

`enterTest` は文字列スクリプトでも、tasks の `before = [ "devenv:enterTest" ]` でも hook 可能。後者が公式推奨:

> "consider using tasks with the `before` attribute"

### 4.2 推奨パターン

```nix
tasks."ci:check" = {
  before = [ "devenv:enterTest" ];
  after = [ "lint-ci:frontend" "lint-ci:drizzle" "format-check:frontend" "type-check:frontend" ... ];
  exec = "echo '✅ All CI checks passed'";
};
```

→ `devenv test` 一発で全 verify (キャッシュ込み)。**ローカルと CI が同じコマンド** = 環境差ゼロ。

---

## 5. scripts / processes との使い分け

「convergent configuration」 (1.2 release blog 由来) の哲学:

| レイヤー | 使いどころ |
|---|---|
| **scripts** | ユーザーが直接打つ単発便利コマンド、依存・キャッシュ不要 |
| **tasks** | 依存・条件実行・キャッシュが必要 (CI gate, セットアップ chain) |
| **processes** | 長時間常駐サービス (devenv 2.0 では内部的に task) |
| **git-hooks** | コミット時の差分ベース fast check |

scripts では namespace match (`devenv tasks run lint-ci` のような prefix) が効かない。tasks 配下に置く場合は scripts は wrapper として `exec devenv tasks run <ns>` に。

---

## 6. 監視ファイル glob のベストプラクティス

`execIfModified` glob 設計時の注意:

| 観点 | 推奨 |
|---|---|
| **ソースファイル** | `frontend/**/*.{ts,tsx,js,jsx,json}` のように拡張子も網羅 |
| **設定ファイル** | `frontend/biome.json`, `frontend/tsconfig*.json`, `frontend/**/package.json` も含める (ルール変更で再 lint 必要) |
| **lockfile は除外** | install task と target が違う |
| **node_modules / .venv 除外** | 自動的に除外されるが念のため明示 glob しない |
| **auto-fix 系には付けない** | exec が自分でファイル書き換える → ループ化 (issue #2497) |

---

## 7. CI 統合

### 7.1 推奨パターン

```yaml
# .github/workflows/ci.yml
- uses: cachix/install-nix-action@v...
- uses: cachix/cachix-action@v...
  with:
    name: devenv
- run: nix profile install nixpkgs#devenv
- run: devenv test     # ← 全 verify が一発で走る (キャッシュも効く)
```

### 7.2 ローカルと CI の対称性

`devenv test` 一本にすることで:
- ローカル `devenv test` ≡ CI `devenv test` (バイト単位で同じコマンド)
- CI 環境で「ローカルでは通ったのに CI で落ちる」問題を排除

---

## 8. このプロジェクト向けの最終推奨設計

### 8.1 git-hooks: ビルトイン 1 行宣言

```nix
git-hooks.hooks = {
  biome.enable = true;          # JS/TS/JSON、変更ファイルだけ
  ruff.enable = true;           # Python lint
  ruff-format.enable = true;    # Python format
  mypy.enable = true;           # Python type
  denofmt = {
    enable = true;
    files = "^supabase/functions/";
  };
  denolint = {
    enable = true;
    files = "^supabase/functions/";
  };
};
```

### 8.2 tasks: namespace + execIfModified

```nix
tasks = {
  # ----- Lint (CI mode、auto-fix なし、execIfModified キャッシュ) -----
  "lint-ci:frontend" = {
    exec = ''cd "$DEVENV_ROOT/frontend" && nr lint:ci'';
    execIfModified = [
      "frontend/**/*.ts" "frontend/**/*.tsx"
      "frontend/**/*.js" "frontend/**/*.jsx" "frontend/**/*.json"
      "frontend/biome.json"
    ];
  };
  "lint-ci:drizzle"    = { ... };
  "lint-ci:backend-py" = { ... };
  "lint-ci:functions"  = { ... };

  # ----- Format check -----
  "format-check:frontend"   = { ... execIfModified = [...]; };
  # 各 sub-project

  # ----- Type check -----
  "type-check:frontend"   = { ... execIfModified = [...]; };
  # 各 sub-project

  # ----- aggregator (devenv test に紐付け) -----
  "ci:check" = {
    before = [ "devenv:enterTest" ];
    after = [
      "lint-ci:frontend" "lint-ci:drizzle" "lint-ci:backend-py" "lint-ci:functions"
      "format-check:frontend" "format-check:drizzle" "format-check:backend-py" "format-check:functions"
      "type-check:frontend" "type-check:mobile" "type-check:backend-py" "type-check:functions"
    ];
    exec = "echo '✅ All CI checks passed'";
  };
};
```

### 8.3 scripts: ユーザー入口

```nix
scripts = {
  # auto-fix 系: 単純 sequential (キャッシュ不要、副作用ループ回避)
  lint   = { exec = ''sequential auto-fix...''; };
  format = { exec = ''sequential auto-fix...''; };

  # CI gate: devenv test 経由 (tasks のキャッシュを最大活用)
  ci-check = { exec = "exec devenv test"; };

  # 個別サブプロジェクト系は維持 (人間が明示的に叩く)
  lint-frontend / format-frontend / type-check-frontend / ...
};
```

### 8.4 効果

| シナリオ | 現状 | 推奨設計 |
|---|---|---|
| `git commit` (frontend 1ファイル変更) | devenv task 起動 + 全 frontend lint (~5s+) | biome built-in が変更ファイルのみ実行 (<200ms) |
| `git commit` (Python 1ファイル変更) | task 起動 + ruff 全実行 | ruff が変更ファイルのみ実行 (<100ms) |
| `ci-check` 直後の再実行 | 全部走る | 全 task キャッシュヒット、数秒 |
| 一部だけ変更 | 全部走る | 影響 task のみ実行 |
| ローカルと CI のコマンド | 別 (`ci-check` script vs CI yaml) | 統一 (`devenv test` 一本) |

---

## 9. 既知のトラップ

| 注意点 | 対策 |
|---|---|
| auto-fix 系に `execIfModified` を付けると fork bomb (#2497) | auto-fix は scripts のみ、execIfModified なし |
| `pass_filenames = false` のカスタム hook は変更絞り込みが効かない | ビルトインを使う or `pass_filenames = true` (default) |
| `status` と `execIfModified` 同時指定はモジュールアサーション失敗 | 用途で使い分け |
| ビルトイン hook は Nix 提供版バイナリを使う (プロジェクトの bun 経由 biome と version drift 可能性) | 通常は許容範囲。完全一致が必要なら `binPath` 上書き or カスタム hook |
| enterShell タスクで git tracked file を書き換えると fork bomb | `--frozen-lockfile` / `--frozen` で防ぐ (現状実施済) |
| `--mode all` で `@complete` 失敗時に direnv が壊れる (#2480) | デフォルト `--mode single` を維持 |

---

## 10. 参考リンク

- [Tasks - devenv](https://devenv.sh/tasks/)
- [Git hooks - devenv](https://devenv.sh/git-hooks/)
- [Tests - devenv](https://devenv.sh/tests/)
- [Monorepo - devenv](https://devenv.sh/guides/monorepo/)
- [Processes - devenv](https://devenv.sh/processes/)
- [git-hooks.nix README](https://github.com/cachix/git-hooks.nix)
- [git-hooks.nix modules/hooks.nix](https://github.com/cachix/git-hooks.nix/blob/master/modules/hooks.nix)
- [devenv 1.7 release](https://devenv.sh/blog/2025/07/03/) — execIfModified, namespace match
- [devenv 1.10 release](https://devenv.sh/blog/2025/10/07/) — monorepo support
- [devlog: Processes are now tasks (2025-07-25)](https://devenv.sh/blog/2025/07/25/devenv-devlog-processes-are-now-tasks/)
- [devenv 2.0 release (2026-03-05)](https://devenv.sh/blog/2026/03/05/)
- [Issue #2497: enterShell fork bomb](https://github.com/cachix/devenv/issues/2497)
- [Issue #2480: --mode all bug](https://github.com/cachix/devenv/issues/2480)
