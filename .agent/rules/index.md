# Antigravity Agent Guidelines - Overview

This directory contains guidelines for Antigravity Agent when working in this repository.
This is an **AWS Amplify Gen2** boilerplate (Cognito / AppSync + DynamoDB / S3 / Lambda / SNS / Amplify Hosting).

## Documentation Structure

### Critical Guidelines (MANDATORY)

1. **[Research-First Development Approach](./research-first.md)** ⚠️ **MUST READ**
   - Pre-implementation research protocol
   - Using Context7 MCP, WebSearch, WebFetch
   - Research checklist

2. **[Development Command Guidelines](./command-guidelines.md)** ⚠️ **MUST READ**
   - devenv scripts usage policy (Makefile は削除済み)
   - Amplify backend (sandbox) change policy

### Architecture and Project Structure

3. **[Architecture Overview](./architecture.md)**
   - Frontend Architecture (Next.js 16, React 19, FSD)
   - Amplify Backend (Cognito, AppSync + DynamoDB, S3)
   - Backend Compute (FastAPI on AWS Lambda) and AI/ML Integration

4. **[Package Management](./package-management.md)**
   - Independent monorepo structure
   - Bun, uv, ampx usage patterns

### Development Workflow

5. **[Development Commands](./development-commands.md)**
   - Initial setup
   - Amplify backend (sandbox)
   - Running services
   - Lint & Format

### Coding Standards

6. **[Code Style and Quality](./code-style.md)**
   - Frontend (Biome, TailwindCSS 4)
   - Backend Python (Ruff, MyPy)

7. **[Date and Time Handling](./date-time-handling.md)**
   - Amplify Data (`a.datetime()` / AWSDateTime) configuration
   - Client implementation principles
   - Next.js SSR/CSR hydration strategies

8. **[UI Implementation Guidelines](./ui-implementation.md)**
   - shadcn/ui + TailwindCSS 4
   - Component usage
   - Accessibility compliance

### Testing and Quality Assurance

9. **[Testing Guidelines](./testing.md)** ⚠️ **MUST READ**
   - Test-Driven Development (TDD) requirement
   - Authorization rules declared in `amplify/data/resource.ts`, verified via sandbox integration / E2E
   - CI/CD integration

10. **[UI Testing Policy](./ui-testing.md)** ⚠️ **MUST READ**
    - UI コンポーネントは Storybook で品質担保
    - 単体テスト不要な対象範囲
    - Storybook 必須要件

11. **[Clean Code Policy](./clean-code.md)** ⚠️ **MUST READ**
    - 後方互換コードの扱い（原則：保持しない）
    - 重複コードの禁止
    - 未使用コードの削除

### Debugging

12. **[Debugging Policy](./debugging.md)** ⚠️ **MUST READ**
    - devenv 2.0 native process manager の TUI 最優先（`devenv up` で TUI 自動起動）
    - 非対話環境では `/tmp/devenv-*/processes/logs/<process>.{stdout,stderr}.log` を tail
    - Amplify backend は `ampx sandbox` のデプロイログ / `amplify_outputs.json` / AWS creds で確認

### Environment Configuration

13. **[Environment Configuration](./environment.md)**
    - Amplify secrets (SSM Parameter Store) via `ampx sandbox secret set`
    - Non-secret config and `amplify_outputs.json`

14. **[Special Notes](./special-notes.md)**
    - Type sharing (`Schema` from `@workspace/backend`)
    - AI/ML features
    - Authentication (Cognito)
    - Development workflow

## Domain-Specific Documentation

For detailed information, refer to the following documentation:

- **Frontend**: [`frontend/README.md`](../../frontend/README.md) - Next.js 16, React 19, Feature-Sliced Design, shadcn/ui
- **Amplify Backend**: [`frontend/packages/backend/README.md`](../../frontend/packages/backend/README.md) - Cognito, AppSync + DynamoDB, S3, Lambda
- **Backend Python**: [`backend-py/README.md`](../../backend-py/README.md) - FastAPI on Lambda, Clean Architecture, AI/ML integration

## Core Principles

### Non-Negotiable Policies

1. **Pre-implementation research is mandatory** - No implementation based on assumptions
2. **Use devenv scripts** - Do not execute tools directly. Makefile は deprecated（削除済み）
3. **Amplify backend changes** - Edit `frontend/packages/backend/amplify/` and reflect via `ampx sandbox` (per-dev cloud sandbox); branch/production deploy via Amplify Hosting CI
4. **Test-Driven Development (TDD) is mandatory** - Write tests before implementation
5. **UI components use Storybook, not unit tests** - See `ui-testing.md`
6. **Authorization rules live in `amplify/data/resource.ts`** - Verified via sandbox integration / E2E (replaces RLS DB tests)
7. **Clean Code Policy** - No backward compatibility, no duplication, no unused code
8. **Use TailwindCSS CSS variables** - No hardcoded colors
9. **Debugging via devenv 2.0 native TUI** - `devenv up` で TUI 起動、非対話環境は logs tail
