# devenv 2.0 Tasks 機能 調査レポート

## 調査情報

- **調査日**: 2026-04-27
- **調査者**: spec agent
- **対象**: devenv 2.0 系列の tasks 機能
- **一次情報**:
  - 公式ドキュメント: <https://devenv.sh/tasks/>
  - 公式ソース (Nix モジュール): <https://github.com/cachix/devenv/blob/main/src/modules/tasks.nix>
  - Processes ドキュメント: <https://devenv.sh/processes/>
  - Scripts ドキュメント: <https://devenv.sh/scripts/>
  - Migration to 2.0: <https://devenv.sh/guides/migrating-to-2.0/>
  - Devlog (Processes are now tasks): <https://devenv.sh/blog/2025/07/25/devenv-devlog-processes-are-now-tasks/>
  - Task Server Protocol 提案: <https://github.com/cachix/devenv/issues/1457>

---

## 1. 概要

devenv の **tasks** は、依存関係を持つコマンド実行ユニットを `devenv.nix` に宣言する仕組み。`enterShell` の代替・拡張として位置付けられており、**実行順序の明示・並列実行・条件付き実行・キャッシュ・ライフサイクルフック**を一元的に扱える。

devenv 2.0 系では「processes も内部的にすべて task になる」アーキテクチャ変更が行われており、`devenv:processes:<name>` という名前空間で process を task と同じ依存グラフに組み込めるようになった (devlog 2025-07-25)。

公式ドキュメントの構成見出し (現行):

1. Tasks
2. Defining tasks
3. enterShell / enterTest
4. Using your favourite language
5. Avoiding running expensive `exec` via `status` check
6. Executing tasks only when files have been modified
7. Inputs / Outputs
8. Shell messages
9. Passing inputs from the CLI
10. Processes as tasks
11. Git Integration
12. SDK using Task Server Protocol

---

## 2. 構文 (Syntax)

### 2.1 基本形

`devenv.nix` のトップレベルに `tasks` attribute set を置き、`"<namespace>:<name>"` をキーとする。

```nix
{ pkgs, ... }:
{
  tasks."myapp:hello" = {
    exec = ''echo "Hello, world!"'';
  };
}
```

実行:

```bash
$ devenv tasks run myapp:hello
```

### 2.2 ネームスペース慣例

- 形式は `"<namespace>:<name>"` のコロン区切り (例: `"myapp:hello"`, `"build:frontend"`, `"app:cleanup"`)
- ビルトインのライフサイクルイベントは `devenv:` ネームスペースを使う (`devenv:enterShell`, `devenv:enterTest`)
- processes 由来のタスクは `devenv:processes:<name>` という三段の名前空間
- v1.7 以降、ネームスペース名のみ指定するとマッチするタスクをまとめて並列実行できる:

```bash
$ devenv tasks run myapp     # myapp:* をすべて実行
```

> 注: ドット区切り (`app.build`) ではなくコロン区切り (`app:build`) が公式の慣例。

---

## 3. 主要フィールド一覧

公式 Nix モジュール (`src/modules/tasks.nix`) で宣言されているオプション。

### 3.1 コア

| フィールド | 型 | デフォルト | 意味 |
|---|---|---|---|
| `type` | enum: `"oneshot"` \| `"process"` | `"oneshot"` | タスクの実行モデル |
| `exec` | string \| null | `null` | 実行するコマンド本体 |
| `binary` | string \| null | `null` | `package` のデフォルトバイナリ名を上書き |
| `package` | package | `pkgs.bash` | `exec` を解釈する実行環境 (例: `config.languages.python.package`) |
| `description` | string | `""` | 人間向け説明 |
| `cwd` | string \| null | `null` | 実行時のワーキングディレクトリ。**`null` の場合は呼び出し時のカレントディレクトリ** |

公式モジュール定義 (引用):

> ```nix
> cwd = lib.mkOption {
>   type = types.nullOr types.str;
>   default = null;
>   description = "Working directory to run the task in. If not specified, the current working directory will be used.";
> };
> ```

### 3.2 実行制御

