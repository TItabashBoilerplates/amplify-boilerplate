import { buildClient, CommitmentPolicy, KmsKeyringNode } from '@aws-crypto/client-node'
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'

/**
 * Cognito CustomEmailSender トリガ（E2E 専用）。OTP を復号して DynamoDB に記録する。
 * 実装は AWS 公式サンプル（Encryption SDK + KMS keyring）に準拠。
 */

const { decrypt } = buildClient(CommitmentPolicy.REQUIRE_ENCRYPT_ALLOW_DECRYPT)
const keyring = new KmsKeyringNode({
  generatorKeyId: process.env.KEY_ID,
  keyIds: [process.env.KEY_ARN as string],
})
const ddb = new DynamoDBClient({})
const TABLE = process.env.CAPTURE_TABLE_NAME as string

interface CustomEmailSenderEvent {
  triggerSource?: string
  userName?: string
  request: {
    code?: string
    userAttributes?: Record<string, string>
  }
}

export const handler = async (event: CustomEmailSenderEvent): Promise<void> => {
  if (!event.request?.code) return

  const { plaintext } = await decrypt(keyring, Buffer.from(event.request.code, 'base64'))
  const code = Buffer.from(plaintext).toString('utf-8')
  const email = event.request.userAttributes?.email ?? event.userName ?? 'unknown'
  const nowSec = Math.floor(Date.now() / 1000)

  await ddb.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: {
        email: { S: email },
        code: { S: code },
        triggerSource: { S: event.triggerSource ?? '' },
        createdAt: { N: String(nowSec) },
        // 10 分で自動失効（DynamoDB TTL）
        ttl: { N: String(nowSec + 600) },
      },
    })
  )
  // コードはログに出さない（メール宛先のみマスク出力）
  console.log(
    `[otp-capture] stored code for ${email.replace(/[^@.]/g, '*')} (${event.triggerSource})`
  )
}
