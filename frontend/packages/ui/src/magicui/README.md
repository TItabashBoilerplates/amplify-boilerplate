# MagicUI Components

このディレクトリには、[MagicUI](https://magicui.design/)から取得した高品質なアニメーションコンポーネントが含まれています。

## 含まれるコンポーネント

### AnimatedBeam

**カテゴリ**: Special Effects
**説明**: 2つの要素間を移動するアニメーションビーム。統合機能の紹介に最適。

**使用例**:
```tsx
import { AnimatedBeam } from '@/shared/ui/magicui'
import { useRef } from 'react'

export function IntegrationDemo() {
  const containerRef = useRef<HTMLDivElement>(null)
  const div1Ref = useRef<HTMLDivElement>(null)
  const div2Ref = useRef<HTMLDivElement>(null)

  return (
    <div ref={containerRef} className="relative h-96">
      <div ref={div1Ref} className="absolute top-20 left-20">
        <ServiceIcon />
      </div>
      <div ref={div2Ref} className="absolute bottom-20 right-20">
        <ServiceIcon />
      </div>
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div1Ref}
        toRef={div2Ref}
        curvature={50}
        gradientStartColor="#ffaa40"
        gradientStopColor="#9c40ff"
      />
    </div>
  )
}
```

**Props**:
- `containerRef` (required): コンテナ要素への参照
- `fromRef` (required): 開始要素への参照
- `toRef` (required): 終了要素への参照
- `curvature`: 曲線の強さ（デフォルト: 0）
- `reverse`: アニメーション方向を反転（デフォルト: false）
- `pathColor`: パスの色（デフォルト: "gray"）
- `pathWidth`: パスの幅（デフォルト: 2）
- `gradientStartColor`: グラデーション開始色（デフォルト: "#ffaa40"）
- `gradientStopColor`: グラデーション終了色（デフォルト: "#9c40ff"）
- `duration`: アニメーション時間（デフォルト: random 4-7s）
- `delay`: アニメーション遅延（デフォルト: 0）

---

### ShimmerButton

**カテゴリ**: Buttons
**説明**: 周囲を移動するシマーエフェクトを持つボタン。

**使用例**:
```tsx
import { ShimmerButton } from '@/shared/ui/magicui'

export function CTASection() {
  return (
    <ShimmerButton
      shimmerColor="#ffffff"
      background="rgba(0, 0, 0, 1)"
      borderRadius="8px"
      onClick={() => console.log('Clicked!')}
    >
      Get Started
    </ShimmerButton>
  )
}
```

**Props**:
- `shimmerColor`: シマーの色（デフォルト: "#ffffff"）
- `shimmerSize`: シマーのサイズ（デフォルト: "0.05em"）
- `borderRadius`: ボーダー半径（デフォルト: "100px"）
- `shimmerDuration`: アニメーション時間（デフォルト: "3s"）
- `background`: 背景色（デフォルト: "rgba(0, 0, 0, 1)"）
- `className`: 追加のCSSクラス
- `children`: ボタンコンテンツ

---

### Meteors

**カテゴリ**: Special Effects
**説明**: 流れ星エフェクト。背景装飾に最適。

**使用例**:
```tsx
import { Meteors } from '@/shared/ui/magicui'

export function HeroSection() {
  return (
    <div className="relative h-screen overflow-hidden">
      <Meteors number={30} />
      <div className="relative z-10">
        <h1>Welcome to our site</h1>
      </div>
    </div>
  )
}
```

**Props**:
- `number`: 流れ星の数（デフォルト: 20）
- `minDelay`: 最小遅延（秒）（デフォルト: 0.2）
- `maxDelay`: 最大遅延（秒）（デフォルト: 1.2）
- `minDuration`: 最小アニメーション時間（秒）（デフォルト: 2）
- `maxDuration`: 最大アニメーション時間（秒）（デフォルト: 10）
- `angle`: 流れ星の角度（デフォルト: 215）
- `className`: 追加のCSSクラス

---

## インポート方法

すべてのコンポーネントは、FSD（Feature-Sliced Design）構造に従ったPublic APIからインポートできます：

```tsx
// 個別インポート
import { AnimatedBeam, ShimmerButton, Meteors } from '@/shared/ui/magicui'

// または型定義を含む
import { AnimatedBeam, type AnimatedBeamProps } from '@/shared/ui/magicui'
```

## 依存関係

これらのコンポーネントは以下のパッケージに依存しています：

- `motion` (Framer Motion v12): AnimatedBeam用
- `@workspace/ui/lib/utils`: `cn`ユーティリティ関数

依存関係がインストールされていることを確認してください：

```bash
bun add motion
```

## アニメーション設定

MagicUIコンポーネントは、TailwindCSS 4のアニメーションクラスを使用しています。`tailwind.config.ts`で以下のアニメーションが定義されている必要があります：

- `animate-meteor`
- `animate-shimmer-slide`
- `animate-spin-around`

これらはプロジェクトのTailwind設定で既に定義されています。

## ベストプラクティス

1. **パフォーマンス**: 大量のMeteorsやAnimatedBeamを使用する場合は、`number`プロパティを調整してパフォーマンスを最適化してください。

2. **アクセシビリティ**: AnimatedBeamやMeteorsは装飾的な要素のため、スクリーンリーダーからは隠すことを推奨します：
   ```tsx
   <div aria-hidden="true">
     <AnimatedBeam ... />
   </div>
   ```

3. **レスポンシブデザイン**: モバイルデバイスではアニメーション数を減らすことを検討してください：
   ```tsx
   <Meteors number={isMobile ? 10 : 30} />
   ```

## 追加のMagicUIコンポーネント

さらにMagicUIコンポーネントが必要な場合は、MagicUI MCPツールを使用して追加できます：

```bash
# 利用可能なコンポーネントを確認
mcp__magicuidesign__getUIComponents

# カテゴリ別に取得
mcp__magicuidesign__getSpecialEffects   # 特殊エフェクト
mcp__magicuidesign__getButtons           # ボタン
mcp__magicuidesign__getBackgrounds       # 背景
mcp__magicuidesign__getTextAnimations    # テキストアニメーション
```

## ライセンス

これらのコンポーネントは[MagicUI](https://magicui.design/)から取得されています。MagicUIのライセンス条項に従ってください。
