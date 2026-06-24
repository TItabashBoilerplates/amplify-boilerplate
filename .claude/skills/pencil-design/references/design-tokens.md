# Design Tokens: globals.css → Pencil Variables

このプロジェクトの `globals.css` (`frontend/apps/web/src/app/styles/globals.css`) から Pencil 変数へのマッピング表。

## 命名規則

| CSS 変数カテゴリ | Pencil 変数プレフィックス |
|-----------------|-------------------------|
| 色（背景・前景） | `color/` |
| ボーダー・入力 | `color/` |
| チャート | `color/chart/` |
| サイドバー | `color/sidebar/` |
| 角丸 | `radius/` |
| スペーシング | `spacing/` |

## カラートークン (Light Mode - `:root`)

| CSS 変数 | Pencil 変数 | oklch 値 | 用途 |
|----------|------------|----------|------|
| `--background` | `color/background` | `oklch(1 0 0)` | ページ背景 |
| `--foreground` | `color/foreground` | `oklch(0.145 0 0)` | メインテキスト |
| `--card` | `color/card` | `oklch(1 0 0)` | カード背景 |
| `--card-foreground` | `color/card-foreground` | `oklch(0.145 0 0)` | カードテキスト |
| `--popover` | `color/popover` | `oklch(1 0 0)` | ポップオーバー背景 |
| `--popover-foreground` | `color/popover-foreground` | `oklch(0.145 0 0)` | ポップオーバーテキスト |
| `--primary` | `color/primary` | `oklch(0.205 0 0)` | プライマリアクション |
| `--primary-foreground` | `color/primary-foreground` | `oklch(0.985 0 0)` | プライマリアクション上テキスト |
| `--secondary` | `color/secondary` | `oklch(0.97 0 0)` | セカンダリアクション |
| `--secondary-foreground` | `color/secondary-foreground` | `oklch(0.205 0 0)` | セカンダリアクション上テキスト |
| `--muted` | `color/muted` | `oklch(0.97 0 0)` | ミュート背景 |
| `--muted-foreground` | `color/muted-foreground` | `oklch(0.556 0 0)` | ミュートテキスト |
| `--accent` | `color/accent` | `oklch(0.97 0 0)` | アクセント背景 |
| `--accent-foreground` | `color/accent-foreground` | `oklch(0.205 0 0)` | アクセントテキスト |
| `--destructive` | `color/destructive` | `oklch(0.577 0.245 27.325)` | 破壊的アクション |
| `--destructive-foreground` | `color/destructive-foreground` | `oklch(0.985 0 0)` | 破壊的アクション上テキスト |
| `--border` | `color/border` | `oklch(0.922 0 0)` | ボーダー |
| `--input` | `color/input` | `oklch(0.922 0 0)` | 入力フィールドボーダー |
| `--ring` | `color/ring` | `oklch(0.708 0 0)` | フォーカスリング |

## カラートークン (Dark Mode - `.dark`)

| CSS 変数 | Pencil 変数 | oklch 値 | 変更点 |
|----------|------------|----------|--------|
| `--background` | `color/background` | `oklch(0.145 0 0)` | 暗い背景（純黒でない） |
| `--foreground` | `color/foreground` | `oklch(0.985 0 0)` | 明るいテキスト |
| `--card` | `color/card` | `oklch(0.205 0 0)` | 暗いカード |
| `--card-foreground` | `color/card-foreground` | `oklch(0.985 0 0)` | 明るいテキスト |
| `--popover` | `color/popover` | `oklch(0.205 0 0)` | 暗いポップオーバー |
| `--popover-foreground` | `color/popover-foreground` | `oklch(0.985 0 0)` | 明るいテキスト |
| `--primary` | `color/primary` | `oklch(0.922 0 0)` | 反転: 明るいプライマリ |
| `--primary-foreground` | `color/primary-foreground` | `oklch(0.205 0 0)` | 反転: 暗いテキスト |
| `--secondary` | `color/secondary` | `oklch(0.269 0 0)` | 暗いセカンダリ |
| `--secondary-foreground` | `color/secondary-foreground` | `oklch(0.985 0 0)` | 明るいテキスト |
| `--muted` | `color/muted` | `oklch(0.269 0 0)` | 暗いミュート |
| `--muted-foreground` | `color/muted-foreground` | `oklch(0.708 0 0)` | グレーテキスト |
| `--accent` | `color/accent` | `oklch(0.269 0 0)` | 暗いアクセント |
| `--accent-foreground` | `color/accent-foreground` | `oklch(0.985 0 0)` | 明るいテキスト |
| `--destructive` | `color/destructive` | `oklch(0.704 0.191 22.216)` | 彩度下げた赤 |
| `--destructive-foreground` | `color/destructive-foreground` | `oklch(0.985 0 0)` | 明るいテキスト |
| `--border` | `color/border` | `oklch(1 0 0 / 10%)` | 半透明ボーダー |
| `--input` | `color/input` | `oklch(1 0 0 / 15%)` | 半透明入力ボーダー |
| `--ring` | `color/ring` | `oklch(0.556 0 0)` | 暗いフォーカスリング |

## チャートカラー

### Light Mode

