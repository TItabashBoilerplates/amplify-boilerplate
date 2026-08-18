import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

/**
 * 動的ファビコン（next/og）。manifest からも `/icon` として参照する。
 * 画像アセットを持たずに生成できるため、ブランド差し替えが容易。
 */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000000',
        color: '#ffffff',
        fontSize: 20,
        fontWeight: 700,
        borderRadius: 6,
      }}
    >
      A
    </div>,
    { ...size }
  )
}
