---
paths: frontend/**/*.{ts,tsx,js,jsx,css,json}
---

# Mobile UI/UX Policy（キーボード・セーフエリア・タップ標的の不変条件）

**CRITICAL / NON-NEGOTIABLE**: **モバイル（Expo / React Native、および「スマホ幅で見られる Web」）
の UI は、キーボードが画面の約半分を覆う前提で設計・実装する。** 入力を含む画面は、
開発者から指示されなくても最初からキーボード回避・セーフエリア・タップ標的サイズを満たすこと。

このポリシーが厳格なのは、**これらの不具合が開発時に一切顕在化しない**からである。

| なぜ気づけないか | 実態 |
|---|---|
| **開発機がキーボードを出さない** | シミュレータは既定でハードウェアキーボード接続扱い（iOS Simulator は `⌘K` でトグル）。ソフトウェアキーボードを出さない限り、入力欄がキーボードに隠れる不具合は**一度も再現しない** |
| **ビルド・型・lint・Storybook が全部通る** | キーボードに隠れたボタンも、セーフエリアの外に出た CTA も、24px のタップ標的も、**静的検査では何も落ちない** |
| **Android は OS バージョンで壊れ方が変わる** | edge-to-edge（Android 15+ で強制、16 で opt-out 不可）により、**長年動いていた `KeyboardAvoidingView` が構造的に壊れた**。古い端末でだけ動くので「直っている」と誤認する |
| **デスクトップ Chrome の DevTools では再現しない** | デバイスモードはビューポート幅を変えるだけで、**仮想キーボードもセーフエリアもエミュレートしない** |

> 詳細な実装手順・API・落とし穴の解説は **`.claude/skills/mobile-uiux/`** を参照
> （本ファイルは「守るべき不変条件」だけを定める）。

---

## 0. 適用判定

| 対象 | 適用 |
|---|---|
| `frontend/apps/mobile/**`（Expo / React Native） | **全面適用** |
| `frontend/packages/native-ui/**` | **全面適用** |
| `frontend/apps/web/**` / `frontend/packages/ui/**` | **スマホ幅（< 768px）での挙動に適用**（§4・§5・§6） |
| `react-native-web` / `use-dom` 経由で Web に出るもの | 両方適用（実体が DOM になる） |

「モバイルアプリを出さない Web だけのプロダクト」でも §4〜§6 は適用する
（**モバイル Web でもキーボードは画面の半分を覆う**）。

---

## 1. キーボードのある画面は「キーボードを考慮した」と言える状態にする（Native）

### 1.1 `react-native-keyboard-controller` を使う（RN 標準の `KeyboardAvoidingView` は使わない）

**MANDATORY**: `apps/mobile` で `TextInput` を含む画面のキーボード回避は
**`react-native-keyboard-controller`** で実装する。**`react-native` の
`KeyboardAvoidingView` を新規に使ってはならない。**

```tsx
// ❌ 禁止: RN 標準。Android の edge-to-edge 下で構造的に壊れている
import { KeyboardAvoidingView } from 'react-native'

// ✅ 正
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller'
```

**理由（推測ではなく仕様上の事実）**:

1. **Android 15（targetSdk 35）以降、edge-to-edge が強制**され、**Android 16 では opt-out できない**
   （Expo は SDK 54 以降すべてのプロジェクトで既定。本リポジトリも `app.json` に
   `android.edgeToEdgeEnabled: true`）。
2. edge-to-edge では **`android:windowSoftInputMode=adjustResize` がウィンドウをリサイズしなくなる**。
   OS は代わりに `WindowInsets` をアプリへ渡し、**レイアウトの責務をアプリ側に移す**。
3. RN 標準の `KeyboardAvoidingView` は **`keyboardDidShow`（＝アニメーション完了後に発火）**に依存し、
   IME inset を見ていない。したがって Android では**入力欄がキーボードに隠れたまま**になるか、
   カクついた遅延アニメーションになる。**Expo 公式も edge-to-edge の案内で
   「ideally `react-native-keyboard-controller`」と明記している。**
4. iOS は `keyboardWillShow` に duration / curve が付くが Android には無い。この非対称を
   自前で吸収するのは**再発明**であり `.claude/rules/minimal-implementation.md` 違反。

> ライブラリ選定は基準を満たしている（MIT / 直近リリースあり / 型同梱 / peer は
> `react-native-reanimated >= 3.0.0` で本リポジトリは 4.5.x。詳細は Skill）。
> **Expo Go では動かない（ネイティブコードを含むため development build が必要）。**