| CSS 変数 | Pencil 変数 | oklch 値 |
|----------|------------|----------|
| `--chart-1` | `color/chart/1` | `oklch(0.646 0.222 41.116)` |
| `--chart-2` | `color/chart/2` | `oklch(0.6 0.118 184.704)` |
| `--chart-3` | `color/chart/3` | `oklch(0.398 0.07 227.392)` |
| `--chart-4` | `color/chart/4` | `oklch(0.828 0.189 84.429)` |
| `--chart-5` | `color/chart/5` | `oklch(0.769 0.188 70.08)` |

### Dark Mode

| CSS 変数 | Pencil 変数 | oklch 値 |
|----------|------------|----------|
| `--chart-1` | `color/chart/1` | `oklch(0.488 0.243 264.376)` |
| `--chart-2` | `color/chart/2` | `oklch(0.696 0.17 162.48)` |
| `--chart-3` | `color/chart/3` | `oklch(0.769 0.188 70.08)` |
| `--chart-4` | `color/chart/4` | `oklch(0.627 0.265 303.9)` |
| `--chart-5` | `color/chart/5` | `oklch(0.645 0.246 16.439)` |

## サイドバートークン

### Light Mode

| CSS 変数 | Pencil 変数 | oklch 値 |
|----------|------------|----------|
| `--sidebar` | `color/sidebar/background` | `oklch(0.985 0 0)` |
| `--sidebar-foreground` | `color/sidebar/foreground` | `oklch(0.145 0 0)` |
| `--sidebar-primary` | `color/sidebar/primary` | `oklch(0.205 0 0)` |
| `--sidebar-primary-foreground` | `color/sidebar/primary-foreground` | `oklch(0.985 0 0)` |
| `--sidebar-accent` | `color/sidebar/accent` | `oklch(0.97 0 0)` |
| `--sidebar-accent-foreground` | `color/sidebar/accent-foreground` | `oklch(0.205 0 0)` |
| `--sidebar-border` | `color/sidebar/border` | `oklch(0.922 0 0)` |
| `--sidebar-ring` | `color/sidebar/ring` | `oklch(0.708 0 0)` |

### Dark Mode

| CSS 変数 | Pencil 変数 | oklch 値 |
|----------|------------|----------|
| `--sidebar` | `color/sidebar/background` | `oklch(0.205 0 0)` |
| `--sidebar-foreground` | `color/sidebar/foreground` | `oklch(0.985 0 0)` |
| `--sidebar-primary` | `color/sidebar/primary` | `oklch(0.488 0.243 264.376)` |
| `--sidebar-primary-foreground` | `color/sidebar/primary-foreground` | `oklch(0.985 0 0)` |
| `--sidebar-accent` | `color/sidebar/accent` | `oklch(0.269 0 0)` |
| `--sidebar-accent-foreground` | `color/sidebar/accent-foreground` | `oklch(0.985 0 0)` |
| `--sidebar-border` | `color/sidebar/border` | `oklch(1 0 0 / 10%)` |
| `--sidebar-ring` | `color/sidebar/ring` | `oklch(0.556 0 0)` |

## Radius トークン

| CSS 変数 | Pencil 変数 | 値 |
|----------|------------|---|
| `--radius` | `radius/base` | `0.625rem` (10px) |
| `--radius-sm` | `radius/sm` | `calc(0.625rem - 4px)` = 6px |
| `--radius-md` | `radius/md` | `calc(0.625rem - 2px)` = 8px |
| `--radius-lg` | `radius/lg` | `0.625rem` = 10px |
| `--radius-xl` | `radius/xl` | `calc(0.625rem + 4px)` = 14px |

## スペーシングトークン (8px Grid)

| Pencil 変数 | 値 | 用途 |
|------------|---|------|
| `spacing/1` | 4px | アイコンギャップ、微調整 |
| `spacing/2` | 8px | デフォルト内部パディング |
| `spacing/3` | 12px | 関連要素間の小さなギャップ |
| `spacing/4` | 16px | 標準パディング、フォームギャップ |
| `spacing/5` | 24px | セクション内部パディング |
| `spacing/6` | 32px | カードパディング、コンポーネント間 |
| `spacing/7` | 40px | セクションギャップ |
| `spacing/8` | 48px | 大きなセクションギャップ |
| `spacing/9` | 64px | ページセクション区切り |
| `spacing/10` | 80px | 主要レイアウトスペーシング |
| `spacing/11` | 96px | ヒーロー/バナーパディング |

## フォント

| Pencil 変数 | 値 | 用途 |
|------------|---|------|
| `font/sans` | Geist Sans | メインフォント |
| `font/mono` | Geist Mono | コードフォント |

## Pencil での `set_variables` 使用例

```
# Light モードトークンセットを作成
set_variables({
  "color/background": "oklch(1 0 0)",
  "color/foreground": "oklch(0.145 0 0)",
  "color/primary": "oklch(0.205 0 0)",
  "color/primary-foreground": "oklch(0.985 0 0)",
  "color/destructive": "oklch(0.577 0.245 27.325)",
  "color/border": "oklch(0.922 0 0)",
  "radius/base": "10px",
  "spacing/4": "16px"
})
```
