---
description: "Mobile UI must assume the keyboard covers ~half the screen; safe areas, input attributes and touch targets"
alwaysApply: false
globs: ["frontend/apps/mobile/**/*.tsx", "frontend/packages/native-ui/**/*.tsx"]
---
# Mobile UI/UX

**MANDATORY**: モバイル（Expo / RN、およびスマホ幅で見られる Web）の UI は、
**キーボードが画面の約 40〜55% を覆う前提**で最初から実装する（指示を待たない）。

正本: `/.claude/rules/mobile-uiux.md`

**これらの不具合は開発中に一切顕在化しない** — シミュレータは既定でハードウェアキーボード扱い、
DevTools は仮想キーボードもセーフエリアもエミュレートせず、ビルド・型・lint・Storybook は全部通る。

## 要点

- **キーボード回避は `react-native-keyboard-controller`**。RN 標準の `KeyboardAvoidingView` は
  Android の edge-to-edge 強制で構造的に壊れているため新規に使わない
- `KeyboardProvider` はアプリのルートに **1 つだけ**（無いとエラーも出さずに何もしない）
- **`behavior` をプラットフォームで書き分けない**（RN 標準版の回避策で、このライブラリでは誤り）
- 入力を含むスクロール容器に **`keyboardShouldPersistTaps="handled"` は必須**
  （無いと「送信ボタンが 1 回目は効かない」）
- **セーフエリアを二重に足さない**（`SafeAreaView` と `useSafeAreaInsets` を混ぜない）
- 入力属性（`inputMode` / `autoComplete` / `textContentType` / `enterKeyHint` /
  `submitBehavior`）は必須。**OTP は必ずオートフィルさせる**（`one-time-code` / `sms-otp`）
- タップ標的は **44×44（HIG）/ 48dp（Material）**、下限 24×24（WCAG 2.5.8）
- Web 側は **`maximumScale` / `userScalable: false` を絶対に書かない**（WCAG 1.4.4 違反）
