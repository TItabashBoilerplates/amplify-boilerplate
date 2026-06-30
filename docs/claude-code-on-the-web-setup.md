# Claude Code on the web 環境セットアップ手順

このリポジトリを **Claude Code on the web**（クラウドセッション）で動かすための環境構築手順。
ローカルと同じ **devenv / direnv（Nix）** 環境を、クラウドのコンテナ上に再現する。

> 出典: [Claude Code on the web 公式ドキュメント](https://code.claude.com/docs/en/claude-code-on-the-web)
> （"Setup scripts vs. SessionStart hooks"）

---

## 全体像（二層構成）

Claude Code on the web のセットアップは、役割の異なる **2つの層**で構成する。

| 層 | 置き場所 | 役割 | repo 依存 |
|---|---|---|---|
| **① 環境のセットアップスクリプト** | クラウド環境設定の **Setup script 欄**（Web UI・手動で貼る） | nix / cachix / devenv / direnv の**インストール**（重い・**初回のみ実行されキャッシュ**される） | ❌ 非依存 |
| **② SessionStart フック** | repo の `.claude/hooks/session-start.sh`（`.claude/settings.json` で配線） | devenv 環境の**有効化**（`direnv allow` ＋ `$CLAUDE_ENV_FILE` への引き継ぎ。**毎セッション実行**） | ✅ 依存 |

```
保存 → 新セッション
  ├─ ① Setup script (Web UI に貼る)   : nix/devenv/direnv を導入（初回のみ・以後キャッシュ）
  └─ ② SessionStart フック (repo)      : direnv allow → devenv 環境を $CLAUDE_ENV_FILE に書き出し
        → Claude の Bash で lint / pnpm / sandbox / aws が直接通る
```

> **なぜ devcontainer ではないのか**: Claude Code on the web の正規機構は devcontainer.json ではなく
> 「環境の Setup script ＋ repo の SessionStart フック」。両者は実行文脈が異なる（下記の落とし穴参照）。

---

## ① 環境のセットアップスクリプト（Web UI に貼る）

クラウド環境設定ダイアログの **Setup script** 欄に、`scripts/cloud-setup.sh` の中身を**丸ごと貼り付けて保存**する。

> `scripts/cloud-setup.sh` は repo にもコミットしてあるが、それは**バージョン管理・レビュー用のリファレンス**。
> repo から自動実行されるわけではないため、**中身を Web UI に手でコピペする**必要がある。

```bash
#!/bin/bash
set -e

NIX_PROFILE_SCRIPT="/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh"

# Nix（Determinate Systems installer / daemonless コンテナ向け --init none）
if ! command -v nix >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix \
    | sh -s -- install linux --no-confirm --init none
fi
# shellcheck disable=SC1090
. "$NIX_PROFILE_SCRIPT"

# devenv のバイナリキャッシュ（初回ビルド高速化）
command -v cachix >/dev/null 2>&1 || nix profile add nixpkgs#cachix
cachix use devenv || true

# devenv / direnv 本体
command -v devenv >/dev/null 2>&1 || nix profile add nixpkgs#devenv
command -v direnv >/dev/null 2>&1 || nix profile add nixpkgs#direnv

# 対話/teleport シェル用に ~/.bashrc にも有効化を追記
# __ETC_PROFILE_NIX_SOURCED が残ると nix-daemon.sh が早期 return するため unset してから source。
BASHRC="${HOME:-/root}/.bashrc"
touch "$BASHRC"
if ! grep -qF '__ETC_PROFILE_NIX_SOURCED' "$BASHRC" 2>/dev/null; then
  {
    echo ''
    echo '# nix + direnv (added by cloud-setup.sh)'
    echo 'unset __ETC_PROFILE_NIX_SOURCED'
    echo ". $NIX_PROFILE_SCRIPT"
    echo 'eval "$(direnv hook bash)"'
  } >> "$BASHRC"
fi

echo "✅ cloud-setup: nix / devenv / direnv ready (devenv activation は SessionStart フックで実施)"
```

### 手順

1. 環境設定ダイアログを開く → **Setup script** 欄
2. 既存内容（AWS CLI 手動インストール等）を**全部消して**、上の内容を貼る → **保存**
3. **新しいセッションを開始**（Setup script を変更するとキャッシュが再ビルドされる）

> **AWS CLI の手動インストールは不要**。`awscli2` は `devenv.nix` に宣言済みのため、devenv 環境が立てば
> `aws` も供給される。Setup script から AWS CLI のインストール記述は削除してよい。

---

## ② SessionStart フック（repo 側・配線済み）

`.claude/hooks/session-start.sh` が repo にコミット済みで、`.claude/settings.json` に配線済み。
**main にマージされていれば自動で効く**（手動設定は不要）。

役割:

- ガードを `unset` して nix を読み込み、プロファイル bin を PATH に prepend
- `cd "$CLAUDE_PROJECT_DIR"` → `direnv allow`
- **devenv 環境を `$CLAUDE_ENV_FILE` に書き出す**（Claude の後続 Bash へ引き継ぐ唯一の正規手段）

---

## 落とし穴（実セッションで判明した根本原因）

| # | 問題 | 対処 |
|---|---|---|
| 1 | **Setup script は「環境」に属し repo 非依存**（`$CLAUDE_PROJECT_DIR` 未設定・CWD は repo ルートでない）。repo 内パスを参照すると `exit 127` | repo 依存処理は **SessionStart フック**に置く（`$CLAUDE_PROJECT_DIR` はここでだけ使える） |
| 2 | **Claude の Bash は非ログイン非対話 shell → `~/.bashrc` を読まない**。bashrc 追記では devenv/nix が PATH に乗らない | SessionStart フックで **`$CLAUDE_ENV_FILE`** に環境を書き出す（公式の正規手段） |
| 3 | **`__ETC_PROFILE_NIX_SOURCED` が基底環境に残ると `nix-daemon.sh` が早期 return** し PATH を追加しない | `unset` してから source ＋ プロファイル bin を直接 PATH に prepend |

---

## 動作確認（新セッションで）

```bash
which devenv direnv aws    # すべて解決すること
echo "$PATH"               # nix profile bin / devenv profile bin が含まれること
lint                       # devenv の script が直接叩けること（例）
```

うまく devenv が見えない場合は `echo "$PATH"` と `which devenv`、`cat "$CLAUDE_ENV_FILE"` の出力を確認し、
`$CLAUDE_ENV_FILE` への引き継ぎ（`direnv export` の結果）が書き込まれているかを見る。

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `scripts/cloud-setup.sh` | ① Setup script のリファレンス（Web UI に貼る中身） |
| `.claude/hooks/session-start.sh` | ② SessionStart フック本体（repo 依存の有効化） |
| `.claude/settings.json` | SessionStart フックの配線 |
| `devenv.nix` | devenv 環境定義（`awscli2` 等の依存を宣言） |
