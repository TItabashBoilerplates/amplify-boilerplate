import { defineStorage } from '@aws-amplify/backend'

/**
 * Amplify Storage（S3）— Supabase Storage の置き換え
 *
 * セキュリティ既定は「非公開」。アクセスは path 単位のルールで制御する。
 * - `media/{entity_id}/*` は所有者（Cognito identity）のみ read/write/delete 可
 * - 公開アセットが必要な場合のみ `allow.guest().to(['read'])` 等を明示的に追加する
 *
 * RESTful な path 規約（`{resource}/{id}/...`）を踏襲する。
 *
 * @see https://docs.amplify.aws/nextjs/build-a-backend/storage/
 */
export const storage = defineStorage({
  name: 'amplifyBoilerplateStorage',
  access: (allow) => ({
    'media/{entity_id}/*': [allow.entity('identity').to(['read', 'write', 'delete'])],
  }),
})
