---
description: "Skills-first policy - check and launch the relevant Skill before starting any task"
alwaysApply: true
globs: []
---
# Skills-First Policy

**MANDATORY**: 調査・実装・レビュー・デバッグを含む**あらゆるタスクを開始する前に、
利用可能な Skill を確認**し、該当するものがあれば**そのタスクの最初の行動として起動**する。

正本: `/.claude/rules/skills-first.md`

## 起動順

```
Skill → Research（公式ドキュメント） → 実装（devenv コマンド / ampx） → All Green 確認
```

## 主要トリガー

| キーワード / 文脈 | 候補 Skill |
|---|---|
| Amplify / Cognito / AppSync / DynamoDB / S3 / ampx | `amplify-gen2`（最優先） |
| 生成AI / LLM / SSE / エージェント / AgentCore | `amplify-gen2`, `langchain` |
| Next.js / App Router / Server Components | `nextjs`, `next-cache-components`, `next-upgrade` |
| FSD / レイヤー / スライス | `fsd`, `feature-sliced-design` |
| モノレポ / pnpm workspace / Turborepo | `monorepo`, `turborepo` |
| shadcn/ui / TailwindCSS | `shadcn`, `web-design-guidelines` |
| gluestack / NativeWind / Expo | `gluestack-ui-v4`, `building-native-ui` |
| モバイル UI/UX（キーボード / セーフエリア / タップ標的） | `mobile-uiux` |
| リリース / TestFlight / Play / 審査提出 | `mobile-release` |
| ストアの掲載画像 / 掲載文 / 課金商品 | `store-screenshots` |
| デスクトップ / Tauri / IPC / capabilities | `tauri` |
| 設計書を書く | `detailed-design` |
| Storybook | `storybook` |
| Maestro / E2E | `maestro` |

> **正本はセッション冒頭に提示される available skills**。この表は参考。

## 禁止事項

- Skill 一覧を確認せずに調査・実装を開始する
- 「自分の知識で十分」という理由で Skill を飛ばす
- Skill のワークフロー・配置規約を無視して独自実装する
