import { defineBackend } from '@aws-amplify/backend'
import { FunctionUrlAuthType, HttpMethod } from 'aws-cdk-lib/aws-lambda'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { api } from './functions/api/resource'
import { storage } from './storage/resource'

/**
 * Amplify Gen2 バックエンド定義のエントリポイント。
 *
 * `ampx sandbox`（ローカル）/ `ampx pipeline-deploy`（CI）がこのファイルを起点に
 * Cognito / AppSync+DynamoDB / S3 / Lambda(FastAPI) をプロビジョニングし、
 * `amplify_outputs.json` を生成する。
 *
 * @see https://docs.amplify.aws/nextjs/build-a-backend/
 */
const backend = defineBackend({
  auth,
  data,
  storage,
  api,
})

// --- FastAPI Lambda の配線 -------------------------------------------------
const fastapi = backend.api.resources.lambda
const { userPool, userPoolClient } = backend.auth.resources

// Cognito の検証に必要な値を環境変数で注入（auth_middleware が参照）
fastapi.addEnvironment('COGNITO_USER_POOL_ID', userPool.userPoolId)
fastapi.addEnvironment('COGNITO_APP_CLIENT_ID', userPoolClient.userPoolClientId)

// ブラウザ/SSR から直接呼べるよう Lambda Function URL を公開する。
// 認可は FastAPI 側の Cognito JWT 検証（auth_middleware）で行うため authType=NONE。
const apiUrl = fastapi.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.ALL],
    allowedHeaders: ['*'],
  },
})

// フロントエンドが参照できるよう amplify_outputs.json の custom に URL を出力
backend.addOutput({
  custom: {
    backendApiUrl: apiUrl.url,
  },
})
