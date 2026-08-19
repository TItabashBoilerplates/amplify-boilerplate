/**
 * Google Play Developer API v3 の薄いクライアント。
 *
 * 資格情報は `store.sh` が SSM Parameter Store / env から注入する:
 *   PLAY_SERVICE_ACCOUNT_JSON … サービスアカウント鍵（JSON そのまま、または base64）
 *
 * 権限は **Play Console の Users & Permissions 側**でアプリ単位に付与する
 * （GCP の IAM ロールでは付かない）。ここを取り違えると、鍵は正しいのに
 * 403 で「アプリが見つからない」ように見える。
 */
import crypto from "node:crypto";
import { packageName } from "./store-config.mjs";

export const PKG = packageName();

const raw = process.env.PLAY_SERVICE_ACCOUNT_JSON;
if (!raw) {
	throw new Error(
		"PLAY_SERVICE_ACCOUNT_JSON がありません。\n" +
			"  scripts/mobile/store.sh 経由で実行してください（SSM / env から注入されます）",
	);
}

const sa = JSON.parse(
	raw.trimStart().startsWith("{")
		? raw
		: Buffer.from(raw, "base64").toString("utf8"),
);

const b64url = (x) =>
	Buffer.from(x)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");

let cached = null;

/** サービスアカウント JWT を access token に交換する（1 時間キャッシュ） */
export async function token() {
	const now = Math.floor(Date.now() / 1000);
	if (cached && cached.exp > now + 60) return cached.value;

	const signingInput = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
		JSON.stringify({
			iss: sa.client_email,
			scope: "https://www.googleapis.com/auth/androidpublisher",
			aud: sa.token_uri,
			iat: now,
			exp: now + 3600,
		}),
	)}`;
	const jwt = `${signingInput}.${b64url(
		crypto.sign("RSA-SHA256", Buffer.from(signingInput), sa.private_key),
	)}`;

	const res = await fetch(sa.token_uri, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
			assertion: jwt,
		}),
	});
	const json = await res.json();
	if (!json.access_token) {
		throw new Error(
			`access token の取得に失敗: ${JSON.stringify(json).slice(0, 300)}`,
		);
	}
	cached = { value: json.access_token, exp: now + 3500 };
	return cached.value;
}

export async function api(method, path, body) {
	const res = await fetch(
		`https://androidpublisher.googleapis.com/androidpublisher/v3${path}`,
		{
			method,
			headers: {
				Authorization: `Bearer ${await token()}`,
				...(body ? { "Content-Type": "application/json" } : {}),
			},
			...(body ? { body: JSON.stringify(body) } : {}),
		},
	);
	const text = await res.text();
	let json;
	try {
		json = text ? JSON.parse(text) : {};
	} catch {
		json = { raw: text.slice(0, 400) };
	}
	if (!res.ok) {
		throw new Error(
			`${method} ${path} → ${res.status}: ${
				json.error?.message ?? JSON.stringify(json).slice(0, 400)
			}`,
		);
	}
	return json;
}

/**
 * ¥ 建ての基準価格を Google 自身に各地域へ換算させる。
 *
 * 為替を自前で計算しない。返り値の `regionVersion.version` は作成・更新の
 * **必須クエリパラメータ**（掲載文だけ直す場合でも要求される）なので、
 * バージョン文字列を推測せずこの応答から取る。
 */
export async function convertRegionPrices(currencyCode, units) {
	const converted = await api(
		"POST",
		`/applications/${PKG}/pricing:convertRegionPrices`,
		{ price: { currencyCode, units: String(units), nanos: 0 } },
	);
	const version = converted.regionVersion?.version;
	if (!version) throw new Error("regionVersion を取得できませんでした");
	return { converted, version };
}
