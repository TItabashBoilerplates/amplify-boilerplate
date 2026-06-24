---
name: pencil-design
description: |
  Pencil.dev UI/UX デザインスキル。MCP ツールを使い、UI/UX ベストプラクティスに完全準拠した
  プロフェッショナルなデザインを Pencil 上に作成する。ワークフロー: リサーチ → ワイヤーフレーム →
  ビジュアルデザイン → レビュー → エクスポート。shadcn/ui、TailwindCSS 4、ダークモード、i18n 対応。
  /pencil-design で呼び出し、画面名またはコンポーネント名を引数に渡す。
argument-hint: <screen-or-component-name>
effort: max
---

# Pencil.dev UI/UX デザインスキル

Pencil.dev の MCP ツールを使い、UI/UX ベストプラクティスに完全準拠したデザインを作成するスキル。

## 使い方

```
/pencil-design dashboard
/pencil-design login-page
/pencil-design user-settings
/pencil-design pricing-card
```

引数にはデザインする画面名またはコンポーネント名を渡す。

## 前提条件

- Pencil.dev 拡張がインストール済み（VS Code / Cursor / スタンドアロン）
- Pencil MCP サーバーが接続済み
- 対象の `.pen` ファイルが開かれている

## トークンフロー（Design-First）

**デザインが起点。** Pencil 上でトークンを定義し、コードに反映する。

```
Pencil でトークン定義 → set_variables で保存 → デザイン作成 → Phase 5 で globals.css を生成
```

1. Pencil 上でカラーパレット・タイポグラフィ・スペーシングを**新規定義**
2. `set_variables` で Pencil 変数として保存
3. デザイン完了後、Phase 5 で `globals.css` 用の CSS 変数定義をエクスポート
4. `references/design-tokens.md` のベストプラクティス（oklch、8px grid、WCAG コントラスト）に従う

> **既存トークンがある場合**: `globals.css` の値を `set_variables` で Pencil に同期してから開始。
> `references/design-tokens.md` のマッピング表を参照。

## ワークフロー概要

```
Phase 1          Phase 2           Phase 3            Phase 4          Phase 5
リサーチ    →    ワイヤーフレーム →  ビジュアルデザイン → レビュー     →   エクスポート
───────────    ────────────────   ─────────────────   ──────────────   ────────────
既存コンポ      2フレーム作成      トークン定義         品質チェック     globals.css生成
i18nキー       auto-layout       タイポグラフィ       a11y検証        shadcn/uiマッピング
スタイル方向    セマンティック命名  色・スペーシング     レスポンシブ     FSD配置
参考事例       FSD階層グループ    状態デザイン         UXヒューリ       i18nキー
                                  ダークモード         デザインシステム  レスポンシブ仕様
```

**各フェーズにゲートチェックリストがある。チェックリストを全て通過するまで次のフェーズに進まない。**

---

## Phase 1: リサーチ

### 目的

デザインに着手する前に、既存のデザインシステム・コンポーネント・コンテンツを把握し、トークンフローを判定する。

### アクション

1. `get_editor_state` で現在の Pencil コンテキスト（開いているファイル、選択状態）を確認
2. `get_variables` で既存の Pencil デザイントークンを読み取り
3. `batch_get` で関連する既存コンポーネント・パターンを検索
4. 既存の FSD views 構造を確認し、関連画面を把握
5. i18n メッセージファイル（`messages/en.json`, `messages/ja.json`）のテキストコンテンツを確認
6. デザイン対象の参考デザイン・競合事例がある場合は収集
7. カラーパレット・タイポグラフィ・スペーシングの方向性を決定

### ゲートチェックリスト

- [ ] カラーパレット・タイポグラフィ・スペーシングの方向性を決定済み
- [ ] Pencil 変数の現在の状態を確認済み
- [ ] 既存の関連コンポーネント・画面を把握済み
- [ ] i18n で必要なテキストコンテンツキーを把握済み
- [ ] ターゲットブレイクポイントを確認（mobile 375px + desktop 1440px）

