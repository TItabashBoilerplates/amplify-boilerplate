# `frontend/CLAUDE.md` と `.claude/rules/frontend.md` をリネーム後の名前で更新

## メタ情報
- **状態**: completed
- **優先度**: medium
- **作成日**: 2026-04-28
- **更新日**: 2026-04-28
- **担当エージェント**: task-executor

## ゴール
0001〜0010 のリファクタで変わった package 名・ディレクトリ・workspace 構成を、ドキュメント側にも反映する。具体的には:

- `frontend/CLAUDE.md` … FSD ディレクトリ説明、`@workspace/ui/web` のような旧名の表記、`packages/ui/web/` 等の旧パス
- `.claude/rules/frontend.md` … 共通化先表（`packages/ui/web/` → `packages/ui/`、`packages/ui/mobile/` → `packages/native-ui/`）と import 例
- `.claude/skills/shadcn-ui/`、`.claude/skills/gluestack/`、`.claude/skills/monorepo/`（あれば） … 同様の更新

## 前提（依存タスク）
- 先行タスク: `0001` 〜 `0010` 全部
- ブロッカー: なし

## 変更対象ファイル

```bash
# 旧名を含む md を機械抽出
cd /Users/titabash/Development/shadcn-boilerplate
grep -rln "@workspace/ui/web\|@workspace/ui/mobile\|packages/ui/web\|packages/ui/mobile" \
  .claude/ frontend/CLAUDE.md frontend/README.md docs/ 2>/dev/null
```

| ファイル | 変更内容 |
|----------|---------|
| `frontend/CLAUDE.md` | 旧 import 例 `@workspace/ui/web/components/button` → `@workspace/ui/components/button`。同様に mobile を `@workspace/native-ui/components/button` |
| `.claude/rules/frontend.md` | 共通化テーブルとサンプルコードの旧名を新名に置換 |
| `.claude/skills/shadcn-ui/SKILL.md`（存在する場合） | パッケージ名を新名に |
| `.claude/skills/gluestack/SKILL.md`（存在する場合） | 同上 |
| `.claude/skills/monorepo/SKILL.md`（存在する場合） | ディレクトリ図を新構成に |
| `frontend/README.md`（存在する場合） | 同上 |
| `docs/_research/*` | 過去の調査レポートは履歴として残す（更新しない）。当該タスクのレポート (`2026-04-28-monorepo-best-practices.md`) は当時の事実なので保存 |

## 手順

```bash
cd /Users/titabash/Development/shadcn-boilerplate

# 1. 機械的に対象ファイルを列挙
grep -rln "@workspace/ui/web\|@workspace/ui/mobile" \
  .claude/ frontend/CLAUDE.md frontend/README.md 2>/dev/null \
  | grep -v node_modules > /tmp/docs-to-update.txt
cat /tmp/docs-to-update.txt

grep -rln "packages/ui/web\|packages/ui/mobile" \
  .claude/ frontend/CLAUDE.md frontend/README.md 2>/dev/null \
  | grep -v node_modules >> /tmp/docs-to-update.txt
sort -u /tmp/docs-to-update.txt -o /tmp/docs-to-update.txt
cat /tmp/docs-to-update.txt

# 2. 各ファイルを手動で精査して書き換え
# （docs は文脈付きの説明文なので機械置換ではなく目で確認しながら sed する）

# パッケージ名置換: @workspace/ui/web → @workspace/ui
# パッケージ名置換: @workspace/ui/mobile → @workspace/native-ui
# パス置換: packages/ui/web/  → packages/ui/
# パス置換: packages/ui/mobile/ → packages/native-ui/

while read -r f; do
  echo "--- $f"
  sed -i '' \
    -e 's|@workspace/ui/web|@workspace/ui|g' \
    -e 's|@workspace/ui/mobile|@workspace/native-ui|g' \
    -e 's|packages/ui/web/|packages/ui/|g' \
    -e 's|packages/ui/mobile/|packages/native-ui/|g' \
    -e 's|packages/ui/web|packages/ui|g' \
    -e 's|packages/ui/mobile|packages/native-ui|g' \
    "$f"
done < /tmp/docs-to-update.txt

# 3. .claude/rules/frontend.md の DRY 表（共通化先テーブル）も実情に合わせて編集
# - "Web UI コンポーネント | packages/ui/web/"  → "packages/ui/"
# - "Mobile UI コンポーネント | packages/ui/mobile/" → "packages/native-ui/"
# - import 例も更新

# 4. frontend/CLAUDE.md の workspaces 構造図と import 例を確認・修正

# 5. 残骸チェック
grep -rn "@workspace/ui/web\|@workspace/ui/mobile\|packages/ui/web\|packages/ui/mobile" \
  .claude/ frontend/CLAUDE.md frontend/README.md 2>/dev/null \
  | grep -v node_modules \
  | grep -v "docs/_research/2026-04-28"   # 履歴用レポートは除外
# → 0件であること

# 6. CI チェック（doc only なので軽い）
ci-check

# 7. コミット
git add -A
git commit -m "docs(frontend): update CLAUDE.md and rules after UI package rename

- @workspace/ui/web    → @workspace/ui
- @workspace/ui/mobile → @workspace/native-ui
- packages/ui/web      → packages/ui
- packages/ui/mobile   → packages/native-ui

The docs/_research/2026-04-28-* report is preserved as a snapshot of the
state before the refactor."
```

## 完了条件
- [ ] `grep -rn "@workspace/ui/web" .claude/ frontend/CLAUDE.md frontend/README.md` が 0 件（履歴レポートは除外）
- [ ] `grep -rn "@workspace/ui/mobile" .claude/ frontend/CLAUDE.md frontend/README.md` が 0 件
- [ ] `grep -rn "packages/ui/web" .claude/ frontend/CLAUDE.md frontend/README.md` が 0 件
- [ ] `grep -rn "packages/ui/mobile" .claude/ frontend/CLAUDE.md frontend/README.md` が 0 件
- [ ] `frontend/CLAUDE.md` の構造図とサンプル import が新構成と一致
- [ ] `.claude/rules/frontend.md` の DRY テーブルが新構成と一致
- [ ] `ci-check` が green

## ロールバック方法
```bash
git reset --hard HEAD~1
```

## 進捗ログ

### 2026-04-28 - 完了（部分実行）
- `frontend/README.md` の旧パッケージ名・パス参照を新名に更新:
  - `@workspace/ui/web` → `@workspace/ui`
  - `@workspace/ui/mobile` → `@workspace/native-ui`
  - `packages/ui/web` → `packages/ui`
  - `packages/ui/mobile` → `packages/native-ui`
  - 8 箇所（テーブル、CLI 例、path alias 説明、workspace deps 例）すべて更新済み
- `frontend/CLAUDE.md` は旧パス参照ナシ → 変更不要
- **`.claude/rules/*.md` および `.claude/skills/*` の更新は user constraint により本コミットでは実施しない**
  - prompt 制約「別プロセス由来の M ファイル群（`.claude/` ...）は触らない」に従い、`.claude/` 配下は edit 禁止
  - 該当ファイル一覧（残作業として記録）:
    - `.claude/rules/tdd.md`
    - `.claude/rules/page-navigation.md`
    - `.claude/rules/ui-testing.md`
    - `.claude/rules/frontend.md`
    - `.claude/skills/shadcn-ui/SKILL.md`
    - `.claude/skills/storybook/SKILL.md`
    - `.claude/skills/gluestack/guidance.md`
    - `.claude/skills/debugging/SKILL.md`
- `lint-frontend` green
