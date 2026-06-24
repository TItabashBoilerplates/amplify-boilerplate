# Test-Driven Development Policy

**MANDATORY**: All implementations MUST follow Test-Driven Development (TDD) methodology.

## TDD Workflow (REQUIRED)

Every implementation MUST follow this strict sequence:

1. **Write Tests First**
   - Define expected inputs and outputs
   - Write test cases BEFORE any implementation code
   - Focus on behavior, not implementation details

2. **Run Tests and Confirm Failure**
   - Execute tests to verify they fail (Red phase)
   - Confirm the test correctly captures the requirement
   - Commit tests at this stage

3. **Implement to Pass Tests**
   - Write minimal code to make tests pass (Green phase)
   - Do NOT modify tests during implementation
   - Continue until all tests pass

4. **Refactor if Needed**
   - Improve code quality while keeping tests green
   - Tests remain unchanged during refactoring

## Prohibited Practices

**NEVER**:
- Write implementation code before tests
- Modify tests to make them pass (fix implementation instead)
- Skip the failing test verification step
- Commit untested code
- Add features without corresponding tests

## Test Commands

| Operation | Command |
|-----------|---------|
| **Frontend Tests** | `test-frontend` (Vitest) |
| **Backend Tests** | `test-backend-py` (pytest) |
| **All Unit Tests** | `unit-test` |
| **DB Tests (pgTAP)** | `test-db` |
| **E2E (Maestro)** | `e2e` / `e2e-web` / `e2e-mobile` |

## Commit Strategy

```
# ✅ Correct TDD commit sequence
1. feat(test): add tests for user authentication  # Red phase
2. feat: implement user authentication            # Green phase
3. refactor: clean up authentication code         # Refactor phase

# ❌ Wrong approach
1. feat: implement user authentication            # No tests first!
```

## Exceptions

TDD is NOT required for:
- Documentation files (README, CLAUDE.md, etc.)
- Configuration files (config.toml, .env, etc.)
- Static assets (images, fonts, etc.)
- Type definition files (when auto-generated)
- **UI コンポーネント**（Storybook で品質担保）

## UI コンポーネントのテスト方針

**UI コンポーネントは単体テスト不要。代わりに Storybook を必須とする。**

### 単体テスト不要（Storybook 対象）

| 対象 | 場所 |
|------|------|
| shadcn/ui | `packages/ui/components/` |
| MagicUI | `packages/ui/magicui/` |
| gluestack-ui | `packages/native-ui/components/` |
| Shared UI | `apps/web/src/shared/ui/` |
| Entity UI | `apps/web/src/entities/*/ui/` |
| Feature UI | `apps/web/src/features/*/ui/` |
| Widget UI | `apps/web/src/widgets/*/ui/` |
| View UI | `apps/web/src/views/*/ui/` |

### 単体テスト必須（TDD 対象）

| 対象 | 場所 |
|------|------|
| ビジネスロジック | `*/model/` |
| API / データ取得 | `*/api/` |
| ユーティリティ | `*/lib/` |
| カスタムフック（ロジック） | `*/model/use*.ts` |

### 例

```
features/auth/
├── ui/
│   ├── LoginForm.tsx          # ❌ 単体テスト不要
│   └── LoginForm.stories.tsx  # ✅ Storybook 必須
├── model/
│   ├── useLoginForm.ts        # ✅ 単体テスト必須（TDD）
│   └── useLoginForm.test.ts
└── api/
    ├── login.ts               # ✅ 単体テスト必須（TDD）
    └── login.test.ts
```

→ 詳細は `.claude/rules/ui-testing.md` および `.claude/skills/storybook/` を参照

## All Green Policy (MANDATORY)

**作業終了時は必ずすべてのテストが通過（All Green）していること。**

### 作業終了前チェックリスト

1. **全テスト実行**: `unit-test` を実行（または個別に `test-frontend` / `test-backend-py` / `test-db`）
2. **失敗テストの対応**:
   - 原因分析を実施
   - 実装の修正（テストは変更しない）
   - 再度テスト実行
3. **All Green確認**: すべてのテストがパスするまで繰り返す

### 失敗テストへの対応

| 状況 | 対応 |
|------|------|
| 実装バグ | 実装を修正 |
| テスト環境問題 | 環境を修正し再実行 |
| 既存テストの破壊 | リグレッションを修正 |
| フレーキーテスト | 根本原因を特定し安定化 |

### 禁止事項

**NEVER**:
- 失敗テストを放置して作業を終了
- テストをスキップ（`skip`/`xfail`）して回避
- 失敗テストを削除して対処
- 「後で直す」として先送り

## Enforcement

This TDD policy is **NON-NEGOTIABLE**. Implementations without prior test cases are considered incomplete and must be revised to include tests first.