### 1.2 `KeyboardProvider` はアプリのルートに 1 つだけ

`app/providers/AppProvider.tsx` のツリー最上位（ナビゲーターより外側）に置く。
画面ごとに置かない。無いとライブラリのコンポーネントは**無言で何もしない**。

### 1.3 画面の形ごとに使うコンポーネントを決める（迷ったら表に従う）

| 画面の形 | 使うもの |
|---|---|
| **スクロールする入力フォーム**（ログイン・登録・設定・プロフィール編集） | **`KeyboardAwareScrollView`** |
| **画面が固定でスクロールしない**（入力 1〜2 個・ダイアログ内） | `KeyboardAvoidingView`（`behavior="padding"`） |
| **下部固定の CTA / ツールバーをキーボードに追従させたい** | `KeyboardStickyView` |
| **チャット / コメント欄**（末尾が最新・入力が最下部） | `KeyboardChatScrollView` または `behavior="translate-with-padding"` |
| **仮想化リスト（`FlatList` / `FlashList`）内に入力がある** | `renderScrollComponent` に `KeyboardAwareScrollView` を渡す |

**`behavior` をプラットフォーム分岐で書き分けない**（`Platform.OS === 'ios' ? 'padding' : undefined`
は RN 標準版の回避策であり、このライブラリでは不要かつ誤り）。

### 1.4 スクロールコンテナに入力があるなら `keyboardShouldPersistTaps="handled"` は必須

無いと**キーボード表示中の 1 タップ目がキーボードを閉じるだけで消費**され、
送信ボタンやリンクが「1 回目は反応しない」という不具合になる。
チャット・長い一覧では合わせて `keyboardDismissMode="interactive"`（iOS）/ `"on-drag"` を付ける。

### 1.5 下タブと固定 CTA

- Bottom Tabs がある画面で入力を出すなら **`tabBarHideOnKeyboard: true`**（`app.json` の
  `android.softwareKeyboardLayoutMode` は既定の `"resize"` のままにする）。
- **画面下固定の主要ボタン（送信・保存・次へ）は、キーボード表示時も必ず見えていること。**
  キーボードの裏に隠れて到達不能になる CTA は**未完成**とみなす。

---

## 2. セーフエリアは二重に足さない・忘れない（Native）

- **セーフエリアは `@workspace/native-ui` の `SafeAreaView`（または `useSafeAreaInsets`）で扱う。
  `react-native-safe-area-context` から `SafeAreaView` を直接 import してはならない**
  （NativeWind v5 では `className` が型・ビルドを通過するのに実行時だけ無視され、
  **画面が真っ黒になる**実例がある。詳細は `.claude/skills/gluestack/SKILL.md`）。
- **ナビゲーター（Stack / Tabs）が既に inset を処理している辺に、もう一度 inset を足さない。**
  `edges` を指定して対象辺を絞る。二重適用は「上に謎の余白」として現れる。
- **`SafeAreaView` と `useSafeAreaInsets` を同一ツリーで混ぜない**（ちらつきの原因）。
- **下部の safe-area inset とキーボードのオフセットを足し合わせない。**
  キーボード表示中は home indicator の inset は不要で、足すと**隙間が二重**に開く
  （キーボード回避はライブラリに任せ、自前で `insets.bottom` を加算しない）。

---

## 3. 入力フィールドの属性は「省略可能な飾り」ではない（Native / Web 共通）

**MANDATORY**: テキスト入力には、その入力の意味に合った属性を**必ず**付ける。
未指定は「英字キーボードで、オートフィルが効かず、Enter が何をするか分からない入力」を
出荷することであり、モバイルでは実質的な機能欠陥である。

| 意味 | React Native | Web (`@workspace/ui`) |
|---|---|---|
| メール | `inputMode="email"` `autoComplete="email"` `textContentType="emailAddress"` `autoCapitalize="none"` `autoCorrect={false}` | `type="email"` `inputmode="email"` `autocomplete="email"` `autocapitalize="off"` |
| 現在のパスワード | `secureTextEntry` `autoComplete="current-password"` `textContentType="password"` | `type="password"` `autocomplete="current-password"` |
| 新しいパスワード | `secureTextEntry` `autoComplete="new-password"` `textContentType="newPassword"` | `type="password"` `autocomplete="new-password"` |
| **OTP / 6 桁コード** | `inputMode="numeric"` + **iOS `textContentType="oneTimeCode"`** / **Android `autoComplete="sms-otp"`** | `inputmode="numeric"` **`autocomplete="one-time-code"`** |
| 電話番号 | `inputMode="tel"` `autoComplete="tel"` | `type="tel"` `autocomplete="tel"` |
| 検索 | `inputMode="search"` `returnKeyType="search"` | `type="search"` `enterkeyhint="search"` |

