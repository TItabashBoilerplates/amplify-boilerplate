# devenv 2.0 `processes.<name>.start.enable` と `devenv up <name>` 引数の関係 調査レポート

## 調査情報
- **調査日**: 2026-04-28
- **調査対象**: devenv 2.0.6 (aarch64-darwin)
- **トリガー**: `dev-web` (= `devenv up backend storybook web`) を実行しても TUI 上で `web auto start off` 表示になり Web プロセスが起動しない症状

---

## 結論 (1 行サマリ)

**`start.enable = false` は CLI で `devenv up <name>` と明示指定しても上書きされない仕様**。
TUI に表示はされるが起動はされず、起動するには **(A) `start.enable` を条件付きで `true` にする** か、**(B) detached の manager を別途立てて `devenv processes start <name>` を呼ぶ** か、**(C) `start.enable = false` を捨てて opt-in を別の仕組み (script ごとに `processes` 定義を切り替える) で実現する** 必要がある。

これは **バグではなく仕様**。GitHub Issues に「CLI 引数で `start.enable=false` を上書きしてほしい」という機能要望は (2026-04-28 時点で) 立っていない。

---

## 公式ドキュメント / ソースコードの記述

### 1. オプションの定義 (`src/modules/processes.nix`)

`start.enable` の Nix module 定義 (要約):

```nix
enable = lib.mkOption {
  type = types.bool;
  default = true;
  description = ''
    Whether to start this process automatically with `devenv up`.

    Disabled processes are still visible in the TUI as stopped
    and can be started manually by selecting them and pressing Enter.
  '';
};
```

→ description で **「TUI 上で stopped として表示され、TUI から手動で Enter キーで起動」** と明記している。CLI 引数で上書きできるとは書かれていない。

URL: https://github.com/cachix/devenv/blob/main/src/modules/processes.nix

### 2. process タスク生成ロジック (`src/modules/processes.nix:467-495`)

```nix
enabledProcesses = lib.filterAttrs (_: p: p.start.enable) config.processes;
# ...
tasks = lib.mapAttrs' (name: process: {
  name = "devenv:processes:${name}";
  value = {
    type = "process";
    process = {
      start.enable = process.start.enable;   # ← ここで原値が task config に渡る
      # ...
    };
  };
}) config.processes;
```

→ **すべての process** (start.enable=false 含む) が `devenv:processes:<name>` タスクとして登録される。CLI で指定すると、そのタスクは roots に積まれる。**しかしタスク内部で `start.enable = false` がそのまま伝播するため、CLI 指定だけでは起動しない**。

### 3. CLI 引数の処理 (`devenv/src/devenv/mod.rs:1581-1592`)

```rust
let roots: Vec<String> = if processes.is_empty() {
    // CLI 引数なし → 全 process タスクを root に
    task_configs.iter()
        .filter(|t| t.name.starts_with(devenv_tasks::PROCESS_TASK_PREFIX))
        .map(|t| t.name.clone()).collect()
} else {
    // CLI 引数あり → 指定された process だけを root に
    processes.iter()
        .map(|p| format!("{}{}", devenv_tasks::PROCESS_TASK_PREFIX, p))
        .collect()
};
```

→ CLI 引数は **「どのタスクを root にするか」** だけを決め、`start.enable` を上書きしない。

### 4. ネイティブ process manager の実装 (`devenv-processes/src/manager.rs:598-614`)

```rust
async fn launch_or_register_not_started(
    &self,
    config: ProcessConfig,
    activity: Activity,
) -> Result<Option<Arc<Job>>> {
    if !config.start.enable {
        activity.set_status(ProcessStatus::NotStarted);
        info!("Registered auto start off process: {}", config.name);
        self.processes.write().await.insert(
            config.name.clone(),
            ProcessEntry::NotStarted { config, activity },
        );
        return Ok(None);   // ← 起動せず NotStarted で登録
    }
    self.launch(&config, activity).await.map(Some)
}
```

→ `start.enable = false` のプロセスは **`launch_or_register_not_started` で問答無用に `NotStarted` フェーズで登録され、起動されない**。CLI 由来か自動か区別する分岐は存在しない。

### 5. タスクランナーの動作 (`devenv-tasks/src/tasks.rs:925-932`)

