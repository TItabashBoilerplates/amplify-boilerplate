# タップ標的・到達性・ナビゲーション・アクセシビリティ

---

## 1. タップ標的サイズ

| 基準 | 値 | 位置づけ |
|---|---|---|
| **WCAG 2.2 SC 2.5.8 Target Size (Minimum)** — Level **AA** | **24 × 24 CSS px** | **絶対下限**。これを割ったら適合違反 |
| **Apple HIG** | **44 × 44 pt** | iOS の既定値 |
| **Material Design** | **48 × 48 dp** | Android の既定値 |
| **WCAG 2.2 SC 2.5.5 Target Size (Enhanced)** — Level **AAA** | 44 × 44 CSS px | 主要操作はここを目指す |

**本リポジトリの運用**: 主要操作（送信・保存・削除・ナビゲーション・アイコンボタン）は
**44×44 以上**。それ以外も **24×24 を下限**とし、間隔の例外に頼らない。

### 24×24 の「間隔の例外」に頼らない理由

SC 2.5.8 には「24px 径の円を各標的の中心に置いて、他の標的（またはその円）と交差しなければ
小さくてもよい」という例外がある。だが**リスト行に密なアイコン列を置いた瞬間に破綻する**うえ、
デザイン変更のたびに再検証が要る。**最初から 44×44 にするほうが安い。**

### 見た目を変えずにヒットエリアだけ広げる

```tsx
// React Native
<Pressable hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
  <Icon size={20} />
</Pressable>

// Web（@workspace/ui の Button なら size で担保する。素で書くなら padding で確保）
<button className="inline-flex size-11 items-center justify-center">
  <Icon className="size-5" />
</button>
```

- **アイコンの見た目サイズ = タップ標的サイズ ではない。** 20px のアイコンをそのまま
  タップ標的にするのは違反。
- 隣接する標的の**間隔も 8px 以上**空ける（誤タップ防止）。

---

## 2. 親指の到達範囲（thumb zone）

片手持ちの親指が届く範囲は**画面下部が最も広く、上部の隅が最も遠い**
（Steve Hoober の調査。Material / Apple HIG が bottom navigation を主要ナビゲーションとして
推奨する根拠でもある）。

| 位置 | 使い方 |
|---|---|
| **画面下部（中央〜両サイド）** | **主要アクション**（送信・次へ・購入）、主要ナビゲーション |
| 画面中央 | コンテンツ |
| **画面上部の隅** | 頻度の低い操作（設定・閉じる）。**主要 CTA を置かない** |

- **破壊的操作（削除・退会・支払い確定）を主要操作の真横に置かない。** 誤タップは
  取り返しがつかない。位置を離すか、確認ステップを挟む。
- 縦長画面では、**画面上部にしか主要操作が無い設計**を避ける。

---

## 3. ナビゲーション

- **Bottom Tabs は 3〜5 個。** 6 個以上になったら「その他」タブで逃がすのではなく、
  情報設計を見直す（本当に同格の目的地が 6 つあるのか）。
- タブは**同格の目的地**に使う。アクション（新規作成など）はタブではなく FAB や画面内のボタン。
- **戻る導線を必ず用意する。** iOS の画面端スワイプバック、Android の戻るジェスチャ/ボタン。
- 画面遷移は `.claude/rules/page-navigation.md`（Web）に従う。一覧のページングは
  Mobile は無限スクロール + 仮想化リスト（`.claude/rules/list-pagination.md`）。

### OS ジェスチャとの衝突

| OS | ジェスチャ | 注意 |
|---|---|---|
| iOS | 画面左端からのスワイプ = 戻る / 下端 = ホーム | **画面端から始まる水平スワイプ UI を作らない**。作るなら開始位置をずらす |
| Android | 左右端スワイプ = 戻る（予測型戻る含む）/ 下端 = ホーム | 同上。本リポジトリは `app.json` で `predictiveBackGestureEnabled: false`（有効化するなら全画面の戻る挙動を確認してから） |

---

## 4. スクロールとリスト

- **モバイルの一覧は仮想化リスト**（`FlatList` / `SectionList`、導入済みなら `FlashList`）。
  `ScrollView` に `.map()` で全件流さない（`.claude/rules/list-pagination.md`）。
- **Pull-to-refresh** を付ける（モバイルでの最新化の標準操作）。
- **初回ローディング / 追加ローディング / 空 / エラー / 末尾到達の 5 状態**を必ず用意する。
- 入力を含むスクロール容器は `keyboardShouldPersistTaps="handled"`
  （→ `keyboard-native.md` §3）。

---

## 5. 文字サイズ・コントラスト・その他アクセシビリティ

- **端末の文字サイズ設定（Dynamic Type / フォントスケール）を最大にしても壊れないこと。**
  固定高さのボタン・1 行前提のラベルは折り返しで崩れる。実機で確認する。
- **フォーム要素はモバイル幅で 16px 以上**（Web / react-native-web。
  `.claude/rules/form-controls.md`）。
- コントラスト比: 通常テキスト **4.5:1**、大きいテキスト（18pt / 14pt bold 以上）**3:1**、
  UI コンポーネント・グラフィックの境界 **3:1**（WCAG 1.4.3 / 1.4.11）。
  色は `@workspace/tokens` のセマンティックトークンから取る（生パレット禁止）。
- **色だけで情報を伝えない**（エラーは色 + アイコン + テキスト）。
- Native は `accessibilityLabel` / `accessibilityRole` / `accessibilityState`、
  Web は適切な要素と `aria-*`。**アイコンだけのボタンには必ずラベルを付ける。**
- **タップ以外の入力手段**: Web は `<a href>` / `<button>` を使う（`onClick` だけの `<div>` は
  キーボード操作できない）。

---

## 6. フィードバック

- タップに**即座の視覚フィードバック**（押下状態）を返す。`Pressable` の押下スタイル、
  Web は `active:` / `:focus-visible`。
- 送信中はボタンを**無効化 + ローディング表示**（二重送信の防止）。
- 破壊的操作・重要な完了には**触覚フィードバック**（`expo-haptics`。導入済み）を検討する。
  ただし多用しない。
- **エラーは入力の直下に、何をすれば直るかを書く。** トーストだけで消えるエラーにしない。
- すべての文言は **i18n 必須**（`.claude/rules/i18n.md`）。

---

## 7. チェックリスト

| # | 確認 |
|---|---|
| 1 | タップできる要素がすべて 44×44（最低 24×24 + 間隔）を満たすか |
| 2 | アイコンボタンに `hitSlop` / padding でヒットエリアを確保したか |
| 3 | 主要 CTA が画面下部（親指の届く範囲）にあるか |
| 4 | 破壊的操作が主要操作の隣にないか |
| 5 | Bottom Tabs が 3〜5 個か |
| 6 | 画面端から始まる自前ジェスチャが OS の戻る操作と衝突しないか |
| 7 | 端末の文字サイズ最大でレイアウトが壊れないか |
| 8 | アイコンのみのボタンにアクセシビリティラベルがあるか |
| 9 | 色だけで状態を伝えていないか |
| 10 | 送信中の二重送信を防いでいるか |

---

## 出典

- [W3C: Understanding SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [W3C: Understanding SC 2.5.5 Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) — 44×44 pt
- [Material Design: Accessibility](https://m3.material.io/foundations/accessible-design/accessibility-basics) — 48×48 dp
- [NN/g: Mobile UX](https://www.nngroup.com/topic/mobile-and-tablet-design/)
- `.claude/rules/list-pagination.md` / `.claude/rules/page-navigation.md` / `.claude/rules/i18n.md`
