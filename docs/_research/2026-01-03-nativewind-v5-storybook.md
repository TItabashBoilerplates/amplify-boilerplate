# NativeWind v5 + Storybook 対応状況調査

**調査日**: 2026-01-03

## 概要

NativeWind v5 と Storybook の統合状況を調査。Tailwind CSS v4 を使用したい場合の選択肢を検討。

## NativeWind バージョン比較

| バージョン | Tailwind CSS | 本番利用 | Storybook Web | Storybook Native |
|-----------|--------------|----------|---------------|------------------|
| **v4.1** | v3 | ✅ 安定 | ✅ 動作 | ✅ 動作 |
| **v5 (preview)** | v4.1+ | ⚠️ プレリリース | ❌ スタイル未適用 | ✅ 動作 |

## NativeWind v5 の要件

- React Native **0.81+**
- Tailwind CSS **v4.1+**
- Reanimated **v4+**
- `react-native-css` パッケージ

## Storybook Web版の問題 (Issue #32018)

### 症状

- `className` で指定した Tailwind クラスが完全に無視される
- Native版（オンデバイス）は正常動作
- Web版（react-native-web経由）でスタイルが適用されない

### 原因（推定）

1. NativeWind v5 で JSX トランスフォームが削除された
2. `react-native-css` パッケージへの依存
3. Vite + react-native-web の変換パイプラインの問題

### ステータス

- Issue #32018: **CLOSED** だが根本解決なし
- 公式の回避策なし

## NativeWind v5 安定版リリース時期

### 公式見解

> **「v5 will be ready when it is ready」**

- タイムラインの公開を停止
- 「State of NativeWind」(YouTube) で進捗共有
- 具体的なリリース日は未定

### 現在のブロッカー

1. JSX トランスフォームの置き換え
2. Reanimated v4 の安定化
3. プレビュー版のバグ（iOS/Android で `@import` エラー）

## 試行可能な回避策

### 1. Metro Config の正しいチェーン処理

```javascript
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");
const { withStorybook } = require("@storybook/react-native/metro");

const config = getDefaultConfig(__dirname);
const nativewindConfig = withNativewind(config);
module.exports = withStorybook(nativewindConfig);
```

### 2. Vite での Tailwind CSS v4 動的インポート

```typescript
// .storybook/main.ts
export default {
  framework: "@storybook/react-native-web-vite",
  viteFinal: async (config) => {
    const { default: tailwindcss } = await import('@tailwindcss/vite');
    config.plugins ||= [];
    config.plugins.push(tailwindcss());
    return config;
  },
};
```

### 3. Babel transformOnly モード（未検証）

```typescript
// vite.config.ts
export default {
  plugins: [
    ['nativewind/babel', { mode: 'transformOnly' }]
  ],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
  },
};
```

## gluestack-ui について

gluestack-ui は NativeWind ベースのため、同じ問題を継承する。

## 現実的な選択肢

| 選択肢 | Tailwind v4 | Web カタログ | 実機確認 | 備考 |
|--------|-------------|--------------|----------|------|
| **A. Web/Mobile UIを分離** | ✅ Web のみ | ✅ Web のみ | ✅ | Mobile Storybook なし |
| **B. Mobile Storybook 保留** | ✅ | ✅ Web のみ | ✅ HMR | 実機 HMR で代替 |
| **C. NativeWind v5 安定待ち** | ✅ | ❌ 待機 | ✅ | 時期未定 |
| **D. Tailwind v3 で妥協** | ❌ | ✅ | ✅ | NativeWind v4.1 |

## 結論

**現時点で「Tailwind CSS v4 + Storybook Web版 + React Native」の組み合わせは安定していない。**

推奨アプローチ:
1. Web コンポーネントは shadcn/ui + Tailwind CSS v4 + Storybook
2. Mobile コンポーネントは実機 HMR で確認（Storybook は一旦保留）
3. NativeWind v5 の安定版リリースを継続ウォッチ

## 参考リンク

- [NativeWind v5 Overview](https://www.nativewind.dev/v5)
- [NativeWind v5 Installation](https://www.nativewind.dev/v5/getting-started/installation)
- [NativeWind v5 Migration Guide](https://www.nativewind.dev/v5/guides/migrate-from-v4)
- [GitHub Issue #32018 - NativeWind Styles Not Displaying](https://github.com/storybookjs/storybook/issues/32018)
- [GitHub Issue #652 - withStoryBook causing issue with nativewind](https://github.com/storybookjs/react-native/issues/652)
- [GitHub Discussion #1422 - Supports Tailwind CSS v4.0](https://github.com/nativewind/nativewind/discussions/1422)
- [Storybook React Native Web Vite](https://storybook.js.org/docs/get-started/frameworks/react-native-web-vite)
- [Using Tailwind v4 with Storybook v8](https://mackie.underdown.wiki/posts/using-tailwind-v4-with-storybook-v8/)
- [GeekyAnts: Universal Storybook with NativeWind](https://techblog.geekyants.com/setting-up-universal-storybook-with-nativewind-a-step-by-step-guide)
- [gluestack-ui GitHub](https://github.com/gluestack/gluestack-ui)