```rust
if launch_info.auto_start_off {
    // Auto start off process: set NotStarted
    set_process_phase(
        &task_state_clone,
        &notify_finished_clone,
        ProcessPhase::NotStarted,
    ).await;
}
```

→ タスクランナー側でも `auto_start_off` を見て NotStarted に設定し、ready 待機もスキップ。

### 6. CLI で起動可能な代替コマンド (`devenv-processes/src/manager.rs:45`)

```rust
/// Start a process that has `start.enable = false`.
Start { name: String },
```

→ `devenv processes start <name>` が `start.enable = false` の process を **「動いている manager に対して」** 後から起動する API として用意されている。

---

## GitHub Issues / PR

### 関連する閉じ済み Issue

#### #2721 "Processes: unexpected dependencies running" (Closed, devenv 2.0.6)
- **報告者**: KitAmbraid
- **症状**: `devenv processes up postgres` が postgres だけでなく `after = ["devenv:processes:postgres"]` の foo, bar も起動してしまう
- **メンテナ (domenkozar) のコメント**:
  > "By default I think we should start dependencies, but I've added a way to set `--mode single`"
- **対応**: CHANGELOG.md より引用:
  > Added `--mode` flag to `devenv up` / `devenv processes up` to control dependency resolution for process tasks. Supports `single`, `before`, `after`, and `all` modes, matching `devenv tasks run --mode`. Defaults to `all`, so `devenv up` starts all processes by default ([#2721](https://github.com/cachix/devenv/issues/2721)).
- **重要**: この issue は **依存解決 (after/before)** の問題で、`start.enable` には**関係しない**。`--mode single` を使っても `start.enable = false` は上書きされない。

URL: https://github.com/cachix/devenv/issues/2721

### `start.enable` を CLI で上書きする機能要望

**該当する Issue/PR は (2026-04-28 時点で) なし**。`start.enable` を `devenv up <name>` で上書きする提案や議論は GitHub 上に存在しない。

### 隣接する Issue

- **#2534 "Obsolete option 'enable' is used"** (Closed bug, 別件・無関係)
- **#1178 "Is there a way to start devenv-up of something other than the default shell?"** (CLI 引数で起動 process を絞る要望、`start.enable` とは別軸)

---

## 回避方法

### 案A: `start.enable` を捨てて `processes` 定義を script で動的に切り替える ← 一般には不可

devenv の `processes.<name>` は Nix evaluation 時に確定する。コマンドライン (`devenv up X` の `X`) を見て Nix 評価を変えることはできない。

ただし **devenv の `--option` フラグ** で Nix オプションを上書きすることは可能:
```bash
devenv --option processes.web.start.enable:bool true up web
```
→ これは **動く**。`--option` は Nix evaluation の前に効くため `start.enable` を `true` に上書きできる。

### 案B: detached manager + `devenv processes start <name>`

```bash
# 軽量セットを detached で起動
devenv up -d
# あとから web を起動 (TUI ではなく socket API 経由)
devenv processes start web
```
→ TUI を使わないなら成立。ただしこのプロジェクトの運用 (TUI を主インターフェース) と相性が悪い。

### 案C: `dev-<name>` script を `--option` ベースに書き換える ★推奨

`mkDevScript` を以下のように書き換える:

```nix
mkDevScript = name: _cfg: {
  exec = ''
    exec devenv \
      --option "processes.${name}.start.enable:bool" true \
      up backend storybook ${name}
  '';
  description = "Start backend + storybook + ${name}";
};
```

そして `devAllExec` も:

```nix
devAllExec =
  let
    appNames = lib.attrNames frontendApps;
    overrides = lib.concatMapStringsSep " " (n:
      ''--option "processes.${n}.start.enable:bool" true''
    ) appNames;
  in ''
    exec devenv ${overrides} up backend storybook ${lib.concatStringsSep " " appNames}
  '';
```

これで:
- `processes.web.start.enable` の Nix デフォルトは `false` のまま (= 素の `devenv up` では起動しない opt-in)
- `dev-web` 経由 / `dev-all` 経由 / 手動 `devenv up backend storybook web` で起動するときだけ `--option` で `start.enable=true` に上書き
- TUI ベースの運用が維持される

### 案D: `frontendApps` ベースの opt-in を捨てる

`processes.web.start.enable = true` にしてしまい、`devenv up backend storybook` だけ叩けば web/mobile も全部上がる構成にする。
ただし Mobile (Expo Metro) のように **重い・常時起動したくない** ものを `start.enable = true` に倒すと意図に反するため、案Cの方が良い。

### 案E: `processes` をプロファイル分岐で書き換える

`{ profile = "web"; ... }` のような devenv profile ごとに `processes` 定義自体を変える方法。Nix の条件分岐で `start.enable` を出し分け。複雑度が上がるため、案Cの単純な `--option` 上書きの方が保守性が高い。

---

## 案ごとの比較

| 案 | 複雑度 | TUI 互換 | `dev-<name>` の意図保持 | 副作用 |
|---|---|---|---|---|
| A: 手動 `--option` | 低 | ◯ | × (毎回手で打つ必要) | なし |
| B: detached + start | 中 | △ (TUI 後付け) | × | API socket 経由になる |
| **C: `--option` を script に内蔵** ★ | 低 | ◯ | ◯ | なし |
| D: `start.enable=true` に倒す | 最低 | ◯ | × (opt-in 思想を捨てる) | 重い process が常に起動 |
| E: profile 分岐 | 高 | ◯ | ◯ | profile 切替の認知負荷増 |

---

## 推奨案

**案C (`mkDevScript` に `--option processes.<name>.start.enable:bool true` を仕込む)** を推奨する。

### 理由
1. `frontendApps` attrset から `dev-<name>` script / `dev-all` script を自動生成する既存の DRY 構造が壊れない
2. `processes.<name>.start.enable = false` という宣言的設計 (= 素の `devenv up` で重い frontend が起動しない opt-in) が維持される
3. TUI で `auto start off` 表示に悩まされず、`dev-web` で素直に web が ready になる
4. 追加の運用知識不要 (detached / API socket を意識する必要がない)
5. 純粋に Nix の文字列生成だけで完結するため devenv の挙動に依存しない

### 実装イメージ (`devenv.nix` への diff)

```nix
# mkDevScript: 既存
mkDevScript = name: _cfg: {
  exec = ''exec devenv up backend storybook ${name}'';
  description = "Start backend + storybook + ${name}";
};

# mkDevScript: 推奨
mkDevScript = name: _cfg: {
  exec = ''
    exec devenv \
      --option "processes.${name}.start.enable:bool" true \
      up backend storybook ${name}
  '';
  description = "Start backend + storybook + ${name}";
};

# devAllExec: 既存
devAllExec = ''
  exec devenv up backend storybook ${lib.concatStringsSep " " (lib.attrNames frontendApps)}
'';

# devAllExec: 推奨
devAllExec =
  let
    appNames = lib.attrNames frontendApps;
    overrides = lib.concatMapStringsSep " " (n:
      ''--option "processes.${n}.start.enable:bool" true''
    ) appNames;
  in ''
    exec devenv ${overrides} up backend storybook ${lib.concatStringsSep " " appNames}
  '';
```

---

## 参考リンク

- [devenv processes 公式ドキュメント](https://devenv.sh/processes/)
- [devenv reference options](https://devenv.sh/reference/options/)
- [Migrating to devenv 2.0](https://devenv.sh/guides/migrating-to-2.0/)
- [devenv 2.0: A Fresh Interface to Nix (blog)](https://devenv.sh/blog/2026/03/05/devenv-20-a-fresh-interface-to-nix/)
- [src/modules/processes.nix (start.enable 定義)](https://github.com/cachix/devenv/blob/main/src/modules/processes.nix)
- [devenv-processes/src/manager.rs (NativeProcessManager)](https://github.com/cachix/devenv/blob/main/devenv-processes/src/manager.rs)
- [devenv/src/devenv/mod.rs (CLI 引数 → roots 変換)](https://github.com/cachix/devenv/blob/main/devenv/src/devenv/mod.rs)
- [Issue #2721: Processes: unexpected dependencies running](https://github.com/cachix/devenv/issues/2721)
- [CHANGELOG.md (2.0 系)](https://github.com/cachix/devenv/blob/main/CHANGELOG.md)
