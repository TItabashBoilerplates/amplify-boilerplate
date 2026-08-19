#!/usr/bin/env node
/**
 * Storybook からストア掲載用スクリーンショットを撮る。
 *
 *   screenshots-storybook                       # storybook-static をビルド済み前提で撮影
 *   screenshots-storybook --url http://localhost:6006
 *   screenshots-storybook --devices iphone-6-9 --locales ja
 *   screenshots-storybook --allow-fidelity-warnings   # 忠実度警告があっても続行
 *
 * ■ これは Maestro 版（screenshots-mobile）の代替であって、上位互換ではない
 *   Storybook は react-native-web の描画なので、**ネイティブと差が出る要素がある**。
 *   本スクリプトは撮影後に DOM を検査して、差が出る構成
 *   （ネイティブ部品・box-shadow・スクロールバー等）を見つけたら**警告して停止**する。
 *   警告が出た画面は `screenshots-mobile`（simulator/emulator の実描画）で撮り直すこと。
 *
 *   Apple のガイドライン 2.3.3 が求めるのは「アプリが**使用されている状態**を示すこと」であり、
 *   生のデバイスキャプチャであることではない（実際の掲載画像は合成が主流）。
 *   問題になるのは**実機と見た目が食い違うこと**なので、そこだけを機械的に検出する。
 *
 * ■ 出力
 *   Maestro 版とまったく同じディレクトリへ出すので、後段の検証・アップロードは共通:
 *     iOS     : store-listing/ios/<locale>/
 *     Android : store-listing/android/<play-locale>/phoneScreenshots/
 *   撮影後は必ず `screenshots-validate` を通すこと（screenshots-mobile --skip-capture でも可）。
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const STORYBOOK_STATIC = join(REPO_ROOT, "frontend/storybook-static");

// playwright-core は frontend の devDependency に入れてある（ブラウザ自動 DL をしない軽量版）。
// このファイルは scripts/ 配下で node の通常解決では frontend/node_modules に届かないため、
// frontend の package.json を基点に解決する。
const frontendRequire = createRequire(
	pathToFileURL(join(REPO_ROOT, "frontend/package.json")),
);

// ─────────────────────────────────────────────────────────────────────────────
// 引数
// ─────────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
	const opts = {
		url: null,
		devices: null,
		locales: null,
		allowFidelityWarnings: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--url") opts.url = argv[++i];
		else if (a === "--devices") opts.devices = argv[++i].split(",");
		else if (a === "--locales") opts.locales = argv[++i].split(",");
		else if (a === "--allow-fidelity-warnings")
			opts.allowFidelityWarnings = true;
		else if (a === "-h" || a === "--help") {
			console.log(
				readFileSync(new URL(import.meta.url))
					.toString()
					.split("*/")[0],
			);
			process.exit(0);
		} else {
			console.error(`未知のオプション: ${a}`);
			process.exit(2);
		}
	}
	return opts;
}

// ─────────────────────────────────────────────────────────────────────────────
// storybook-static を配信する最小サーバ（依存を足さないため自前）
// ─────────────────────────────────────────────────────────────────────────────
const MIME = {
	".html": "text/html",
	".js": "text/javascript",
	".mjs": "text/javascript",
	".css": "text/css",
	".json": "application/json",
	".png": "image/png",
	".jpg": "image/jpeg",
	".svg": "image/svg+xml",
	".woff2": "font/woff2",
	".woff": "font/woff",
	".ttf": "font/ttf",
	".map": "application/json",
};

