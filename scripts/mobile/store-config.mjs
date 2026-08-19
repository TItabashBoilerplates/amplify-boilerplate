/**
 * ストア反映スクリプト（asc-* / play-*）の共通土台。
 *
 * **設定の正本を 1 か所に固定する**のが目的。派生プロジェクトごとに変わる値
 * （bundle id / package name / 掲載文 / 商品定義）をスクリプトへ直書きすると、
 * 「iOS 側だけ価格を直して Android が古いまま」のような食い違いが必ず起きる。
 *
 * | 値 | 正本 |
 * |---|---|
 * | bundle id / package name / version / icon | `app.json`（Expo の設定そのもの） |
 * | App Store の掲載文 | `store.config.js`（EAS Metadata 形式） |
 * | Play の掲載文・画像 | `play.config.js` |
 * | サブスク商品（両ストア共通） | `iap.config.js` |
 * | スクリーンショット | `store-listing/`（`screenshots-mobile` の出力先） |
 *
 * 非機密の実行時設定（`MOBILE_APP_DIR` 等）は `scripts/mobile/config.env` にあり、
 * `store.sh` が source して環境変数として渡す（同じパーサを 2 言語で持たないため）。
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const REPO_ROOT = resolve(import.meta.dirname, "../..");

export const APP_DIR = join(
	REPO_ROOT,
	process.env.MOBILE_APP_DIR || "frontend/apps/mobile",
);

/**
 * 撮影済みスクリーンショットの置き場。`screenshots-mobile` /
 * `screenshots-storybook` の出力先と揃っている必要がある。
 *
 *   store-listing/ios/<App Store のロケール>/**\/*.png
 *   store-listing/android/<Play のロケール>/<imageType>/*.png
 *
 * Android 側のディレクトリ名がそのまま Play の `imageType`（`phoneScreenshots` /
 * `tenInchScreenshots` 等）になる。
 */
export const LISTING_ROOT = join(REPO_ROOT, "store-listing");

/** `DRY_RUN=1` で「何をするか」だけ出して一切書き込まない */
export const DRY = process.env.DRY_RUN === "1";

export const log = (s) => console.log(s);

/** 変更前に必ず出す見出し。dry-run かどうかを取り違えると本番を書き換えてしまう */
export function banner(title) {
	log(`\n=== ${title}${DRY ? "  [DRY RUN: 書き込みません]" : ""} ===`);
}

// ─────────────────────────────────────────────────────────────────────────────
// app.json（Expo の設定＝アプリ identity の正本）
// ─────────────────────────────────────────────────────────────────────────────

const appJsonPath = join(APP_DIR, "app.json");
if (!existsSync(appJsonPath)) {
	throw new Error(
		`app.json が無い: ${appJsonPath}（MOBILE_APP_DIR の設定を確認してください）`,
	);
}

/** @type {{ expo: Record<string, any> }} */
export const appJson = JSON.parse(readFileSync(appJsonPath, "utf8"));
export const expo = appJson.expo;

/**
 * iOS の bundle identifier。
 *
 * **アプリの特定は必ずこれで行う**（`eas.json` の `ascAppId` は任意項目で、
 * 実際に消えていたことがある。app.json の bundle id なら必ず存在する）。
 */
export function bundleId() {
	const id = expo?.ios?.bundleIdentifier;
	if (!id) {
		throw new Error(
			"app.json に expo.ios.bundleIdentifier がありません。" +
				"App Store へ出す前に設定してください",
		);
	}
	return id;
}

/** Android の package name */
export function packageName() {
	const pkg = expo?.android?.package;
	if (!pkg) {
		throw new Error(
			"app.json に expo.android.package がありません。" +
				"Google Play へ出す前に設定してください",
		);
	}
	return pkg;
}

/** app.json の version（App Store のバージョン紐付けに使う） */
export function appVersion() {
	const v = expo?.version;
	if (!v) throw new Error("app.json に expo.version がありません");
	return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// <name>.config.js の読み込み
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `frontend/apps/mobile/<name>.config.js` を読む。
 *
 * Expo アプリの package.json に `"type": "module"` は無い（＝ CJS）ので、
 * `import()` の結果は `{ default: module.exports }` になる。関数を export して
 * いる場合（`store.config.js` は EAS Metadata の仕様で関数を返せる）は呼び出す。
 */
export async function loadAppConfig(name) {
	const path = join(APP_DIR, `${name}.config.js`);
	if (!existsSync(path)) {
		throw new Error(
			`${name}.config.js が無い: ${path}\n` +
				"  ストアへ反映する内容の正本になるファイルです。先に作成してください",
		);
	}
	const mod = await import(pathToFileURL(path).href);
	const value = mod.default ?? mod;
	return typeof value === "function" ? value() : value;
}

// ─────────────────────────────────────────────────────────────────────────────
// 共通の小道具
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 429 / 5xx を指数バックオフで再試行する。
 *
 * 地域ごとに数百回 POST する処理（価格の等価展開・導入オファー）があり、
 * **一度 429 を貰うと以降が総崩れになる**。握りつぶさず、諦めるときは投げる。
 */
export async function withRetry(fn, { attempts = 4, label = "request" } = {}) {
	let lastError;
	for (let i = 0; i < attempts; i++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			const retryable = /HTTP (429|5\d\d)|→ (429|5\d\d)/.test(String(error));
			if (!retryable || i === attempts - 1) throw error;
			const waitMs = 2 ** i * 1000;
			console.warn(`  ⚠ ${label} を ${waitMs}ms 後に再試行します: ${error}`);
			await new Promise((r) => setTimeout(r, waitMs));
		}
	}
	throw lastError;
}

/**
 * 同時実行数を絞って順に流す。
 * 一気に並列で投げると 429 を貰うので、地域単位の一括作成はこれを通す。
 */
export async function inBatches(items, size, fn) {
	const out = [];
	for (let i = 0; i < items.length; i += size) {
		out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
	}
	return out;
}
