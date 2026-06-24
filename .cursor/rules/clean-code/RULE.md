---
description: "Clean code policy - no backward compatibility, no duplication, no unused code"
alwaysApply: true
globs: []
---
# Clean Code Policy

**MANDATORY**: コードは常にクリーンな状態を維持する。

## 後方互換コードの扱い

**原則: 後方互換は保持しない**

- 未使用の変数・関数・型定義は即座に削除
- deprecated なコードは残さず完全に置換
- リネーム時に `_oldName` のようなエイリアスは作成しない
- re-export による互換レイヤーは作成しない

**例外**: ユーザーから明示的に指示があった場合のみ

### 禁止パターン

```typescript
// ❌ 未使用のリネーム互換
export { newFunction as oldFunction }

// ❌ deprecated コメントで残す
/** @deprecated Use newFunction instead */
export function oldFunction() { ... }

// ✅ 完全に置き換える
// oldFunction を newFunction に変更し、oldFunction を削除
```

## 重複コードの禁止

| 範囲 | 配置先 |
|------|--------|
| 複数アプリ共通 | `packages/` |
| 同一アプリ内共通 | `shared/` レイヤー |
| 同一feature内共通 | feature の `model/` または `lib/` |

## 未使用コードの削除

- インポートされていないexport
- 呼び出されていない関数
- 参照されていない型定義
- コメントアウトされたコード

```typescript
// ❌ コメントアウトで残す
// function oldImplementation() { ... }

// ✅ 不要なら削除（git履歴で復元可能）
```
