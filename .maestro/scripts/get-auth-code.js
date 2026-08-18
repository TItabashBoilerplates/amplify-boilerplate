/**
 * Cognito が送った 6 桁コードを取得する（OTP ブリッジ経由）。
 *
 * ## なぜブリッジ越しなのか
 *
 * Cognito のコードは**メールにしか出ず AWS API では取得できない**。このリポジトリは
 * `AUTH_E2E_OTP_CAPTURE=true` でデプロイしたときだけ CustomEmailSender Lambda が
 * コードを DynamoDB に書く（`.claude/skills/e2e-auth/SKILL.md`）。
 *
 * ただし DynamoDB を読むには SigV4 署名が必要で、Maestro の graaljs には
 * `http` / `json` しか無いため直接は読めない。そこで `scripts/e2e/run-maestro.mjs` が
 * localhost に薄いブリッジを立て、ここではそれを `http.get` する。
 *
 * 使い方:
 *   - runScript: scripts/get-auth-code.js
 *   - inputText: ${output.authCode}
 *
 * 環境変数:
 *   - OTP_BRIDGE_URL: ブリッジのベース URL（Android エミュレータは 10.0.2.2）
 *   - TEST_EMAIL: 対象のメールアドレス
 *   - MAX_RETRIES: 最大リトライ回数（既定 20。1 回ごとに約 1 秒待つ）
 */

const bridgeUrl =
	(typeof OTP_BRIDGE_URL !== "undefined" && OTP_BRIDGE_URL) ||
	"http://localhost:4599";
const email = (typeof TEST_EMAIL !== "undefined" && TEST_EMAIL) || "";
const maxRetries = Number.parseInt(
	(typeof MAX_RETRIES !== "undefined" && MAX_RETRIES) || "20",
	10,
);

if (!email) {
	throw new Error("TEST_EMAIL is required (run via `e2e-mobile`)");
}

/** graaljs には setTimeout が無いのでビジーウェイトする */
function sleep(ms) {
	const start = Date.now();
	while (Date.now() - start < ms) {
		// busy wait
	}
}

let code = null;
for (let attempt = 0; attempt < maxRetries && !code; attempt++) {
	const response = http.get(`${bridgeUrl}/code?email=${email}`);
	if (response.status === 200 || response.code === 200) {
		const body = json(response.body);
		code = body.code || null;
	} else {
		// 失敗を握りつぶさない（`.claude/rules/error-handling.md`）
		console.log(
			`get-auth-code: bridge responded ${response.status || response.code} (attempt ${attempt + 1})`,
		);
	}
	if (!code) {
		sleep(1000);
	}
}

if (!code) {
	throw new Error(
		`get-auth-code: no code captured for ${email}. ` +
			"Deploy the sandbox with AUTH_E2E_OTP_CAPTURE=true (see .claude/skills/e2e-auth/).",
	);
}

output.authCode = code;