---

## Phase 2: ワイヤーフレーム

### 目的

ビジュアルデザインの前に、レイアウト構造とコンポーネント階層を確立する。

### アクション

1. `batch_design` で 2 つのトップレベルフレームを作成:
   - `[ScreenName]-mobile` : 375 x 812 px（iPhone ビューポート）
   - `[ScreenName]-desktop` : 1440 x 900 px
2. auto-layout グループでワイヤーフレームを構築（セマンティック命名）
3. コンテンツエリアにはミュートカラーのプレースホルダー矩形を使用
4. FSD 構造に合わせたコンポーネント階層を確立:
   - Widget レベルグループ（header, sidebar, footer）
   - Feature レベルグループ（forms, actions）
   - Entity レベルグループ（cards, lists）
   - Shared UI グループ（buttons, inputs）
5. `get_screenshot` でレイアウトのレンダリングを確認
6. `snapshot_layout` で配置問題を検出

### 命名規則 (MANDATORY)

| 要素タイプ | 命名パターン | 例 |
|-----------|-------------|---|
| ページフレーム | `[ScreenName]-[breakpoint]` | `Dashboard-mobile`, `Dashboard-desktop` |
| ウィジェットグループ | `widget/[name]` | `widget/header`, `widget/sidebar` |
| フィーチャーグループ | `feature/[name]` | `feature/auth-form`, `feature/search` |
| エンティティグループ | `entity/[name]` | `entity/user-card`, `entity/post-item` |
| 共有 UI コンポーネント | `ui/[name]` | `ui/button-primary`, `ui/input` |
| 状態バリアント | `[name]/[state]` | `ui/button-primary/hover`, `ui/input/error` |

### auto-layout ルール

**MANDATORY**: 絶対配置（absolute positioning）は禁止。全ての要素は auto-layout で配置する。

```
✅ GOOD: auto-layout グループで gap: 8px, padding: 16px
❌ BAD:  要素を手動で x/y 座標指定
```

### ゲートチェックリスト

- [ ] mobile（375px）と desktop（1440px）の 2 フレームが作成済み
- [ ] 全グループが auto-layout を使用（絶対配置なし）
- [ ] 全要素にセマンティック名が付与済み（"Frame 42" 等の自動名なし）
- [ ] 8px グリッドスナッピングが適用済み
- [ ] レイアウト階層が FSD 構造と一致
- [ ] `snapshot_layout` で配置問題がゼロ
- [ ] ナビゲーション項目が 7 以下

---

## Phase 3: ビジュアルデザイン

### 目的

タイポグラフィ、色、スペーシング、状態を適用し、完成度の高いデザインに仕上げる。

### 3.1 デザイントークン定義

**MANDATORY**: 全ての色・スペーシング・角丸は Pencil 変数を使用。ハードコード値は禁止。

1. `references/design-tokens.md` のベストプラクティスを参考に、Pencil 上でトークンを定義
2. `set_variables` で以下のトークンカテゴリを設定:
   - **カラー**: `color/background`, `color/foreground`, `color/primary` 等（oklch 推奨）
   - **スペーシング**: `spacing/1` 〜 `spacing/11`（8px grid）
   - **角丸**: `radius/base`, `radius/sm`, `radius/md`, `radius/lg`, `radius/xl`
   - **フォント**: `font/sans`, `font/mono`
3. Light と Dark の 2 セットを定義
4. **トークン定義ルール**:
   - 背景は純黒 `#000` 禁止（Dark mode: `oklch(0.145 0 0)` 以上の明度を推奨）
   - アクセントカラーの Dark mode 版は彩度を下げる
   - セマンティックカラー必須: success, warning, error, info
   - WCAG AA コントラスト比を必ず確認してから確定

> **既存 `globals.css` がある場合**: `set_variables` で Pencil に同期し、必要に応じて上書き・拡張する。

