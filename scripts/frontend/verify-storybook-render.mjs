#!/usr/bin/env node
/**
 * Storybook のストーリーが「ビルドは通ったが描画は壊れている」状態でないことを実測する。
 *
 *   verify-storybook-render                 # 全ストーリー
 *   verify-storybook-render --filter auth   # ID に auth を含むものだけ
 *
 * ## なぜ必要か
 *
 * `build-storybook` の成功・型チェック・lint は **描画を一切検証しない**。
 * 実際にこのリポジトリでは「ビルド成功・型 OK・lint OK」を全部満たしたうえで
 * 全ストーリーが無スタイル / 実行時エラーで落ちていたことがある
 * （`.claude/rules/ui-testing.md`「完了条件: ビルドが通ったで終わらせない」）。
 *
 * ## 何を見るか
 *
 * クラス文字列の有無ではなく **`getComputedStyle` の実値**と実行時エラーを見る
 * （「クラスは付いているのに効いていない」が実際に起きるため）:
 *
 * | 検査 | 落ちる例 |
 * |---|---|
 * | 何も描画されない / エラーオーバーレイ | プロバイダー不足で例外（next-intl / SafeArea 等） |
 * | console / page error | ルーターコンテキスト無しで `useRouter()` |
 * | 画像が読み込めていない（`naturalWidth === 0`） | 画像 URL の組み立てミス・アセットの置き場所ミス |
 * | i18n キーがそのまま見えている | メッセージ未追加、namespace 取り違え |
 * | 入力欄の font-size < 16px | iOS Safari のオートズーム（`form-controls.md`） |
 *
 * font-size は **モバイル幅で測る**。`text-base md:text-sm` は仕様どおりなので、
 * デスクトップ幅で測ると 14px を誤検出する。
 *
 * 前提: `build-storybook` 済み（`frontend/storybook-static/`）。
 */
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const STATIC = join(REPO_ROOT, "frontend/storybook-static");
const frontendRequire = createRequire(
	pathToFileURL(join(REPO_ROOT, "frontend/package.json")),
);
const { chromium } = frontendRequire("playwright-core");

const MIME = {
	".html": "text/html",
	".js": "text/javascript",
	".mjs": "text/javascript",
	".css": "text/css",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".woff2": "font/woff2",
	".map": "application/json",
};

const server = createServer((req, res) => {
	const urlPath = decodeURIComponent(req.url.split("?")[0]);
	let filePath = join(STATIC, urlPath === "/" ? "index.html" : urlPath);
	if (!existsSync(filePath) || filePath.endsWith("/"))
		filePath = join(STATIC, "index.html");
	try {
		const body = readFileSync(filePath);
		res.writeHead(200, {
			"Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
		});
		res.end(body);
	} catch {
		res.writeHead(404).end("not found");
	}
});

await new Promise((r) => server.listen(6199, r));
const BASE = "http://127.0.0.1:6199";

const filterIndex = process.argv.indexOf("--filter");
const filter =
	filterIndex === -1 ? null : new RegExp(process.argv[filterIndex + 1], "i");

const indexPath = join(STATIC, "index.json");
if (!existsSync(indexPath)) {
	console.error(
		"storybook-static が見つかりません。先に `build-storybook` を実行してください。",
	);
	process.exit(1);
}
const index = JSON.parse(readFileSync(indexPath, "utf8"));
// docs エントリは複数ストーリーの寄せ集めで、個別の描画検証には向かないので除外する
const ids = Object.keys(index.entries).filter(
	(id) => !id.endsWith("--docs") && (!filter || filter.test(id)),
);

const browser = await chromium.launch({
	executablePath: "/opt/pw-browsers/chromium",
});
// iOS Safari のオートズームはモバイル幅の話なので、その幅で測る
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });

const failures = [];
let checked = 0;

