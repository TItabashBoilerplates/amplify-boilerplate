# Research-First Development Policy

**MANDATORY**: Before starting any implementation or planning, you MUST conduct thorough research.

## Pre-Implementation Research (REQUIRED)

Before writing any code or creating a plan, you MUST:

1. **Use Context7 MCP** to fetch the latest documentation for all relevant libraries and frameworks
2. **Use WebSearch** to verify current best practices and common pitfalls
3. **Use WebFetch** to read official documentation directly

## What to Research

**ALWAYS research**:
- Library/framework versions and their current APIs
- Deprecated features and their replacements
- Breaking changes in recent versions
- Official recommended patterns and anti-patterns
- TypeScript type definitions and interfaces
- Configuration file formats and schemas
- CLI command syntax and options

**NEVER**:
- Make assumptions based on memory or general knowledge
- Use outdated patterns without verification
- Implement features without checking official docs
- Guess API signatures or parameter types

## Mandatory Research Scenarios

Research is REQUIRED when:
- Using any external library or framework
- Implementing authentication or security features
- Configuring build tools or bundlers
- Setting up database schemas or migrations
- Integrating third-party APIs or services
- Using CLI tools with specific syntax
- Implementing real-time features
- Working with type definitions

## spec サブエージェントとの連携

技術選定や新規モジュールのセットアップ時は、`spec` サブエージェントを積極的に活用してください。

### spec エージェントを使用すべき場面

- 新しいライブラリ/フレームワークの導入
- 既存パッケージのメジャーアップデート
- 設定ファイルの作成・変更
- ビルドツールのセットアップ

### 調査レポートの保存先

spec エージェントは調査結果を `docs/_research/` に保存します：

```
docs/_research/
├── 2024-01-15-tailwindcss-v4.md
├── 2024-01-16-nextjs-16.md
└── ...
```

これらのレポートは将来の参照用に保持され、同じ技術の再調査時に参考にできます。

## Enforcement

This research-first approach is **NON-NEGOTIABLE**. Any implementation without proper research is considered incomplete and must be revised.
