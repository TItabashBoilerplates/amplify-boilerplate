---
description: "Reserved env prefixes (AWS/AMPLIFY_/_/GITHUB_) and where secrets belong"
alwaysApply: true
globs: []
---
# Environment Variable & Secret Naming

正本: `/.claude/rules/env-naming.md`

1. **Amplify Hosting の環境変数に `AWS` で始まる名前を作らない**（公式が拒否する）
2. **Lambda の予約変数を上書きしない**（`AWS_REGION` / `AWS_LAMBDA_*` / `_HANDLER` /
   `_X_AMZN_TRACE_ID` / `TZ`）
3. **秘匿値を環境変数に置かない** — Amplify secrets（SSM）。公式:
   「Don't use environment variables to store secrets」
4. **`NEXT_PUBLIC_` / `EXPO_PUBLIC_` は「公開される」という意味**。秘匿値を絶対に入れない
5. **Amplify backend の接続情報（User Pool / AppSync / S3）は env に書かない** —
   `amplify_outputs.json` が正本。複製すると二重管理になり必ず食い違う

`AMPLIFY_` / `_` 始まりは Amplify Hosting のビルド制御が、`GITHUB_` は GitHub Actions が予約済み。
代替は prefix を削った別名（`BEDROCK_MODEL_ID` / `BACKEND_API_URL` / `GH_TOKEN`）。
IAM の長期クレデンシャルは env で配らずロールで渡す。
