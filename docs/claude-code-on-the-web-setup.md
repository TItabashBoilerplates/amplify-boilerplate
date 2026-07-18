# Claude Code on the web 環境セットアップ手順

このリポジトリを **Claude Code on the web**（クラウドセッション / 以下 CCR）で動かすための環境構築手順。
ローカルと同じ **devenv / direnv（Nix）** 環境を、クラウドのコンテナ上に再現する。

> 出典: [Claude Code on the web 公式ドキュメント](https://code.claude.com/docs/en/claude-code-on-the-web)

---

## 方針: 単一のセットアップスクリプト（CCR 専用・ローカル非干渉）

セットアップは **`scripts/claude-code-web-setup.sh` 一枚**で完結する。この方式は
**ローカル開発環境に一切影響しない**のが最大の特徴:

- スクリプトは **CCR 環境設定の Setup script 欄に手で貼る用**。ローカルの `claude` では実行されない。
- `.claude/settings.json` の **SessionStart フック等の repo 配線は使わない**（フックはローカルでも
  走ってしまうため）。よってローカルの devenv/direnv 設定には何も触れない。
- クラウドへの環境引き継ぎは **`BASH_ENV`（CCR の環境変数欄でのみ設定）** で行う。この変数は
  ローカルには存在しないため、ローカルの Bash からローダが読まれることは決してない。

```
CCR 環境設定
  ├─ ① Setup script 欄   : scripts/claude-code-web-setup.sh の中身を貼る
  │                        （nix/devenv/direnv 導入 + /usr/local/bin へ symlink + BASH_ENV ローダ生成）
  └─ ② 環境変数 欄        : BASH_ENV=/root/.ccr-devenv-env.sh を追加
        → clone 後の初回 Bash が devenv 環境を生成・キャッシュ
        → 以後 lint / format / sandbox / dev-web / pnpm / uv / aws が *裸で* 通る
```

> **なぜ Docker / Supabase の調整が無いのか**: 本リポジトリは AWS Amplify Gen2 ベースで、
> バックエンドのローカル実行は**クラウドの `ampx sandbox`** で行う。ローカル Docker スタック
> （旧 Supabase の realtime / edge-runtime）は無いので、dockerd 起動やイメージパッチは一切不要。

---

## 設定手順（この2点をセットで行う）

### ① Setup script 欄

CCR 環境設定ダイアログの **Setup script** 欄に、`scripts/claude-code-web-setup.sh` の中身を
**丸ごと貼り付けて保存**する。

> repo にコミットしてあるのは**バージョン管理・レビュー用**。repo から自動実行されるわけではない
> ため、**中身を Web UI に手でコピペ**する必要がある。

このスクリプトがやること:

1. **Determinate Nix** を `--init none`（systemd 不要 / root-only）でインストール
2. `cachix` / `devenv` / `direnv` を nix profile に導入
3. それらを **`/usr/local/bin` に symlink**（非対話の Bash ツールシェルでも `devenv` が解決する）
4. **`BASH_ENV` 遅延ローダ** (`/root/.ccr-devenv-env.sh`) を書き出す

### ② 環境変数 欄

CCR 環境設定の **環境変数** 欄に、次の1行を追加する:

```
BASH_ENV=/root/.ccr-devenv-env.sh
```

> ★ **これが無いとローダが動かず、`lint` / `sandbox` 等が裸で通らない**（必須）。
> セットアップスクリプトからはツールシェルの環境変数を直接セットできないため、
> `BASH_ENV` の付与だけはこの「環境変数」欄で行う。

設定後、**新しいセッションを開始**する（Setup script を変更するとキャッシュが再ビルドされる）。

---

## 落とし穴（なぜこの構成なのか）

| # | 問題 | 対処 |
|---|---|---|
| 1 | **Setup script は clone 前・repo 非依存**（`$CLAUDE_PROJECT_DIR` 未設定）。repo 内 `devenv.nix` を要する事前ビルドはここでは不可 | Setup script は**ローダだけ**書き、devenv 環境の生成は clone 後の初回 Bash（`BASH_ENV` 経由）に遅延させる |
| 2 | **Claude の Bash は非ログイン非対話 shell → `~/.bashrc` を読まない**。bashrc 追記では devenv/nix が PATH に乗らない | (a) `/usr/local/bin` へ symlink（`devenv` を裸で解決）＋ (b) `BASH_ENV` ローダで devenv 環境を毎シェルに source |
| 3 | **`__ETC_PROFILE_NIX_SOURCED` が残ると `nix-daemon.sh` が早期 return** し PATH を追加しない | `unset` してから source ＋ プロファイル bin を直接 PATH に prepend |
| 4 | **初回のみ devenv ビルドが遅い**（`*.cachix.org` は既定 allowlist 外） | 環境の Custom allowlist に `*.cachix.org` と `install.determinate.systems` を足すと高速化。`*.nixos.org` は既定許可のため toolchain 自体はプリビルド取得できる |

---

## 動作確認（新セッションで）

```bash
which devenv direnv aws    # すべて解決すること
lint-frontend              # devenv の script が直接叩けること（例）
bootstrap                  # 依存インストール（pnpm install + uv sync）
```

うまく devenv が見えない場合は `echo "$BASH_ENV"`（`/root/.ccr-devenv-env.sh` を指すこと）と
`cat /root/.ccr-devenv-env.cache.sh`（devenv 環境がキャッシュされているか）を確認する。

---

## ローカル開発との関係（重要）

- 本手順は **CCR 専用**。ローカルでは従来どおり `.envrc`（`use devenv`）＋ direnv が自動でロードする。
- `scripts/claude-code-web-setup.sh` はローカルで実行しない（実行しても repo は変更しない設計だが不要）。
- ローカルの `claude` セッションは repo の SessionStart フックを使わないため、この CCR セットアップは
  **ローカルのデバッグ環境に一切干渉しない**。

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `scripts/claude-code-web-setup.sh` | CCR セットアップスクリプト（Setup script 欄に貼る中身。BASH_ENV ローダを生成） |
| `devenv.nix` | devenv 環境定義（`lint` / `sandbox` / `bootstrap` 等の scripts、`awscli2` 等の依存を宣言） |
| `.envrc` | `use devenv`（ローカルの direnv 自動ロード用） |
