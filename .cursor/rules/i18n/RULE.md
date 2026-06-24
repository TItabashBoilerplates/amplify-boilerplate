---
description: "Internationalization policy: All user-facing text must be translated"
alwaysApply: false
globs: ["frontend/**/*.ts", "frontend/**/*.tsx"]
---
# Internationalization (i18n) Policy

**MANDATORY**: すべてのユーザー向けテキストは多言語対応が必須。

## 基本ルール

### 1. ハードコードテキスト禁止

```typescript
// PROHIBITED
<Button>Save</Button>

// REQUIRED
<Button>{t('common.save')}</Button>
```

### 2. 両言語ファイルへの追加必須

新規テキスト追加時は **両方** のファイルに追加:
- `src/shared/config/i18n/messages/en.json`
- `src/shared/config/i18n/messages/ja.json`

### 3. 翻訳関数

| コンポーネント | 関数 |
|--------------|------|
| Server Component | `getTranslations()` from `next-intl/server` |
| Client Component | `useTranslations()` from `next-intl` |

