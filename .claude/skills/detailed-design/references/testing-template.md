# {Feature Name} - テスト計画

<!--
  出力先: docs/designs/{feature-name}/testing.md
  TDD、Storybook、RLSテスト、E2Eテストの計画を定義する。

  必須参照:
  - .claude/rules/tdd.md - TDD 必須ポリシー
  - .claude/rules/ui-testing.md - UI テスト方針
  - .claude/skills/storybook/SKILL.md - Storybook 10
  - .claude/skills/pgtap/ - RLS・DB 層テスト（pgTAP + `supabase test db`）
  - .claude/skills/python-testing/ - Python 単体テスト
  - .claude/skills/maestro/ - E2E テスト
-->

[< security.md](./security.md) | [rollout.md >](./rollout.md)

## テスト方針

<!--
  テスト対象と手法の対応表。
  UI コンポーネントは単体テスト不要、Storybook で品質担保。
  ビジネスロジック（model/api/lib）は TDD 必須。
-->

| 対象 | テスト手法 | ツール | TDD |
|------|-----------|--------|:---:|
| UI コンポーネント | Storybook | Storybook 10 | - |
| ビジネスロジック (Frontend) | 単体テスト | Vitest | 必須 |
| API フック (Frontend) | 単体テスト | Vitest | 必須 |
| RLS ポリシー / DB 関数 / 制約 | DB 層テスト | pgTAP (`supabase test db`) | 必須 |
| Backend UseCase | 単体テスト | pytest | 必須 |
| Backend Gateway | 単体テスト | pytest | 必須 |
| E2E フロー | E2E テスト | Maestro | - |

## Frontend 単体テスト (TDD)

<!--
  参照: .claude/rules/tdd.md

  TDD ワークフロー:
  1. テストを先に書く (Red)
  2. テストが失敗することを確認
  3. 最小限のコードで通す (Green)
  4. リファクタリング (Refactor)

  テストコマンド: test-frontend
-->

### テスト対象一覧

| ファイル | テストファイル | テスト内容 |
|---------|-------------|-----------|
| entities/{entity}/model/hooks.ts | hooks.test.ts | カスタムフックのロジック |
| entities/{entity}/api/queries.ts | queries.test.ts | Query Key、queryFn |
| features/{feature}/model/hooks.ts | hooks.test.ts | フォームロジック、バリデーション |
| features/{feature}/api/{action}.ts | {action}.test.ts | Mutation、エラーハンドリング |
| shared/lib/{util}.ts | {util}.test.ts | ユーティリティ関数 |

### テストケース設計

#### entities/{entity}/model/hooks.test.ts

```typescript
import { describe, it, expect } from 'vitest'

describe('use{Entity}', () => {
  describe('正常系', () => {
    it('{entity}データを正しく取得できること', () => {
      // Arrange
      // Act
      // Assert
    })

    it('空の結果を正しくハンドリングすること', () => {
      // ...
    })
  })

  describe('異常系', () => {
    it('認証エラー時にリダイレクトすること', () => {
      // ...
    })

    it('ネットワークエラー時にリトライすること', () => {
      // ...
    })
  })
})
```

#### features/{feature}/model/hooks.test.ts

```typescript
import { describe, it, expect } from 'vitest'

describe('use{Feature}Form', () => {
  describe('バリデーション', () => {
    it('必須フィールドが空の場合エラーを返すこと', () => {
      // ...
    })

    it('不正な形式の入力を拒否すること', () => {
      // ...
    })
  })

  describe('送信', () => {
    it('正しいデータで送信できること', () => {
      // ...
    })

    it('送信中に二重送信を防止すること', () => {
      // ...
    })
  })
})
```

## Storybook (UI コンポーネント)

<!--
  参照: .claude/rules/ui-testing.md, .claude/skills/storybook/SKILL.md

  ルール:
  - UI コンポーネントは単体テスト不要
  - Storybook ストーリー必須
  - 最低限: Default, Loading, Error, Empty
  - title は FSD 構造に準拠
  - fn() は storybook/test からインポート
-->

### ストーリー一覧

