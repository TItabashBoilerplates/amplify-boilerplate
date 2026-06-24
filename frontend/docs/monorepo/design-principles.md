# モノレポ設計原則

このドキュメントでは、フロントエンドモノレポにおける**正しい設計原則**と**よくある間違い**を解説します。

---

## 🎯 基本原則

### モノレポの目的

モノレポは**複数アプリ間で実際に共有されるコード**を効率的に管理するためのものです。

**✅ 正しい理解:**
- 複数アプリで**実際に使われる**コンポーネント・ロジックを共有
- ビルドキャッシュによる高速化
- 型定義・ユーティリティの一元管理

**❌ 間違った理解:**
- すべてのコードをパッケージ化する
- アプリ専用のコードも `packages/` に置く
- 過度な抽象化・細分化

---

## 📂 パッケージ配置の判断基準

### 判断フローチャート

```
新しいコンポーネントを作る
      ↓
複数アプリで使う？
      ↓
  Yes ────→ packages/ui/ に配置
      ↓
  No
      ↓
apps/{app}/src/shared/ui/ に配置（FSD）
```

---

## ✅ `packages/` に置くべきもの

### 1. 基本UIコンポーネント（shadcn/ui等）

**理由:** 全アプリで共通して使用

```typescript
// packages/ui/components/ui/button.tsx
export function Button({ children, ...props }) {
  return <button {...props}>{children}</button>
}
```

**使用箇所:**
```typescript
// apps/admin - 管理画面で使用
import { Button } from '@workspace/ui/components/button'

// apps/web - ユーザー向けアプリで使用
import { Button } from '@workspace/ui/components/button'

// apps/mobile - モバイルアプリで使用
import { Button } from '@workspace/ui/components/button'
```

---

### 2. 型定義

**理由:** Supabase型、API型は全アプリで共有

```typescript
// packages/types/src/database.ts
export type Database = {
  public: {
    tables: {
      users: { /* ... */ }
    }
  }
}
```

---

### 3. ユーティリティ関数

**理由:** 日時処理、バリデーション等は全アプリで共通

```typescript
// packages/utils/src/date.ts
export function formatDate(date: Date): string {
  return date.toISOString()
}
```

---

### 4. APIクライアント

**理由:** Supabaseクライアント設定は全アプリで共通

```typescript
// packages/api-client/src/supabase.ts
export function createSupabaseClient() {
  return createClient(url, anonKey)
}
```

---

### 5. 認証ロジック（オプション）

**理由:** 認証フローは全アプリで共通の可能性が高い

```typescript
// packages/auth/src/hooks/useAuth.ts
export function useAuth() {
  // 認証ロジック
}
```

---

## ✅ `apps/{app}/src/shared/` に置くべきもの（FSD）

### 1. アプリ専用のUIコンポーネント

**理由:** そのアプリでしか使わないなら、FSDの `shared/` レイヤーで管理

```typescript
// apps/admin/src/shared/ui/DataTable.tsx
export function DataTable({ data }) {
  // 管理画面専用のデータテーブル
  // 他のアプリでは使わない
}
```

**使用箇所:**
```typescript
// apps/admin/src/features/user-management/ui/UserList.tsx
import { DataTable } from '@/shared/ui/DataTable'  // ← FSD内部でのみ使用
```

---

### 2. アプリ固有のデザイン拡張

```typescript
// apps/web/src/shared/ui/Hero.tsx
export function Hero({ title, subtitle }) {
  // ユーザー向けアプリ専用のヒーローセクション
  // 管理画面では使わない
}
```

---

### 3. アプリ固有のユーティリティ

```typescript
// apps/admin/src/shared/lib/export-csv.ts
export function exportToCSV(data: any[]) {
  // 管理画面専用のCSVエクスポート機能
  // ユーザー向けアプリでは不要
}
```

---

## ❌ よくある間違い

### アンチパターン1: アプリ専用パッケージの作成

```
❌ 間違った構成:

packages/
├── ui/              # 全アプリ共通
├── ui-admin/        # ← 不要！
├── ui-web/          # ← 不要！
└── ui-mobile/       # ← 不要！
```

**なぜ間違いか:**
- `ui-admin` は管理画面でしか使わない → FSDの `shared/` で管理すべき
- `ui-web` はユーザー向けアプリでしか使わない → FSDの `shared/` で管理すべき
- 過度な抽象化で複雑性が増す

**✅ 正しい構成:**

```
packages/
└── ui/              # 全アプリ共通のみ

apps/admin/src/shared/ui/    # admin専用UI
apps/web/src/shared/ui/      # web専用UI
apps/mobile/src/shared/ui/   # mobile専用UI
```

---

### アンチパターン2: 使われていないのに packages/ に置く

```typescript
// ❌ 間違い: apps/admin でしか使わないのに packages/ に置く
packages/ui/components/admin/DataTable.tsx

// ✅ 正解: apps/admin/src/shared/ui/ に置く
apps/admin/src/shared/ui/DataTable.tsx
```