| フィールド | 型 | デフォルト | 意味 |
|---|---|---|---|
| `status` | string \| null | `null` | 事前判定コマンド。終了コード `0` で `exec` をスキップ |
| `execIfModified` | list of strings | `[]` | 監視対象ファイルパス/glob。**変更があった場合のみ** 実行 |
| `before` | list of strings | `[]` | このタスクが**先**に走るべき相手のリスト |
| `after` | list of strings | `[]` | このタスクが**後**に走るべき相手のリスト |

公式の重要制約 (`tasks.nix` のアサーション):

```nix
{
  assertion = lib.all
    (task: task.status == null || task.execIfModified == [ ])
    (lib.attrValues config.tasks);
  message = "The 'status' and 'execIfModified' options cannot be used together. Use only one of them to determine whether a task should run.";
}
```

> **status と execIfModified は同時指定禁止**。どちらか一方のみ。

### 3.3 環境・I/O

| フィールド | 型 | デフォルト | 意味 |
|---|---|---|---|
| `env` | attrs of strings | `{}` | このタスク専用の環境変数 |
| `exports` | list of strings | `[]` | 後続タスクへエクスポートする環境変数名のリスト |
| `input` | attrs of anything | `{}` | JSON エンコードされて `$DEVENV_TASK_INPUT` として渡される入力 |
| `showOutput` | bool | `false` | 成功/失敗を問わず stdout/stderr を常に表示 |

`exports` は CLI 2.0.4+ では `$DEVENV_TASK_EXPORTS_FILE` 経由でエクスポートされる (それ以前のバージョンでは stdout のエンコード経由)。

### 3.4 process タイプ専用 (`type = "process"`)

processes 統合に使う追加オプション。日常的なタスク用途では使わないが、ファクトとして列挙:

| フィールド | 型 | デフォルト | 意味 |
|---|---|---|---|
| `process.start.enable` | bool | `true` | プロセス自動起動 |
| `process.ready` | readyType \| null | `null` | readiness の判定 |
| `process.restart.on` | enum | `"on_failure"` | 再起動条件 |
| `process.restart.max` | int \| null | `5` | 最大再起動回数 |
| `process.restart.window` | unsigned int \| null | `null` | 再起動レート制御 (秒) |
| `process.ports` | attrs of port numbers | `{}` | ポート割り当て |
| `process.listen` | list of listenType | `[]` | systemd ソケット activation 設定 |
| `process.watch.paths` | list of strings | `[]` | 変更検知パス |
| `process.watch.extensions` | list of strings | `[]` | 拡張子フィルタ |
| `process.watch.ignore` | list of strings | `[]` | 除外 glob |

---

## 4. タスク間の依存関係 (before / after)

### 4.1 セマンティクス

- `before = [ "X" ]` → 「このタスクは X が走る**前に**完了している必要がある」
- `after = [ "X" ]` → 「このタスクは X が走った**後に**実行される」

### 4.2 サフィックス (process タスクとの依存で使える)

processes は内部的に task になっており、依存先には完了状態を表すサフィックスが付けられる:

| サフィックス | 意味 |
|---|---|
| `@started` | プロセスが起動した |
| `@ready` | readiness probe が通った (デフォルト) |
| `@completed` | プロセスが終了した (exit コード問わず) |
| `@succeeded` | (内部) 成功完了 |

例 (公式ドキュメントから):

```nix
processes.app-server = { exec = "node server.js"; };

tasks."app:cleanup" = {
  exec = ''
    echo "Server stopped, cleaning up..."
    rm -f ./server.pid
    rm -rf ./tmp/cache/*
  '';
  after = [ "devenv:processes:app-server" ];
};
```

```nix
processes.web-server = { exec = "python -m http.server 8080"; };

tasks."app:setup-data" = {
  exec = "echo 'Setting up data...'";
  before = [ "devenv:processes:web-server" ];
};
```

---

## 5. 実行方法 (CLI)

### 5.1 基本

```bash
# 単一タスク
$ devenv tasks run myapp:hello

# ネームスペース配下を一括 (v1.7+)
$ devenv tasks run myapp

# プロセスをタスクとして起動
$ devenv tasks run devenv:processes:web-server
```

### 5.2 入力の渡し方 (CLI)

```bash
# 個別 key=value (有効な JSON は自動パース)
$ devenv tasks run myapp:mytask --input value=42 --input name=hello

# 一括 JSON
$ devenv tasks run myapp:mytask --input-json '{"value": 42, "name": "hello"}'
```

