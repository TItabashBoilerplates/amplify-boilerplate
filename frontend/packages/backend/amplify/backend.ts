import { defineBackend } from '@aws-amplify/backend'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { storage } from './storage/resource'

/**
 * Amplify Gen2 バックエンド定義のエントリポイント。
 *
 * `ampx sandbox`（ローカル）/ `ampx pipeline-deploy`（CI）がこのファイルを起点に
 * Cognito / AppSync+DynamoDB / S3 をプロビジョニングし、`amplify_outputs.json` を生成する。
 *
 * 後続フェーズで FastAPI(Python) Lambda などの custom function をここに追加する。
 *
 * @see https://docs.amplify.aws/nextjs/build-a-backend/
 */
defineBackend({
  auth,
  data,
  storage,
})
