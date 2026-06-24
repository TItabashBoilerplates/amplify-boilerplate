/**
 * Maestro Test User Cleanup Script (Cognito — テンプレート / 要実装)
 *
 * Amazon Cognito User Pool からテストユーザーを削除する。
 * 認証スタックは Amplify Auth（passwordless Email OTP）。
 *
 * IMPORTANT:
 *   Cognito の Admin API（cognito-idp: AdminDeleteUser）は AWS SigV4 署名が必要で、
 *   Maestro の graaljs `http` からは直接呼べない。実運用では setup-test-user.js と同様に
 *   CI 側の AWS CLI / SDK、または SigV4 署名プロキシ経由で削除すること。
 *
 * 必要な環境変数:
 *   - COGNITO_USER_POOL_ID: 対象 User Pool ID
 *   - TEST_EMAIL: 削除するテストユーザーの email（= username）
 */

const userPoolId =
	(typeof COGNITO_USER_POOL_ID !== "undefined" && COGNITO_USER_POOL_ID) || "";
const testEmail = (typeof TEST_EMAIL !== "undefined" && TEST_EMAIL) || "";

if (!testEmail) {
	console.log("No TEST_EMAIL provided, skipping cleanup");
	output.cleaned = false;
} else {
	/**
	 * Cognito からテストユーザーを削除する。
	 *
	 * TODO: SigV4 署名付きで cognito-idp AdminDeleteUser を呼ぶ HTTP プロキシを実装し、
	 *       ここから叩く。例（プロキシ前提）:
	 *
	 *   const response = http.request(`${COGNITO_ADMIN_PROXY}/users/${testEmail}`, {
	 *     method: "DELETE",
	 *     headers: { "Content-Type": "application/json" },
	 *     body: JSON.stringify({ userPoolId }),
	 *   })
	 *   if (response.code !== 200 && response.code !== 204)
	 *     throw new Error(`Failed: ${response.body}`)
	 *
	 * 現状は削除を行わない（フローは wip タグで除外）。CI/SDK 側でクリーンアップすること。
	 */
	function deleteTestUser() {
		console.log(
			"cleanup-test-user.js is a template: delete the Cognito user via CI/SDK or a SigV4 proxy.",
		);
		console.log("Would delete:", testEmail, "from pool", userPoolId);
		return true;
	}

	try {
		deleteTestUser();
		output.cleaned = true;
		output.deletedEmail = testEmail;
		console.log("Cleanup complete (template)");
	} catch (error) {
		console.log("Cleanup failed:", error.message);
		output.cleaned = false;
		output.error = error.message;
		// Don't throw - cleanup failures shouldn't fail the test
	}
}
