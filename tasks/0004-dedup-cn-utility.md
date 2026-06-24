# `cn` ユーティリティの重複削除（apps/web shared/lib/utils.ts → @workspace/ui に統一）

## メタ情報
- **状態**: completed
- **優先度**: high
- **作成日**: 2026-04-28
- **更新日**: 2026-04-28
- **担当エージェント**: task-executor

## ゴール
`frontend/apps/web/src/shared/lib/utils.ts`（中身は `@workspace/ui` 側と完全に同一の `cn` ユーティリティ）を削除し、apps/web からの import を `@workspace/ui/lib/utils` に統一する。`.claude/rules/clean-code.md` の「重複コード禁止」ポリシーに従う。

mobile 側に同種の重複があれば同コミットで一緒に削除する（`apps/mobile/src/shared/lib/utils.ts` 等）。

## 前提（依存タスク）
- 先行タスク: `0001-rename-ui-web-to-ui.md`（`@workspace/ui` の名前が確定している必要）
- ブロッカー: なし

## 背景

両ファイルの内容は以下で**完全一致**：

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

apps/web の方を消し、すべて `@workspace/ui/lib/utils` 経由で参照する。

## 変更対象ファイル

### A. 削除対象

| ファイル | 状態 |
|----------|------|
| `frontend/apps/web/src/shared/lib/utils.ts` | 削除 |
| `frontend/apps/mobile/src/shared/lib/utils.ts`（存在する場合） | 削除（mobile 側は `@workspace/native-ui` 由来の同等ユーティリティを使う） |

### B. import 置換対象

```bash
# 検出（apps/web 配下）
cd /Users/titabash/Development/shadcn-boilerplate/frontend
grep -rn "from '@/shared/lib/utils'" --include="*.ts" --include="*.tsx" apps/web
grep -rn 'from "@/shared/lib/utils"' --include="*.ts" --include="*.tsx" apps/web
# 「cn」を import している箇所だけ置換（他の関数を import している場合は注意）
```

`@/shared/lib/utils` から `cn` を import している箇所を、`@workspace/ui/lib/utils` からの import に変更する。同じファイルから他のユーティリティも import している場合は、そちらは shared/lib/ に残すか、適切な配置先（`apps/web/src/shared/lib/<別ファイル>.ts`）に分離する。

## 手順

```bash
cd /Users/titabash/Development/shadcn-boilerplate/frontend

# 1. 重複の最終確認
diff apps/web/src/shared/lib/utils.ts packages/ui/src/lib/utils.ts
# → 一致を確認（差分があれば内容を精査）

# 2. apps/web 内で @/shared/lib/utils から cn を import している箇所を列挙
grep -rn "from '@/shared/lib/utils'" --include="*.ts" --include="*.tsx" apps/web > /tmp/cn-refs.txt
grep -rn 'from "@/shared/lib/utils"' --include="*.ts" --include="*.tsx" apps/web >> /tmp/cn-refs.txt
cat /tmp/cn-refs.txt

# 3. utils.ts に cn 以外の export があるか確認
cat apps/web/src/shared/lib/utils.ts
# → cn のみであることを確認（他の関数があれば別途対応が必要）

# 4. import を置換
#    cn だけを named import している箇所を一括変換
find apps/web \
  \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" \
  -exec sed -i '' \
    -e "s|from '@/shared/lib/utils'|from '@workspace/ui/lib/utils'|g" \
    -e 's|from "@/shared/lib/utils"|from "@workspace/ui/lib/utils"|g' \
    {} +

# 5. 削除
git rm apps/web/src/shared/lib/utils.ts

# 6. mobile 側に同種ファイルがあるか確認 → あれば削除
ls apps/mobile/src/shared/lib/utils.ts 2>/dev/null && cat apps/mobile/src/shared/lib/utils.ts
# → 同一内容なら同様の置換 + 削除
# （mobile は @workspace/native-ui を使うので置換先は @workspace/native-ui/lib/utils など。
#  実際の存在パスは確認してから）

# 7. 残骸チェック
grep -rn "@/shared/lib/utils" frontend/apps/web --include="*.ts" --include="*.tsx" 2>/dev/null
# → 0件であること（cn 以外のユーティリティを残す場合は対象外）

# 8. CI チェック
cd /Users/titabash/Development/shadcn-boilerplate
ci-check

# 9. コミット
git add -A
git commit -m "refactor(frontend): dedupe cn utility, use @workspace/ui/lib/utils everywhere

- apps/web/src/shared/lib/utils.ts duplicated packages/ui/src/lib/utils.ts.
- Per .claude/rules/clean-code.md, code duplication across packages/apps
  must be eliminated. Single source of truth is the shared package."
```

## 完了条件
- [ ] `frontend/apps/web/src/shared/lib/utils.ts` が存在しない
- [ ] `grep -r "@/shared/lib/utils" frontend/apps/web` で `cn` の import が 0 件
- [ ] `frontend/apps/mobile` 側にも重複があれば削除済み
- [ ] `ci-check` が green
- [ ] `type-check-frontend` で `cn` import エラーがない

## ロールバック方法
```bash
git reset --hard HEAD~1
```

## 進捗ログ

### 2026-04-28 - 完了
- `apps/web/src/shared/lib/utils.ts` と `packages/ui/src/lib/utils.ts` の中身が完全一致を確認
- `apps/web` 配下に `@/shared/lib/utils` を import している箇所は 0 件（grep 確認）
- `git rm frontend/apps/web/src/shared/lib/utils.ts` で削除
- mobile 側: `apps/mobile/src/shared/lib/` には `index.ts` しかなく `utils.ts` は存在しない（スキップ）
- `lint-frontend` green
