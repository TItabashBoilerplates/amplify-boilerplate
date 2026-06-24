import { defineBackend } from '@aws-amplify/backend'
import {
  type Function as CdkFunction,
  FunctionUrlAuthType,
  HttpMethod,
} from 'aws-cdk-lib/aws-lambda'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { api } from './functions/api/resource'
import { mcp } from './functions/mcp/resource'
import { restApi } from './functions/rest-api/resource'
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
  restApi,
  mcp,
})

// --- FastAPI Lambda の配線 -------------------------------------------------
// resources.lambda は IFunction 型なので、addEnvironment を呼ぶため concrete な Function に絞る。
const fastapi = backend.api.resources.lambda as CdkFunction
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

// --- 通知（SNS）-----------------------------------------------------------
// OneSignal の置き換え。サーバー駆動の通知基盤として SNS トピックを用意し、
// FastAPI Lambda に publish 権限を付与する（モバイルプッシュは Pinpoint を別途追加）。
const notificationsStack = backend.createStack('notifications')
const notificationsTopic = new Topic(notificationsStack, 'NotificationsTopic')
notificationsTopic.grantPublish(fastapi)
fastapi.addEnvironment('SNS_TOPIC_ARN', notificationsTopic.topicArn)

// --- TypeScript Lambda（Amplify ネイティブ・第一候補）の配線 ----------------
// REST API（Hono）と MCP（@hono/mcp）をそれぞれ Function URL で公開する。
const tsRestApi = backend.restApi.resources.lambda as CdkFunction
const tsMcp = backend.mcp.resources.lambda as CdkFunction

const cors = {
  allowedOrigins: ['*'],
  allowedMethods: [HttpMethod.ALL],
  allowedHeaders: ['*'],
}

// REST API は Cognito JWT を検証する想定（env を注入）
tsRestApi.addEnvironment('COGNITO_USER_POOL_ID', userPool.userPoolId)
tsRestApi.addEnvironment('COGNITO_APP_CLIENT_ID', userPoolClient.userPoolClientId)

const restApiUrl = tsRestApi.addFunctionUrl({ authType: FunctionUrlAuthType.NONE, cors })
const mcpUrl = tsMcp.addFunctionUrl({ authType: FunctionUrlAuthType.NONE, cors })

// フロントエンドが参照できるよう amplify_outputs.json の custom に出力
backend.addOutput({
  custom: {
    backendApiUrl: apiUrl.url, // FastAPI(Python) Lambda
    restApiUrl: restApiUrl.url, // REST API(TypeScript/Hono) Lambda
    mcpUrl: mcpUrl.url, // MCP(TypeScript) Lambda（/mcp）
    notificationsTopicArn: notificationsTopic.topicArn,
  },
})