> v2.0+: CLI で渡した入力は Nix 側で定義された `input` とマージされ、**衝突時は CLI 側が勝つ**。

### 5.3 `--mode` フラグ

`devenv tasks run` には実行範囲を制御する `--mode` フラグがある:

| 値 | 意味 |
|---|---|
| `single` (デフォルト) | 指定タスクのみ実行 |
| `before` | 指定タスク + その依存タスク (before チェーン) を実行 |
| `after` | 指定タスク + それに依存するタスク (after チェーン) を実行 |
| `all` | `before` と `after` 両方含めて実行 |

> 既知の不具合 (issue #2480): `--mode all` 利用時、`@complete` のタスクが失敗した場合に非ゼロ終了し、`direnv export fish` 等を壊すケースがある。

### 5.4 `--verbose` / `--no-tui`

- `--verbose`: 実行時の詳細ログを出力 (verbosity level = Verbose)
- `--no-tui`: TUI を無効化して `devenv up` を起動 (tasks 実行時というより全体オプション)

---

## 6. ライフサイクルイベント (enterShell / enterTest)

### 6.1 ビルトインタスクイベント

devenv はタスクシステム上に 2 つのライフサイクルポイントを公開している:

| イベント | 発火タイミング |
|---|---|
| `devenv:enterShell` | `devenv shell` でシェルに入る前、および `devenv up` でプロセス起動前 |
| `devenv:enterTest` | `devenv test` 実行前 (これ自体が `devenv:enterShell` に依存) |

これらに `before` で hook するのが、devenv 2.0 系における **`enterShell` (シェルスクリプト形式) の正統な代替** とされている。

### 6.2 サンプル

```nix
{ pkgs, lib, config, ... }:
{
  tasks = {
    "bash:hello" = {
      exec = "echo 'Hello world from bash!'";
      before = [ "devenv:enterShell" ];
    };

    "myapp:test-setup" = {
      exec = "echo 'Preparing test fixtures...'";
      before = [ "devenv:enterTest" ];
    };
  };
}
```

### 6.3 多くのモジュールが自動連携

git-hooks など devenv 内部のモジュールはこのイベントへ自分の準備タスク (例: `devenv:git-hooks:install`) を自動登録している。ユーザーが直接ハンドルする必要は通常ない。

### 6.4 既知の罠

- Issue #2497: `enterShell` 系のタスクが git 管理下のファイルを書き換えると、direnv 等の再評価ループで fork bomb 化することがある。**enterShell タスクは git tracked file を書き換えないこと**。
- Issue #2407: 状況によっては enterShell 中の task の出力が表示されないことがある (`showOutput = true` の活用検討)。

---

## 7. ワーキングディレクトリ (cwd)

- 型: `string \| null`、デフォルト `null`
- `null` のときは「呼び出し時のカレントディレクトリ」で実行される
- モノレポでリポジトリルートからの相対指定をしたい場合は `${config.git.root}` を使うのが公式推奨

```nix
{ config, ... }:
{
  tasks."build:frontend" = {
    exec = "npm run build";
    cwd = "${config.git.root}/frontend";
  };

  tasks."test:backend" = {
    exec = "cargo test";
    cwd = "${config.git.root}/backend";
  };
}
```

---

## 8. 環境変数の渡し方

### 8.1 入力 / 出力の主要変数

| 変数 | 用途 | 書き込み可? |
|---|---|---|
| `$DEVENV_TASK_INPUT` | このタスクへの入力 (JSON 文字列) | 読み取り |
| `$DEVENV_TASKS_OUTPUTS` | 依存タスク群の出力 (JSON オブジェクト) | 読み取り |
| `$DEVENV_TASK_OUTPUT_FILE` | このタスクの出力 JSON を書き込むファイルパス | 書き込み |
| `$DEVENV_TASK_EXPORTS_FILE` | 後続タスクに伝播させる環境変数を書き込むファイル | 書き込み |
| `$DEVENV_ROOT` | リポジトリルート | 読み取り |

### 8.2 サンプル (公式)

```nix
tasks."myapp:mytask" = {
  exec = ''
    echo $DEVENV_TASK_INPUT > $DEVENV_ROOT/input.json
    echo '{ "output": 1 }' > $DEVENV_TASK_OUTPUT_FILE
    echo $DEVENV_TASKS_OUTPUTS > $DEVENV_ROOT/outputs.json
  '';
  input = {
    value = 1;
  };
};
```

### 8.3 `$DEVENV_TASK_EXPORTS_FILE` のフォーマット

> Tasks write to `$DEVENV_TASK_EXPORTS_FILE` as `name\0base64(value)\0` pairs which will be set in the environment of dependent tasks.

NUL 区切りで `name` と base64 化した値を交互に書き込む (バイナリ安全)。

### 8.4 タスク固有の環境変数

`env` フィールドで宣言的に追加できる:

```nix
env = lib.mkOption {
  type = types.attrsOf types.str;
  default = { };
  description = "Environment variables to set for this task.";
};
```

### 8.5 Shell messages (v2.1+)

`$DEVENV_TASK_OUTPUT_FILE` に特別な JSON を書くと、シェル投入後にメッセージとして表示される:

```nix
tasks."myapp:info" = {
  exec = ''
    echo '{"devenv":{"messages":["Setup complete. Dashboard: http://localhost:3000"]}}' > "$DEVENV_TASK_OUTPUT_FILE"
  '';
  before = [ "devenv:enterShell" ];
};
```

---

## 9. tasks vs scripts vs processes の使い分け

| 観点 | **tasks** | **scripts** | **processes** |
|---|---|---|---|
| 主目的 | 依存グラフ・ライフサイクルフック・条件実行 | シェルから呼べる短い CLI ショートカット | 長時間稼働のサービス |
| 定義キー | `tasks."ns:name"` | `scripts.<name>.exec` | `processes.<name>.exec` |
| 並列実行 | 依存グラフに従って自動並列 | 並列概念なし (手動実行) | 同時起動 |
| 依存関係 | `before` / `after` | なし | `devenv:processes:*` の task として使える (v2.0+) |
| ライフサイクル | `devenv:enterShell` / `devenv:enterTest` に hook 可能 | hook 不可 | task 経由で hook 可能 |
| 条件付きスキップ | `status` / `execIfModified` | なし | プロセス用ヘルスチェック |
| 入出力チャネル | `$DEVENV_TASK_INPUT` / `$DEVENV_TASK_OUTPUT_FILE` 等 | shell 引数 (`"$@"`) | stdout/stderr |
| 言語 | `package` / `binary` で任意 (Python, Nu, Bash 等) | 同じく `package` / `binary` | 同様 |
| 想定実行時間 | 短〜中 (oneshot) | 短 (CLI 単発) | 長 (常駐) |
| TUI 統合 | 非対話 | 対話可 (普通の shell) | process-compose / mprocs 経由で TUI 提供 |

実装方針 (公式の推奨):

> "for operations that need to run when entering the shell, consider using tasks with the `before` attribute instead of `enterShell`. Tasks provide better control over execution order and dependencies."

→ **enterShell 文字列を書く代わりに、`before = [ "devenv:enterShell" ]` の task を書く** のが 2.0 以降のベストプラクティス。

---

## 10. サンプル集 (公式から抜粋)

### 10.1 言語パッケージで実行 (Python)

```nix
{ pkgs, lib, config, ... }:
{
  tasks = {
    "python:hello" = {
      exec = ''
        print("Hello world from Python!")
      '';
      package = config.languages.python.package;
    };
  };
}
```

### 10.2 status による条件実行 (高コスト処理のスキップ)

```nix
tasks = {
  "myapp:migrations" = {
    exec = "db-migrate";
    status = "db-needs-migrations";   # 終了 0 → exec スキップ
  };
};
```

### 10.3 ファイル変更ベースの条件実行

```nix
tasks = {
  "myapp:build" = {
    exec = "npm run build";
    execIfModified = [
      "src/**/*.ts"
      "*.json"
      "package.json"
      "src"
    ];
    cwd = "./frontend";
  };
};
```

> ファイル検知は **更新時刻と内容ハッシュ両方** を使う。スキップ時は前回の成功時の出力がキャッシュから依存タスクへ復元される。

### 10.4 処理セットアップ → プロセス起動 → 後始末

```nix
processes.app-server = { exec = "node server.js"; };

tasks = {
  "app:setup-data" = {
    exec = "echo 'Setting up...'";
    before = [ "devenv:processes:app-server" ];
  };
  "app:cleanup" = {
    exec = ''
      rm -f ./server.pid
      rm -rf ./tmp/cache/*
    '';
    after = [ "devenv:processes:app-server" ];
  };
};
```

---

## 11. ベストプラクティス

1. **`enterShell` の生スクリプトは避け、`before = [ "devenv:enterShell" ]` の task を書く**
   - 依存関係を明示でき、並列性とキャッシュ恩恵を受けられる。
2. **重い処理は `status` または `execIfModified` で必ずガードする**
   - どちらか片方のみ (同時指定はモジュールアサーションで禁止)。
   - DB マイグレーションのような外部状態依存は `status`、ビルド系は `execIfModified` が定石。
3. **モノレポの `cwd` には `${config.git.root}/...` を使う**
   - 呼び出し位置によらず安定する。
4. **タスク名はコロン区切りの 2 段以上で名前空間を切る**
   - `app:build`, `app:test`, `app:cleanup`, `db:migrate` のようにドメイン別に整理。
   - ネームスペース一括実行 (`devenv tasks run app`) のメリットを享受できる。
5. **後続タスクへ値を渡したい時は `$DEVENV_TASK_OUTPUT_FILE` か `$DEVENV_TASK_EXPORTS_FILE`**
   - 出力 JSON は依存先で `$DEVENV_TASKS_OUTPUTS` から読み取れる。
   - 環境変数として伝播したい場合は `name\0base64(value)\0` 形式で書く。
6. **enterShell タスクで git tracked file を書き換えない** (issue #2497)
   - 再評価ループで fork bomb 化する既知の地雷。
7. **対話的 / TUI 系処理は tasks に入れない**
   - tasks は依存グラフに沿って並列・非対話実行されるのが前提 (10章参照)。
   - 長時間 TUI を伴うものは `processes` (process-compose / mprocs) で扱う。
8. **`showOutput = true` を必要箇所で活用**
   - enterShell 中はデフォルトで stdout が抑制されるケースがあるため (issue #2407)。

---

## 12. 制約・既知の地雷

| 制約 | 出典 / 説明 |
|---|---|
| `status` と `execIfModified` は同時指定不可 | `tasks.nix` のアサーション |
| `cwd` のデフォルトは `null` (= 呼び出し元 cwd) | `tasks.nix` モジュール定義 |
| **対話的 (TTY) タスクや TUI ベースのタスクの公式サポートは記載なし** | 公式ドキュメント上、対話/TTY を扱う仕組みは明示されていない。TUI が必要な場合は `processes` (process-compose/mprocs) を使う設計 |
| 出力キャッシュは `status` 成功時 / ファイル未変更時に依存タスクへ復元される | 公式: "outputs are cached and restored and passed to dependent tasks" |
| `enterShell` 系タスクで git tracked file を書き換えると fork bomb 化 | issue #2497 |
| `--mode all` で `@complete` の失敗時に非ゼロ終了し direnv 連携が壊れる | issue #2480 |
| enterShell 中の出力が表示されないケースがある | issue #2407 |
| Migration to 2.0 ガイドには tasks 関連の breaking change の明示はない | (ガイド本文確認済み) |
| Task Server Protocol (任意言語で task 定義) は **提案段階** | issue #1457 |

---

## 13. 参考リンク

- [Tasks - devenv](https://devenv.sh/tasks/)
- [Processes - devenv](https://devenv.sh/processes/)
- [Scripts - devenv](https://devenv.sh/scripts/)
- [Migrating to 2.0 - devenv](https://devenv.sh/guides/migrating-to-2.0/)
- [devlog: Processes are now tasks (2025-07-25)](https://devenv.sh/blog/2025/07/25/devenv-devlog-processes-are-now-tasks/)
- [Source: src/modules/tasks.nix](https://github.com/cachix/devenv/blob/main/src/modules/tasks.nix)
- [Issue #1457: Task Server Protocol](https://github.com/cachix/devenv/issues/1457)
- [Issue #2497: enterShell tasks fork bomb](https://github.com/cachix/devenv/issues/2497)
- [Issue #2480: --mode all non-zero on @complete fail](https://github.com/cachix/devenv/issues/2480)
- [Issue #2407: enterShell task output missing](https://github.com/cachix/devenv/issues/2407)