```
✅ GOOD: Pencil 変数 `color/primary` を参照
❌ BAD:  ハードコード `#1a1a1a` を直接指定
```

### 3.2 タイポグラフィ

| レベル | サイズ | ウェイト | 用途 |
|--------|--------|---------|------|
| Display / H1 | 32-48px | Bold (700) | ページタイトル、ヒーロー |
| H2 | 24-32px | Semi-bold (600) | セクション見出し |
| H3 | 20-24px | Semi-bold (600) | サブセクション見出し |
| H4 | 18-20px | Medium (500) | カードタイトル |
| Body | 16px（最小） | Regular (400) | 本文テキスト |
| Small / Caption | 12-14px | Regular (400) | ラベル、キャプション |

**ルール**:
- フォント: Geist Sans（メイン）+ Geist Mono（コード）の 2 種類のみ
- Body テキスト最小 16px（モバイルでも）
- 行高: 本文テキストはフォントサイズの 1.4-1.6 倍
- 1 行あたり 45-85 文字（最適: 65-75 文字）
- type scale ratio: 1.25（Major Third）

### 3.3 色とコントラスト

**WCAG 2.2 AA 準拠（MANDATORY）**:

| 要素 | 最小コントラスト比 |
|------|-------------------|
| 通常テキスト（< 18px bold / < 24px） | 4.5:1 |
| 大テキスト（>= 18px bold / >= 24px） | 3:1 |
| UI コンポーネント・グラフィカルオブジェクト | 3:1 |
| フォーカスインジケータ | 3:1 |

**ルール**:
- 色のみで情報を伝えない（アイコン・テキスト・パターンを併用）
- セマンティックカラー: Success（緑）、Warning（琥珀）、Error（赤）、Info（青）
- 色覚異常シミュレーションでテスト（protanopia, deuteranopia, tritanopia）

### 3.4 スペーシング (8px Grid)

| トークン | 値 | 用途 |
|---------|---|------|
| spacing/1 | 4px | アイコンギャップ、微調整 |
| spacing/2 | 8px | デフォルト内部パディング |
| spacing/3 | 12px | 関連要素間の小ギャップ |
| spacing/4 | 16px | 標準パディング、フォームギャップ |
| spacing/5 | 24px | セクション内部パディング |
| spacing/6 | 32px | カードパディング |
| spacing/7 | 40px | セクションギャップ |
| spacing/8 | 48px | 大セクションギャップ |

**ルール**:
- 内部スペーシング（padding）<= 外部スペーシング（margin）（Gestalt 近接の法則）
- 関連要素は近く、非関連要素は遠く配置
- コンテナサイドマージン: 16px（mobile）、48-80px（desktop）

### 3.5 視覚階層

**画面あたり 1 つの主要アクション（MANDATORY）**

階層ツール（影響度順）:
1. **サイズ** -- 大きい要素が最初に注目を集める
2. **色/コントラスト** -- 高コントラスト要素が目立つ
3. **ウェイト** -- 太字テキストが注意を引く
4. **位置** -- 左上（LTR）が最初にスキャンされる（F/Z パターン）
5. **ホワイトスペース** -- 隔離された要素にフォーカスが集まる
6. **奥行き** -- エレベーション/シャドウが重要性を示唆

### 3.6 インタラクション状態

全てのインタラクティブ要素に以下の状態をデザインする:

| 状態 | 説明 |
|------|------|
| Default | 初期状態 |
| Hover | マウスオーバー時（desktop のみ） |
| Focus | キーボードフォーカス時（2px+ アウトライン、3:1 コントラスト） |
| Active | クリック/タップ中 |
| Disabled | 無効状態（コントラスト要件免除だが識別可能に） |
| Loading | 処理中（スケルトン or スピナー） |
| Error | エラー状態（アイコン + テキスト、色のみに頼らない） |

### 3.7 ダークモード

**MANDATORY**: Light フレームの複製を `-dark` サフィックスで作成し、Dark トークンセットを適用。

**ルール**:
- 純黒 `#000000` は絶対に使わない（`oklch(0.145 0 0)` を使用）
- アクセントカラーの彩度を下げる
- テキストコントラスト: 4.5:1 以上（過度なコントラストは眼精疲労の原因）
- シャドウは明るい表面エレベーションに置き換え
- 画像は暗い背景用のバリアントか、明度を下げたオーバーレイを検討