| コンポーネント | ストーリーファイル | バリエーション |
|--------------|-----------------|--------------|
| {EntityName}Card | entities/{entity}/ui/{EntityName}Card.stories.tsx | Default, Loading, Error, Empty |
| {EntityName}List | entities/{entity}/ui/{EntityName}List.stories.tsx | Default, Loading, Empty, ManyItems |
| {FeatureName}Form | features/{feature}/ui/{FeatureName}Form.stories.tsx | Default, Filled, Submitting, ValidationError |
| {WidgetName} | widgets/{widget}/ui/{WidgetName}.stories.tsx | Default, Loading, Error |

### Mobile ストーリー

<!--
  Mobile (React Native / gluestack-ui) コンポーネントも Storybook の対象。
  Storybook 設定に packages/native-ui/**/*.stories が含まれている。

  参照: .claude/skills/storybook/SKILL.md

  既知の制限:
  - NativeWind v5 は jsx-runtime をエクスポートしていないため、
    Mobile コンポーネントはスタイルが適用されない状態で表示される。
  - 構造の確認のみ可能。NativeWind v5 安定版リリースを待つ。

  title パターン: packages/native-ui/{Component}
  配置先: packages/native-ui/components/{Component}.stories.tsx
-->

| コンポーネント | ストーリーファイル | 備考 |
|--------------|-----------------|------|
| {MobileComponent} | packages/native-ui/components/{MobileComponent}.stories.tsx | スタイル未適用（NativeWind v5 制限） |

### Interaction テスト

```typescript
// features/{feature}/ui/{FeatureName}Form.stories.tsx
import { fn, expect, userEvent, within } from 'storybook/test'

export const SubmitForm: Story = {
  args: {
    onSubmit: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    // フォームに入力
    await userEvent.type(canvas.getByLabelText('Name'), 'Test Name')

    // 送信
    await userEvent.click(canvas.getByRole('button', { name: /submit/i }))

    // コールバック確認
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test Name' })
    )
  },
}
```

## RLS テスト

<!--
  参照: .claude/skills/pgtap/

  pgTAP + `supabase test db` で RLS ポリシーを SQL レベルで検証する。
  テストは supabase/tests/ 配下にフラットに配置し、認証コンテキスト切替は
  supabase-test-helpers (tests.authenticate_as 等) を使用する。
  各テーブルの各操作について、許可/拒否のケースを両方テストする。
-->

### テスト対象ポリシー

| テーブル | ポリシー | テストシナリオ |
|---------|---------|-------------|
| {table} | select_policy_{table} | 自分のデータのみ取得可能 |
| {table} | insert_policy_{table} | 認証ユーザーが自分のデータを作成可能 |
| {table} | update_policy_{table} | 自分のデータのみ更新可能 |
| {table} | service_insert_{table} | service_role のみ作成可能 |

### 実行

```bash
test-db   # = supabase test db --local
```

### テストケース

```sql
-- supabase/tests/{table}_rls.sql
begin;

select plan(7);

-- ===== フィクスチャ =====
select tests.create_supabase_user('user-1', 'user1@example.com');
select tests.create_supabase_user('user-2', 'user2@example.com');

select tests.authenticate_as_service_role();

insert into public.{table} (user_id, /* ... */) values
  (tests.get_supabase_uid('user-1'), /* ... */),
  (tests.get_supabase_uid('user-2'), /* ... */);

-- ===== SELECT =====
select tests.authenticate_as('user-1');

select results_eq(
  $$ select user_id from public.{table} $$,
  $$ values (tests.get_supabase_uid('user-1')) $$,
  '認証ユーザーは自分のデータのみ取得できる'
);

select is_empty(
  $$ select 1 from public.{table} where user_id = tests.get_supabase_uid('user-2') $$,
  '他ユーザーのデータは取得できない'
);

select tests.clear_authentication();

select is_empty(
  $$ select 1 from public.{table} $$,
  '未認証ユーザーはアクセスできない'
);

-- ===== INSERT =====
select tests.authenticate_as('user-1');

select lives_ok(
  $$ insert into public.{table} (user_id /*, ...*/) values (tests.get_supabase_uid('user-1') /*, ...*/) $$,
  '認証ユーザーは自分のデータを作成できる'
);

select throws_ok(
  $$ insert into public.{table} (user_id /*, ...*/) values (tests.get_supabase_uid('user-2') /*, ...*/) $$,
  null,
  '他ユーザーの user_id で作成はブロックされる'
);

-- ===== UPDATE =====
select throws_ok(
  $$ update public.{table} set /* col */ = /* val */ where user_id = tests.get_supabase_uid('user-2') $$,
  null,
  '他ユーザーのデータは更新できない'
);

-- ===== DELETE =====
select throws_ok(
  $$ delete from public.{table} where user_id = tests.get_supabase_uid('user-2') $$,
  null,
  '他ユーザーのデータは削除できない'
);

select * from finish();
rollback;
```