function serveStatic(root) {
	const server = createServer((req, res) => {
		const urlPath = decodeURIComponent(req.url.split("?")[0]);
		const file = join(root, urlPath === "/" ? "/index.html" : urlPath);
		if (!file.startsWith(root)) {
			res.writeHead(403).end();
			return;
		}
		if (!existsSync(file)) {
			res.writeHead(404).end("not found");
			return;
		}
		try {
			const body = readFileSync(file);
			res.writeHead(200, {
				"content-type": MIME[extname(file)] ?? "application/octet-stream",
			});
			res.end(body);
		} catch {
			res.writeHead(500).end();
		}
	});
	return new Promise((r) =>
		server.listen(0, "127.0.0.1", () =>
			r({ server, port: server.address().port }),
		),
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Chromium の実行ファイル探索
// ─────────────────────────────────────────────────────────────────────────────
function findChromium() {
	const candidates = [
		process.env.PLAYWRIGHT_CHROMIUM_PATH,
		process.env.CHROME_BIN,
		// devenv の store-listing profile が入れる chromium
		...(process.env.PATH ?? "")
			.split(":")
			.flatMap((d) => [
				join(d, "chromium"),
				join(d, "chromium-browser"),
				join(d, "google-chrome"),
			]),
		// CCR / web-sandbox のプリインストール
		"/opt/pw-browsers/chromium",
		"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
	].filter(Boolean);
	for (const c of candidates) if (existsSync(c)) return c;
	throw new Error(
		"Chromium が見つかりません。`devenv shell -P store-listing` に入るか、" +
			"PLAYWRIGHT_CHROMIUM_PATH で実行ファイルのパスを指定してください。",
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// 忠実度チェック
//   react-native-web と実機で見た目が食い違う構成を検出する。
//   ここで挙げているものは「Storybook では正しく見えるのに実機では違う」典型。
// ─────────────────────────────────────────────────────────────────────────────
const FIDELITY_PROBE = () => {
	const problems = [];
	const root = document.querySelector("#storybook-root");
	if (!root) return [{ kind: "empty", detail: "#storybook-root が無い" }];
	if (root.innerHTML.trim() === "")
		return [{ kind: "empty", detail: "何も描画されていない" }];

	// ネイティブ部品: react-native-web は DOM 要素で代替するため実機と別物になる
	const nativeControls = root.querySelectorAll(
		'input, textarea, select, [role="progressbar"], [role="switch"], [role="slider"]',
	);
	if (nativeControls.length > 0) {
		problems.push({
			kind: "native-control",
			detail: `${nativeControls.length} 個（input/textarea/select/switch/slider/progressbar）。React Native では OS 提供の部品になるため見た目が一致しない`,
		});
	}

	// shadow / elevation: RN の shadow プロパティと CSS box-shadow は描画が一致しない
	const shadowed = [...root.querySelectorAll("*")].filter((el) => {
		const s = getComputedStyle(el).boxShadow;
		return s && s !== "none";
	});
	if (shadowed.length > 0) {
		problems.push({
			kind: "shadow",
			detail: `${shadowed.length} 要素に box-shadow。iOS の shadow* / Android の elevation とは描画が異なる`,
		});
	}

	// 画像の読み込み失敗（撮ってから気づくと痛い）
	const brokenImages = [...root.querySelectorAll("img")].filter(
		(i) => !i.complete || i.naturalWidth === 0,
	);
	if (brokenImages.length > 0) {
		problems.push({
			kind: "broken-image",
			detail: `${brokenImages.length} 枚の画像が読めていない`,
		});
	}

	return problems;
};

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
	const opts = parseArgs(process.argv.slice(2));
	const config = await import(
		pathToFileURL(join(__dirname, "storybook-shots.config.mjs"))
	);

	const deviceKeys = opts.devices ?? Object.keys(config.devices);
	const localeKeys = opts.locales ?? Object.keys(config.locales);

	let baseUrl = opts.url;
	let server = null;
	if (!baseUrl) {
		if (!existsSync(join(STORYBOOK_STATIC, "index.json"))) {
			console.error(
				`storybook-static がありません: ${STORYBOOK_STATIC}\n` +
					"先に `build-storybook` を実行するか、--url で起動中の Storybook を指定してください。",
			);
			process.exit(1);
		}
		const s = await serveStatic(STORYBOOK_STATIC);
		server = s.server;
		baseUrl = `http://127.0.0.1:${s.port}`;
		console.log(`storybook-static を配信: ${baseUrl}`);
	}

	const { chromium } = frontendRequire("playwright-core");
	const executablePath = findChromium();
	const browser = await chromium.launch({
		executablePath,
		args: ["--no-sandbox", "--force-device-scale-factor=1"],
	});

	const warnings = [];
	let count = 0;

	try {
		for (const deviceKey of deviceKeys) {
			const device = config.devices[deviceKey];
			if (!device) throw new Error(`未知のデバイス: ${deviceKey}`);

			for (const localeKey of localeKeys) {
				const locale = config.locales[localeKey];
				if (!locale) throw new Error(`未知のロケール: ${localeKey}`);

				const outDir =
					device.platform === "ios"
						? join(REPO_ROOT, "store-listing/ios", localeKey)
						: join(
								REPO_ROOT,
								"store-listing/android",
								localeKey === "ja" ? "ja-JP" : localeKey,
								"images/phoneScreenshots",
							);
				mkdirSync(outDir, { recursive: true });

				const context = await browser.newContext({
					viewport: { width: device.width, height: device.height },
					deviceScaleFactor: device.scale,
					locale: locale.browserLocale,
					// prefers-color-scheme も揃えておく（native.css 側の分岐に効く）
					colorScheme: "light",
				});

				for (const shot of config.shots) {
					const page = await context.newPage();
					// 出力ピクセルはブラウザ側の viewport x deviceScaleFactor で厳密に決める。
					// ⚠️ ストーリー側に `globals: { viewport: ... }` があると Storybook が
					//    iframe を内側で縮めるうえ、**URL の globals が上書きされて theme も効かなくなる**。
					//    撮影対象のストーリーには story-level globals を書かないこと。
					const url =
						`${baseUrl}/iframe.html?id=${shot.id}&viewMode=story` +
						`&globals=theme:${shot.theme ?? "light"}`;
					await page.goto(url, { waitUntil: "networkidle" });
					await page.waitForTimeout(600);

					// ── テーマの強制適用と検証 ──────────────────────────────────
					// addon-themes の withThemeByClassName は `<html>` に .dark を付けるが、
					// **story 内に reanimated の CSS アニメーション（HelloWave 等）があると
					// その effect が実行されない**ことがある。放っておくと
					// 「dark を指定したのに light の画像が出来上がる」という無言の事故になるので、
					// ここで明示的に付け直したうえで、実際に付いたかを検証する。
					const themeApplied = await page.evaluate((theme) => {
						const root = document.documentElement;
						const beforeHadDark = root.classList.contains("dark");
						if (theme === "dark") root.classList.add("dark");
						else root.classList.remove("dark");
						return {
							addonApplied: theme === "dark" ? beforeHadDark : !beforeHadDark,
							ok: root.classList.contains("dark") === (theme === "dark"),
						};
					}, shot.theme ?? "light");

					if (!themeApplied.ok) {
						throw new Error(
							`テーマ ${shot.theme} を適用できませんでした（${shot.id}）`,
						);
					}
					if (!themeApplied.addonApplied) {
						warnings.push({
							device: deviceKey,
							locale: localeKey,
							shot: shot.name,
							kind: "theme-decorator",
							detail:
								`addon-themes がテーマを適用しなかったため撮影側で強制適用した。` +
								`reanimated の CSS アニメーションを含む story で起きる。` +
								`Storybook 上での目視確認時は**テーマ切替が効かない**点に注意`,
						});
					}
					// クラス変更後の再描画を待ってから撮る
					await page.waitForTimeout(250);

					const problems = await page.evaluate(FIDELITY_PROBE);
					for (const p of problems) {
						warnings.push({
							device: deviceKey,
							locale: localeKey,
							shot: shot.name,
							...p,
						});
					}

					const file = join(outDir, `${shot.name}-${deviceKey}.png`);
					// Playwright の PNG は colorType 2（アルファ無し）で出るので、
					// 両ストアの「透過不可」要件をそのまま満たす（変換不要）。
					await page.screenshot({ path: file });
					count++;
					console.log(
						`  撮影: ${deviceKey} / ${localeKey} / ${shot.name} -> ${file.replace(`${REPO_ROOT}/`, "")}`,
					);
					await page.close();
				}
				await context.close();
			}
		}
	} finally {
		await browser.close();
		server?.close();
	}

	console.log(`\n${count} 枚を撮影`);

	if (warnings.length > 0) {
		console.error(`\n⚠ 忠実度の警告 ${warnings.length} 件:`);
		for (const w of warnings) {
			console.error(
				`  [${w.kind}] ${w.device}/${w.locale}/${w.shot}: ${w.detail}`,
			);
		}
		console.error(
			"\nこれらは **Storybook では正しく見えるのに実機では違う**可能性が高い箇所です。\n" +
				"該当画面は `screenshots-mobile`（simulator/emulator の実描画）で撮り直してください。\n" +
				"意図的に許容する場合は --allow-fidelity-warnings を付けて再実行します。",
		);
		if (!opts.allowFidelityWarnings) process.exit(1);
		console.error("--allow-fidelity-warnings が指定されたため続行します。");
	}

	console.log(
		"\n次に `screenshots-validate` でストア要求を検証してください:\n" +
			"  screenshots-validate --platform ios store-listing/ios\n" +
			"  screenshots-validate --platform android store-listing/android",
	);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