### 3.8 フォームデザイン

- 単列レイアウト（縦スキャン）
- ラベルは入力フィールドの上（プレースホルダーのみは禁止）
- 関連フィールドをグループ化
- インラインバリデーション（blur 時）
- エラーメッセージ: 具体的、人間が読める、フィールド近くに配置
- エラー表示: アイコン + テキスト（色のみに頼らない）
- 必須フィールドインジケータ（* + 凡例）

### 3.9 ローディング状態

| 所要時間 | 戦略 |
|---------|------|
| 0-300ms | インジケータなし（即座に感じる） |
| 300ms-1s | ボタン上のスピナー等の微妙なインジケータ |
| 1-3s | コンテンツレイアウトに合わせたスケルトンスクリーン |
| 3-10s | スケルトン + 進捗パーセンテージ |
| >10s | バックグラウンド処理 + 完了通知 |

### アクション

1. `set_variables` でデザイントークンを同期
2. `batch_design` でタイポグラフィ・色・スペーシングを適用
3. 各インタラクティブ要素の全状態をデザイン
4. Dark モードフレームを作成し、Dark トークンセットを適用
5. `get_screenshot` で before/after を比較確認

### ゲートチェックリスト

- [ ] 全ての色が Pencil 変数を使用（ハードコード hex/rgb なし）
- [ ] フォントは Geist Sans + Geist Mono の 2 種類のみ
- [ ] Body テキストが 16px 以上
- [ ] WCAG コントラスト比: テキスト 4.5:1、大テキスト/UI 3:1
- [ ] 8px グリッドスペーシングが一貫
- [ ] 全インタラクティブ要素に hover/focus/active/disabled 状態がある
- [ ] Dark モードフレームが正しいトークンセットで作成済み
- [ ] Dark モードに純黒 `#000000` が使われていない
- [ ] モバイルフレームのタッチターゲットが 44x44px 以上
- [ ] アイコンは Lucide React セットを使用
- [ ] 画面あたり 1 つの明確な主要アクション
- [ ] フォームは単列、ラベル上配置

---

## Phase 4: レビュー

### 目的

エクスポート前の包括的な品質監査。

### アクション

1. `get_screenshot` で全フレームの最終レンダーをキャプチャ
2. `snapshot_layout` で構造の整合性を検証
3. 以下の全チェックリストを実行
4. 問題が見つかれば修正し、再スクリーンショットで確認

### アクセシビリティチェックリスト (WCAG 2.2 AA)

- [ ] カラーコントラスト: 通常テキスト 4.5:1、大テキスト 3:1
- [ ] 色のみで情報を伝えていない（アイコン・テキストで補完）
- [ ] 全インタラクティブ要素にフォーカス状態が見える
- [ ] モバイルのタッチターゲット 44x44px 以上
- [ ] タッチターゲット間に最低 8px のスペーシング
- [ ] フォーム入力に可視ラベルがある（プレースホルダーのみでない）
- [ ] エラー状態にアイコン + テキスト（色のみでない）
- [ ] ドラッグ操作にシングルポインター代替手段がある
- [ ] 認知機能テストなしで認証可能
- [ ] 同一セッション内で同じ情報を再要求しない

### レスポンシブチェックリスト

- [ ] mobile フレーム（375px）に水平オーバーフローなし
- [ ] desktop フレーム（1440px）に適切な max-width コンテナ
- [ ] モバイルでナビゲーションがハンバーガー or ボトムナビに変更
- [ ] モバイルでカードが縦スタック、desktop でグリッド
- [ ] 両ブレイクポイントでフォントサイズが読みやすい
- [ ] モバイルはタッチ操作、desktop はホバー操作に対応
- [ ] コンテンツの優先順位がモバイルで適切（重要な情報が上部）

