#!/usr/bin/env node
/**
 * ストア掲載用スクリーンショットが各ストアの要求を満たしているか検証する。
 *
 *   node scripts/mobile/validate-screenshots.mjs --platform ios     store-listing/ios
 *   node scripts/mobile/validate-screenshots.mjs --platform android store-listing/android
 *
 * **アップロード前に必ず通す**こと。ストア側で弾かれると原因が
 * 「Image dimensions are wrong」程度しか返らず、どのファイルが悪いのか分からない。
 *
 * 依存を増やさないため PNG / JPEG のヘッダを直接読んでサイズを得る
 * （ImageMagick を入れるほどの処理ではない）。
 *
 * 出典（2026-08 時点。要求は変わるので追従すること）:
 *   App Store Connect:
 *     https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/
 *   Google Play:
 *     https://support.google.com/googleplay/android-developer/answer/9866151
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

// ─────────────────────────────────────────────────────────────────────────────
// ストア要求
// ─────────────────────────────────────────────────────────────────────────────

/**
 * App Store Connect が受け付ける実ピクセルサイズ。
 * ここに無いサイズは「どの表示サイズ枠にも属さない」としてアップロードが失敗する。
 *
 * `displayType` は App Store Connect API の `screenshotDisplayType`（アップロード先の
 * セットを決める値）。**アップロードはこれで端末クラスを指定する**ので、
 * ピクセルサイズから引けるようにここに併記している。
 *
 * ⚠️ **推測で増やさないこと。** 新しい画面サイズの display type は
 * **Apple の API リファレンスに載っていない**（下記フォーラム参照）。値を誤ると
 * API が 400 で許容値の一覧を返すので、**実際に送って返ってきた値だけ**をここへ足す。
 * `displayType` が無いサイズは検証には通るが `asc-push-screenshots` が
 * 「マッピングが無い」と明示して落ちる（黙って掲載から漏らさないため）。
 *
 *   6.9" iPhone: https://developer.apple.com/forums/thread/763908
 *     → APP_IPHONE_67 が 1320x2868 / 1290x2796 / 1260x2736 を受け付ける
 *   13"  iPad  : https://developer.apple.com/forums/thread/751867
 *     → APP_IPAD_PRO_3GEN_129 が 2064x2752 / 2048x2732 を受け付ける
 */
export const APP_STORE_SIZES = [
	{
		label: 'iPhone 6.9"',
		portrait: [1320, 2868],
		required: true,
		displayType: "APP_IPHONE_67",
	},
	{ label: 'iPhone 6.5"', portrait: [1284, 2778], required: false },
	{ label: 'iPhone 6.3"', portrait: [1179, 2556], required: false },
	{ label: 'iPhone 6.1"', portrait: [1170, 2532], required: false },
	{ label: 'iPhone 5.5"', portrait: [1242, 2208], required: false },
	{
		label: 'iPad 13"',
		portrait: [2064, 2752],
		required: false,
		displayType: "APP_IPAD_PRO_3GEN_129",
	},
	{ label: 'iPad 11"', portrait: [1488, 2266], required: false },
	{ label: 'iPad 10.5"', portrait: [1668, 2224], required: false },
	{ label: 'iPad 9.7"', portrait: [1536, 2048], required: false },
];

const APP_STORE_MAX_PER_SIZE = 10;

const PLAY = {
	minEdge: 320,
	maxEdge: 3840,
	/**
	 * Play の「最大辺は最小辺の 2 倍以内」制約。
	 * ここが一番踏みやすい罠で、**最近の Android 端末の素のスクショは大半が違反する**
	 * （例: Pixel 7 の 1080x2400 は 2.22 倍）。1080x1920 (16:9) の AVD で撮るか、
	 * 上下をクロップ / パディングして 2 倍以内に収める必要がある。
	 */
	maxAspect: 2,
	minCount: 2,
	maxCount: 8,
};

// ─────────────────────────────────────────────────────────────────────────────
// 画像サイズの取得（依存なし）
// ─────────────────────────────────────────────────────────────────────────────

