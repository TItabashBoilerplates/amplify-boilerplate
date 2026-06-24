/**
 * Cognito Email OTP 取得スクリプト（テンプレート / 要実装）
 *
 * 認証スタックは Amazon Cognito（Amplify Auth, passwordless Email OTP）。
 * Cognito はワンタイムコードを Amazon SES 経由でメール送信する。
 *
 * IMPORTANT:
 *   旧 Supabase ローカルスタックと違い、ローカルのメールシンク（Mailpit / Inbucket）が
 *   存在しないため、本スクリプトをそのまま動かすことはできない。E2E でコードを取得するには
 *   以下のいずれかを実装すること:
 *     1. テスト用メールボックス（例: SES → S3/SNS、または mailosaur / mailslurp のような
 *        受信ボックス API）を用意し、その API からコードを取得する。
 *     2. 開発用 User Pool に固定のテストユーザー + 既知コードを用意する。
 *
 * 使用方法（実装後）:
 *   - runScript: scripts/get-otp-from-email.js
 *   - inputText: ${output.otpCode}
 *
 * 環境変数:
 *   - TEST_EMAIL: OTP 送信先のテストメールアドレス
 *   - WAIT_FOR_EMAIL: "true" でメール到着を待機
 *   - MAX_RETRIES: 最大リトライ回数 (default: 10)
 *   - MAILBOX_API: 採用するメールボックス API のベース URL（実装者が定義）
 */

const MAX_WAIT_RETRIES = parseInt(MAX_RETRIES) || 10;
const RETRY_DELAY_MS = 1000;

/**
 * Wait for specified milliseconds (busy wait for Maestro JS)
 */
function sleep(ms) {
	const start = Date.now();
	while (Date.now() - start < ms) {
		// Busy wait
	}
}

/**
 * メール本文から OTP コード（6桁数字）を抽出
 * Cognito の Email OTP メールは "Your verification code is 123456" 形式
 */
function extractOtpFromBody(text) {
	const match = text.match(/\b(\d{6})\b/);
	return match ? match[1] : null;
}

/**
 * テスト用メールボックスから最新メールの本文を取得する。
 *
 * TODO: 採用するメールボックスプロバイダ（SES + S3/SNS、mailosaur、mailslurp 等）に対して
 *       HTTP リクエストを実装する。例:
 *
 *   const response = http.get(`${MAILBOX_API}/messages/latest?to=${TEST_EMAIL}`)
 *   if (response.code !== 200) return null
 *   return JSON.parse(response.body).text || ""
 *
 * 現状は未実装のため null を返す（フローは wip タグで除外されている）。
 */
function fetchLatestEmailBody() {
	console.log(
		"get-otp-from-email.js is a template: no mailbox provider configured.",
	);
	console.log(
		"Implement fetchLatestEmailBody() against your test mailbox to enable OTP E2E.",
	);
	return null;
}

/**
 * 最新メールから OTP を取得
 */
function getOtpFromLatestEmail() {
	const body = fetchLatestEmailBody();
	if (!body) {
		return null;
	}
	const otp = extractOtpFromBody(body);
	if (otp) {
		console.log("OTP code found:", otp);
		return otp;
	}
	console.log("No OTP code found in email body");
	return null;
}

/**
 * メール到着を待って OTP を取得
 */
function waitForOtp() {
	for (let attempt = 0; attempt < MAX_WAIT_RETRIES; attempt++) {
		console.log(
			`Attempt ${attempt + 1}/${MAX_WAIT_RETRIES}: Checking for OTP email...`,
		);
		const otp = getOtpFromLatestEmail();
		if (otp) {
			return otp;
		}
		sleep(RETRY_DELAY_MS);
	}
	console.log("Failed to find OTP after max retries");
	return null;
}

// Main execution
if (typeof WAIT_FOR_EMAIL !== "undefined" && WAIT_FOR_EMAIL === "true") {
	output.otpCode = waitForOtp() || "";
} else {
	output.otpCode = getOtpFromLatestEmail() || "";
}

if (output.otpCode) {
	console.log("OTP extraction successful:", output.otpCode);
} else {
	console.log("OTP extraction failed (template not implemented)");
}