**なぜ間違いか:**
- 「将来使うかも」という推測で共有化しない
- YAGNIの原則（You Aren't Gonna Need It）
- 実際に複数アプリで使うことが確定してから共有化

---

### アンチパターン3: FSDを無視した構成

```
❌ 間違い: FSDの shared/ を使わず、すべて packages/ に置く

apps/admin/
└── src/
    ├── features/
    └── entities/
    # shared/ がない ← FSD違反

packages/
├── admin-features/      # ← FSDの役割を無視
└── admin-components/    # ← FSDの役割を無視
```

**✅ 正解: FSDの構造を維持**

```
apps/admin/
└── src/
    ├── features/        # ビジネス機能
    ├── entities/        # エンティティ
    └── shared/          # アプリ内共有コード
        ├── ui/          # 再利用可能UIコンポーネント
        └── lib/         # 再利用可能ユーティリティ
```

---

## 🔄 共有化の正しいタイミング

### ステップ1: アプリ内で実装（FSD）

```typescript
// apps/admin/src/shared/ui/DataTable.tsx
export function DataTable() {
  // 最初は管理画面専用として実装
}
```

### ステップ2: 他アプリでも使うことが確定

```typescript
// apps/web でも DataTable が必要になった
// → この時点で packages/ に移行を検討
```

### ステップ3: packages/ に移行

```bash
# 実際に複数アプリで使うことが確定したら移動
mv apps/admin/src/shared/ui/DataTable.tsx packages/ui/components/data-table.tsx
```

**重要:** 「将来使うかも」ではなく、**実際に使うことが確定してから**移行する。

---

## 📊 判断基準まとめ

| 質問 | Yes → | No → |
|------|-------|------|
| 複数アプリで**実際に**使われている？ | `packages/` | 次の質問へ |
| 将来的に共有する**明確な計画**がある？ | `packages/` | 次の質問へ |
| そのアプリ内で複数箇所で使う？ | `apps/{app}/src/shared/` | `apps/{app}/src/features/` or `entities/` |

---

## 🎯 実践例

### 例1: Button コンポーネント

**質問:** 複数アプリで使う？
**回答:** Yes（admin、web、mobile全てで使用）
**配置:** `packages/ui/components/ui/button.tsx`

---

### 例2: DataTable コンポーネント

**質問:** 複数アプリで使う？
**回答:** No（管理画面でしか使わない）
**配置:** `apps/admin/src/shared/ui/DataTable.tsx`

---

### 例3: Hero コンポーネント

**質問:** 複数アプリで使う？
**回答:** No（ユーザー向けアプリでしか使わない）
**配置:** `apps/web/src/shared/ui/Hero.tsx`

---

### 例4: PricingCard が admin でも必要になった場合

**初期状態:**
```
apps/web/src/shared/ui/PricingCard.tsx  # web専用
```

**admin でも使うことが確定:**
```bash
# packages/ に移行
mv apps/web/src/shared/ui/PricingCard.tsx packages/ui/components/pricing-card.tsx
```

**移行後:**
```typescript
// apps/web
import { PricingCard } from '@workspace/ui/components/pricing-card'

// apps/admin
import { PricingCard } from '@workspace/ui/components/pricing-card'
```

---

## 🚫 禁止事項

### 1. 推測に基づく共有化

```typescript
// ❌ 「将来使うかも」という推測で packages/ に置かない
packages/ui/components/maybe-used-later/

// ✅ 実際に使うときに移行する
```

### 2. アプリ名を含むパッケージ名

```
❌ packages/ui-admin/
❌ packages/web-components/
❌ packages/mobile-ui/

✅ packages/ui/           # 全アプリ共通のみ
```

### 3. FSDの役割を無視

```
❌ packages/admin-features/    # FSD の features/ の役割
❌ packages/web-entities/      # FSD の entities/ の役割

✅ apps/admin/src/features/
✅ apps/web/src/entities/
```

---

## ✅ チェックリスト

新しいコンポーネント・ロジックを作成する前に確認：

- [ ] 複数アプリで**実際に**使われるか？
- [ ] 使われるなら `packages/` に配置
- [ ] 1つのアプリでしか使わないなら `apps/{app}/src/shared/` に配置
- [ ] 将来の推測ではなく、現在の事実に基づいて判断
- [ ] FSDの構造を維持しているか？
- [ ] アプリ名を含むパッケージ名になっていないか？

---

## 📚 関連ドキュメント

- [FSD公式ドキュメント](https://feature-sliced.design/)
- [アーキテクチャ設計図](./architecture.md)
- [新しいアプリの追加方法](./adding-apps.md)

---

このドキュメントに従うことで、**シンプルで保守しやすい**モノレポ構造を維持できます。

**原則:** 過度な抽象化を避け、実際のニーズに基づいて設計する。
