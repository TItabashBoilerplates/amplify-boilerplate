---
description: "Text inputs must be >= 16px on mobile widths (iOS Safari auto-zoom); form styles live in one shared component"
alwaysApply: false
globs: ["frontend/**/*.tsx", "frontend/packages/ui/**/*.tsx"]
---
# Form Controls

**MANDATORY**: **テキスト入力を受け付けるフォーム要素（`<input>` / `<textarea>` /
ネイティブ `<select>` / `contenteditable`）は、モバイル幅で必ず font-size 16px 以上。**
標準形は `text-base md:text-sm`。

正本: `/.claude/rules/form-controls.md`

- **iOS Safari は 16px 未満のフォーム要素にフォーカスすると自動でズームイン**する。
  `text-sm`(14px) / `text-xs`(12px) は禁止
- `maximum-scale=1` / `user-scalable=no` での回避は **WCAG 1.4.4 違反**につき禁止
- **フォーム要素のスタイルは `@workspace/ui` の共有コンポーネント 1 か所にのみ定義**する。
  `textareaClass` のようなローカル定数を各画面にコピペしない
  （実際に 6 ファイルへコピペされ全部がズーム対象になった事故がある）
- checkbox / radio / file や Radix の `SelectTrigger`（実体は `<button>`）は対象外

`verify-storybook-render` が computed style で実測する。
