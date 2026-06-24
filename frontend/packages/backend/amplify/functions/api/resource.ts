import { execSync } from 'node:child_process'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineFunction } from '@aws-amplify/backend'
import { DockerImage, Duration } from 'aws-cdk-lib'
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda'

const functionDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * リポジトリ root の `backend-py`（uv workspace）への相対パス。
 * frontend/packages/backend/amplify/functions/api → repo root → backend-py
 */
const backendPyDir = path.resolve(functionDir, '../../../../../../backend-py')

/**
 * FastAPI バックエンドを載せた Python Lambda（Amplify custom function）。
 *
 * Amplify Gen2 の `defineFunction` は Node/TS のみ第一級サポートのため、Python は
 * CDK に降りて `Function`(Runtime.PYTHON_3_13) を定義する。バンドルは uv で
 * サードパーティ依存を `requirements.txt` に書き出し → pip で Lambda 互換 wheel を
 * インストール → `apps/api`/`packages/core` のソースをコピーする。
 *
 * ハンドラは `api.lambda_handler.handler`（Mangum が FastAPI を Lambda に適合）。
 *
 * @see https://docs.amplify.aws/nextjs/build-a-backend/functions/custom-functions/
 */
export const api = defineFunction(
  (scope) =>
    new Function(scope, 'fastapi', {
      handler: 'api.lambda_handler.handler',
      runtime: Runtime.PYTHON_3_13,
      timeout: Duration.seconds(30),
      memorySize: 512,
      code: Code.fromAsset(backendPyDir, {
        // ローカルに uv + python3 があれば Docker を使わずにバンドルする。
        bundling: {
          image: DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.13'),
          local: {
            tryBundle(outputDir: string) {
              const reqFile = path.join(outputDir, 'requirements.txt')
              // 1) サードパーティ依存だけを requirements.txt に書き出す（workspace 除外）
              execSync(
                `uv export --frozen --no-dev --no-emit-workspace --package api -o ${reqFile}`,
                { cwd: backendPyDir, stdio: 'inherit' }
              )
              // 2) Lambda(linux/x86_64) 互換 wheel をインストール
              execSync(
                `python3 -m pip install -r ${reqFile} -t ${outputDir} ` +
                  '--platform manylinux2014_x86_64 --python-version 3.13 --only-binary=:all:',
                { stdio: 'inherit' }
              )
              // 3) アプリ + 共有パッケージのソースをコピー
              execSync(`cp -r ${path.join(backendPyDir, 'apps/api/src/api')} ${outputDir}/api`, {
                stdio: 'inherit',
              })
              execSync(
                `cp -r ${path.join(backendPyDir, 'packages/core/src/core')} ${outputDir}/core`,
                { stdio: 'inherit' }
              )
              return true
            },
          },
        },
      }),
    }),
  {
    resourceGroupName: 'auth',
  }
)
