# Clean Code Policy

**MANDATORY**: コードは常にクリーンな状態を維持する。

## 基本原則

このプロジェクトでは、Feature Sliced Design・モノレポ構成・クリーンアーキテクチャを採用している。
これらのアーキテクチャの目的は**コードの整理と重複排除**である。

## 後方互換コードの扱い

**原則: 後方互換は保持しない**

- 未使用の変数・関数・型定義は即座に削除
- deprecated なコードは残さず完全に置換
- リネーム時に `_oldName` のようなエイリアスは作成しない
- re-export による互換レイヤーは作成しない

**例外**: ユーザーから明示的に「後方互換を保持してほしい」と指示があった場合のみ

### 禁止パターン

```typescript
// ❌ 未使用のリネーム互換
export { newFunction as oldFunction }

// ❌ deprecated コメントで残す
/** @deprecated Use newFunction instead */
export function oldFunction() { ... }

// ❌ 型エイリアスでの互換維持
export type OldType = NewType

// ✅ 完全に置き換える
// oldFunction の呼び出し箇所をすべて newFunction に変更し、oldFunction を削除
```

## 重複コードの禁止

**原則: 同一処理の重複実装は禁止**

### 共通化の階層

| 範囲 | 配置先 |
|------|--------|
| 複数アプリ共通 | `packages/` |
| 同一アプリ内共通 | `shared/` レイヤー |
| 同一feature内共通 | feature の `model/` または `lib/` |

### チェックリスト

コード追加前に確認：

1. 同じ処理が他の場所に存在しないか？
2. packages に共通化すべきか？
3. shared レイヤーに配置すべきか？

## 未使用コードの削除

**原則: 使われていないコードは即座に削除**

- インポートされていないexport
- 呼び出されていない関数
- 参照されていない型定義
- コメントアウトされたコード
- TODO/FIXME付きの放置コード

```typescript
// ❌ コメントアウトで残す
// function oldImplementation() { ... }

// ❌ 「後で使うかも」で残す
export function maybeUseLater() { ... }

// ✅ 不要なら削除（git履歴で復元可能）
```