- **OTP のオートフィル属性を落とすのは禁止。** 本リポジトリの認証はモバイルのパスワード再設定を
  **6 桁コード方式**と定めており（`.claude/rules/auth.md`）、`oneTimeCode` / `sms-otp` が無いと
  ユーザーは SMS / メールとアプリを往復して手打ちすることになる。
- **Enter キーの意味を明示する**: 次の欄があるなら `returnKeyType="next"`（Web は
  `enterkeyhint="next"`）＋ `ref.focus()` で移動、最後の欄は `"done"` / `"go"` で送信。
- **`blurOnSubmit` は deprecated。`submitBehavior`（`'submit' | 'blurAndSubmit' | 'newline'`）を使う。**
- 複数行は `multiline` + **`textAlignVertical="top"`**（iOS は上寄せ、Android は中央寄せで既定が食い違う）。
  `secureTextEntry` は `multiline` と併用できない。
- **`inputMode` は `keyboardType` に、`enterKeyHint` は `returnKeyType` に、
  `textContentType`(iOS) は `autoComplete` に優先する。**両方書いて食い違わせない。

---

## 4. Web のモバイル: ビューポートとキーボード

### 4.1 `maximum-scale` / `user-scalable=no` は禁止（再掲・最重要）

**Next.js 公式ドキュメントの `generateViewport` のサンプルコードには
`maximumScale: 1, userScalable: false` がそのまま載っている。これをコピーしてはならない。**
WCAG 1.4.4 違反であり、axe でも failure として検出される
（`.claude/rules/form-controls.md` §2.3）。iOS のオートズームは **font-size 16px 以上**で止める。

```ts
// ❌ 禁止（Next.js のドキュメント例をそのまま貼らない）
export const viewport: Viewport = { maximumScale: 1, userScalable: false }
```

### 4.2 キーボードで壊れるのは「`position: fixed` の下部バー」と「`100vh`」

| 現象 | 原因 | 対処 |
|---|---|---|
| 下部固定の CTA がキーボードに隠れる | **iOS Safari の既定は `interactive-widget=resizes-visual`** — レイアウトビューポートが縮まないため `position: fixed` はキーボードの裏に残る | ビューポート meta に **`interactive-widget=resizes-content`**（Next.js は `viewport.interactiveWidget`）を指定するか、`VisualViewport` API で追従させる |
| `100vh` / `100dvh` がキーボードで変わらない | **`dvh` / `svh` / `lvh` は仮想キーボードに反応しない**（レイアウトビューポートが縮んだときだけ変わる） | 同上（`resizes-content` にするとレイアウトビューポートが縮み `dvh` が追従する） |
| ノッチ / ホームインジケータに潜り込む | `viewport-fit=cover` と `env(safe-area-inset-*)` の未対応 | 固定要素の padding に `env(safe-area-inset-bottom)` を足す |

- **`env(keyboard-inset-*)` に依存しない。** VirtualKeyboard API（`navigator.virtualKeyboard.overlaysContent = true`）
  が前提で **Chromium 系のみ**。iOS Safari では常に 0 になり、**iOS でだけ壊れる実装**になる。
- **フォーカスされた入力の直下に固定バーがある場合は `scroll-margin-block` を付ける**
  （ブラウザの自動スクロールが入力をバーの裏に置くのを防ぐ）。

### 4.3 モバイル幅の検証は「幅を狭めた」で終わらせない

DevTools のデバイスモードは**仮想キーボードもセーフエリアもエミュレートしない**。
入力を含む画面を変更したら、**実機（または Simulator でソフトウェアキーボードを表示した状態）**で
「入力欄が見えるか」「送信ボタンに到達できるか」を確認する。

---

## 5. タップ標的サイズ（Native / Web 共通）

**MANDATORY**: タップできる要素は下表を満たす。

