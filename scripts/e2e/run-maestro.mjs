#!/usr/bin/env node
/**
 * Maestro E2E のドライバ（Cognito 版）。
 *
 * ## なぜドライバが必要か
 *
 * Maestro の `runScript` は graaljs で動き、使えるのは `http` / `json` だけである。
 * Cognito の Admin API は **SigV4 署名**を要求するので Maestro からは直接呼べない。
 * また Cognito のコードは**メールにしか出ず AWS API では取得できない**。
 *
 * そこでこのスクリプトが Maestro の外側で前後処理を行う:
 *
 * 1. `aws cognito-idp admin-create-user` + `admin-set-user-password` でテストユーザを作る
 *    （メール + パスワードのログインは**コードを一切必要としない** = 審査担当者と同じ経路）
 * 2. **localhost の OTP ブリッジ**を立てる。`AUTH_E2E_OTP_CAPTURE=true` でデプロイした
 *    sandbox は CustomEmailSender Lambda がコードを DynamoDB に書くので、
 *    `GET /code?email=...` でそれを返す（Maestro からは `http.get` で読める）
 * 3. `maestro test` を実行（`-e` で APP_ID / 資格情報 / ブリッジ URL を渡す）
 * 4. 後始末（テストユーザ削除・ブリッジ停止）
 *
 * ## 前提
 *
 * - AWS 認証情報（プロファイル）と `aws` CLI
 * - `AUTH_E2E_OTP_CAPTURE=true` でデプロイ済みの sandbox
 *   （`.claude/skills/e2e-auth/SKILL.md`。パスワード再設定フローのみ必要）
 * - 端末 / シミュレータ / エミュレータが起動していること
 *
 * ## 使い方
 *
 *   e2e-mobile              # devenv script 経由（推奨）
 *   e2e-mobile --platform ios
 *
 * 第 1 引数に Maestro のターゲット（フローのパス）を渡せる。省略時は `.maestro`。
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUTS = join(
	REPO_ROOT,
	"frontend/packages/backend/amplify_outputs.json",
);
/** Android エミュレータからホストの localhost は 10.0.2.2。iOS は localhost で届く */
const BRIDGE_PORT = Number(process.env.E2E_BRIDGE_PORT ?? 4599);
const TEST_PASSWORD = "Auth-E2E-Test-1!";

if (!existsSync(OUTPUTS)) {
	console.error(
		"amplify_outputs.json がありません。先に `sandbox` / `sandbox-once` でデプロイしてください。",
	);
	process.exit(1);
}

const outputs = JSON.parse(readFileSync(OUTPUTS, "utf8"));
const region =
	outputs.auth?.aws_region ??
	process.env.AWS_REGION ??
	process.env.AWS_DEFAULT_REGION;
const poolId = outputs.auth?.user_pool_id;
const otpTable = outputs.custom?.otpCaptureTableName;

if (!poolId || !region) {
	console.error(
		"amplify_outputs.json に auth.user_pool_id / aws_region がありません。",
	);
	process.exit(1);
}

