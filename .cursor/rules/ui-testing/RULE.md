---
description: "UI testing policy - Storybook for UI components, no unit tests for UI"
alwaysApply: true
globs: ["**/ui/**", "**/*.stories.tsx"]
---
# UI Testing Policy

**MANDATORY**: UI コンポーネントは単体テストではなく **Storybook** で品質を担保する。

## 基本方針

| 対象 | テスト方法 |
|------|-----------|
| **UI コンポーネント** | Storybook（単体テスト不要） |
| **ビジネスロジック** | 単体テスト（TDD 必須） |
| **API / データ取得** | 単体テスト（TDD 必須） |
| **ユーティリティ関数** | 単体テスト（TDD 必須） |

## Storybook 対象（単体テスト不要）

- `packages/ui/web/components/` - shadcn/ui
- `packages/ui/mobile/components/` - gluestack-ui
- `apps/web/src/shared/ui/`
- `apps/web/src/entities/*/ui/`
- `apps/web/src/features/*/ui/`
- `apps/web/src/widgets/*/ui/`
- `apps/web/src/views/*/ui/`

## Storybook 必須要件

UI コンポーネント作成時は**必ず Story を作成**：

```typescript
// 最低限必要なストーリー
export const Default: Story = {}
export const Loading: Story = { args: { isLoading: true } }
export const Error: Story = { args: { error: 'エラー' } }
```

## 禁止事項

**NEVER**:
- UI コンポーネントに Jest/Vitest で DOM テスト
- `render()` + `screen.getByText()` のような RTL テスト
- スナップショットテスト

```typescript
// ❌ 禁止
import { render, screen } from '@testing-library/react'
test('renders button', () => {
  render(<Button>Click</Button>)
  expect(screen.getByText('Click')).toBeInTheDocument()
})

// ✅ 代わりに Storybook
export const Default: Story = { args: { children: 'Click' } }
```

## 詳細

→ Storybook 実装方法は `.claude/skills/storybook/` 参照
