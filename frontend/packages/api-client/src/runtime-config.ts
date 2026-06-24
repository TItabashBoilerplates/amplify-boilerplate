/**
 * Hey API ランタイム設定
 *
 * 環境変数から baseUrl を動的に設定するための設定ファイル。
 * openapi-ts の runtimeConfigPath によって自動的に読み込まれる。
 */
import type { CreateClientConfig } from './generated/client.gen'

/**
 * クライアント設定を作成する関数
 *
 * 環境変数 NEXT_PUBLIC_BACKEND_PY_URL からベースURLを取得し、
 * フォールバックとして http://127.0.0.1:4040 を使用する。
 */
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: process.env.NEXT_PUBLIC_BACKEND_PY_URL ?? 'http://127.0.0.1:4040',
})
