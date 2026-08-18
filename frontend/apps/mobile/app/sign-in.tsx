import { signInWithPassword } from '@workspace/auth/api'
import { SignInScreen } from '@/views/auth'

/**
 * ルートは**合成点**。ここで初めて実 API を画面に配線する。
 *
 * 画面とフォームが副作用を props で受け取るのは、Storybook（ブラウザ）が
 * `amplify_outputs.json` を読めないため。合成をルートに寄せることで、
 * カタログ側は純粋な UI として扱える。
 */
export default function SignInRoute() {
  return <SignInScreen signIn={signInWithPassword} />
}
