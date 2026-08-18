import { ImageResponse } from 'next/og'
import { APP_NAME } from '@/shared/config/app'

export const alt = APP_NAME
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * SNS シェア用の OG 画像（全ルート共通）。ブランド名を中央に配置したシンプルなカード。
 * 追加インフラ不要（next/og の ImageResponse でビルド時 / リクエスト時に生成）。
 */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
        color: '#ffffff',
        fontSize: 72,
        fontWeight: 700,
        letterSpacing: '-0.02em',
      }}
    >
      {APP_NAME}
      <div style={{ marginTop: 24, fontSize: 28, fontWeight: 400, color: '#a1a1aa' }}>
        Next.js + AWS Amplify Gen2 Boilerplate
      </div>
    </div>,
    { ...size }
  )
}
