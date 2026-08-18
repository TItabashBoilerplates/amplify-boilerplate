# キーボード（Expo / React Native）

対象: `frontend/apps/mobile` / `frontend/packages/native-ui`（Expo SDK 57 / RN 0.86 / Reanimated 4.5.x）

---

## 1. まず仕組みを理解する（ここを知らないと直せない）

### 1.1 iOS と Android は根本的に違う

| | iOS | Android |
|---|---|---|
| 通知 | `UIKeyboardWillShow` を**アニメーション開始前**に配信し、**duration とカーブ**が付く | `WindowInsetsAnimationCallback` が**フレームごと**に現在の inset を配信（Android 11+） |
| RN の `Keyboard` イベント | `keyboardWillShow` / `keyboardWillHide` **が来る** | **`keyboardWill*` は来ない**。`keyboardDidShow` / `keyboardDidHide` のみ |
| 帰結 | 開始前に高さが分かるので同期アニメーションできる | `keyboardDidShow` は**アニメーション完了後**に発火 → 同期できない |

**`Keyboard.addListener('keyboardWillShow', ...)` を Android でも動く前提で書かない。**
プラットフォーム差を自前で吸収するのは再発明（`.claude/rules/minimal-implementation.md`）。

### 1.2 Android の edge-to-edge が何を壊したか（最重要）

従来 Android は `AndroidManifest.xml` の `android:windowSoftInputMode` に従い、**OS が
ウィンドウを縮めて（`adjustResize`）／ずらして（`adjustPan`）**くれていた。

**Android 15（targetSdk 35）以降、edge-to-edge が強制**され、**Android 16 では opt-out できない**
（`edgeToEdgeEnabled` は無効化される）。この状態では:

> **`adjustResize` を指定しても OS はウィンドウをリサイズしない。**
> 代わりに `WindowInsets`（IME inset）をアプリへ渡し、レイアウトの責務をアプリ側へ移す。

結果、**RN 標準の `KeyboardAvoidingView` は構造的に壊れた**:

1. IME inset を見ていない
2. `keyboardDidShow`（完了後）に依存している
3. `LayoutAnimation` のタイミングが Android で不安定

Expo は SDK 54 以降すべてのプロジェクトで edge-to-edge を既定にしており、本リポジトリも
`app.json` に `android.edgeToEdgeEnabled: true` を持つ。**つまり現在の構成はこの影響下にある。**
Expo 公式も edge-to-edge の案内で「`KeyboardAvoidingView` か — **ideally**
`react-native-keyboard-controller`」と書いている。

> **古い Android 端末では今も動いてしまう**ため、「手元で動いた」は根拠にならない。
> **API 35+ の実機 / エミュレータで確認すること。**

---

## 2. `react-native-keyboard-controller`

- ライセンス **MIT** / peer は **`react-native-reanimated >= 3.0.0`**（本リポジトリは 4.5.x）
- **Expo Go では動かない。development build が必要**（ネイティブコードを含む）
- インストール: `bunx expo install react-native-keyboard-controller`（`apps/mobile` で実行）
- **`KeyboardProvider` をアプリのルートに 1 つ**。無いと**エラーを出さずに何もしない**

### 2.1 `KeyboardAvoidingView`

RN 標準と**同名・同 API 感**だが中身は別物（iOS / Android で同一のアニメーションを再現する）。

| `behavior` | 用途 |
|---|---|
| `padding` | **既定的に選ぶもの**。コンテンツを押し上げ、`paddingBottom` を足す |
| `height` | ビュー自体を縮める |
| `position` | ビューを上へずらす。**下部固定ボタンがある画面**向け |
| `translate-with-padding` | translate と `paddingTop` の併用。**チャット向けで最も滑らか** |

| prop | 意味 |
|---|---|
| `keyboardVerticalOffset` | 画面上端と RN ビューの距離を補正（固定ヘッダー・ナビゲーションバー・モーダル） |
| `automaticOffset` | 画面位置（ヘッダー / モーダル）を自動検出。`keyboardVerticalOffset` は**加算**扱いになる |
| `enabled` | 無効化（既定 `true`） |

