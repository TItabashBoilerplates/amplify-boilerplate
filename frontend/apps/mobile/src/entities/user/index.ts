/**
 * User Entity - Public API（Mobile）
 *
 * 型・ストアは **`@workspace/app` が正本**（Web / Mobile 共有）。
 * ここではそれを再 export し、Mobile 固有の UI だけを足す。
 * **アプリ側で `AppUser` を手書きし直さないこと**（データモデルから乖離する）。
 */

export type { AppUser } from '@workspace/app'
export { toAppUser, useUserProfileStore } from '@workspace/app'

// UI Components（gluestack-ui ベースなので Mobile 固有）
export { UserAvatar } from './ui/UserAvatar'