for (const id of ids) {
	const errors = [];
	page.removeAllListeners("pageerror");
	page.removeAllListeners("console");
	page.on("pageerror", (e) => errors.push(String(e)));
	page.on("console", (m) => {
		if (m.type() === "error") errors.push(m.text());
	});

	await page.goto(`${BASE}/iframe.html?id=${id}&viewMode=story`, {
		waitUntil: "load",
	});
	await page.waitForTimeout(180);

	const report = await page.evaluate(() => {
		const root = document.querySelector("#storybook-root");
		if (!root) return { ok: false, reason: "no #storybook-root" };
		const text = (root.textContent ?? "").trim();
		// 画像・図形コンポーネントは要素 1 つ（<img> 等）でテキストも持たないため、
		// 要素数だけで「何も描画されていない」と判定すると誤検出になる。
		// 実際に読み込めている置換要素があれば「描画された」とみなす。
		const media = [...root.querySelectorAll("img, svg, canvas, video")];
		const renderedMedia = media.filter((el) => {
			const box = el.getBoundingClientRect();
			if (box.width === 0 || box.height === 0) return false;
			// <img> は「箱はあるが読み込めていない」（= 壊れた URL）が起こりうる
			return el.tagName !== "IMG" || (el.complete && el.naturalWidth > 0);
		});
		if (
			text.length === 0 &&
			root.querySelectorAll("*").length < 2 &&
			renderedMedia.length === 0
		) {
			return { ok: false, reason: "rendered nothing" };
		}
		// 読み込みに失敗した画像（URL の組み立てミス・アセットの置き場所ミス）
		const brokenImages = media
			.filter(
				(el) => el.tagName === "IMG" && el.complete && el.naturalWidth === 0,
			)
			.map((el) => el.getAttribute("src") ?? "(no src)");
		if (brokenImages.length > 0) {
			return {
				ok: false,
				reason: `image failed to load: ${brokenImages.join(", ")}`,
			};
		}
		// Storybook のエラーオーバーレイ。#error-message はテンプレートに常在するので
		// 存在チェックではなく body のクラス（表示中のみ付く）を見る。
		if (document.body.classList.contains("sb-show-errordisplay")) {
			const msg = document.querySelector("#error-message")?.textContent ?? "";
			return { ok: false, reason: `error overlay: ${msg.slice(0, 200)}` };
		}
		// 未翻訳（i18n キーがそのまま出ている）を検出する
		const untranslated =
			/(?:^|\s)(?:Auth|auth)\.(?:errors|success|requirements)\.[a-zA-Z]+/.test(
				text,
			);
		// フォーム要素のフォントサイズ（16px 未満は iOS Safari のオートズーム対象）
		const smallInputs = [...root.querySelectorAll("input, textarea")]
			.filter((el) => {
				const type = (el.getAttribute("type") ?? "text").toLowerCase();
				if (
					[
						"checkbox",
						"radio",
						"file",
						"range",
						"color",
						"submit",
						"button",
					].includes(type)
				)
					return false;
				return Number.parseFloat(getComputedStyle(el).fontSize) < 16;
			})
			.map(
				(el) =>
					`${el.tagName.toLowerCase()}[type=${el.getAttribute("type")}]:${getComputedStyle(el).fontSize}`,
			);
		return { ok: true, untranslated, smallInputs, textLength: text.length };
	});

	checked += 1;
	if (!report.ok) failures.push(`${id}: ${report.reason}`);
	else {
		if (report.untranslated)
			failures.push(`${id}: untranslated i18n key visible`);
		if (report.smallInputs?.length)
			failures.push(
				`${id}: input font < 16px -> ${report.smallInputs.join(", ")}`,
			);
	}
	const fatal = errors.filter(
		(e) => !/Failed to load resource|favicon/.test(e),
	);
	if (fatal.length)
		failures.push(`${id}: console/page error -> ${fatal[0].slice(0, 160)}`);
}

await browser.close();
server.close();

console.log(`checked ${checked} stories`);
if (failures.length) {
	console.log(`FAILURES (${failures.length}):`);
	for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
	if (failures.length > 40)
		console.log(`  ... and ${failures.length - 40} more`);
	process.exit(1);
}
console.log(
	"all stories rendered OK (runtime errors / i18n keys / form font-size verified)",
);