- **`behavior` をプラットフォーム分岐しない**（`Platform.OS === 'ios' ? 'padding' : undefined` は
  RN 標準版の回避策）。
- 既知の注意: iOS + `translate-with-padding` で、キーボードイベント直前に React の state 更新が
  走るとアニメーションが飛ぶことがある（Reanimated の `DISABLE_COMMIT_PAUSING_MECHANISM`
  フラグで回避）。**チャット以外では踏まない。**

### 2.2 `KeyboardAwareScrollView`（フォーム画面の既定）

フォーカスされた入力の位置と選択範囲を追い、**必要な分だけ**スクロールする。

| prop | 意味 |
|---|---|
| `bottomOffset` | **キーボードとキャレットの間の余白**（既定 `0`）。他ライブラリの `extraHeight` 相当。**24 前後を入れると実用的**（0 だと入力欄がキーボードにぴったり接する） |
| `extraKeyboardSpace` | コンポーネントが画面下端に達していないときの補正。届いていない → 負値 / sticky 要素ぶん伸ばす → 正値 |
| `disableScrollOnKeyboardHide` | キーボードを閉じたときに元位置へ戻さない（既定 `false`） |
| `mode` | `"insets"`（**v1.21.0 以降の既定**。リフローが起きない）/ `"layout"`（flex でボタンを下端に貼る等、**flex 配分に依存するフォーム**はこちら） |
| `enabled` | 無効化 |

- **仮想化リスト（`FlatList` / `FlashList`）の中に入力があるときは、専用ラッパーではなく
  `renderScrollComponent` に `KeyboardAwareScrollView` を渡す。**
- `snapToOffsets` があると実効 `bottomOffset` が指定より大きくなることがある。
- Fabric で `multiline` の高さが伸びるケースに既知の問題がある（伸縮する入力は挙動を実機で確認）。

### 2.3 `KeyboardStickyView`（下部 CTA・アクセサリ）

**ビューを縮めずに、キーボードと一緒に平行移動させるだけ。** 下部固定の送信バー・
ツールバー・「次へ」ボタンに使う。

```tsx
<KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
  <SubmitBar />
</KeyboardStickyView>
```

`offset.closed` / `offset.opened` で閉時 / 開時それぞれの追加余白を指定する
（閉時は safe-area の bottom inset を、開時は 0 を入れる、という使い分けが典型）。

### 2.4 その他

| API | 用途 |
|---|---|
| `KeyboardToolbar` | 複数入力の「前へ / 次へ / 完了」バー。長いフォームで有効 |
| `KeyboardChatScrollView` | チャット向けスクロールビュー |
| `useKeyboardHandler` | **フレーム単位**のキーボード追従（自前アニメーション） |
| `useReanimatedKeyboardAnimation` | 高さ / 進捗を Reanimated の共有値で取得 |
| `useKeyboardState` | 現在の表示状態・高さ |
| `KeyboardController` | 命令的に `dismiss()` / `setFocusTo('next' \| 'prev')` |

---

## 3. スクロール容器の必須プロパティ

```tsx
<KeyboardAwareScrollView
  keyboardShouldPersistTaps="handled"   // ★ 必須
  keyboardDismissMode="interactive"     // チャット / 長い一覧（iOS）。Android は "on-drag"
>
```

- **`keyboardShouldPersistTaps="handled"` が無いと、キーボード表示中の 1 タップ目が
  「キーボードを閉じる」ために消費される。** 送信ボタンが「1 回目は効かない」という
  再現性の低いバグとして報告される典型。
- `"always"` は**キーボードが閉じなくなる**ので使わない（`"handled"` が正解）。

---

## 4. 下タブ・ナビゲーションとの組み合わせ