/** PNG: 8 byte signature + IHDR(length/type) の後に width/height が big-endian で並ぶ */
function pngSize(buf) {
	if (buf.length < 24) return null;
	const isPng =
		buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a;
	if (!isPng) return null;
	return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** JPEG: SOFn マーカー (0xFFC0-0xFFCF, ただし C4/C8/CC を除く) の中に height/width がある */
function jpegSize(buf) {
	if (buf.length < 4 || buf.readUInt16BE(0) !== 0xffd8) return null;
	let offset = 2;
	while (offset + 9 < buf.length) {
		if (buf[offset] !== 0xff) {
			offset++;
			continue;
		}
		const marker = buf[offset + 1];
		const isSof =
			marker >= 0xc0 &&
			marker <= 0xcf &&
			marker !== 0xc4 &&
			marker !== 0xc8 &&
			marker !== 0xcc;
		if (isSof) {
			return {
				height: buf.readUInt16BE(offset + 5),
				width: buf.readUInt16BE(offset + 7),
			};
		}
		offset += 2 + buf.readUInt16BE(offset + 2);
	}
	return null;
}

/** PNG がアルファチャンネルを持つか（両ストアともアルファ付きを拒否する） */
function pngHasAlpha(buf) {
	const colorType = buf[25];
	// 4 = grayscale+alpha, 6 = truecolour+alpha
	return colorType === 4 || colorType === 6;
}

export function readImage(path) {
	const buf = readFileSync(path);
	const ext = extname(path).toLowerCase();
	if (ext === ".png") {
		const size = pngSize(buf);
		return size && { ...size, format: "png", hasAlpha: pngHasAlpha(buf) };
	}
	if (ext === ".jpg" || ext === ".jpeg") {
		const size = jpegSize(buf);
		return size && { ...size, format: "jpeg", hasAlpha: false };
	}
	return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 検証
// ─────────────────────────────────────────────────────────────────────────────

export function collectImages(dir) {
	const out = [];
	const walk = (d) => {
		for (const entry of readdirSync(d, { withFileTypes: true })) {
			const p = join(d, entry.name);
			if (entry.isDirectory()) walk(p);
			else if (/\.(png|jpe?g)$/i.test(entry.name)) out.push(p);
		}
	};
	if (!statSync(dir).isDirectory())
		throw new Error(`ディレクトリではありません: ${dir}`);
	walk(dir);
	return out.sort();
}

function validateIos(images) {
	const errors = [];
	const byLabel = new Map();

	for (const { path, img } of images) {
		if (img.hasAlpha) {
			errors.push(
				`${path}: アルファチャンネル付き（App Store は透過を受け付けない）`,
			);
		}
		const { width, height } = img;
		const match = APP_STORE_SIZES.find(
			(s) =>
				(s.portrait[0] === width && s.portrait[1] === height) ||
				(s.portrait[1] === width && s.portrait[0] === height),
		);
		if (!match) {
			errors.push(
				`${path}: ${width}x${height} は App Store の受付サイズに一致しない。` +
					`必須は iPhone 6.9" = 1320x2868（縦）`,
			);
			continue;
		}
		byLabel.set(match.label, (byLabel.get(match.label) ?? 0) + 1);
	}

	for (const [label, count] of byLabel) {
		if (count > APP_STORE_MAX_PER_SIZE) {
			errors.push(
				`${label}: ${count} 枚（1 サイズあたり最大 ${APP_STORE_MAX_PER_SIZE} 枚）`,
			);
		}
	}

	const hasRequired = [...byLabel.keys()].some(
		(l) => APP_STORE_SIZES.find((s) => s.label === l)?.required,
	);
	if (images.length > 0 && !hasRequired) {
		errors.push(
			'必須サイズ（iPhone 6.9" = 1320x2868）の画像が 1 枚も無い。' +
				'6.9" を出さない場合は 6.5"（1284x2778）が必須。',
		);
	}

	return { errors, summary: byLabel };
}

function validateAndroid(images) {
	const errors = [];

	for (const { path, img } of images) {
		if (img.hasAlpha) {
			errors.push(
				`${path}: アルファチャンネル付き（Play は 24-bit PNG / JPEG のみ）`,
			);
		}
		const { width, height } = img;
		const min = Math.min(width, height);
		const max = Math.max(width, height);

		if (min < PLAY.minEdge)
			errors.push(`${path}: 最小辺 ${min}px < ${PLAY.minEdge}px`);
		if (max > PLAY.maxEdge)
			errors.push(`${path}: 最大辺 ${max}px > ${PLAY.maxEdge}px`);
		if (max > min * PLAY.maxAspect) {
			errors.push(
				`${path}: ${width}x${height} は縦横比 ${(max / min).toFixed(2)}:1 で、` +
					`Play の「最大辺は最小辺の ${PLAY.maxAspect} 倍以内」に違反。` +
					`1080x1920 (16:9) の AVD で撮るか、クロップ/パディングで収めること`,
			);
		}
	}

	if (images.length > 0 && images.length < PLAY.minCount) {
		errors.push(`${images.length} 枚（Play は最低 ${PLAY.minCount} 枚必要）`);
	}
	if (images.length > PLAY.maxCount) {
		errors.push(
			`${images.length} 枚（Play はデバイス種別あたり最大 ${PLAY.maxCount} 枚）`,
		);
	}

	return { errors, summary: new Map([["Play phone", images.length]]) };
}

// ─────────────────────────────────────────────────────────────────────────────

function main() {
	const argv = process.argv.slice(2);
	const pIdx = argv.indexOf("--platform");
	const platform = pIdx >= 0 ? argv[pIdx + 1] : null;
	const dir = argv
		.filter((a, i) => !a.startsWith("--") && i !== pIdx + 1)
		.at(-1);

	if (!platform || !["ios", "android"].includes(platform) || !dir) {
		console.error(
			"usage: validate-screenshots.mjs --platform <ios|android> <dir>\n" +
				"  例: validate-screenshots.mjs --platform ios store-listing/ios",
		);
		process.exit(2);
	}

	const paths = collectImages(dir);
	const images = [];
	const unreadable = [];
	for (const path of paths) {
		const img = readImage(path);
		if (img) images.push({ path, img });
		else unreadable.push(path);
	}

	const { errors, summary } =
		platform === "ios" ? validateIos(images) : validateAndroid(images);

	for (const p of unreadable)
		errors.push(`${p}: 画像として読めない（壊れているか未対応形式）`);

	console.log(`検証対象: ${dir}（${images.length} 枚 / platform=${platform}）`);
	for (const [label, count] of summary) console.log(`  ${label}: ${count} 枚`);

	if (images.length === 0) {
		console.error(
			"✗ 画像が 1 枚も見つからない。撮影が失敗している可能性が高い",
		);
		process.exit(1);
	}

	if (errors.length > 0) {
		console.error(`\n✗ ${errors.length} 件の問題:`);
		for (const e of errors) console.error(`  - ${e}`);
		process.exit(1);
	}

	console.log("\n✓ すべてストアの要求を満たしている");
}

// 直接実行されたときだけ検証を走らせる。
// asc-push-screenshots.mjs が APP_STORE_SIZES / readImage / collectImages を import するので、
// ガードが無いと push のたびに usage を出して exit(2) してしまう。
if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	main();
}
