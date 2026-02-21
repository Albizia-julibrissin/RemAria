# UI ガイドライン

この文書は、RemAria の画面デザイン方針を定義する。
実装時は Tailwind CSS を使用し、本ガイドラインの色・トーンに従う。

------------------------------------------------------------------------

## 1. デザインコンセプト

**深い暖色ダーク ＋ 真鍮アクセント**

- スチームパンク × ハイファンタジーの世界観
- ログ中心・長時間閲覧に適した可読性
- 落ち着いた温かみのある画面

------------------------------------------------------------------------

## 2. 技術スタック

| 項目 | 技術 |
|------|------|
| **Styling** | Tailwind CSS |
| **コンポーネント** | shadcn/ui（必要に応じて） |
| **フォント** | システムフォント or 可読性重視のフォント（後述） |

------------------------------------------------------------------------

## 3. カラーパレット

### 3.1 基本色（hex）

| 用途 | 色名 | hex | 用途説明 |
|------|------|-----|----------|
| **背景（ベース）** | base | `#1e1915` | メイン背景 |
| **背景（やや明）** | base-elevated | `#2a2420` | カード・パネル・入力欄 |
| **背景（境界）** | base-border | `#3d3530` | 区切り線・ボーダー |
| **本文** | text-primary | `#e8e0d5` | メインテキスト |
| **本文（補助）** | text-muted | `#b5a99a` | 補足・ラベル |
| **アクセント** | accent-brass | `#b8860b` | ボタン・リンク・強調 |
| **アクセント（ホバー）** | accent-brass-hover | `#c9a227` | ホバー時 |
| **ログ・数値** | accent-amber | `#daa520` | 戦闘ログ・数値表示（任意） |
| **エラー** | error | `#c25c5c` | エラーメッセージ |
| **成功** | success | `#5c8f5c` | 成功メッセージ |

### 3.2 Tailwind への組み込み

`tailwind.config.ts` の `theme.extend.colors` に以下を追加すること：

```ts
// tailwind.config.ts の theme.extend 例
theme: {
  extend: {
    colors: {
      base: {
        DEFAULT: "#1e1915",
        elevated: "#2a2420",
        border: "#3d3530",
      },
      brass: {
        DEFAULT: "#b8860b",
        hover: "#c9a227",
      },
      amber: {
        accent: "#daa520",
      },
    },
  },
},
```

または CSS 変数を使用する場合（`globals.css`）：

```css
:root {
  --color-base: #1e1915;
  --color-base-elevated: #2a2420;
  --color-base-border: #3d3530;
  --color-text-primary: #e8e0d5;
  --color-text-muted: #b5a99a;
  --color-brass: #b8860b;
  --color-brass-hover: #c9a227;
}
```

Tailwind で参照する場合は `theme()` または `var(--color-base)` を利用。

------------------------------------------------------------------------

## 4. 使用例（Tailwind クラス）

### 4.1 基本レイアウト

```html
<!-- ページ背景 -->
<div class="min-h-screen bg-base text-[#e8e0d5]">

<!-- カード・パネル -->
<div class="bg-base-elevated border border-base-border rounded-lg p-4">

<!-- ボタン（プライマリ） -->
<button class="bg-brass hover:bg-brass-hover text-base px-4 py-2 rounded">
```

### 4.2 フォーム・入力

- 入力欄背景：`bg-base-elevated`
- ボーダー：`border-base-border`
- プレースホルダー：`text-muted`（`#b5a99a`）
- フォーカスリング：`ring-brass` または `ring-accent-brass`

### 4.3 テキスト

- 見出し：`text-[#e8e0d5]`（text-primary）
- 補足文：`text-[#b5a99a]`（text-muted）
- リンク：`text-brass hover:text-brass-hover underline`

------------------------------------------------------------------------

## 5. shadcn/ui との併用

shadcn/ui を使用する場合：

- テーマをダークモード固定にし、上記カラーパレットにマッピングする
- `tailwind.config` の色拡張を shadcn のテーマ変数と整合させる
- または `components.json` でダークテーマの CSS 変数を RemAria 用に上書きする

------------------------------------------------------------------------

## 6. フォント

| 用途 | 指定 | 備考 |
|------|------|------|
| **本文** | `font-sans`（システム） | 可読性優先。`Inter` / `Noto Sans JP` 等も可 |
| **ログ表示** | 等幅フォント `font-mono` | 戦闘ログ・数値は等幅で揃えると見やすい |
| **見出し** | `font-semibold` 等 | 必要に応じて |

------------------------------------------------------------------------

## 7. アクセシビリティ

- 本文と背景のコントラスト比は WCAG AA 以上を目指す（`#e8e0d5` on `#1e1915` は十分）
- フォーカス状態は `ring-2 ring-brass ring-offset-base` 等で明示する
- エラー・成功メッセージは色だけでなくアイコン・文言でも伝える

------------------------------------------------------------------------

## 8. 禁止・注意事項

- 純白（`#ffffff`）を背景にしない
- 蛍光色・ネオン系は控える（計器盤風のアクセントを除く）
- ログ以外での等幅フォントの過度な使用は避ける
