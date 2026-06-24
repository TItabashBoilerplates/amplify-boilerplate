---
name: devenv-cicd
description: GitHub Actions × devenv 2.0 による CI/CD ガイダンス。`.github/workflows/` の YAML 編集、`devenv tasks run` を CI で動かす、`enterShell` hook を発火させる、`devenv test` の process phase 回避、`/nix/store` の cache 戦略（cache-nix-action × cachix）、`concurrency` group などについての質問に使用。本リポジトリの ci-check / test ジョブの設計方針を提供。
---

# devenv-cicd Skill

このプロジェクトの CI/CD（GitHub Actions × devenv 2.0）の設計方針と、よくある落とし穴の回避策をまとめる。

対象: `.github/workflows/ci.yml` ほか、devenv で構成された開発環境を CI 上で動かすすべての workflow。

## 大原則

**CI 上の `run:` ステップは原則すべて devenv shell 内で実行する**。`devenv tasks run` を `run:` で素のシェルから直接叩いてはいけない。

理由: `devenv:enterShell` hook を経由しないと `setup:install-frontend` / `setup:install-drizzle` / `setup:install-backend` 等（`before = [ "devenv:enterShell" ]` で登録された task）が発火せず、`bun install --frozen-lockfile` / `uv sync --frozen` が走らないため、`turbo` / `eslint` / `tsc` 等の node_modules / .venv 依存ツールが PATH 上に出現しない状態で verify task が実行されて落ちる。

## 推奨パターン（公式ベストプラクティス準拠）