| 基準 | 値 | 本リポジトリの扱い |
|---|---|---|
| WCAG 2.2 SC 2.5.8 Target Size (Minimum) **AA** | **24 × 24 CSS px**（または 24px 径の円が他の標的と重ならない間隔） | **絶対下限**。これを割ったら違反 |
| Apple HIG | **44 × 44 pt** | **iOS の既定値** |
| Material Design | **48 × 48 dp** | **Android の既定値** |
| WCAG 2.2 SC 2.5.5 **AAA** | 44 × 44 CSS px | 主要操作はここを目指す |

- **主要な操作（送信・保存・削除・ナビゲーション・アイコンボタン）は 44×44 以上**にする。
  見た目のアイコンが 20px でも、**ヒットエリアを padding / `hitSlop` で広げる**（見た目は変えない）。
- **24×24 未満で「間隔の例外」に頼るのは、リスト内の密なアイコン列で必ず破綻する。** 例外に頼らない。
- **破壊的操作（削除・退会・支払い）を主要操作の隣に置かない**（誤タップは取り返しがつかない）。

---

## 6. 到達性と画面下部（親指の届く範囲）

- **主要アクションは画面下部（親指の緑ゾーン）に置く。** 画面上部の隅は片手操作で
  最も届きにくい（Steve Hoober の thumb zone 研究、Material / HIG が bottom navigation を
  主要ナビゲーションとして推奨する根拠）。
- **Bottom Tabs は 3〜5 個**。6 個以上は「その他」に逃がすのではなく情報設計を見直す。
- **Web でモバイル幅のモーダルは Drawer（下から出るシート）にする**。中央ダイアログは
  スマホでキーボードと衝突しやすい（shadcn/ui の推奨も「モバイルは Drawer / デスクトップは Dialog」）。
  **`Drawer` を `@workspace/ui` に持たずに画面ごとに自作しない**（`.claude/rules/clean-code.md`）。
- **OS のジェスチャと衝突させない**: iOS の画面端スワイプバック、Android の予測型戻る。
  画面端から始まる自前の水平スワイプは避けるか、`hitSlop` で開始位置をずらす。

---

## 7. 禁止パターン

```tsx
// ❌ RN 標準の KeyboardAvoidingView を新規に使う（Android edge-to-edge で壊れている）
import { KeyboardAvoidingView } from 'react-native'

// ❌ behavior をプラットフォームで書き分ける（keyboard-controller では不要かつ誤り）
<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

// ❌ 入力を含む ScrollView に keyboardShouldPersistTaps が無い（1 タップ目が死ぬ）
<ScrollView>{/* TextInput ... */}</ScrollView>

// ❌ react-native-safe-area-context の SafeAreaView に className（実行時だけ無視される）
import { SafeAreaView } from 'react-native-safe-area-context'

// ❌ セーフエリアの bottom inset とキーボード回避を自前で足し算する（隙間が二重に開く）
<View style={{ paddingBottom: insets.bottom + keyboardHeight }} />

// ❌ 入力の属性を省く（英字キーボード・オートフィル無し・Enter の意味不明）
<TextInput placeholder="メールアドレス" onChangeText={setEmail} />

// ❌ OTP 入力にオートフィル属性が無い（SMS とアプリを往復させる）
<TextInput value={code} onChangeText={setCode} />

// ❌ deprecated な blurOnSubmit を使う
<TextInput blurOnSubmit={false} />

// ❌ Next.js のドキュメント例をコピーしてズームを殺す（WCAG 1.4.4 違反）
export const viewport: Viewport = { maximumScale: 1, userScalable: false }

// ❌ env(keyboard-inset-bottom) に依存する（Chromium 限定。iOS で常に 0）
// ❌ 20px のアイコンボタンをそのままタップ標的にする（hitSlop / padding が無い）
// ❌ 画面下固定の送信ボタンがキーボードの裏に入る
```

---

## 8. チェックリスト（入力・モバイル画面を実装／変更したら必ず）