### UX ヒューリスティクスチェックリスト (Nielsen)

| # | ヒューリスティック | チェック |
|---|-------------------|---------|
| 1 | **システム状態の可視性** | ローディング・保存中・エラーの状態が見える |
| 2 | **システムと現実世界の一致** | 馴染みのある言葉、技術用語でない |
| 3 | **ユーザーの制御と自由** | Undo/Cancel/戻るが利用可能 |
| 4 | **一貫性と標準** | 同じ言葉/アイコン = 全箇所で同じ意味 |
| 5 | **エラー防止** | 破壊的アクションに確認ダイアログ |
| 6 | **記憶よりも認識** | 選択肢が見える、暗記不要 |
| 7 | **柔軟性と効率** | エキスパート向けショートカット |
| 8 | **美的でミニマルなデザイン** | 不要な情報なし |
| 9 | **エラーからの回復支援** | 具体的解決策を含むエラーメッセージ |
| 10 | **ヘルプとドキュメント** | コンテキストに応じたヘルプ |

### デザインシステム一貫性チェックリスト

- [ ] 全コンポーネントが shadcn/ui パターンに一致
- [ ] border-radius が `--radius` トークンを一貫使用
- [ ] スペーシングが 8px 倍数のみ
- [ ] タイポグラフィスケールが TailwindCSS 4 スケールに一致
- [ ] 全テキストコンテンツに i18n プレースホルダー（en + ja）
- [ ] Card, Button, Input スタイルが既存プロジェクトコンポーネントに一致

### インタラクションデザインチェックリスト

- [ ] 全クリッカブル要素にポインターカーソル表示
- [ ] トランジション 100-500ms（即座でも遅くもない）
- [ ] ローディング状態にスケルトンスクリーン（スピナーでない）
- [ ] フォームは単列レイアウト、ラベル上配置
- [ ] インラインバリデーション表示あり
- [ ] マイクロインタラクションがユーザーアクションにフィードバック
- [ ] `prefers-reduced-motion` 対応のアニメーション仕様

### Gestalt 原則チェックリスト

- [ ] **近接**: 関連要素が近くに配置
- [ ] **類似**: 同種要素が一貫したスタイル
- [ ] **連続**: アライメント・グリッドレイアウト・フロー方向
- [ ] **閉合**: アイコン・プログレスインジケータの認識しやすさ
- [ ] **図と地**: モーダルオーバーレイ・カードエレベーション
- [ ] **共通領域**: カード・ボーダーセクション・背景色によるグルーピング

### 認知負荷チェックリスト

- [ ] 画面あたり 1 つの主要アクション
- [ ] プログレッシブ・ディスクロージャー（最小限表示、必要に応じて詳細）
- [ ] 合理的なデフォルト値で判断を削減
- [ ] ナビゲーション項目 5-7 以下（Hick の法則）
- [ ] 情報を 3-5 項目のグループにチャンク化（Miller の法則）
- [ ] 重要なアクションは大きく、期待される位置に近く（Fitts の法則）

---

## Phase 5: エクスポート

### 目的

デザインをコード実装に引き渡すための仕様を整理する。

### アクション

1. `get_screenshot` で最終ドキュメント用スクリーンショットをキャプチャ
2. `batch_get` でコンポーネント階層を抽出
3. 以下のハンドオフ成果物を作成

### ハンドオフ成果物

#### 0. globals.css トークン生成（Design-First の場合）

Design-First の場合、Pencil 上で定義したトークンを `globals.css` 形式で出力する。
`get_variables` で全 Pencil 変数を取得し、以下のフォーマットで CSS 変数を生成:

```css
/* Pencil 変数 → globals.css 変換例 */
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);          /* color/background */
  --foreground: oklch(0.145 0 0);      /* color/foreground */
  --primary: oklch(0.205 0 0);         /* color/primary */
  --primary-foreground: oklch(0.985 0 0); /* color/primary-foreground */
  /* ... 全トークンを変換 */
}

.dark {
  --background: oklch(0.145 0 0);      /* color/background (dark) */
  --foreground: oklch(0.985 0 0);      /* color/foreground (dark) */
  /* ... 全 Dark トークンを変換 */
}
```

