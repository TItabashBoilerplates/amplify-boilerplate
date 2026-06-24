# UI Testing Policy

**MANDATORY**: UI コンポーネントは単体テストではなく **Storybook** で品質を担保する。

## 基本方針

| 対象 | テスト方法 |
|------|-----------|
| **UI コンポーネント** | Storybook（単体テスト不要） |
| **ビジネスロジック** | 単体テスト（TDD 必須） |
| **API / データ取得** | 単体テスト（TDD 必須） |
| **ユーティリティ関数** | 単体テスト（TDD 必須） |

## UI コンポーネントの定義

以下は **Storybook 対象**（単体テスト不要）：

- `packages/ui/web/components/` - shadcn/ui コンポーネント
- `packages/ui/web/magicui/` - MagicUI コンポーネント
- `packages/ui/mobile/components/` - gluestack-ui コンポーネント
- `apps/web/src/shared/ui/` - 共有 UI
- `apps/web/src/entities/*/ui/` - エンティティ UI
- `apps/web/src/features/*/ui/` - フィーチャー UI
- `apps/web/src/widgets/*/ui/` - ウィジェット UI
- `apps/web/src/views/*/ui/` - ビュー UI

## Storybook 必須要件

UI コンポーネントを作成・変更した場合、**必ず Storybook ストーリーを作成**する：

```typescript
// コンポーネント: Button.tsx
// ストーリー: Button.stories.tsx（必須）
```

### ストーリーに含めるべき内容

1. **Default**: 基本状態
2. **バリエーション**: props の組み合わせ
3. **状態**: Loading, Error, Empty, Disabled など
4. **エッジケース**: 長いテキスト、空データなど

```typescript
// 最低限必要なストーリー
export const Default: Story = {}
export const Loading: Story = { args: { isLoading: true } }
export const Error: Story = { args: { error: 'エラー' } }
export const Empty: Story = { args: { data: [] } }
```

## 単体テストが必要なもの

UI コンポーネント内でも、以下は**単体テスト対象**：

- `model/` 内のビジネスロジック
- `api/` 内のデータ取得関数
- `lib/` 内のユーティリティ関数
- カスタムフック（複雑なロジックを含む場合）

```
features/auth/
├── ui/
│   ├── LoginForm.tsx          # Storybook
│   └── LoginForm.stories.tsx  # Storybook
├── model/
│   └── useLoginForm.ts        # 単体テスト（ロジック部分）
└── api/
    └── login.ts               # 単体テスト
```

## 禁止事項

**NEVER**:
- UI コンポーネントに対して Jest/Vitest で DOM テストを書く
- `render()` + `screen.getByText()` のような RTL テスト
- スナップショットテスト

```typescript
// ❌ 禁止: UI コンポーネントの単体テスト
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

test('renders button', () => {
  render(<Button>Click</Button>)
  expect(screen.getByText('Click')).toBeInTheDocument()
})

// ✅ 代わりに: Storybook ストーリー
export const Default: Story = {
  args: { children: 'Click' },
}
```

## 理由

1. **Storybook の利点**:
   - 視覚的な確認が可能
   - デザイナーとの協業に有用
   - ドキュメントとして機能
   - インタラクションテストが可能

2. **単体テストの非効率性**:
   - DOM の詳細に依存しやすい
   - リファクタリング時に壊れやすい
   - 視覚的な問題を検出できない
