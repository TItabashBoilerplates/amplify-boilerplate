import { defineBackend } from '@aws-amplify/backend'
import { RemovalPolicy, Stack } from 'aws-cdk-lib'
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb'
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { Key } from 'aws-cdk-lib/aws-kms'
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
import { otpCapture } from './functions/otp-capture/resource'
import { restApi } from './functions/rest-api/resource'
import { storage } from './storage/resource'

// E2E テスト専用: Cognito の Email OTP を DynamoDB に記録する CustomEmailSender を配線するか。
// `AUTH_E2E_OTP_CAPTURE=true ampx sandbox` のときだけ有効。本番/通常 sandbox では一切デプロイしない。
const e2eOtpCapture = process.env.AUTH_E2E_OTP_CAPTURE === 'true'

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
  // E2E OTP キャプチャ関数は opt-in のときだけ含める（通常デプロイには現れない）
  ...(e2eOtpCapture ? { otpCapture } : {}),
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

// --- 本番デフォルト: データ保護（PITR + 削除保護）-------------------------
// Amplify Data（AppSync + DynamoDB）の各モデルテーブルに対し、
// ポイントインタイムリカバリ（PITR, 35日）と削除保護を既定で有効化する。
// Amplify Data のテーブルは素の CfnTable ではなく AmplifyDynamoDbTable カスタム
// リソースで管理されるため、`amplifyDynamoDbTables` 経由で boolean を立てる。
// @see https://docs.amplify.aws/nextjs/build-a-backend/add-aws-services/deletion-backup-resources/
for (const table of Object.values(backend.data.resources.cfnResources.amplifyDynamoDbTables)) {
  table.pointInTimeRecoveryEnabled = true
  table.deletionProtectionEnabled = true
}

// --- 本番デフォルト: Lambda の X-Ray アクティブトレーシング -----------------
// `defineFunction` は tracing オプションを持たず、L2 の `tracing` は構築時専用のため、
// 合成済み関数には L1（CfnFunction）の `tracingConfig` を上書きして有効化する。
// @see https://docs.amplify.aws/nextjs/build-a-backend/functions/modify-resources-with-cdk/
for (const fn of [backend.api, backend.restApi, backend.mcp]) {
  fn.resources.cfnResources.cfnFunction.tracingConfig = { mode: 'Active' }
}

// --- 本番デフォルト: Cognito User Pool の削除保護 --------------------------
// 誤削除でユーザーディレクトリが消えないよう保護する（本番想定の既定）。
backend.auth.resources.cfnResources.cfnUserPool.deletionProtection = 'ACTIVE'

// フロントエンドが参照できるよう amplify_outputs.json の custom に出力
const customOutputs: Record<string, string> = {
  backendApiUrl: apiUrl.url, // FastAPI(Python) Lambda
  restApiUrl: restApiUrl.url, // REST API(TypeScript/Hono) Lambda
  mcpUrl: mcpUrl.url, // MCP(TypeScript) Lambda（/mcp）
  notificationsTopicArn: notificationsTopic.topicArn,
}

// --- E2E 専用: Cognito CustomEmailSender で Email OTP を DynamoDB にキャプチャ -------
// AUTH_E2E_OTP_CAPTURE=true のときだけ配線。Gmail 等の外部メールボックスに依存せず、
// CLI/AI が OTP を取得して認証フローを一気通貫で検証できるようにする。本番では作成しない。
// @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-email-sender.html
if (e2eOtpCapture) {
  // e2eOtpCapture が true のときだけ defineBackend に含めているため非 null
  const captureFn = backend.otpCapture?.resources.lambda as CdkFunction
  // KMS/テーブルも auth スタックに同居させ、nested stack 間の参照（循環依存）を作らない。
  const stack = Stack.of(backend.auth.resources.userPool)

  // OTP 保存テーブル（TTL 10 分・破棄可能）
  const table = new Table(stack, 'OtpCaptureTable', {
    partitionKey: { name: 'email', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
    timeToLiveAttribute: 'ttl',
    removalPolicy: RemovalPolicy.DESTROY,
  })

  // Cognito が OTP を暗号化 / Lambda が復号するための KMS キー
  const key = new Key(stack, 'OtpKmsKey', { removalPolicy: RemovalPolicy.DESTROY })
  const cognito = new ServicePrincipal('cognito-idp.amazonaws.com')
  key.grant(cognito, 'kms:Encrypt', 'kms:Decrypt', 'kms:GenerateDataKey*', 'kms:CreateGrant')
  key.grantDecrypt(captureFn)
  table.grantWriteData(captureFn)

  captureFn.addEnvironment('KEY_ID', key.keyId)
  captureFn.addEnvironment('KEY_ARN', key.keyArn)
  captureFn.addEnvironment('CAPTURE_TABLE_NAME', table.tableName)

  // Cognito から関数を invoke 許可（sourceAccount で User Pool ⇄ Lambda の循環参照を回避）
  captureFn.addPermission('CognitoCustomEmailSenderInvoke', {
    principal: cognito,
    sourceAccount: stack.account,
  })

  // User Pool に CustomEmailSender トリガ + KMS キーを設定（CDK エスケープハッチ）
  const cfnUserPool = backend.auth.resources.cfnResources.cfnUserPool
  cfnUserPool.addPropertyOverride('LambdaConfig.CustomEmailSender.LambdaArn', captureFn.functionArn)
  cfnUserPool.addPropertyOverride('LambdaConfig.CustomEmailSender.LambdaVersion', 'V1_0')
  cfnUserPool.addPropertyOverride('LambdaConfig.KMSKeyID', key.keyArn)

  customOutputs.otpCaptureTableName = table.tableName
}

backend.addOutput({ custom: customOutputs })