**変換ルール**:
- Pencil 変数 `color/xxx` → CSS 変数 `--xxx`
- Pencil 変数 `color/sidebar/xxx` → CSS 変数 `--sidebar-xxx`
- Pencil 変数 `color/chart/N` → CSS 変数 `--chart-N`
- Pencil 変数 `radius/base` → CSS 変数 `--radius`
- oklch 形式を維持（TailwindCSS 4 互換）

#### 1. コンポーネント → shadcn/ui マッピング表

デザイン上の各要素を対応する shadcn/ui コンポーネントにマッピング:

```
| デザイン要素 | shadcn/ui コンポーネント | インポートパス |
|-------------|----------------------|--------------|
| ui/button-primary | Button (variant="default") | @workspace/ui |
| ui/input | Input | @workspace/ui |
| entity/user-card | Card + CardHeader + CardContent | @workspace/ui |
```

#### 2. FSD 配置ガイド

各コンポーネントグループの FSD レイヤー配置:

```
| Pencil グループ | FSD レイヤー | パス |
|----------------|------------|------|
| widget/header | widgets/header/ui/ | src/widgets/header/ui/ |
| feature/auth-form | features/auth/ui/ | src/features/auth/ui/ |
| entity/user-card | entities/user/ui/ | src/entities/user/ui/ |
| ui/button-primary | shared/ui/ | packages/ui/components/ |
```

#### 3. i18n キー構造

デザイン内のテキストコンテンツを i18n キーにマッピング:

```json
{
  "ScreenName": {
    "title": "Page Title / ページタイトル",
    "description": "Description / 説明",
    "actions": {
      "submit": "Submit / 送信",
      "cancel": "Cancel / キャンセル"
    }
  }
}
```

#### 4. レスポンシブ仕様

mobile → desktop の変更点を文書化:

```
| 要素 | Mobile (375px) | Desktop (1440px) |
|------|---------------|-----------------|
| ナビゲーション | ボトムナビ / ハンバーガー | 水平トップナビ |
| カード配置 | 縦スタック | 2-3列グリッド |
| サイドバー | 非表示 / ドロワー | 常時表示 |
```

#### 5. インタラクション仕様

状態遷移とアニメーション:

```
| 要素 | トリガー | アニメーション | 所要時間 |
|------|---------|--------------|---------|
| Modal | ボタンクリック | fade-in + scale | 200ms |
| Dropdown | クリック | slide-down | 150ms |
| Page transition | ナビゲーション | fade | 300ms |
```

### ゲートチェックリスト

- [ ] 全フレームの最終スクリーンショット（light + dark, mobile + desktop）
- [ ] `globals.css` 用 CSS 変数定義を生成済み
- [ ] コンポーネント → shadcn/ui マッピング表
- [ ] FSD 配置ガイド
- [ ] i18n キー構造（en + ja）
- [ ] レスポンシブ仕様
- [ ] インタラクション仕様（状態、トランジション、アニメーション）

---

## Pencil MCP ツールリファレンス

| ツール | 用途 | 使用フェーズ |
|--------|------|------------|
| `batch_design` | 要素の作成・変更・削除、画像生成・配置 | ワイヤーフレーム、ビジュアル |
| `batch_get` | コンポーネント検索、パターン検索、階層調査 | リサーチ、エクスポート |
| `get_screenshot` | プレビューレンダー、before/after 比較 | ワイヤーフレーム、ビジュアル、レビュー、エクスポート |
| `snapshot_layout` | 構造分析、配置問題検出 | ワイヤーフレーム、レビュー |
| `get_editor_state` | 現在のコンテキスト・選択データ取得 | リサーチ |
| `get_variables` | デザイントークン・テーマの読み取り | リサーチ |
| `set_variables` | デザイントークン・テーマの設定・同期 | ビジュアル |

