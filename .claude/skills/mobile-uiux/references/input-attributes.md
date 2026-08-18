# 入力フィールドの属性（Native / Web 対応表）

**入力属性は飾りではない。** 未指定の `TextInput` / `<input>` は
「英字キーボードが出て、オートフィルが効かず、Enter が何をするか分からない入力」であり、
モバイルでは機能欠陥にあたる。

---

## 1. 優先順位（食い違わせない）

| 新しい prop | 旧 prop | 関係 |
|---|---|---|
| `inputMode` | `keyboardType` | **`inputMode` が優先** |
| `enterKeyHint` | `returnKeyType` | **`enterKeyHint` が優先** |
| `textContentType`（iOS） | `autoComplete` | **`textContentType` が優先**（後方互換のため） |
| `submitBehavior` | `blurOnSubmit` | **`blurOnSubmit` は deprecated**。`submitBehavior` を使う |

**新しい方だけを書く**のが基本。両方書いて別々の意味にすると、プラットフォームごとに
違う挙動になり切り分け不能になる。

---

## 2. 意味 → 属性（この表からコピーする）

### React Native（`apps/mobile`）

| 用途 | 属性 |
|---|---|
| メール | `inputMode="email"` `autoComplete="email"` `textContentType="emailAddress"` `autoCapitalize="none"` `autoCorrect={false}` |
| ユーザー名 | `autoComplete="username"` `textContentType="username"` `autoCapitalize="none"` |
| 現在のパスワード | `secureTextEntry` `autoComplete="current-password"` `textContentType="password"` `autoCapitalize="none"` |
| 新しいパスワード | `secureTextEntry` `autoComplete="new-password"` `textContentType="newPassword"` `autoCapitalize="none"` |
| **OTP / 確認コード** | `inputMode="numeric"` + **iOS `textContentType="oneTimeCode"`** / **Android `autoComplete="sms-otp"`** |
| 電話番号 | `inputMode="tel"` `autoComplete="tel"` `textContentType="telephoneNumber"` |
| 氏名 | `autoComplete="name"` `textContentType="name"` `autoCapitalize="words"` |
| 郵便番号 | `inputMode="numeric"` `autoComplete="postal-code"` `textContentType="postalCode"` |
| 住所 | `autoComplete="street-address"` `textContentType="fullStreetAddress"` |
| クレジットカード番号 | `inputMode="numeric"` `autoComplete="cc-number"` `textContentType="creditCardNumber"` |
| 検索 | `inputMode="search"` `enterKeyHint="search"` `autoCorrect={false}` |
| 数量・金額 | `inputMode="decimal"`（整数のみなら `"numeric"`） |
| URL | `inputMode="url"` `autoCapitalize="none"` `autoCorrect={false}` |
| 自由記述（本文・メモ） | `multiline` **`textAlignVertical="top"`** |

`autoComplete` は cross-platform 値と片側だけの値が混在する。**Android 専用値
（`sms-otp` / `username-new` / `password-new` / `postal-address*` / `tel-national` 等）と
iOS 専用値（`nickname` / `organization` / `cc-name` / `url` 等）を、もう一方に渡さない。**
共通で使える主な値: `email` / `username` / `name` / `given-name` / `family-name` /
`current-password` / `new-password` / `one-time-code` / `tel` / `postal-code` /
`street-address` / `address-line1` / `address-line2` / `country` / `cc-number` / `off`。

### Web（`apps/web` / `@workspace/ui`）

| 用途 | 属性 |
|---|---|
| メール | `type="email"` `inputmode="email"` `autocomplete="email"` `autocapitalize="off"` `spellcheck="false"` |
| ユーザー名 | `autocomplete="username"` `autocapitalize="off"` |
| 現在のパスワード | `type="password"` `autocomplete="current-password"` |
| 新しいパスワード | `type="password"` `autocomplete="new-password"` |
| **OTP / 確認コード** | `inputmode="numeric"` **`autocomplete="one-time-code"`** `pattern="[0-9]*"` |
| 電話番号 | `type="tel"` `autocomplete="tel"` |
| 郵便番号 | `inputmode="numeric"` `autocomplete="postal-code"` |
| 検索 | `type="search"` `enterkeyhint="search"` |
| 数量・金額 | `inputmode="decimal"` |
| URL | `type="url"` `inputmode="url"` `autocapitalize="off"` |

> **`type="number"` は金額・数量に使わない。** スピナーが付き、スクロールで値が変わり、
> 先頭 0 や桁区切りを扱えない。`inputmode="numeric"` + `type="text"` にする。

---

## 3. OTP のオートフィル（落としてはいけない）

本リポジトリの認証は、**モバイルのパスワード再設定を 6 桁コード方式**と定めている
（`.claude/rules/auth.md`）。オートフィル属性が無いと、ユーザーは SMS / メールアプリと
本アプリを往復して手打ちすることになる。

