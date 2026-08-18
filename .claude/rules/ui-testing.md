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

- `packages/ui/components/` - shadcn/ui コンポーネント
- `packages/ui/magicui/` - MagicUI コンポーネント
- `packages/native-ui/components/` - gluestack-ui コンポーネント
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

## 完了条件: 「ビルドが通った」で終わらせない（MANDATORY）

**Storybook のストーリー・`.storybook/` の設定を追加/変更したら、`build-storybook` の成功を
もって完了としてはならない。必ず実際に描画して確認する。**

これは実際に起きた事故への対策である:

| 事故 | ビルド結果 | 実際 |
|---|---|---|
| Mobile コンポーネントが全部無スタイル | ✅ 成功 | className が DOM に出ず、CSS も当たっていない |
| 本番ビルドだけ全ストーリーが落ちる | ✅ 成功 | ブラウザで `Cannot access 'X' before initialization` |
| `bg-primary` だけ効かない | ✅ 成功 | クラスは付いているがカスケードで負けている |
| dark を指定したのに light のまま | ✅ 成功 | テーマ decorator の effect が実行されていない |

**いずれも「ビルド成功」「型チェック通過」「lint 通過」をすべて満たしたうえで壊れていた。**
`ci-check` と `unit-test` は UI の描画を一切検証しないので、これらは原理的に検出できない。

### 確認方法

1. **人が見る**: `storybook` → `http://localhost:6006` で該当ストーリーを開く
2. **機械的に確かめる**（設定変更時・回帰確認時は必須）:

   ```bash
   build-storybook            # frontend/storybook-static/ を作る
   verify-storybook-render    # 実行時エラー / 未翻訳キー / 画像 / font-size を実測
   verify-storybook-render --filter auth   # ID で絞る
   ```

   **クラス文字列の有無ではなく `getComputedStyle` の実値を見る**
   （「クラスは付いているのに効いていない」が実際に起きるため）

→ 具体的な症状別の原因と対処は `.claude/skills/storybook/` の
  「ハマりどころ早見表」を参照

## 詳細

→ Storybook の実装方法は `.claude/skills/storybook/` を参照
