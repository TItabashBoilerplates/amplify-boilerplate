# Doppler × CI/CD（Vercel / Supabase / Railway / GitHub Actions）

このプロジェクトのデプロイは **各プラットフォームが GitHub 連携で直接ビルド/デプロイ**する
（GitHub Actions でデプロイしない）。よってシークレットは GitHub Actions ではなく
**Doppler から各プラットフォームへ直接 sync** する。3 つとも Doppler 公式ネイティブ連携がある。

目次:
1. 全体像
2. config ↔ 環境の対応
3. Vercel（ネイティブ連携）
4. Railway（ネイティブ連携）
5. Supabase（ネイティブ連携）
6. GitHub Actions CI（service token）
7. サービストークン運用
8. 検証

## 1. 全体像

```
            ┌──────────── Doppler（シークレットの正本）─────────────┐
            │  config: dev / stg / prd                              │
            └───┬─────────────┬──────────────┬─────────────────────┘
   native sync  │             │              │  native sync
                ▼             ▼              ▼
            Vercel        Railway         Supabase
         (env vars)    (env vars)     (Functions secrets)
                ▲             ▲              ▲
                └──── GitHub 連携で push → 各プラットフォームがビルド/デプロイ ────┘
```

- シークレットは Doppler ダッシュボードの **Integrations（sync）** で各プラットフォームへ自動反映。
- GitHub にシークレットを置く必要はない（CI で secrets が要る場合のみ §6 の service token）。

## 2. config ↔ 環境の対応

| Doppler config | Vercel | Railway | Supabase | devenv profile |
|---|---|---|---|---|
| `prd` | Production | Production env | 本番 project | `-P production` |
| `stg` | Preview | Staging env | staging project | `-P staging` |
| `dev` | Development | dev env | dev project | `-P dev` |

Vercel は環境ごとに**別々の連携**が必要（Development / Preview / Production）。

## 3. Vercel（ネイティブ連携）

ダッシュボード操作（ユーザー）:
1. Doppler の対象 project → **Integrations** → **Vercel** → 認可。
2. **環境ごとに連携を作成**: `prd`→Production / `stg`→Preview / `dev`→Development。
3. sync 対象の Doppler config と Vercel 環境を選択。Doppler は Vercel 同期を既定で
   **Sensitive** として扱う。

以降、Doppler の値を更新すると Vercel の env vars に反映され（webhook で再デプロイも可）、
Vercel の GitHub 連携ビルドがその値を使う。`NEXT_PUBLIC_*` のような**非機密**は引き続き
`env/frontend/.env.<ENV>`（リポジトリ）で管理してもよい（責務分離）。

## 4. Railway（ネイティブ連携）

1. Railway で API Token を発行。
2. Doppler の対象 project → **Integrations** → **Railway** → API Token を貼り付け。
3. Railway の project / environment と、sync する Doppler config を選択。

選択した config の secrets が Railway の env vars に継続 sync され、Railway の GitHub 連携
ビルド/ランタイムが使う（コード変更不要）。

## 5. Supabase（ネイティブ連携）

> 旧 `scripts/supabase/deploy-secrets.sh`（dotenvx で `supabase secrets set`）は廃止し、
> ネイティブ連携に置換した。`deploy.sh` は secrets を push しない。

1. Supabase の Access Token を発行。
2. Doppler の対象 project → **Integrations** → **Supabase** → Access Token を貼り付け。
3. sync 先の Supabase project と Doppler config を選択。

config の secrets が Supabase に継続 sync され、`supabase secrets list` で確認でき Edge Functions
から参照できる。Functions / config / migration のデプロイ自体は従来どおり
`devenv tasks run -P <env> deploy:supabase`（GitHub 連携 + CLI）で行う。

## 6. GitHub Actions CI（service token）

CI（`.github/workflows/ci.yml`）は lint / format / type-check / unit-test のみで**シークレット不要**。
fallback 廃止後も enterShell は警告を stderr に出すだけで `-e` を踏まないので CI は通る。

CI でシークレットが要るジョブ（将来の統合テスト等）を足す場合:
1. Doppler で **read-only・該当 config スコープの service token** を発行
   （`doppler configs tokens create ci --plain` または ダッシュボード）。
2. GitHub の **Secrets** に `DOPPLER_TOKEN` として登録。
3. `ci.yml` は既に top-level `env: DOPPLER_TOKEN: ${{ secrets.DOPPLER_TOKEN }}` を渡しているので、
   devenv shell 進入時に `loadDopplerByEnv` が token のスコープ config から secrets を取得する
   （token が config を決めるので `--config` 不要）。未登録なら空文字 → 警告のみで CI は通る。

## 7. サービストークン運用

- 本番 / CI / 各プラットフォーム連携には **service token**（read-only・単一 config）を使う。
  CLI / Personal トークンは作成者と同じ write 権限を持つため live 環境で使わない。
- 失効を付けるなら `doppler configs tokens create <name> --plain --max-age 24h`。
- prd への write はユーザー承認必須（`.claude/skills/doppler/SKILL.md`）。

## 8. 検証

- **連携 sync**: Doppler で値を変更 → 各プラットフォームの env vars に反映されるか
  （Vercel/Railway は project settings、Supabase は `supabase secrets list`）。
- **CI**: `DOPPLER_TOKEN` 未登録でも CI（lint/test）が green。登録後は secrets を要するジョブが通る。
- **デプロイ**: 各プラットフォームの GitHub 連携ビルドが sync された値で成功する。
