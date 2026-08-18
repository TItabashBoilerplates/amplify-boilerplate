# 環境変数・シークレット命名ポリシー（予約 prefix / 秘匿値の置き場所）

**CRITICAL / NON-NEGOTIABLE**:

1. **Amplify Hosting の環境変数に `AWS` で始まる名前を作ってはならない**（プラットフォーム予約）。
2. **Lambda の予約環境変数を上書きしてはならない**（`AWS_REGION` / `AWS_LAMBDA_*` / `TZ` / `_HANDLER` 等）。
3. **秘匿値を環境変数に置いてはならない**。Amplify secrets（SSM Parameter Store）を使う。
4. **`NEXT_PUBLIC_` / `EXPO_PUBLIC_` は「公開される」という意味**。秘匿値を絶対に入れない。
5. **Amplify backend の接続情報（User Pool / AppSync / S3）は env に書かない**。`amplify_outputs.json` が正本。

命名を間違えると**ビルド時にエラーで落ちるか、より悪いことに無言で無視される**。どちらも
「デプロイは成功したのに動かない」という形でしか気づけないので、書く前に本ファイルを見る。

---

## 1. 禁止 prefix / 予約名

| prefix / 名前 | 予約している場所 | 起きること | 出典 |
|---|---|---|---|
| **`AWS...`**（`AWS` 始まりすべて） | **Amplify Hosting の環境変数** | 作成が**拒否される**。公式:「**Amplify doesn't allow you to create environment variable names with an `AWS` prefix. This prefix is reserved for Amplify internal use only.**」 | [Amplify: 環境変数](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html) |
| **`AWS_REGION` / `AWS_EXECUTION_ENV` / `AWS_LAMBDA_*` / `_HANDLER` / `_X_AMZN_TRACE_ID` / `TZ`** | **Lambda ランタイム** | **関数設定に設定できない**（設定しても上書きされる / 予期しない挙動）。公式:「The keys for these environment variables are **reserved and cannot be set** in your function configuration.」 | [Lambda: 環境変数](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html) |
| **`AMPLIFY_`** | Amplify Hosting のビルド制御 | `AMPLIFY_MONOREPO_APP_ROOT` / `AMPLIFY_DIFF_DEPLOY` / `AMPLIFY_DESTRUCTIVE_UPDATES` 等が予約済み。同名を自前用途で作ると**ビルド挙動が変わる** | 同上 |
| **`GITHUB_`** | GitHub Actions secrets | secret 名として拒否される。公式:「**Must not start with the `GITHUB_` prefix.**」 | [GitHub: Secrets reference](https://docs.github.com/en/actions/reference/secrets-reference) |
| **`_`（アンダースコア始まり）** | Amplify Hosting のビルド制御 | `_BUILD_TIMEOUT` / `_LIVE_UPDATES` が予約済み | 同上 |

### 併せて守る命名制約

- **英数字と `_` のみ**・**数字始まり禁止**（GitHub Actions secrets の要件）。
- **Amplify Hosting の環境変数の値は 5500 文字以内**（公式）。長い値（証明書・鍵）は env に置かない
  → Amplify secrets を使う（§2）。
- アプリ側で読む名前は **`NEXT_PUBLIC_` / `EXPO_PUBLIC_` が付くかどうかで公開/非公開が決まる**（§3）。

---

## 2. 秘匿値は環境変数ではなく Amplify secrets（SSM）

公式が明言している:

> **Important — Don't use environment variables to store secrets.** For a Gen 2 app, use the
> **Secret management** feature in the Amplify console.

| 種類 | 置き場所 | 取り出し方 |
|---|---|---|
| **秘匿値**（API キー・OAuth client secret・署名鍵） | **Amplify secrets（SSM Parameter Store）** | backend 定義で `secret('NAME')`、関数内は typed `env.NAME` |
| 非機密の設定値（機能フラグ・外部 API の公開 URL・ログレベル） | Amplify Hosting の環境変数 / `defineFunction({ environment })` | `process.env.NAME` |
| **ローカル開発の非機密既定値** | `env/<svc>/.env.local`（ファイル管理） | 既存ファイルを編集。**Amplify のプラットフォーム制約はかからない** |

```bash
# sandbox（開発者ごと）に秘匿値を登録する
cd frontend/packages/backend && pnpm exec ampx sandbox secret set GOOGLE_CLIENT_SECRET
# ブランチ環境は Amplify コンソールの Secret management（または ampx generate ...）で登録する
```

```ts
// backend の定義側で参照する（値はコードに現れない）
import { defineAuth, secret } from '@aws-amplify/backend'
externalProviders: { google: { clientSecret: secret('GOOGLE_CLIENT_SECRET') } }
```

**秘匿値をチャット / ログ / コミット / PR に出さない**（会話は**キー名のみ**で行う）。
詳細は `.claude/skills/amplify-gen2/references/secrets-and-env.md`。

---

## 3. `NEXT_PUBLIC_` / `EXPO_PUBLIC_` は「バンドルに焼き込まれる」

これらの prefix は**ビルド時にクライアントバンドルへ埋め込まれる**。ブラウザ / アプリの
バイナリを開けば誰でも読める。

```bash
# ✅ OK: 公開してよい値だけ
NEXT_PUBLIC_SITE_URL=https://example.com
EXPO_PUBLIC_BACKEND_PY_URL=https://api.example.com

# ❌ NG: 秘匿値に PUBLIC prefix を付ける（公開される）
NEXT_PUBLIC_STRIPE_SECRET_KEY=...
EXPO_PUBLIC_BEDROCK_API_KEY=...
```

公式も「Storing sensitive values, such as API keys, inside these frontend framework prefixed
environment variables is not a best practice and is **highly discouraged**」と明記している。

---

## 4. Amplify backend の値は env で管理しない（最重要）

**「Cognito の User Pool ID が要る」「AppSync のエンドポイントが要る」は env にキーを作る理由にならない。**

| 実行環境 | backend 接続情報の入手経路 | エージェントがやること |
|---|---|---|
| **Web / Mobile（クライアント）** | **`amplify_outputs.json`**（`ampx` が生成。`Amplify.configure(outputs)` が読む） | **何もしない**（env に書かない） |
| **Next.js のサーバー側** | 同じ `amplify_outputs.json` + `runWithAmplifyServerContext` | **何もしない** |
| **Amplify Functions（Lambda）** | `defineFunction` の `resourceGroupName` / `env` 経由で Amplify が注入 | **何もしない**（typed `env` を import する） |
| **CI（型チェック / ビルド）** | `apps/web/amplify_outputs.ci.json`（公開情報のみのスタブ）を配置 | 既存ファイルを使う |

`amplify_outputs.json` は**環境ごとに異なる生成物**で **Git 追跡しない**
（`.claude/rules/auto-generated.md`）。同じ値を env にも書くと **二重管理になり、必ず食い違う**。

```bash
# ❌ NG: 生成物にある値を env にも置く（二重管理 + AWS prefix で拒否される）
AWS_USER_POOL_ID=us-east-1_xxxx
NEXT_PUBLIC_APPSYNC_ENDPOINT=https://xxxx.appsync-api...
```

---

## 5. どうしても必要なときの代替命名

予約 prefix の値を**自分で持ちたい**場合は、prefix を削って別名にする。
アプリ側の参照名も同時に合わせること（`.claude/rules/clean-code.md` により旧名エイリアスは残さない）。

| ❌ 登録できない / 危険 | ✅ 代替キー名 |
|---|---|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` を env で配る | **配らない**。IAM ロール（Amplify / Lambda の実行ロール）で権限を渡す |
| `AWS_REGION`（Lambda 内で上書き） | 上書きしない。Lambda は既に持っている。ビルド時に要るなら `APP_REGION` |
| `AWS_BEDROCK_MODEL_ID` | `BEDROCK_MODEL_ID` |
| `AMPLIFY_API_URL`（自前用途） | `BACKEND_API_URL` |
| `GITHUB_TOKEN`（PAT を自前で持つ場合） | `GH_TOKEN` |

> `NEXT_PUBLIC_AWS_REGION` のように **`AWS` が先頭でなければ Amplify Hosting の制約には当たらない**
> が、紛らわしいので避ける。禁止されているのは**名前の先頭一致**であって、名前に "AWS" を含むこと
> 自体ではない。

---

## 6. 適用範囲（対象外を明示）

| 対象 | 本ルールの適用 |
|---|---|
| Amplify Hosting のブランチ環境変数 | **適用**（`AWS` / `_` / `AMPLIFY_` 予約） |
| `defineFunction({ environment })` / Lambda の環境変数 | **適用**（Lambda 予約名） |
| Amplify secrets（SSM） | **適用**（秘匿値はここへ。§2） |
| GitHub Actions の repository/environment secrets | **適用**（`GITHUB_` 拒否） |
| `env/<svc>/.env.local`（ローカル非機密ファイル） | **対象外**（プラットフォームへ送られない） |
| コード内で `process.env.AWS_REGION` を**読む**こと | **対象外**（読むのは正しい。禁止しているのは**設定**） |

---

## 7. 禁止パターン

```bash
# ❌ NG: Amplify Hosting に AWS 始まりの環境変数を作る（作成が拒否される）
AWS_API_KEY / AWS_REGION / AWSBucketName

# ❌ NG: Lambda の予約名を defineFunction の environment に入れる
environment: { AWS_REGION: 'us-east-1', TZ: 'Asia/Tokyo' }

# ❌ NG: 秘匿値を環境変数に置く（公式が明確に禁止。Amplify secrets を使う）
STRIPE_SECRET_KEY=sk_live_...    # ← Amplify Hosting の env に登録

# ❌ NG: 秘匿値に NEXT_PUBLIC_ / EXPO_PUBLIC_ を付ける（バンドルに焼き込まれる）

# ❌ NG: amplify_outputs.json の値を env に複製する（二重管理）

# ❌ NG: IAM の長期クレデンシャルを env で配る（ロールを使う）

# ❌ NG: 数字始まり（`1PASSWORD_TOKEN`）／ハイフン・スペース入りのキー名

# ✅ OK
BEDROCK_MODEL_ID / BACKEND_API_URL / LOG_LEVEL
NEXT_PUBLIC_SITE_URL / EXPO_PUBLIC_BACKEND_PY_URL
GH_TOKEN
```

---

## 8. 新規キー追加時のチェックリスト

1. **そもそも必要か？** Amplify backend の接続情報なら**不要**（§4。`amplify_outputs.json` が持つ）。
2. **秘匿値か？** → 環境変数ではなく **Amplify secrets**（§2）。
3. **先頭が `AWS` / `AMPLIFY_` / `_` / `GITHUB_` でないか？** → 該当したら §5 で改名。
4. **Lambda の予約名でないか？**（`AWS_*` / `_HANDLER` / `_X_AMZN_TRACE_ID` / `TZ`）
5. **英数字と `_` のみ / 数字始まりでないか / 値は 5500 文字以内か？**
6. **クライアントへ出す必要が本当にあるか？**（`NEXT_PUBLIC_` / `EXPO_PUBLIC_` を安易に付けない）
7. 値は**チャット / ログ / コミットに出さない**（キー名のみで会話する）。

---

## 9. 強制事項

このポリシーは**交渉の余地なし**。

- **`AWS` / `AMPLIFY_` / `_` / `GITHUB_` prefix のキーを作る実装・提案はレビューで却下**する。
- **秘匿値を環境変数（とくに `NEXT_PUBLIC_` / `EXPO_PUBLIC_`）に置く実装も却下**する。
- **`amplify_outputs.json` の値を env に複製する提案も却下**する。
- 判断に迷う場合は勝手に決めず**ユーザーに確認**する。

## 参考

- [Amplify Hosting: Using environment variables](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html) — `AWS` prefix 禁止 / 予約変数一覧 / 5500 文字 / 「秘匿値を env に置くな」
- [Amplify Gen2: Secrets and environment vars](https://docs.amplify.aws/react/deploy-and-host/fullstack-branching/secrets-and-vars/) — `secret()` / Secret management
- [AWS Lambda: Working with environment variables](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html) — 予約環境変数（設定不可）
- [GitHub: Secrets reference](https://docs.github.com/en/actions/reference/secrets-reference) — `GITHUB_` prefix 禁止
- `.claude/rules/auto-generated.md` / `.claude/skills/amplify-gen2/references/secrets-and-env.md`
