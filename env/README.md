# `env/` ディレクトリ

環境変数の置き場所。**シークレットは Doppler、非機密 config はファイル**で分離し、読み込みは
環境変数 `ENV` で切り替える。Doppler 連携の詳細は `.claude/skills/doppler/SKILL.md`。

## 方針: シークレット vs 非機密

| 種類 | 例 | 置き場所 |
|---|---|---|
| **シークレット** | API キー / トークン / DB パスワード / service_role | **Doppler のみ**（ファイルフォールバックは廃止） |
| **非機密 config** | ローカル Supabase URL / backend URL / port / publishable key | **このディレクトリのファイル**（`<svc>/.env.<ENV>`） |

「漏れても害がない設定値」だけをファイルに置く。機密はすべて Doppler。

## 構成

```
env/
├── README.md              # このファイル
├── .env.secrets           # 旧シークレット（gitignore・読み込まれない）。doppler-import 用に
│                          #   一時保持し、Doppler 投入が済んだら削除してよい。
├── backend/.env.<ENV>     # backend 非機密 config（.env.local は commit）
├── frontend/.env.<ENV>    # frontend 非機密 config（.env.local は commit）
└── migration/.env.<ENV>   # migration 非機密 config（.env.local は commit）
```

`<ENV>` = `local` / `dev` / `staging` / `production`。

## 読み込み（ENV 駆動）

`devenv.nix` が `ENV`（既定 `local`）に従って読み込む:

1. `loadEnvFilesForEnv`: 各サービスの `env/<svc>/.env.$ENV` を source（**非機密 config のみ**）。
2. `loadDopplerByEnv`: `$ENV` 対応の Doppler config からシークレットを取得して注入。
   **Doppler が唯一のシークレットソース**。取得できなければファイルフォールバックは無いので
   警告を出す（`.env.secrets` はもう読まれない）。

```bash
devenv shell                      # ENV=local: .env.local（config）+ Doppler local（secrets）
ENV=staging devenv shell          # ENV=staging: .env.staging（config）+ Doppler stg（secrets）
devenv shell -P staging -- <cmd>  # profile が ENV=staging を export（同上）
```

シークレットを使うには **`doppler login` → `doppler setup`** が必要（CI は `DOPPLER_TOKEN`）。

## Git 追跡

commit されるのは **`.env.local`（非機密）と `README.md` のみ**。`.env.secrets` と
`.env.<dev|staging|production>` は機密・環境固有値のため gitignore。

## Doppler への移行（一度だけ）

```bash
doppler login
doppler setup                 # doppler.yaml の project/config に紐付け
doppler-import --config dev    # 旧 env/.env.secrets を Doppler に一括投入
# 確認後、env/.env.secrets は削除してよい
```

## 新しい環境を追加する

1. `env/{backend,frontend,migration}/.env.<name>` を作成（非機密 config）。
2. `devenv.nix` の `profiles` に profile を 1 つ追加（`export ENV="<name>"` + 各ローダ）。
3. シークレットは Doppler の対応 config に投入。
