# Claude Code on the web 環境セットアップ手順

このリポジトリを **Claude Code on the web**（CCR / クラウドセッション）で動かすための環境構築手順。
ローカルと同じ **devenv / direnv（Nix）** 環境を、クラウドのコンテナ上に再現する。

> 出典: [Claude Code on the web 公式ドキュメント](https://code.claude.com/docs/en/claude-code-on-the-web)

---

## 全体像（Setup script ＋ BASH_ENV の 2 点セット）

CCR の **Bash ツールは非ログイン・非対話シェル**で動くため、`~/.bashrc` /
`~/.profile` / `/etc/profile.d` を読み込まない。よって nix プロファイルを対話シェル
向けに配線しても効かず、`devenv` / `lint` などが「毎回認識されない」。

これを解決するのが `scripts/claude-code-web-setup.sh` の **BASH_ENV 方式**。
CCR 環境設定で次の **2 点をセットで**設定する。

| # | 置き場所 | 設定内容 | 役割 |
|---|---|---|---|
| **①** | 環境設定の **Setup script** 欄 | `scripts/claude-code-web-setup.sh` の中身を丸ごと貼る | nix / devenv / direnv / jq の**インストール**＋ `/usr/local/bin` への symlink ＋ **BASH_ENV 遅延ローダの書き出し**（初回のみ・以後キャッシュ） |
| **②** | 環境設定の **環境変数** 欄 | `BASH_ENV=/root/.ccr-devenv-env.sh` を1行追加 | 全非対話シェルに①のローダを source させ、devenv 環境（PATH 等）を引き継ぐ |

```
保存 → 新セッション
  ├─ ① Setup script (clone 前・環境に属す)  : nix/devenv/direnv/jq 導入 + /usr/local/bin symlink
  │                                            + BASH_ENV 遅延ローダ (/root/.ccr-devenv-env.sh) を書き出し
  └─ ② BASH_ENV (環境変数欄)                : 各セッション最初の非対話 Bash (clone 済み) が
        ローダを source → direnv export で devenv 環境を生成・キャッシュして読み込み
        → Claude の Bash で lint / format / type-check / unit-test / sandbox / dev-web / aws が
          *プレフィックス無し* で直接通る
```

> **なぜ 2 点セットなのか**: Setup script は「クラウド環境」に属し **repo の clone 前**に
> 実行される（`$CLAUDE_PROJECT_DIR` 未設定・CWD は repo ルートでない）。よって repo を要する
> devenv 事前ビルドや `direnv export` は Setup script では行えない。そこで Setup script は
> *ローダだけ* を書き、repo 依存の環境生成は **clone 後の初回 Bash**（BASH_ENV 経由）に遅延させる。
> **セットアップスクリプトからはツールシェルの環境変数を直接セットできない**ため、
> `BASH_ENV` の付与だけは「環境変数」欄で行う（② が必須）。

> ⚠️ **② の BASH_ENV を設定し忘れるとローダが一切動かず、devenv scripts が PATH に乗らない。**
> `lint` などが `command not found` になったら、まず環境変数欄の `BASH_ENV` を確認する。

---

## このリポジトリ固有の注意（Amplify Gen2 / AWS ファースト）

- バックエンドのローカル実行は **`ampx sandbox`（per-dev のクラウド sandbox）** で行う。
  **Supabase / ローカル Docker は使わない**ため、旧 shadcn-boilerplate 版の CCR スクリプトに
  あった **Docker デーモン起動・ローカルイメージ調整（realtime/edge-runtime パッチ）は一切不要**
  → `scripts/claude-code-web-setup.sh` からは完全に削除している。
- `sandbox`（ampx）や `aws` を使うには **AWS 認証情報（プロファイル）が別途必要**。
  `lint` / `format` / `type-check` / `unit-test` などは AWS 認証なしで通る。
- プロジェクト依存（`pnpm install` / `uv sync`）は自動では入らない。必要になったら
  devenv の **`bootstrap`** を実行する（`bootstrap` 自体は BASH_ENV で PATH に乗る）。

---

## ① Setup script（Web UI に貼る）

環境設定ダイアログの **Setup script** 欄に、`scripts/claude-code-web-setup.sh` の中身を
**丸ごと貼り付けて保存**する。

> `scripts/claude-code-web-setup.sh` は repo にもコミットしてあるが、それは
> **バージョン管理・レビュー用のリファレンス**。repo から自動実行はされないため、
> **中身を Web UI に手でコピペする**必要がある。

スクリプトがやること（詳細はファイル冒頭のコメント参照）:

1. **nix (Determinate Systems installer / `--init none`)** を導入（systemd 不要 / root-only）。
2. **devenv / direnv / cachix / jq** を `nix profile` に導入（`cachix use devenv` で初回ビルド高速化）。
   - `jq` は遅延ローダが `direnv export json` を整形するのに **devenv shell の外**でも必要なため明示導入。
3. `devenv / direnv / nix / jq / cachix` を **`/usr/local/bin` に symlink**（非対話シェルでも解決）。
4. **BASH_ENV 遅延ローダ**を `/root/.ccr-devenv-env.sh` に書き出す。

### 手順

1. 環境設定ダイアログを開く → **Setup script** 欄
2. 既存内容を**全部消して**、`scripts/claude-code-web-setup.sh` の中身を貼る → **保存**
3. **環境変数** 欄に `BASH_ENV=/root/.ccr-devenv-env.sh` を追加 → **保存**
4. **新しいセッションを開始**（Setup script を変更するとキャッシュが再ビルドされる）

---

## ② BASH_ENV 遅延ローダ（`/root/.ccr-devenv-env.sh`）

Setup script が書き出すローダ。BASH_ENV を通じて**全非対話 Bash が起動時に source** する。

役割:

- `_CCR_DEVENV_LOADED` を即 export し、ビルド中に派生する子シェルの再入（デッドロック）を防ぐ。
- セッション内キャッシュ（`/root/.ccr-devenv-env.cache.sh`）が未生成なら、**ロックで先着 1 プロセス
  だけ**が `direnv allow` → `devenv shell` → `direnv export json` を実行して環境を生成・キャッシュ。
  他プロセスはキャッシュ完成を待ってから読み込む（torn read 防止）。
- 以降は各シェルがキャッシュを直接 source（数ミリ秒）。

> 初回のみ devenv ビルドで数分かかる（`cachix` で緩和）。2 回目以降はキャッシュヒットで即時。

---

## 落とし穴（実セッションで判明した根本原因）

| # | 問題 | 対処 |
|---|---|---|
| 1 | **Claude の Bash は非ログイン非対話 shell → `~/.bashrc` を読まない**。bashrc 追記では devenv/nix が PATH に乗らない | **BASH_ENV** で全非対話シェルにローダを source させる（②）＋ `devenv`/`jq` を `/usr/local/bin` に symlink |
| 2 | **Setup script は clone 前に走り repo 非依存**（`$CLAUDE_PROJECT_DIR` 未設定）。repo 内パス参照は失敗 | repo 依存の環境生成は **BASH_ENV ローダ（clone 後の初回 Bash）** に遅延（`$CLAUDE_PROJECT_DIR` はここで使える） |
| 3 | **`__ETC_PROFILE_NIX_SOURCED` が基底環境に残ると `nix-daemon.sh` が早期 return** し PATH を追加しない | Setup script 側で `unset` してから source ＋ プロファイル bin を直接 PATH に補完 |
| 4 | `nix profile` が **`$USER must be set`** を警告 | Setup script 冒頭で `export USER="${USER:-root}"` |
| 5 | `jq` が **devenv shell の外に無い**とローダの `direnv export json` 整形が失敗 | `jq` を `nix profile` にも導入し `/usr/local/bin` へ symlink |

---

## 動作確認（新セッションで）

```bash
which devenv direnv aws jq   # すべて解決すること（devenv 等は /usr/local/bin 経由）
lint --help 2>/dev/null || echo lint   # devenv の script が直接叩けること（例）
sandbox --help 2>/dev/null || true     # ※ ampx は AWS 認証が要る
echo "$PATH"                 # nix store の devenv scripts（.../lint/bin など）が含まれること
```

うまく devenv が見えない場合の切り分け:

- `echo "$BASH_ENV"` が `/root/.ccr-devenv-env.sh` を指しているか（**環境変数欄の設定漏れが最頻**）。
- `cat /root/.ccr-devenv-env.sh` でローダが存在するか（Setup script が走ったか）。
- `cat /root/.ccr-devenv-env.cache.sh` にキャッシュ（`DEVENV_*` / 太い `PATH`）が書き込まれているか。
- キャッシュが壊れていそうなら `rm -f /root/.ccr-devenv-env.cache.sh /root/.ccr-devenv-env.lock` して
  新しい Bash を開くと再生成される。

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `scripts/claude-code-web-setup.sh` | ① Setup script のリファレンス（Web UI に貼る中身）＋ BASH_ENV ローダの生成元 |
| `/root/.ccr-devenv-env.sh` | ② BASH_ENV 遅延ローダ（Setup script が生成・環境変数欄が指す。repo 外・コミットしない） |
| `.claude/settings.json` | PreToolUse / PostToolUse フックの配線（**SessionStart フックは廃止**） |
| `devenv.nix` / `.envrc` | devenv 環境定義（`awscli2` 等の依存を宣言）＋ direnv 有効化。**ローカル開発と共用** |

> 旧構成（`scripts/cloud-setup.sh` ＋ `.claude/hooks/session-start.sh` による
> `$CLAUDE_ENV_FILE` 引き継ぎ）は **BASH_ENV 方式に一本化**したため削除済み。