[Using devenv in GitHub Actions](https://devenv.sh/integrations/github-actions/) で推奨される 3 形態:

| パターン | 使い道 | enterShell hook |
|---|---|---|
| `run: devenv test` | フルチェック（git hooks 含む） | 発火 |
| `run: devenv shell <single-cmd>` | 単一コマンド実行 | 発火 |
| `shell: devenv shell bash -- -e {0}` + `run: \|` | 複数行スクリプト | 発火 |

複数 step に渡って devenv shell を使うなら、**workflow / job レベルで `defaults.run.shell` を設定**して全 `run:` に適用するのが最もシンプル。

```yaml
defaults:
  run:
    shell: devenv shell bash -- -e {0}
```

ただし「devenv 自体をインストールする step」だけは `shell: bash` で override する必要がある（その時点では devenv shell が存在しないため）。

## 本リポジトリの設計

### `.github/workflows/ci.yml` の構成

#### 共通

- `concurrency.group = ${{ github.workflow }}-${{ github.ref }}`、`cancel-in-progress = ${{ github.event_name == 'pull_request' }}`
  - PR への連続 push は古い走行をキャンセルし、main / develop への直接 push はキャンセルしない
- `defaults.run.shell: devenv shell bash -- -e {0}` を **workflow レベル**で設定 → 両 job の全 `run:` で enterShell hook が発火
- `cachix/install-nix-action@v31` で Nix インストール（`extra_nix_config: keep-outputs = true; keep-env-derivations = true` 必須、後述）
- `nix-community/cache-nix-action@v7` で **`/nix/store` 自体**を GHA cache に乗せる
- `cachix/cachix-action@v16` (`name: devenv`) を read-only substituter として併用
- `actions/cache@v4` で `node_modules` 系を別 cache（`/nix/store` 外）
- `Install devenv.sh` step は `shell: bash` override + `run: nix profile add nixpkgs#devenv`

#### `ci-check` job（lint + format + type-check）

verify task のみを **直接列挙** して `devenv tasks run ...` で実行する。

```yaml
- name: Run verify tasks
  run: |
    devenv tasks run \
      lint-ci:frontend lint-ci:drizzle lint-ci:backend-py lint-ci:functions lint-ci:fsd \
      format-check:frontend format-check:drizzle format-check:backend-py format-check:functions \
      type-check:frontend type-check:mobile type-check:backend-py type-check:functions
```

**`devenv test` (= `ci:check` aggregator) は使わない**。理由は次節。

#### `test` job（unit tests）

```yaml
- name: Run unit tests
  run: unit-test
```

defaults によりすでに devenv shell 内なので、`devenv shell unit-test` のように二重に書かず devenv script (`unit-test`) を直接呼ぶ。

> **Note**: script 名を `test` ではなく **`unit-test`** にしているのは、`test` が bash 組み込みコマンド（`[` と等価）と名前衝突するため。bash では builtin が PATH より優先されるため、`run: test` と書くと**引数なしの builtin `test` が実行されて exit 1 を返し**、`-e` で即座にジョブが落ちる（devenv の同名 script は呼ばれない）。`unit-test` のように builtin と衝突しない名前にする必要がある。

### なぜ `devenv test` を使わないか

`devenv test` は `ci:check` aggregator (`before = [ "devenv:enterTest" ]`) を起動する。`devenv:enterTest` は **process phase を含む**ため、本リポジトリの設定では:

- `supabase:start` task が `before = [ "devenv:processes:backend" ]` で前置されて Supabase Docker を起動する
- `backend` / `storybook` プロセスも立ち上げようとする

CI で lint / format / type-check しか走らせたくないのに毎回 Supabase Docker と Storybook を起動するのはコスト・時間の無駄。だから `devenv test` の代わりに、aggregator 配下の verify task を `devenv tasks run` で**直接列挙**する。

verify task 自体は `execIfModified` キャッシュ込みで実装されているので、aggregator を経由しなくても効果は同じ。

### Cache 戦略（CRITICAL）

**3 段で効かせる**。`/nix/store` を cache する層と `node_modules` を cache する層を分けるのがポイント。`.devenv/` を `actions/cache` で抱えるアンチパターンは**やめる**（後述「事故 3」参照）。

| 層 | キャッシュ対象 | 効果 |
|---|---|---|
| `nix-community/cache-nix-action@v7` | **`/nix/store`** 全体（devenv shell の構成要素、bun / nodejs / uv / python など Nix で管理されるすべて） | shell の build / 評価結果を保持。2 回目以降の `Configuring shell` がほぼ瞬時 |
| `cachix/cachix-action@v16` (`name: devenv`) | devenv 公式の Cachix binary cache を read-only substituter として登録 | 1 回目（cache-nix-action が cold）でも devenv 共通依存物は build from source を回避できる |
| `actions/cache@v4` の `path: frontend/**/node_modules`, `drizzle/node_modules` | **Bun workspace の install 結果**（`/nix/store` 外） | `setup:install-frontend` task が `execIfModified` で skip された際に node_modules が空になるのを防ぐ |

**`.devenv/` は CI ではキャッシュしない**。`uv venv` (`UV_PROJECT_ENVIRONMENT=$DEVENV_ROOT/.devenv/state/venv`) は CI 上では `setup:install-backend` task が `uv sync --frozen` で毎回再生成するため cache 不要（数秒で済む）。task runner の execIfModified state も CI では「毎回フルチェックで OK」なので cache せず捨てる。

#### `cache-nix-action` の必須設定

```yaml
- uses: cachix/install-nix-action@v31
  with:
    extra_nix_config: |
      keep-outputs = true
      keep-env-derivations = true
- uses: nix-community/cache-nix-action@v7
  with:
    primary-key: nix-${{ runner.os }}-${{ hashFiles('devenv.nix', 'devenv.lock', 'devenv.yaml') }}
    restore-prefixes-first-match: nix-${{ runner.os }}-
    gc-max-store-size-linux: 5G
    purge: true
    purge-prefixes: nix-${{ runner.os }}-
    purge-created: 0
    purge-primary-key: never
```

- **`keep-outputs = true` / `keep-env-derivations = true`** は cache-nix-action 公式の必須要件。これがないと nix store の自動 GC で devenv-shell の依存（中間ビルド成果物・derivation）が落ちて、2 回目以降に「あるはずのものが無い」状態になる。
- `primary-key` は `devenv.nix` / `devenv.lock` / `devenv.yaml` の hash で組む。devenv 設定が変われば cache を作り直す。`bun.lock` / `uv.lock` は `/nix/store` の中身に影響しないので含めない（含めるとキャッシュ rotation が無駄に増える）。
- `restore-prefixes-first-match` で部分一致 fallback を効かせる。devenv 設定が変わっても近い cache から始めて差分だけ build できる。
- `gc-max-store-size-linux: 5G` で GHA cache の上限 (10GB/repo) に引っかからないよう保存前に GC。
- `purge: true` + `purge-primary-key: never` で primary-key 以外の古い cache を整理。

#### 重大な落とし穴 — `setup:install-*` の `execIfModified` × CI

**症状**: CI で `vitest: command not found` / `tsc: command not found` / `turbo: command not found` のように、明らかに `bun install` 済みのはずのツールが見つからずに死ぬ。`Cached setup:install-frontend` ログが出ているのに死ぬ。

**原因**: `setup:install-frontend` task は `execIfModified = [ "frontend/bun.lock", "frontend/package.json" ]` で「lockfile が変わってなければ skip」というローカル開発向けの最適化が入っている。これは **inputs の hash しか見ず、outputs（`node_modules`）の存在を確認しない**。

CI 上では:

1. job A で初回 install → `frontend/node_modules/` 生成 → `.devenv/state/tasks` に「実行済み」hash 記録
2. job B（別 runner）で `.devenv/` だけ復元される → `frontend/node_modules/` は**存在しない**
3. enterShell hook → `setup:install-frontend` が hash 一致を見て skip → install されないまま step が進む → `vitest` / `tsc` 等が見つからずに死ぬ

**根本対策（採用中）**: `actions/cache@v4` で `node_modules` 系を別 cache に切り出す。lockfile が変われば cache key も変わるので整合性も取れる。

```yaml
- name: Cache node_modules
  uses: actions/cache@v4
  with:
    path: |
      frontend/node_modules
      frontend/apps/*/node_modules
      frontend/packages/*/node_modules
      frontend/tooling/*/node_modules
      drizzle/node_modules
    key: ${{ runner.os }}-node-modules-${{ hashFiles('frontend/bun.lock', 'drizzle/bun.lock') }}
    restore-keys:
      - ${{ runner.os }}-node-modules-
```

**なぜ uv venv は cache しなくて良いのか**: `backend-py` は `UV_PROJECT_ENVIRONMENT=$DEVENV_ROOT/.devenv/state/venv` で venv を `.devenv/` 内に置いているが、CI では `.devenv/` を cache しない方針なので毎回 `uv sync --frozen` で再生成される（数秒）。Bun workspace は `frontend/node_modules` に hoist される（`/nix/store` 外）ため、こちらは別 cache 必須。**つまり「install 結果がどこに出るか」と「cache せず毎回再生成して許容できるコストか」を見て cache path を決める**。

> ⚠️ **教訓**: 公式 devenv の GitHub Actions ドキュメント [Using devenv in GitHub Actions](https://devenv.sh/integrations/github-actions/) は `.devenv/` を cache する**最小例**を示している（が、それは罠）。公式最小例は「devenv 自体の state」のキャッシュ例にすぎず、`.devenv/profile` が `/nix/store` への symlink を持つことや、外部パッケージマネージャ（bun / npm / pnpm 等）が `.devenv/` 外に出力する install 結果のキャッシュ方法は別途考える必要がある。**最小例をそのまま真似ると CI が壊れる**。

## やってはいけないパターン

### NG: enterShell を発火させない

```yaml
# ❌ NG: setup:install-* が走らないので turbo / eslint / tsc が見つからない
- name: Run verify tasks
  run: |
    devenv tasks run lint-ci:frontend type-check:frontend ...
```

```yaml
# ✅ OK: defaults または step-level shell で devenv shell 経由
defaults:
  run:
    shell: devenv shell bash -- -e {0}
# ...
- name: Run verify tasks
  run: |
    devenv tasks run lint-ci:frontend type-check:frontend ...
```

### NG: bash で `bun install` / `uv sync` を直接呼ぶ

```yaml
# ❌ NG: setup task の execIfModified キャッシュを無視して毎回 install してしまう
- run: cd frontend && bun install --frozen-lockfile
- run: cd backend-py && uv sync --all-packages --all-groups --frozen
```

setup task が lockfile 変更を検知して必要なときだけ install する設計なので、CI で重ねて install を呼ばない。`devenv shell` 経由にして hook に任せる。

### NG: `devenv test` を使う（このプロジェクトでは）

```yaml
# ❌ NG: process phase で Supabase Docker / Storybook が毎回起動する
- run: devenv test
```

CI 用途では、verify task を直接列挙する。

### NG: `Install devenv.sh` で defaults を上書きしない

```yaml
# ❌ NG: devenv shell がまだ存在しないのに devenv shell bash -- -e で起動しようとする
- name: Install devenv.sh
  run: nix profile add nixpkgs#devenv
```

```yaml
# ✅ OK: bash で override
- name: Install devenv.sh
  shell: bash
  run: nix profile add nixpkgs#devenv
```

### NG: `.devenv/` を `actions/cache` で抱える

```yaml
# ❌ NG: .devenv/profile が /nix/store への symlink を持つため、
#       別 runner で restore すると参照先実体が無く
#       「no substituter that can build it」で失敗する。
- uses: actions/cache@v4
  with:
    path: |
      .devenv
      frontend/node_modules
      ...
    key: ...
```

```yaml
# ✅ OK: /nix/store 自体を cache-nix-action で抱え、node_modules は別 cache
- uses: cachix/install-nix-action@v31
  with:
    extra_nix_config: |
      keep-outputs = true
      keep-env-derivations = true
- uses: nix-community/cache-nix-action@v7
  with:
    primary-key: nix-${{ runner.os }}-${{ hashFiles('devenv.nix', 'devenv.lock', 'devenv.yaml') }}
    restore-prefixes-first-match: nix-${{ runner.os }}-
    gc-max-store-size-linux: 5G
    purge: true
    purge-prefixes: nix-${{ runner.os }}-
    purge-created: 0
    purge-primary-key: never
- uses: actions/cache@v4
  with:
    path: |
      frontend/node_modules
      frontend/apps/*/node_modules
      frontend/packages/*/node_modules
      frontend/tooling/*/node_modules
      drizzle/node_modules
    key: ${{ runner.os }}-node-modules-${{ hashFiles('frontend/bun.lock', 'drizzle/bun.lock') }}
```

詳細は「事故 3」参照。

### NG: `cache-nix-action` を `extra_nix_config` 無しで使う

```yaml
# ❌ NG: keep-outputs = true / keep-env-derivations = true が無いと
#       nix store の自動 GC で devenv-shell の依存物が落ちる。
#       次回 cache restore したときに「あるはずのものが無い」状態になる。
- uses: cachix/install-nix-action@v31
- uses: nix-community/cache-nix-action@v7
  with:
    primary-key: ...
```

```yaml
# ✅ OK: cache-nix-action 公式推奨の nix.conf を必ず設定する
- uses: cachix/install-nix-action@v31
  with:
    extra_nix_config: |
      keep-outputs = true
      keep-env-derivations = true
- uses: nix-community/cache-nix-action@v7
  with:
    primary-key: ...
```

### NG: devenv script 名に bash 組み込みコマンドを使う

bash には `test` / `time` / `kill` / `printf` / `read` / `true` / `false` / `let` / `local` / `set` / `trap` / `wait` / `exec` / `eval` / `command` / `type` / `hash` / `exit` 等の **builtin** がある。bash は **builtin を PATH より優先**するため、devenv script の名前をこれらと衝突させると、CI の `run: <script>` で **builtin が呼ばれて意図と違う挙動になる**（`test` の場合は引数なしで exit 1 が返って `-e` で即落ち）。

```nix
# ❌ NG: `test` は bash builtin と衝突 → CI で `run: test` が exit 1
"test" = { exec = ''...''; description = "..."; };
```

```nix
# ✅ OK: 衝突しない名前を選ぶ
"unit-test" = { exec = ''...''; description = "..."; };
```

ハイフン付きの名前（`test-frontend` / `format-check` / `ci-check` 等）は builtin と衝突しないので安全。新規 script を `devenv.nix` に追加する際は **`type <name>` で bash builtin と衝突しないか確認**してから登録すること。

## 新しい verify task / job を追加する手順

1. `devenv.nix` の `tasks` に task を追加（`execIfModified` で対象ファイル glob を指定）
2. 必要に応じて scripts (`xxx-ci`) も追加
   - **NEW script は bash builtin と衝突しない名前にする**（`type <name>` で確認）
3. `.github/workflows/ci.yml` の `ci-check` job の `devenv tasks run ...` リストに task 名を追加
4. enterShell hook は `defaults.run.shell` で既に発火するので、追加の install 系ステップは不要

新しいパッケージ (`frontend/apps/<new>/`) を追加した場合も、`bun.lock` が更新されれば `setup:install-frontend` の `execIfModified` が検知して install するため、CI workflow 側は無変更で動く。

ただし以下のケースでは **`.github/workflows/ci.yml` の更新が必要**:

| 変更 | 必要な workflow 修正 |
|---|---|
| `devenv.nix` / `devenv.lock` / `devenv.yaml` を変更（依存物の更新） | `cache-nix-action` の `primary-key` は自動で hash が変わるので追加対応不要（`hashFiles(...)` 引数に既に含まれているため） |
| 新しい lockfile（例: `tooling/<new>/bun.lock`）が増えた | `node_modules` cache の `hashFiles(...)` 引数に追加。さもないと依存変更が cache key に反映されず stale cache が使われ続ける |
| 新しい install 出力ディレクトリが `/nix/store` 外にできる（例: 新しい monorepo を `tools/` 配下に追加し独自 `node_modules` ができる） | `actions/cache@v4` の `path:` リストに追加。漏らすと CI で「cache hit したのに必要なツールが見つからない」事故が起きる |
| 新しいパッケージマネージャを導入（pnpm / yarn 等） | install 出力先を確認のうえ `actions/cache` の path に追加 |

## 参考テンプレート（最小骨格）

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

defaults:
  run:
    shell: devenv shell bash -- -e {0}

jobs:
  ci-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: cachix/install-nix-action@v31
        with:
          # cache-nix-action 公式推奨。必須設定。
          extra_nix_config: |
            keep-outputs = true
            keep-env-derivations = true
      - uses: nix-community/cache-nix-action@v7
        with:
          primary-key: nix-${{ runner.os }}-${{ hashFiles('devenv.nix', 'devenv.lock', 'devenv.yaml') }}
          restore-prefixes-first-match: nix-${{ runner.os }}-
          gc-max-store-size-linux: 5G
          purge: true
          purge-prefixes: nix-${{ runner.os }}-
          purge-created: 0
          purge-primary-key: never
      - uses: cachix/cachix-action@v16
        with:
          name: devenv
      - name: Cache node_modules
        uses: actions/cache@v4
        with:
          path: |
            frontend/node_modules
            frontend/apps/*/node_modules
            frontend/packages/*/node_modules
            frontend/tooling/*/node_modules
            drizzle/node_modules
          key: ${{ runner.os }}-node-modules-${{ hashFiles('frontend/bun.lock', 'drizzle/bun.lock') }}
          restore-keys:
            - ${{ runner.os }}-node-modules-
      - name: Install devenv.sh
        shell: bash
        run: nix profile add nixpkgs#devenv
      - name: Run verify tasks
        run: |
          devenv tasks run \
            lint-ci:frontend \
            lint-ci:drizzle \
            ...
```

## チェックリスト（PR 前）

- [ ] `defaults.run.shell` か step-level `shell:` で devenv shell が経由されているか
- [ ] `Install devenv.sh` step は `shell: bash` override されているか
- [ ] `devenv test` を CI で叩いていないか（process phase 起動回避）
- [ ] verify task / test を直接列挙しているか
- [ ] `bun install` / `uv sync` を bash から直接呼んでいないか
- [ ] **`/nix/store` を `cache-nix-action` で cache しているか**（`actions/cache` で `.devenv/` を抱えていないか）
- [ ] **`cachix/install-nix-action` の `extra_nix_config` に `keep-outputs = true` と `keep-env-derivations = true` が設定されているか**
- [ ] `actions/cache` の `path:` に **`frontend/**/node_modules`, `drizzle/node_modules` 等の install 結果が含まれているか**
- [ ] `cache-nix-action` の `primary-key` が devenv 設定 (`devenv.nix` / `devenv.lock` / `devenv.yaml`) の hash で組まれているか
- [ ] `actions/cache` の `key:` の `hashFiles(...)` に新 lockfile が含まれているか（lockfile を新規追加した場合）
- [ ] devenv script 名が **bash builtin と衝突していないか**（`type <name>` で確認）
- [ ] `concurrency` group が設定されているか

## 過去の事故と教訓（Past incidents）

レビューや新規 workflow 設計の参考として、本リポジトリで実際に起きた CI 事故を記録する。

### 事故 1: `test` script の bash builtin 衝突（2026-04-28）

**症状**: `Run unit tests` step が出力なしで `Error: Process completed with exit code 1` だけを出して死ぬ。

**原因**: devenv.nix で script を `"test"` という名前で定義していた。bash の builtin `test`（`[` と等価）が PATH より優先されるため、`run: test` は引数なしの builtin が実行されて exit 1 を返した。devenv の `test` script は呼ばれていなかった。

**修正**: `unit-test` にリネーム。`devenv.nix` / `.github/workflows/ci.yml` / 関連ドキュメントの `test` 表記もすべて追従。

**教訓**: **devenv script 名は bash builtin と衝突させない**。新規 script 追加時は `type <name>` で確認する。`test-frontend` のようにハイフン付きにするのが最も安全。

### 事故 2: `frontend/node_modules` がキャッシュ対象に含まれていない（2026-04-28）

**症状**: `Cached setup:install-frontend` ログが出ているのに、後続の vitest / tsc / turbo が `command not found` で死ぬ。

**原因**: `actions/cache@v4` の `path:` が `.devenv` だけ。`setup:install-frontend` task の `execIfModified` は lockfile の hash 一致で skip と判定したが、`frontend/node_modules`（`.devenv/` 外）はキャッシュされていないため復元されず、空の状態で task が skip された。`backend-py` 側は `UV_PROJECT_ENVIRONMENT=$DEVENV_ROOT/.devenv/state/venv` で venv を `.devenv/` 内に置いていたためたまたま無事だった。

**修正（暫定）**: cache `path:` に `frontend/node_modules` 系および `drizzle/node_modules` を追加。lockfile が変われば cache key も変わるので整合性も取れる。

**追記（最終修正）**: 事故 3 を経て `.devenv/` 自体を cache 対象から外し、`node_modules` だけを `actions/cache` で別 cache に切り出す形に変更。

**教訓**:
- `execIfModified` は **inputs の hash しか見ず、outputs の存在を確認しない**。CI のように outputs が ephemeral（job 間で消える）な環境では、outputs もキャッシュ対象に含めなければならない。
- 公式 devenv の GitHub Actions ドキュメントは `.devenv/` だけを cache する**最小例**しか示しておらず、外部パッケージマネージャ（bun / npm 等）が `.devenv/` 外に出力する install 結果のキャッシュ方法は別問題として扱われている。**最小例をそのまま真似ると壊れる**。
- **install 結果がどこに出力されるか**を正確に把握してから cache path を決める。
- 「他に問題ない」と即答する前に、**少なくとも cache scope が完結しているかは検証**する。具体的には: (1) install task が出力するパスを列挙、(2) それぞれが cache に含まれているか確認、(3) cache miss シナリオを頭の中で trace。

### 事故 3: `.devenv/` を `actions/cache` で抱えると `/nix/store` symlink がダングリングになる（2026-04-28）

**症状**: 同じ commit / 同じ cache key で 2 連続走らせて、片方の job が成功し、もう片方が失敗する。失敗側のログ:

```
Configuring shell
Configuring shell in 223ms
Error:   × Failed to get dev environment from derivation
  ╰─▶ error: path '/nix/store/<hash>-devenv-shell.drv' is required,
      but there is no substituter that can build it
```

成功側は `Configuring shell` に 28 秒かけて build from source していた。失敗側は `.devenv/nix-eval-cache.db` の評価結果を信じて即座に `/nix/store` を探しに行き、**実体が無くて即死**。

**原因**: `actions/cache@v4` で `.devenv/` を cache していた。`.devenv/` の中身は:

| 項目 | 中身 |
|---|---|
| `profile` | `/nix/store/...-devenv-profile` への **symlink** |
| `bash-bash` | `/nix/store/...-bash-interactive-...` への symlink |
| `gc/` | gc-roots（さらに `/nix/store` への symlink 群） |
| `nix-eval-cache.db` | nix の評価結果（drv ハッシュ）を保存する SQLite DB |
| `shell-*.sh` | 過去の shell 評価結果 |

`.devenv/` 自体は cache 復元されるが、symlink が指している `/nix/store/...` の実体は別 runner では存在しない。`devenv shell` は `nix-eval-cache.db` の cached drv hash を使って `/nix/store/...drv` を realize しようとし、無いので失敗。public な `cachix devenv` cache はこのリポジトリ固有の shell.drv を持っていないので fallback もできない。

なぜ片方の job だけ成功するのかは決定的には判明しなかったが、SQLite WAL / gc-roots の状態が job 間で僅かに違うため、片方は eval cache を引いて即死、もう片方は cache miss と判定して 28 秒かけて build from source、と振る舞いが分岐する。**いずれにせよ `.devenv/` を runner 跨ぎで cache するのは根本的に整合しない**。

**修正**: `.devenv/` を `actions/cache` から外し、代わりに `nix-community/cache-nix-action@v7` で `/nix/store` 自体を cache する構成に変更。`/nix/store` を cache すれば symlink 先の実体も同時に揃うので、`.devenv/` の symlink / eval cache は `/nix/store` の整合性に追随できる（ただし本リポジトリでは `.devenv/` 自体は cache しない方針に振り、CI では毎回再生成）。

`cache-nix-action` 公式推奨の `keep-outputs = true` / `keep-env-derivations = true` を `cachix/install-nix-action` の `extra_nix_config` で設定するのを忘れないこと。これがないと nix store の自動 GC で必要な derivation / outputs が落ちる。

**教訓**:
- **`.devenv/` は `actions/cache` で抱えてはいけない**。中身が `/nix/store` への symlink と評価キャッシュ DB を含むため、別 runner で復元すると整合しない。
- **「CI cache」の対象は内容物が `/nix/store` から自己完結している層に限る**。symlink で外を参照する層は外側ごと cache するか、cache せずに毎回再生成するかのどちらか。
- 公式 devenv の GitHub Actions ドキュメントの最小例は `.devenv/` を cache していないので、それに従うのが正解。逆に「最適化のつもりで `.devenv/` を cache 対象に追加する」のはアンチパターン。
- 同じ cache key で 2 job 並列走らせて結果が分岐する場合、**SQLite WAL / gc-roots 等の「cache 内に入っている可変状態」が原因**であることを疑う。

## 関連ドキュメント

- 公式: [Using devenv in GitHub Actions](https://devenv.sh/integrations/github-actions/)
- 公式 issue（CI 最適化議論）: [What to do to optimize CI? #1575](https://github.com/cachix/devenv/issues/1575)
- [nix-community/cache-nix-action README](https://github.com/nix-community/cache-nix-action)
- [cachix/install-nix-action README](https://github.com/cachix/install-nix-action)
- 本リポジトリ:
  - `.github/workflows/ci.yml` — 実装
  - `devenv.nix` — task / scripts 定義
  - `.claude/rules/commands.md` — devenv コマンド使用ポリシー
  - `.claude/skills/debugging/SKILL.md` — devenv 2.0 の native process manager / TUI の運用