| やりたいこと | 方法 |
|---|---|
| 入力時にタブバーを隠す | ナビゲーターの `tabBarHideOnKeyboard: true` |
| ヘッダーぶんのズレを補正 | `KeyboardAvoidingView` の `automaticOffset`（または `keyboardVerticalOffset`） |
| `softwareKeyboardLayoutMode` | **既定の `"resize"` のまま**。`"pan"` は keyboard-controller を使わない場合の下タブ回避策 |

`app.json` の値は `"resize"` / `"pan"` の 2 つのみ（既定 `"resize"`）。

---

## 5. セーフエリアとの組み合わせ

```tsx
import { SafeAreaView } from '@workspace/native-ui/components'  // ★ 直接 import しない

<SafeAreaView className="flex-1 bg-background" edges={['top']}>
```

- **`react-native-safe-area-context` の `SafeAreaView` に `className` を渡すと、
  型もビルドも通るのに実行時だけ無視され画面が真っ黒になる**（NativeWind v5 の import 横取りが
  `SafeAreaProvider` しかラップしないため）。詳細 → `.claude/skills/gluestack/SKILL.md`
- **ナビゲーターが処理している辺に inset を足さない**（余白が二重）。`edges` で絞る。
- **`SafeAreaView` と `useSafeAreaInsets` を同一ツリーで混ぜない**（ちらつく）。
- **キーボード表示中に `insets.bottom` を足さない**（隙間が二重に開く）。キーボード回避は
  ライブラリに任せる。

---

## 6. 症状 → 原因 早見表

| 症状 | 原因 |
|---|---|
| 入力欄がキーボードに隠れる（**Android だけ**） | RN 標準の `KeyboardAvoidingView` を使っている。edge-to-edge で `adjustResize` が効かない（§1.2） |
| ライブラリを入れたのに**何も起きない** | `KeyboardProvider` が無い / ナビゲーターの内側にある |
| **1 回目のタップが効かない** | `keyboardShouldPersistTaps="handled"` が無い |
| タップしてもキーボードが閉じない | `keyboardShouldPersistTaps="always"` にしている |
| 入力欄とキーボードが接して読みづらい | `bottomOffset` が 0 |
| 下部ボタンとキーボードの間に**隙間が二重**に開く | safe-area の `insets.bottom` を自前で加算している |
| ヘッダーぶん位置がずれる | `keyboardVerticalOffset` / `automaticOffset` 未設定 |
| flex で下端に貼ったボタンが崩れる | `KeyboardAwareScrollView` の `mode="insets"`（既定）→ `mode="layout"` に変える |
| `FlatList` の中の入力だけ動かない | `renderScrollComponent` を使っていない |
| Expo Go で動かない | ネイティブモジュール。**development build が必要** |
| **iOS Simulator で再現しない** | ハードウェアキーボード接続扱い。**`⌘K` でソフトウェアキーボードを出す** |
| 古い Android 実機では動くのに新しい端末で壊れる | edge-to-edge は API 35+ から。**API 35+ で確認する** |

---

## 出典

- [Expo: Keyboard handling](https://docs.expo.dev/guides/keyboard-handling/)
- [Expo: Edge-to-Edge display, now streamlined for Android](https://expo.dev/blog/edge-to-edge-display-now-streamlined-for-android)
- [Expo: app config (`android.softwareKeyboardLayoutMode`)](https://docs.expo.dev/versions/latest/config/app/)
- [react-native-keyboard-controller: Installation](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/installation)
- [react-native-keyboard-controller: KeyboardAvoidingView](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-avoiding-view)
- [react-native-keyboard-controller: KeyboardAwareScrollView](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-aware-scroll-view)
- [react-native-keyboard-controller: KeyboardStickyView](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-sticky-view)
- [Margelo: The Go-To Guide for Understanding Keyboards in React Native](https://margelo.com/blog/deep-dive-in-keyboard-handling)
- [React Native community: Handling Android 15's edge-to-edge enforcement](https://github.com/react-native-community/discussions-and-proposals/discussions/827)
