---
name: mobile-uiux
description: モバイル（Expo / React Native）と「スマホ幅で見られる Web」の UI/UX を設計・実装・修正するときの正本。とくに**キーボードが画面の約半分を覆う前提での入力 UI**（キーボード回避・スクロール・下部固定 CTA・オートフィル属性・Enter キーの意味・OTP 自動入力）、セーフエリア / edge-to-edge、タップ標的サイズ、親指の到達範囲、モバイル幅のモーダル（Drawer / Sheet）を扱う。ログインやフォームや検索やチャットや設定画面を作る、`TextInput` / `<input>` / `<textarea>` を足す、「入力欄がキーボードに隠れる」「送信ボタンが押せない」「1 回目のタップが効かない」「Android だけ挙動が違う」「下部バーがキーボードの裏に入る」「iOS でフォーカスするとズームする」「セーフエリアにコンテンツが潜る / 余白が二重に開く」「小さくてタップしづらい」といった症状が出る、`apps/mobile` や `packages/native-ui` の画面を触る、Web をスマホ幅で作る、といった場面では必ず最初に起動すること。ユーザーが「キーボード」「UIUX」「レスポンシブ」と一言も言わなくても、入力を含む画面を作るなら対象。
---

# モバイル UI/UX（キーボード・セーフエリア・入力）

**守るべき不変条件は `.claude/rules/mobile-uiux.md`（常時適用ルール）。このスキルは
「どう実装するか」の手順・API・落とし穴を持つ。**

## 0. なぜ入力 UI がモバイルで最優先なのか

**キーボードは画面の 40〜55% を覆う。** つまり入力にフォーカスした瞬間、
設計時に見えていた画面の半分が消える。ここで壊れるのは常に同じ 3 つ:

1. **入力欄そのもの**がキーボードの裏に入る
2. **送信 / 次へ の CTA** がキーボードの裏に入り、到達不能になる
3. **キーボードを閉じる手段が無い**（閉じるための 1 タップ目が吸われる）

そして**このどれも、ビルド・型・lint・Storybook・DevTools のデバイスモードでは検出できない。**
シミュレータは既定でハードウェアキーボード扱いなので、**手元では一度も再現しない**。
だから「指示されたら直す」ではなく「**最初から入れる**」を規約にしている。

---

## 1. 現状（このリポジトリ）と最初にやること

| 項目 | 現状 |
|---|---|
| Expo / RN | **Expo SDK 57 / React Native 0.86**（`app.json` は `android.edgeToEdgeEnabled: true`） |
| Reanimated | **4.5.x**（`react-native-keyboard-controller` の peer `>=3.0.0` を満たす） |
| キーボード制御 | **`react-native-keyboard-controller` は未導入**。`views/auth/ui/AuthScreen.tsx` が **RN 標準の `KeyboardAvoidingView`** を使っている（= Android edge-to-edge 下で構造的に壊れる構成） |
| セーフエリア | `@workspace/native-ui` の `SafeAreaView`（`react-native-safe-area-context` の直接 import は禁止 → `.claude/skills/gluestack/`） |
| Web | `apps/web` に明示的な `viewport` export は無い（Next.js 既定） |

**入力を含む画面に手を入れるときは、まず導入から**:

```bash
cd frontend/apps/mobile && bunx expo install react-native-keyboard-controller
```

- **Expo Go では動かない**（ネイティブコードを含む）。**development build が必要**
  → `.claude/skills/expo-dev-client/`
- 導入後は `app/providers/AppProvider.tsx` の**最上位**に `KeyboardProvider` を置く（§2）。
- `app.json` の `android.softwareKeyboardLayoutMode` は**既定の `"resize"` のまま**にする
  （`"pan"` は下タブの回避策であり、keyboard-controller を使うなら不要）。

---

## 2. `KeyboardProvider` の置き場所（1 つだけ・ルート）

```tsx
// frontend/apps/mobile/src/app/providers/AppProvider.tsx
import { KeyboardProvider } from 'react-native-keyboard-controller'

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardProvider>
      <ThemeProvider ...>
        <GluestackUIProvider>{children}</GluestackUIProvider>
      </ThemeProvider>
    </KeyboardProvider>
  )
}
```

- **ナビゲーターより外側**に置く（画面ごとに置かない）。
- 無いとライブラリのコンポーネントは**エラーも出さずに何もしない**。「効かない」ときは最初にここを疑う。

---

## 3. 画面の形 → 使うコンポーネント（この表で決める）

