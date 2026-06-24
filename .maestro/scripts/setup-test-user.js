/**
 * Maestro Test User Setup Script (Cognito — テンプレート / 要実装)
 *
 * Amazon Cognito User Pool にテストユーザーを作成する。
 * 認証スタックは Amplify Auth（passwordless Email OTP）。
 *
 * IMPORTANT:
 *   Cognito の Admin API（cognito-idp: AdminCreateUser など）は AWS SigV4 署名が必要で、
 *   Maestro の graaljs `http` からは直接呼べない。実運用では次のいずれかを推奨する:
 *     1. CI 側で AWS CLI / SDK を使って事前にテストユーザーを作成し、その email を
 *        TEST_EMAIL として Maestro に渡す（このスクリプトは email の受け渡しのみ担う）。
 *     2. SigV4 署名を行う薄いプロキシ（Lambda 等）を用意し、その HTTP エンドポイントを叩く。
 *
 * 必要な環境変数:
 *   - COGNITO_USER_POOL_ID: 対象 User Pool ID
 *   - TEST_EMAIL: 作成するテストユーザーの email（未指定なら自動生成）
 *
 * Output:
 *   - output.testEmail: テストユーザーの email
 */

// Maestro injects env vars (COGNITO_USER_POOL_ID, TEST_EMAIL) via `runScript`.
// Use `typeof` guards so the script also works when invoked outside Maestro.
const userPoolId =
	(typeof COGNITO_USER_POOL_ID !== "undefined" && COGNITO_USER_POOL_ID) || "";

// Generate a unique test email if not provided
const timestamp = Date.now();
const testEmail =
	(typeof TEST_EMAIL !== "undefined" && TEST_EMAIL) ||
	`e2e_test_${timestamp}@test.local`;

if (!userPoolId) {
	console.log(
		"COGNITO_USER_POOL_ID is not set; assuming the test user is provisioned externally.",
	);
}

/**
 * Cognito にテストユーザーを作成する。
 *
 * TODO: SigV4 署名付きで cognito-idp AdminCreateUser を呼ぶ HTTP プロキシを実装し、
 *       ここから叩く。例（プロキシ前提）:
 *
 *   const response = http.post(`${COGNITO_ADMIN_PROXY}/users`, {
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ userPoolId, email: testEmail }),
 *   })
 *   if (response.code !== 200) throw new Error(`Failed: ${response.body}`)
 *
 * 現状はユーザー作成を行わず、email の受け渡しのみ行う（フローは wip タグで除外）。
 */
function createTestUser() {
	console.log(
		"setup-test-user.js is a template: provision the Cognito user via CI/SDK and pass TEST_EMAIL.",
	);
	return { email: testEmail };
}

// Execute setup
try {
	const user = createTestUser();
	output.testEmail = user.email;
	console.log("Setup complete. Test email:", user.email);
} catch (error) {
	console.log("Setup failed:", error.message);
	throw error;
}