### ツール使用のベストプラクティス

- **パフォーマンス**: 個別の create/modify 呼び出しでなく `batch_design` をまとめて使用
- **構造確認**: 構造変更後は毎回 `snapshot_layout` で問題を早期検出
- **視覚確認**: ビジュアル変更時は `get_screenshot` で before/after 比較
- **トークン優先**: スタイリング前に `set_variables` でトークンを作成し、`batch_design` で参照

---

## GOOD / BAD パターン

### 命名

```
✅ GOOD: widget/header, feature/login-form, entity/user-card, ui/button-primary
❌ BAD:  Frame 42, Group 1, Rectangle 5, Untitled
```

### レイアウト

```
✅ GOOD: auto-layout グループ、gap: 8px、padding: 16px
❌ BAD:  絶対配置、マジックナンバーの座標、フリーハンド配置
```

### 色

```
✅ GOOD: Pencil 変数 `color/primary` を参照
❌ BAD:  ハードコード `#1a1a1a`、`rgb(26, 26, 26)` を直接指定
```

### ダークモード

```
✅ GOOD: 背景 oklch(0.145 0 0)（プロジェクトトークン）
❌ BAD:  背景 #000000（純黒）
```

### タイポグラフィ

```
✅ GOOD: 16px body テキスト、Geist Sans、TailwindCSS type scale
❌ BAD:  12px body テキスト、4 種類のフォント、不統一なサイズ
```

### レスポンシブ

```
✅ GOOD: 2 フレーム（375px mobile, 1440px desktop）、同一コンテンツ
❌ BAD:  単一フレーム、任意の幅、モバイル考慮なし
```

### フォーム

```
✅ GOOD: 単列、ラベル上配置、インラインバリデーション、エラーアイコン+テキスト
❌ BAD:  複数列、プレースホルダーのみ、色のみでエラー表示
```

### 視覚階層

```
✅ GOOD: 1 つの明確な CTA ボタン、段階的な視覚ウェイト
❌ BAD:  複数の同等ボタン、視覚的優先順位の不在
```

---

## トラブルシューティング

### Pencil 変数が反映されない

**原因**: `set_variables` 後に `batch_design` で変数を参照していない
**解決**: `set_variables` でトークン設定 → `batch_design` で要素に変数を適用

### auto-layout が崩れる

**原因**: 子要素にサイズの固定値が設定されている
**解決**: 子要素の幅を `fill` or `hug` に設定し、固定ピクセル値を避ける

### スクリーンショットが期待と異なる

**原因**: 非表示レイヤーやオーバーフローしたコンテンツ
**解決**: `snapshot_layout` で構造を確認し、オーバーフロー設定を修正

### フレーム間でスタイルが不一致

**原因**: 変数でなくハードコード値を使用
**解決**: 全スタイルを Pencil 変数経由にし、ハードコード値をゼロにする

### ダークモードでコントラスト不足

**原因**: Light モードのコントラスト値をそのまま Dark モードに流用
**解決**: Dark モード用トークンセットを別途検証し、4.5:1 以上を確保

---

## 関連スキル

| スキル | 連携ポイント |
|--------|-------------|
| `shadcn-ui` | コンポーネントパターン、CSS 変数使用法 |
| `fsd` | グループ命名の FSD レイヤー対応、エクスポート配置 |
| `i18n` | テキストコンテンツの i18n キー構造 |
| `storybook` | エクスポート後のストーリー作成 |
| `ui-ux-pro-max` | スタイル・色・タイポグラフィの検索スクリプト |

## 参考資料

- [Nielsen Norman Group - 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Google Material Design 3](https://m3.material.io/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
- [Pencil.dev Documentation](https://docs.pencil.dev/)
- デザイントークン詳細: `references/design-tokens.md`
- UI/UX リサーチレポート: `docs/_research/2026-03-31-ui-ux-design-best-practices.md`