| プラットフォーム | 属性 | 追加条件 |
|---|---|---|
| iOS | `textContentType="oneTimeCode"` | SMS の場合は Apple のドメイン紐付け形式に沿った本文が必要 |
| Android | `autoComplete="sms-otp"` | — |
| Web | `autocomplete="one-time-code"` | iOS Safari は SMS 本文の形式条件あり |

- **6 桁を 6 個の入力に分割しない。** 分割 UI はオートフィル・貼り付け・スクリーンリーダーの
  すべてを壊す。1 つの入力にして表示だけを分けるなら、オートフィルが効くことを実機で確認する。
- コード入力欄には `autoCapitalize="none"` `autoCorrect={false}`（英数字コードの場合）。

---

## 4. Enter キーの意味と入力の連鎖

**複数入力のフォームで Enter が「改行」や「何も起きない」になっていたら未完成。**

```tsx
const passwordRef = useRef<TextInput>(null)

<TextInput
  ref={emailRef}
  inputMode="email"
  autoComplete="email"
  enterKeyHint="next"                 // キーボードに「次へ」が出る
  submitBehavior="submit"             // フォーカスを外さずに onSubmitEditing を発火
  onSubmitEditing={() => passwordRef.current?.focus()}
/>
<TextInput
  ref={passwordRef}
  secureTextEntry
  autoComplete="current-password"
  enterKeyHint="done"                 // 最後の欄は「完了」
  onSubmitEditing={handleSubmit}
/>
```

`submitBehavior` の値:

| 値 | 挙動 |
|---|---|
| `'submit'` | **フォーカスを保ったまま** `onSubmitEditing` を発火（次の欄へ移すときはこれ） |
| `'blurAndSubmit'` | ぼかして発火（単一行の既定） |
| `'newline'` | 改行を挿入（複数行の既定） |

`enterKeyHint` の値: `'enter'`(iOS) / `'done'` / `'next'` / `'previous'`(Android) /
`'search'` / `'send'` / `'go'`。cross-platform は `done` / `next` / `search` / `send` / `go`。

Web は `enterkeyhint="next"` を付けたうえで、フォームを `<form onSubmit>` で包む
（Enter でのサブミットはブラウザ標準に任せる）。

---

## 5. 複数行入力の注意

```tsx
<TextInput
  multiline
  textAlignVertical="top"   // ★ iOS は上寄せ / Android は中央寄せで既定が食い違う
  submitBehavior="newline"
/>
```

- **`secureTextEntry` は `multiline` と併用できない。**
- `clearButtonMode`（iOS）は単一行のみ。
- 高さを伸ばす実装は `onContentSizeChange`（multiline のみ発火）。Web 側は
  `field-sizing: content`（`@workspace/ui` の `Textarea` が採用済み）。
- **キーボードで伸びる入力 + `KeyboardAwareScrollView` の組み合わせは実機で確認する**
  （Fabric に既知の挙動差がある → `keyboard-native.md` §2.2）。

---

## 6. font-size とオートズーム（Web / react-native-web）

**モバイル幅で computed font-size が 16px 未満のフォーム要素は、iOS Safari がフォーカス時に
自動ズームする。** 標準形は `text-base md:text-sm`。
`maximum-scale` / `user-scalable=no` による回避は **WCAG 1.4.4 違反**につき禁止。

→ 詳細・検出コマンド・実装リファレンスは **`.claude/rules/form-controls.md`**

ネイティブの `TextInput` はこの影響を受けないが、**`react-native-web` / `use-dom` 経由で
DOM になるものは対象**。

---

## 7. ラベル・エラーとアクセシビリティ

- **placeholder をラベル代わりにしない**（入力すると消える／コントラスト不足／
  スクリーンリーダーで読まれないことがある）。可視ラベルを置く。
- Web は `<Label htmlFor>` と `aria-invalid` / `aria-describedby`。
- Mobile は gluestack の `FormControl`（`FormControlLabel` / `FormControlHelper` /
  `FormControlError` + `isInvalid`）で組む。`Input` の `isInvalid` と対応させる。
- **エラーは入力の直下に、何をすれば直るかを書く。** 「入力が不正です」は不可。
- すべての文言は **i18n 必須**（`.claude/rules/i18n.md`）。

---

## 出典

- [React Native: TextInput](https://reactnative.dev/docs/textinput) — `submitBehavior` / `inputMode` / `autoComplete` / `textContentType` / `enterKeyHint` の値と優先順位
- [MDN: HTML autocomplete attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete)
- [MDN: inputmode](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode)
- [MDN: enterkeyhint](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/enterkeyhint)
- [gluestack-ui: FormControl](https://gluestack.io/ui/docs/components/form-control)
- `.claude/rules/form-controls.md` / `.claude/rules/auth.md`
