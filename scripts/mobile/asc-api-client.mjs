/**
 * App Store Connect API のクライアント（ES256 JWT の署名 + fetch）。
 *
 * 資格情報は `store.sh` が SSM Parameter Store / env から注入する（キー名のみで会話し、値は出さない）:
 *   APPLE_API_KEY      … Key ID（App Store Connect > Users and Access > Integrations）
 *   APPLE_API_ISSUER   … Issuer ID（同上）
 *   APPLE_API_KEY_P8   … .p8 秘密鍵（PEM そのまま、または base64）
 *
 * ⚠️ **ES256 の JWT は `dsaEncoding: "ieee-p1363"` が必須。**
 *    Node の既定は DER で、そのまま base64url にすると Apple 側で 401 になる。
 *    署名自体は成功してしまうので「鍵が違う」と誤診しやすい。
 */
import crypto from "node:crypto";

const {
	APPLE_API_KEY: KEY_ID,
	APPLE_API_ISSUER: ISSUER,
	APPLE_API_KEY_P8: RAW_P8,
} = process.env;

if (!KEY_ID || !ISSUER || !RAW_P8) {
	throw new Error(
		"APPLE_API_KEY / APPLE_API_ISSUER / APPLE_API_KEY_P8 がありません。\n" +
			"  scripts/mobile/store.sh 経由で実行してください（SSM / env から注入されます）",
	);
}

const pem = RAW_P8.includes("BEGIN PRIVATE KEY")
	? RAW_P8
	: Buffer.from(RAW_P8, "base64").toString("utf8");

const b64url = (b) =>
	Buffer.from(b)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");

const now = Math.floor(Date.now() / 1000);
const signingInput = `${b64url(
	JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }),
)}.${b64url(
	JSON.stringify({
		iss: ISSUER,
		iat: now,
		exp: now + 1200, // Apple の上限は 20 分
		aud: "appstoreconnect-v1",
	}),
)}`;

export const TOKEN = `${signingInput}.${b64url(
	crypto.sign("sha256", Buffer.from(signingInput), {
		key: crypto.createPrivateKey(pem),
		dsaEncoding: "ieee-p1363",
	}),
)}`;

/** HTTP ステータスをそのまま返す（404 を「未作成」として扱いたい GET 用） */
export async function apiRaw(method, path, body) {
	const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${TOKEN}`,
			...(body ? { "Content-Type": "application/json" } : {}),
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});
	const text = await res.text();
	let json;
	try {
		json = text ? JSON.parse(text) : {};
	} catch {
		json = { raw: text.slice(0, 400) };
	}
	return { ok: res.ok, status: res.status, json };
}

/**
 * 失敗を握りつぶさず、Apple のエラー本文を添えて投げる。
 * `screenshotDisplayType` のような未文書の enum は、**誤った値を送ると 400 と一緒に
 * 許容値が返る**ので、本文をそのまま見せることが調査の近道になる。
 */
export async function api(method, path, body) {
	const { ok, status, json } = await apiRaw(method, path, body);
	if (!ok) {
		const e = json?.errors?.[0];
		throw new Error(
			`${method} ${path} → HTTP ${status}: ${e?.title ?? ""} / ${
				e?.detail ?? JSON.stringify(json).slice(0, 300)
			}${e?.source?.pointer ? ` @ ${e.source.pointer}` : ""}`,
		);
	}
	return json;
}

/**
 * ページングを辿って全件返す。
 * 価格ポイントは 1 地域でも 200 件を超えるので、1 ページ目だけ見ると取りこぼす。
 */
export async function apiAll(path) {
	const out = [];
	let url = path;
	while (url) {
		const r = await api("GET", url);
		out.push(...(r.data ?? []));
		url =
			r.links?.next?.replace("https://api.appstoreconnect.apple.com", "") ??
			null;
	}
	return out;
}

/** bundle id からアプリを引く（`ascAppId` は任意項目なので当てにしない） */
export async function findApp(bundleId) {
	const { data } = await api(
		"GET",
		`/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=2`,
	);
	if (data.length === 0) {
		throw new Error(
			`App Store Connect にアプリがありません: ${bundleId}\n` +
				"  先に App Store Connect でアプリレコードを作成してください",
		);
	}
	return data[0];
}
