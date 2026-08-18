---
description: "Frontend code standards for Next.js, React, and FSD architecture"
alwaysApply: false
globs: ["frontend/**/*.ts", "frontend/**/*.tsx"]
---
# Frontend Code Standards

## Architecture

- **Pattern**: Feature Sliced Design (FSD)
- **Segments**: api, model, ui
- **State**: TanStack Query (server), Zustand (global)

## Monorepo Structure

```
frontend/
├── apps/
│   ├── web/        # Next.js 16 + shadcn/ui
│   └── mobile/     # Expo 55 + gluestack-ui
└── packages/
    ├── ui/           # shadcn/ui (Web)
    ├── native-ui/    # gluestack-ui (Mobile)
    ├── tokens/       # Design tokens
    ├── backend/      # Amplify Gen2 backend 定義（@workspace/backend）
    ├── backend-core/ # Amplify Functions 横断の共有ロジック
    ├── data-client/  # generateClient<Schema>()
    ├── auth/         # 認証状態 + 共有バリデーション
    ├── api-client/   # Hey API 生成クライアント
    └── query/        # TanStack Query
```

## DRY Principle (MANDATORY)

| 対象 | 配置場所 |
|------|---------|
| Web UI | `packages/ui/` |
| Mobile UI | `packages/native-ui/` |
| Amplify backend 定義 | `packages/backend/amplify/` |
| Amplify データクライアント | `packages/data-client/` |
| 認証（状態・バリデーション） | `packages/auth/` |
| Amplify Functions 横断の共有 | `packages/backend-core/` |
| Query設定 | `packages/query/` |
| 型定義 | `packages/*/types/` |

## Code Style

- **Linting**: Biome
- **Indentation**: 2 spaces
- **Quotes**: Single
- **TypeScript**: Strict mode

## CSS/Styling

**必須**: CSS変数を使用、ハードコード色禁止

```typescript
// CORRECT
<Card className="bg-background text-foreground">

// WRONG
<Card className="bg-white text-black">
```

