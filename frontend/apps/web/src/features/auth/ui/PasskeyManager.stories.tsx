import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@workspace/query'
import { PasskeyManager } from './PasskeyManager'

/**
 * passkey 管理コンポーネント
 *
 * 実データは Cognito（`ampx sandbox` で `loginWith.webAuthn` を有効化）から取るため、
 * Storybook では **TanStack Query のキャッシュを事前に埋めて**各状態を再現する。
 *
 * `queryFn` を実際に走らせると Storybook では `Auth UserPool not configured` で
 * 実行時エラーになり、`verify-storybook-render` が落ちる（＝描画が壊れている）。
 */
const QUERY_KEY = ['auth', 'passkeys']

/** 指定した状態のキャッシュを積んだ QueryClient を返す（fetch は走らせない） */
function withCache(seed: (client: QueryClient) => void) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  })
  seed(client)
  return client
}

const meta = {
  component: PasskeyManager,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PasskeyManager>

export default meta
type Story = StoryObj<typeof meta>

/** 登録済み passkey がある状態 */
export const Default: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={withCache((client) =>
          client.setQueryData(QUERY_KEY, [
            { credentialId: 'cred-1', friendlyCredentialName: 'MacBook Pro' },
            { credentialId: 'cred-2', friendlyCredentialName: 'iPhone' },
          ])
        )}
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
}

/** まだ 1 つも登録していない状態 */
export const Empty: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={withCache((client) => client.setQueryData(QUERY_KEY, []))}>
        <Story />
      </QueryClientProvider>
    ),
  ],
}

/** 名前が付いていない資格情報（credentialId にフォールバックする） */
export const UnnamedCredential: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={withCache((client) =>
          client.setQueryData(QUERY_KEY, [
            { credentialId: 'cred-unnamed', friendlyCredentialName: '' },
          ])
        )}
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
}
