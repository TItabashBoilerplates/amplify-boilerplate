/**
 * Mailpit からOTPコードを取得するスクリプト
 *
 * Supabase CLI の Inbucket (Mailpit互換API) は 54324 ポートで動作
 *
 * 使用方法:
 *   - runScript: scripts/get-otp-from-mailpit.js
 *   - inputText: ${output.otpCode}
 *
 * 環境変数:
 *   - MAILPIT_URL: Mailpit API URL (default: http://localhost:54324)
 *   - WAIT_FOR_EMAIL: "true" でメール到着を待機
 *   - MAX_RETRIES: 最大リトライ回数 (default: 10)
 */

const MAILPIT_API = (MAILPIT_URL || "http://localhost:54324") + "/api/v1";
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
 * メッセージ一覧を取得
 */
function getMessages() {
	try {
		const response = http.get(`${MAILPIT_API}/messages`);
		if (response.code !== 200) {
			console.log("Failed to fetch messages:", response.code);
			return [];
		}
		const data = JSON.parse(response.body);
		return data.messages || [];
	} catch (e) {
		console.log("Error fetching messages:", e);
		return [];
	}
}

/**
 * メッセージ詳細を取得
 */
function getMessageDetail(messageId) {
	try {
		const response = http.get(`${MAILPIT_API}/message/${messageId}`);
		if (response.code !== 200) {
			console.log("Failed to fetch message detail:", response.code);
			return null;
		}
		return JSON.parse(response.body);
	} catch (e) {
		console.log("Error fetching message detail:", e);
		return null;
	}
}

/**
 * メッセージを削除
 */
function deleteMessage(messageId) {
	try {
		http.request(`${MAILPIT_API}/message/${messageId}`, { method: "DELETE" });
		console.log("Message deleted:", messageId);
	} catch (e) {
		console.log("Error deleting message:", e);
	}
}

/**
 * メール本文からOTPコード（6桁数字）を抽出
 * Supabase OTPメールは "Your login code is: 123456" 形式
 */
function extractOtpFromBody(text) {
	const match = text.match(/\b(\d{6})\b/);
	return match ? match[1] : null;
}

/**
 * 最新のメールからOTPを取得
 */
function getOtpFromLatestEmail() {
	const messages = getMessages();

	if (!messages || messages.length === 0) {
		console.log("No messages found in Mailpit");
		return null;
	}

	// 最新のメッセージIDを取得
	const latestMessageId = messages[0].ID;
	console.log("Latest message ID:", latestMessageId);

	// メッセージ詳細を取得
	const emailDetail = getMessageDetail(latestMessageId);

	if (!emailDetail) {
		console.log("Failed to get email detail");
		return null;
	}

	// メール本文からOTPコードを抽出
	const textBody = emailDetail.Text || "";
	const htmlBody = emailDetail.HTML || "";
	const body = textBody || htmlBody;

	const otp = extractOtpFromBody(body);

	if (otp) {
		console.log("OTP code found:", otp);
		// 使用済みメッセージを削除
		deleteMessage(latestMessageId);
		return otp;
	}

	console.log("No OTP code found in email body");
	return null;
}

/**
 * メール到着を待ってOTPを取得
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
if (WAIT_FOR_EMAIL === "true") {
	output.otpCode = waitForOtp() || "";
} else {
	output.otpCode = getOtpFromLatestEmail() || "";
}

if (output.otpCode) {
	console.log("OTP extraction successful:", output.otpCode);
} else {
	console.log("OTP extraction failed");
}