| 画面の形 | 使うもの | 主なプロパティ |
|---|---|---|
| スクロールする入力フォーム（ログイン / 登録 / 設定 / 編集） | **`KeyboardAwareScrollView`** | `bottomOffset`（キーボードと入力の余白）/ `extraKeyboardSpace` / `keyboardShouldPersistTaps="handled"` |
| 固定レイアウト（入力 1〜2 個 / ダイアログ内） | `KeyboardAvoidingView` | `behavior="padding"` / `keyboardVerticalOffset` / `automaticOffset` |
| 下部固定の CTA・ツールバーをキーボードに追従 | `KeyboardStickyView` | `offset={{ closed: 0, opened: 0 }}` |
| チャット / コメント（末尾が最新・入力が最下部） | `KeyboardChatScrollView` または `behavior="translate-with-padding"` | — |
| 複数入力の行き来を助けたい | `KeyboardToolbar` | 前へ / 次へ / 完了 |
| 仮想化リスト（`FlatList` / `FlashList`）内に入力 | `renderScrollComponent` に `KeyboardAwareScrollView` を渡す | 専用ラッパーは使わない |

詳細な props・落とし穴は **[references/keyboard-native.md](references/keyboard-native.md)**。

### 標準形（フォーム画面）

```tsx
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { SafeAreaView } from '@workspace/native-ui/components'

export function LoginScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 24, gap: 16 }}
        keyboardShouldPersistTaps="handled"   // ← 無いと 1 タップ目が吸われる
        keyboardDismissMode="interactive"
        bottomOffset={24}                      // キーボードと入力の間の余白
      >
        {/* ... 入力と CTA ... */}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  )
}
```

- `edges={['top']}` — 下辺の inset は**キーボード回避と二重にしない**ため外している
  （下タブがある画面ではナビゲーターが処理する）。
- **`behavior` をプラットフォーム分岐しない**。`Platform.OS === 'ios' ? 'padding' : undefined` は
  **RN 標準版の回避策**で、このライブラリでは不要かつ誤り。

---

## 4. 入力フィールドの属性（ここを省くと「使えない入力」になる）

意味ごとの属性は **[references/input-attributes.md](references/input-attributes.md)** に
Native / Web 対応表としてまとめてある。最低限の原則:

- **`inputMode` は `keyboardType` に、`enterKeyHint` は `returnKeyType` に、
  `textContentType`(iOS) は `autoComplete` に優先する。** 両方書いて食い違わせない。
- **`blurOnSubmit` は deprecated → `submitBehavior`**（`'submit' | 'blurAndSubmit' | 'newline'`）。
- **OTP は必ずオートフィルさせる**: iOS `textContentType="oneTimeCode"` /
  Android `autoComplete="sms-otp"` / Web `autocomplete="one-time-code"`。
  本リポジトリの認証はモバイルのパスワード再設定を 6 桁コード方式にしている
  （`.claude/rules/auth.md`）ので、これが無いとユーザーは SMS とアプリを往復する。
- **`multiline` は `textAlignVertical="top"`**（iOS は上寄せ / Android は中央寄せで既定が違う）。
- **フォーム要素のスタイルは共有コンポーネント 1 か所**（`@workspace/ui` / `@workspace/native-ui`）。
  画面ごとにクラス定数をコピペしない（`.claude/rules/form-controls.md` — 実際に事故がある）。

---

## 5. セーフエリアと edge-to-edge

- **`@workspace/native-ui` の `SafeAreaView` を使う。** `react-native-safe-area-context` から
  直接 import すると、NativeWind v5 では `className` が**型もビルドも通るのに実行時だけ無視され、
  画面が真っ黒になる**（`.claude/skills/gluestack/SKILL.md` の「SafeArea の罠」）。
- **二重適用しない。** Stack / Tabs が処理している辺に自分でも inset を足すと余白が二重になる。
  `edges` で対象辺を絞る。
- **`SafeAreaView` と `useSafeAreaInsets` を同じツリーで混ぜない**（ちらつく）。
- **キーボード表示中に `insets.bottom` を足さない。** キーボードが下辺を覆っている間、
  home indicator の inset は不要。足すと隙間が二重に開く。

Android の edge-to-edge が何を変えたか（`adjustResize` が効かなくなる仕組み）は
**[references/keyboard-native.md](references/keyboard-native.md) §1**。

---

## 6. Web（スマホ幅）

**[references/web-mobile.md](references/web-mobile.md)** が正本。要点:

- **`maximumScale` / `userScalable: false` は禁止**（WCAG 1.4.4）。
  **Next.js 公式の `generateViewport` サンプルにこの 2 つがそのまま載っているので、コピーしないこと。**
