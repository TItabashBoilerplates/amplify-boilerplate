/**
 * Hey API ランタイム設定
 *
 * 環境変数から baseUrl を動的に設定するための設定ファイル。
 * openapi-ts の runtimeConfigPath によって自動的に読み込まれる。
 */
import type { CreateClientConfig } from './generated/client.gen'

/**
 * クライアント設定を作成する関数（デフォルト baseUrl）。
 *
 * 本番の baseUrl は FastAPI Lambda の Function URL（`amplify_outputs.json` の
 * `custom.backendApiUrl`）。利用側で `client.setConfig({ baseUrl })` を呼んで上書きする。
 * ここではローカル開発（uvicorn）のフォールバックのみを定義する。
 */
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: 'http://127.0.0.1:4040',
})
