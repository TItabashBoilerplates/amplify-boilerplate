# `env/` ディレクトリ

環境変数の置き場所。**シークレットは AWS（Amplify secrets / SSM Parameter Store）、
非機密 config はファイル**で分離する。

## 方針: シークレット vs 非機密

| 種類 | 例 | 置き場所 |
|---|---|---|
| **シークレット** | API キー / トークン / OAuth secret / 外部サービスのキー | **Amplify secrets**（SSM Parameter Store） |
| **非機密 config（frontend）** | `amplify_outputs.json` の値、`NEXT_PUBLIC_*` | `apps/web/.env*`（生成物 `amplify_outputs.json` は gitignore） |
| **非機密 config（backend Lambda）** | Cognito ID 等の環境変数 | `amplify/backend.ts` の `addEnvironment(...)` で注入 |

> `.env.local` などの実ファイルは **追跡しない**（`.gitignore` 済み）。秘密の混入を防ぐ。

## シークレット（Amplify secrets / SSM Parameter Store）

Amplify Gen2 のシークレットは SSM Parameter Store に保存され、バックエンド定義から
型安全に参照できる。

```bash
# ローカル sandbox にシークレットを登録（per-developer）
cd frontend/packages/backend
npx ampx sandbox secret set GOOGLE_CLIENT_ID
npx ampx sandbox secret set GOOGLE_CLIENT_SECRET

# 一覧 / 削除
npx ampx sandbox secret list
npx ampx sandbox secret remove GOOGLE_CLIENT_ID
```

ブランチ（dev/staging/prod）のシークレットは **Amplify コンソール → Hosting → Secrets**、
または `ampx pipeline-deploy` 環境で管理する。

バックエンド定義での参照:

```ts
import { secret } from '@aws-amplify/backend'

export const auth = defineAuth({
  loginWith: {
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
      },
    },
  },
})
```

## 非機密 config

| サービス | 方法 |
|---|---|
| **frontend (web)** | `apps/web/.env.local` に `NEXT_PUBLIC_*` を置く。Amplify バックエンドの値は `amplify_outputs.json`（`ampx sandbox` / `ampx generate outputs` で生成）から取得 |
| **frontend (mobile)** | `apps/mobile` の Expo 設定 + `amplify_outputs.json` |
| **backend (Lambda)** | `amplify/backend.ts` で `fn.addEnvironment('KEY', value)`。Cognito ID 等は backend 内で配線済み |

## 参考

- Amplify secrets: https://docs.amplify.aws/nextjs/deploy-and-host/fullstack-branching/secrets-and-vars/
- 生成物 `amplify_outputs.json` は環境ごとに生成し、git 管理しない。