const aws = (args) => {
	const out = execFileSync(
		"aws",
		[...args, "--region", region, "--output", "json"],
		{
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	return out.trim() ? JSON.parse(out) : null;
};

const appId = process.env.APP_ID ?? readAppId();
function readAppId() {
	const appJson = JSON.parse(
		readFileSync(join(REPO_ROOT, "frontend/apps/mobile/app.json"), "utf8"),
	);
	// iOS / Android で bundle id が分かれている場合は APP_ID を明示的に渡す
	return (
		appJson.expo?.ios?.bundleIdentifier ?? appJson.expo?.android?.package ?? ""
	);
}
if (!appId) {
	console.error(
		"APP_ID を解決できません。app.json に ios.bundleIdentifier / android.package を設定するか、APP_ID を渡してください。",
	);
	process.exit(1);
}

const email = `e2e-${Date.now()}@example.com`;
const log = (m) => console.log(`• ${m}`);

/**
 * OTP ブリッジ。DynamoDB のキャプチャテーブルから 1 件読んで返すだけ。
 *
 * **テストにしか使わないので localhost のみで待ち受ける。** 本番の経路には一切関与しない
 * （キャプチャ自体も `AUTH_E2E_OTP_CAPTURE=true` の sandbox でのみ配線される）。
 */
function startBridge() {
	const server = createServer((req, res) => {
		const url = new URL(req.url ?? "/", `http://127.0.0.1:${BRIDGE_PORT}`);
		if (url.pathname !== "/code") {
			res.writeHead(404).end("not found");
			return;
		}
		if (!otpTable) {
			res.writeHead(503, { "content-type": "application/json" });
			res.end(JSON.stringify({ error: "otp capture table not deployed" }));
			return;
		}
		try {
			const item = aws([
				"dynamodb",
				"get-item",
				"--table-name",
				otpTable,
				"--key",
				JSON.stringify({
					email: { S: url.searchParams.get("email") ?? email },
				}),
			]);
			res.writeHead(200, { "content-type": "application/json" });
			res.end(JSON.stringify({ code: item?.Item?.code?.S ?? null }));
		} catch (error) {
			console.error("[bridge] failed to read the capture table:", error);
			res.writeHead(500, { "content-type": "application/json" });
			res.end(JSON.stringify({ error: "lookup failed" }));
		}
	});
	server.listen(BRIDGE_PORT, "127.0.0.1");
	return server;
}

const bridge = startBridge();
log(
	`OTP bridge on http://127.0.0.1:${BRIDGE_PORT} (table: ${otpTable ?? "not deployed"})`,
);

let created = false;
try {
	log(`test user: ${email}`);
	aws([
		"cognito-idp",
		"admin-create-user",
		"--user-pool-id",
		poolId,
		"--username",
		email,
		"--user-attributes",
		`Name=email,Value=${email}`,
		"Name=email_verified,Value=true",
		"--message-action",
		"SUPPRESS",
	]);
	aws([
		"cognito-idp",
		"admin-set-user-password",
		"--user-pool-id",
		poolId,
		"--username",
		email,
		"--password",
		TEST_PASSWORD,
		"--permanent",
	]);
	created = true;

	// 第 1 引数がパスならターゲットとして扱い、残りは maestro へそのまま渡す
	const [maybeTarget, ...restArgs] = process.argv.slice(2);
	const isTarget = maybeTarget !== undefined && !maybeTarget.startsWith("-");
	const target = isTarget ? maybeTarget : ".maestro";
	const passthrough = isTarget ? restArgs : process.argv.slice(2);

	log(`maestro test ${target} …`);
	const result = spawnSync(
		"maestro",
		[
			"test",
			target,
			"-e",
			`APP_ID=${appId}`,
			"-e",
			`TEST_EMAIL=${email}`,
			"-e",
			`TEST_PASSWORD=${TEST_PASSWORD}`,
			// Android エミュレータからは 10.0.2.2 でホストへ届く
			"-e",
			`OTP_BRIDGE_URL=http://localhost:${BRIDGE_PORT}`,
			"-e",
			`OTP_BRIDGE_URL_ANDROID=http://10.0.2.2:${BRIDGE_PORT}`,
			...passthrough,
		],
		{ cwd: REPO_ROOT, stdio: "inherit" },
	);
	if (result.status !== 0) {
		process.exitCode = result.status ?? 1;
	}
} finally {
	bridge.close();
	if (created) {
		try {
			aws([
				"cognito-idp",
				"admin-delete-user",
				"--user-pool-id",
				poolId,
				"--username",
				email,
			]);
			log("test user deleted");
		} catch (error) {
			console.error(
				"テストユーザの削除に失敗しました（手動で消してください）:",
				error,
			);
		}
	}
}