- iOS Safari の既定は **`interactive-widget=resizes-visual`** → レイアウトビューポートが縮まないので
  **`position: fixed` の下部バーがキーボードの裏に残り、`dvh` も変わらない**。
  必要なら Next.js の `viewport.interactiveWidget = 'resizes-content'` にする。
- **`env(keyboard-inset-*)` に依存しない**（VirtualKeyboard API 前提で Chromium 限定。iOS では常に 0）。
- モバイル幅のモーダルは **Drawer（下から出るシート）**。中央 Dialog はキーボードと衝突する。
  `@workspace/ui` に Drawer が無ければ**まず shadcn で追加してから**使う（`shadcn` Skill を先に起動）。

---

## 7. タップ標的・到達性

**[references/touch-and-layout.md](references/touch-and-layout.md)** が正本。要点:

| 基準 | 値 |
|---|---|
| WCAG 2.2 SC 2.5.8 (AA) | **24×24 CSS px**（絶対下限。間隔の例外に頼らない） |
| Apple HIG | **44×44 pt** |
| Material Design | **48×48 dp** |

- 見た目のアイコンが小さくても、**`hitSlop`（Native）/ padding・疑似要素（Web）でヒットエリアを広げる**。
- **主要操作は画面下部**（親指の届く範囲）。**破壊的操作を主要操作の隣に置かない。**
- Bottom Tabs は 3〜5 個。

---

## 8. 検証（ここを飛ばすと意味が無い）

**「ビルドが通った」「Storybook で見た」では完了にならない。** キーボード挙動は Storybook でも
DevTools のデバイスモードでも再現しない。

| # | やること |
|---|---|
| 1 | **iOS Simulator でソフトウェアキーボードを表示**（`⌘K` = Toggle Software Keyboard）して、入力欄と CTA の両方が見えるか |
| 2 | **Android は API 35+ のエミュレータ / 実機**で確認（edge-to-edge の影響は古い端末では出ない） |
| 3 | キーボード表示中に **CTA を 1 回のタップで押せるか**（`keyboardShouldPersistTaps` の確認） |
| 4 | 入力を順に辿って **Enter キーの表示（次へ / 完了）と挙動**が一致しているか |
| 5 | **オートフィルが出るか**（パスワード / OTP。実機の Keychain / Google パスワードマネージャで確認） |
| 6 | Web は **実機の iOS Safari** でフォーカス時にズームしないか（`.claude/rules/form-controls.md`） |
| 7 | 端末の**文字サイズを最大**にして崩れないか（Dynamic Type / フォントスケール） |

```bash
type-check-mobile      # 型
test-frontend          # 適合テスト
lint-fsd               # FSD 境界
dev-mobile             # Expo Metro（別ターミナルで mobile-ios / mobile-android の TUI）
```

---

## 9. 参照ファイル

| ファイル | 内容 |
|---|---|
| [references/keyboard-native.md](references/keyboard-native.md) | Expo / RN のキーボード内部仕様、edge-to-edge が壊したもの、各コンポーネントの props と落とし穴、症状別の原因表 |
| [references/input-attributes.md](references/input-attributes.md) | 意味 → 属性の対応表（Native / Web）、OTP オートフィル、Enter キー連鎖、優先順位 |
| [references/web-mobile.md](references/web-mobile.md) | ビューポート meta、`interactive-widget`、`dvh/svh/lvh`、`env(safe-area-inset-*)`、VisualViewport、Drawer 判断 |
| [references/touch-and-layout.md](references/touch-and-layout.md) | タップ標的、親指の到達範囲、ナビゲーション、ジェスチャ衝突、アクセシビリティ |

## 関連

- **`.claude/rules/mobile-uiux.md`** — 本スキルの不変条件（常時適用）
- `.claude/rules/form-controls.md` — 16px / 共有コンポーネント
- `.claude/rules/auth.md` — ログイン・OTP・パスワード再設定の導線
- `.claude/skills/gluestack/` — Mobile UI 実装規約（`SafeAreaView` の罠）
- `.claude/skills/shadcn-ui/` / `shadcn` — Web の UI コンポーネント
- `building-native-ui` / `gluestack-ui-v4` / `vercel-react-native-skills` — Mobile の公式スキル
- `ui-ux-pro-max` / `frontend-design` — UI を新規に設計するとき
- `baseline-ui` / `improve-ui` / `web-design-guidelines` — 既存 UI を整える・レビューする
- `accessibility`（WCAG 2.2） / `core-web-vitals` / `fixing-motion-performance` — 品質監査