## Backend Python テスト (TDD)

<!--
  参照: .claude/rules/backend-py.md, .claude/skills/python-testing/

  ルール:
  - 外部SDK を丸ごと Mock しない
  - 本物の SDK を使い、I/O層（HTTP/DB）のみ差し替え
  - autospec / spec_set で本物 API に縛る
  - テストコマンド: test-backend-py
-->

### テスト対象一覧

<!-- Backend Python API が必要な場合のみ記述 -->

| ファイル | テストファイル | テスト内容 |
|---------|-------------|-----------|
| usecase/{feature}/{use_case}.py | test_{use_case}.py | ビジネスロジック |
| gateway/{feature}/{gateway}.py | test_{gateway}.py | データアクセス |

### テストケース

```python
# backend-py/tests/usecase/{feature}/test_{use_case}.py
import pytest
from unittest.mock import patch

class TestCreate{Entity}UseCase:
    """正常系"""

    def test_正常なデータで作成できること(self):
        # Arrange
        usecase = Create{Entity}UseCase()
        input_data = {Entity}CreateRequest(
            name="test",
            # ...
        )

        # Act (I/O層のみ差し替え)
        with patch.object(
            usecase.gateway, 'create', autospec=True
        ) as mock_create:
            mock_create.return_value = {Entity}(id="1", name="test")
            result = usecase.execute(mock_session, input_data)

        # Assert
        assert result.id == "1"
        assert result.name == "test"

    """異常系"""

    def test_重複データでConflictErrorを返すこと(self):
        # ...
        pass

    def test_不正な入力でValidationErrorを返すこと(self):
        # ...
        pass
```

## E2E テスト (Maestro)

<!--
  参照: .claude/skills/maestro/

  主要なユーザーフローの E2E テストを定義する。
  Maestro を使用してモバイル / Web のフローをテストする。
-->

### テストシナリオ

| # | シナリオ | 前提条件 | ステップ | 期待結果 |
|---|---------|---------|---------|---------|
| 1 | {entity}の作成 | ログイン済み | フォーム入力 → 送信 | 一覧に表示 |
| 2 | {entity}の編集 | データ存在 | 編集 → 保存 | 更新反映 |
| 3 | {entity}の削除 | データ存在 | 削除ボタン → 確認 | 一覧から消去 |

### Maestro フロー例

```yaml
# maestro/flows/{feature}/create-{entity}.yaml
appId: com.example.app
---
- launchApp
- tapOn: "{Create Button Text}"
- inputText:
    id: "name-input"
    text: "Test Entity"
- tapOn: "{Submit Button Text}"
- assertVisible: "Test Entity"
```

## テスト実行コマンド

| テスト種別 | コマンド |
|-----------|---------|
| Frontend 全体 | `test-frontend` |
| Backend 全体 | `test-backend-py` |
| 全テスト | `unit-test` |

## All Green ポリシー

<!--
  参照: .claude/rules/tdd.md

  作業終了時は必ずすべてのテストが通過（All Green）していること。
  失敗テストを放置して作業を終了することは禁止。
-->

### 作業終了前チェック

```bash
# 全テスト実行 (devenv script、PATH 直結。Makefile は削除済み)
test

# 結果確認
# - すべて PASS であること
# - 新規追加テストが含まれていること
# - 既存テストが破壊されていないこと
```