| # | 確認 |
|---|---|
| 1 | キーボードを**実際に表示した状態**で、入力欄と主要ボタンの両方が見えるか（Simulator は `⌘K`） |
| 2 | Native のキーボード回避が `react-native-keyboard-controller` になっているか（RN 標準を使っていないか） |
| 3 | `KeyboardProvider` がアプリのルートに 1 つあるか |
| 4 | 入力を含むスクロールコンテナに `keyboardShouldPersistTaps="handled"` があるか |
| 5 | セーフエリアが二重適用になっていないか（`edges` で絞ったか） |
| 6 | 入力属性（`inputMode` / `autoComplete` / `textContentType` / `enterKeyHint` / `submitBehavior`）が意味に合っているか |
| 7 | OTP 入力に `oneTimeCode`（iOS）/ `sms-otp`（Android）/ `one-time-code`（Web）があるか |
| 8 | フォーム要素のモバイル幅 font-size が 16px 以上か（`.claude/rules/form-controls.md`） |
| 9 | タップ標的が 44×44（最低でも 24×24 + 間隔）を満たすか |
| 10 | Web で `maximumScale` / `userScalable: false` を入れていないか |
| 11 | Web の下部固定バーがキーボード表示時に隠れないか（`interactiveWidget` / `VisualViewport`） |
| 12 | 文言が i18n 化されているか（`.claude/rules/i18n.md`） |
| 13 | Storybook のストーリーがあるか（`.claude/rules/ui-testing.md`） |
| 14 | **Android 実機（または API 35+ エミュレータ）**でキーボードを出して確認したか（edge-to-edge の影響は古い端末では出ない） |

---

## 9. 関連ルール

| ルール | 関係 |
|---|---|
| `.claude/rules/form-controls.md` | 入力要素は 16px 以上・共有コンポーネント必須（本ルールと表裏） |
| `.claude/rules/auth.md` | ログイン / パスワード再設定 / OTP の導線。入力属性はここで効く |
| `.claude/rules/list-pagination.md` | Mobile の一覧は無限スクロール + 仮想化リスト（キーボードとの組み合わせは §1.3） |
| `.claude/rules/clean-code.md` | キーボード回避・セーフエリアのラッパーを画面ごとにコピペしない |
| `.claude/rules/minimal-implementation.md` | キーボード / セーフエリアの制御を自作しない（実績ある OSS に寄せる） |
| `.claude/rules/ui-testing.md` | UI は Storybook。ただし**キーボード挙動は Storybook では担保できない**ので実機確認が要る |
| `.claude/skills/gluestack/` | Mobile UI の実装規約（`SafeAreaView` の罠を含む） |
| `.claude/skills/mobile-uiux/` | **本ルールの実装手順・API・落とし穴の正本** |

---

## 10. 強制事項

このポリシーは**交渉の余地なし**。

- **入力を含む画面をキーボード回避なしで実装した PR はレビューで却下**する。
- **RN 標準の `KeyboardAvoidingView` を新規に導入する変更は却下**する。
- **入力属性（オートフィル / キーボード種別 / Enter キー）を省いた実装は却下**する。
- **タップ標的が 24×24 を割る実装は却下**する。
- 「開発者から指示が無かった」は理由にならない。**指示を待たずに最初から入れる**。
- キーボード方式が要件で割れる場合（全画面をシートで作る、独自の入力オーバーレイを持つ等）は
  推測で進めず**ユーザーに確認**する。

## 参考（一次情報）

- [Expo: Keyboard handling](https://docs.expo.dev/guides/keyboard-handling/) — `KeyboardProvider` / `KeyboardAwareScrollView` / development build 必須
- [Expo: Edge-to-Edge display, now streamlined for Android](https://expo.dev/blog/edge-to-edge-display-now-streamlined-for-android) — Android 16 は opt-out 不可、「ideally react-native-keyboard-controller」
- [react-native-keyboard-controller (docs)](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/installation)
- [Margelo: The Go-To Guide for Understanding Keyboards in React Native](https://margelo.com/blog/deep-dive-in-keyboard-handling) — edge-to-edge で `adjustResize` が効かなくなる仕組み
- [React Native: TextInput](https://reactnative.dev/docs/textinput) — `submitBehavior` / `inputMode` / `autoComplete` / `textContentType` の優先順位
- [CSS Viewport Module: `interactive-widget`](https://github.com/bramus/viewport-resize-behavior/blob/main/explainer.md) — `resizes-visual`（iOS 既定）/ `resizes-content`（Android 既定）/ `overlays-content`
- [MDN: `env()`](https://developer.mozilla.org/en-US/docs/Web/CSS/env) — `safe-area-inset-*` / `keyboard-inset-*`（VirtualKeyboard API 前提）
- [Next.js: generateViewport](https://nextjs.org/docs/app/api-reference/functions/generate-viewport) — `viewportFit` / `interactiveWidget`
- [W3C: WCAG 2.2 SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
