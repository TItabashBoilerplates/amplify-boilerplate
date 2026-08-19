/**
 * Google Play の掲載情報（文言 + 画像 + スクリーンショット）を Play Console へ反映する。
 *
 *   store-push-play-listing --dry-run   # 現状と差分だけ出す（必ず先にこれ）
 *   store-push-play-listing             # 実行（edit を commit する）
 *
 * 正本:
 *   - 文言 …………………… `frontend/apps/mobile/play.config.js`
 *   - アイコン ………………  `app.json` の `expo.icon`（実行時に 512x512 へ縮小）
 *   - フィーチャーグラフィック … `<app>/assets/store/play-feature-graphic.png`（任意）
 *   - スクリーンショット ……… `store-listing/android/<ロケール>/<imageType>/*.png`
 *
 * ## なぜ 1 スクリプトに文言と画像をまとめるか
 *
 * Play の編集は **edit というトランザクション**単位。文言と画像で別々に edit を作ると
 * commit が 2 回に分かれ、**片方だけ通った中途半端な掲載**になりうる。
 *
 * ## EAS Metadata は Play に対応しない
 *
 * EAS Metadata は Apple 専用。Play 側の掲載情報を Git 管理して反映する経路は
 * この API 直叩きしかない。
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { api, PKG, token } from "./play-api-client.mjs";
import {
	APP_DIR,
	banner,
	DRY,
	expo,
	LISTING_ROOT,
	loadAppConfig,
	log,
} from "./store-config.mjs";

/** Play の上限。超えると **commit 時**に落ちて原因が分かりにくいので送る前に弾く */
const MAX_SCREENSHOTS = 8;

const ANDROID_ROOT = join(LISTING_ROOT, "android");

const { LIMITS, listings: WANT_LISTINGS } = await loadAppConfig("play");

const work = mkdtempSync(join(tmpdir(), "play-listing-"));

/**
 * Play が要求する寸法ちょうどに縮小した PNG を作る（元画像は変更しない）。
 *
 * ImageMagick を優先し、無ければ macOS の `sips` を使う。どちらも無ければ落とす
 * （黙って元サイズのまま送ると Play 側で「Icon must be 512x512」になる）。
 */
function resized(src, { width, height }) {
	const out = join(work, `${width}x${height}.png`);
	const tools = [
		["magick", [src, "-resize", `${width}x${height}!`, out]],
		["convert", [src, "-resize", `${width}x${height}!`, out]],
		[
			"sips",
			[
				"-z",
				String(height),
				String(width),
				"--setProperty",
				"format",
				"png",
				src,
				"--out",
				out,
			],
		],
	];
	for (const [cmd, args] of tools) {
		try {
			execFileSync(cmd, args, { stdio: "ignore" });
			return out;
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
	}
	throw new Error(
		"画像を縮小できません。ImageMagick を入れてください" +
			"（devenv shell -P store-listing で入ります）",
	);
}

/**
 * 送る単発画像。`resize` を持つものは実行時に縮小する
 * （元画像を正本にして二重管理を避ける）。
 *
 * **購入シートのアイコンはストア掲載情報の `icon` を見る**（APK のランチャー
 * アイコンではない）。ここが未登録だと購入直前にプレースホルダが出る。
 */
const IMAGES = [
	{
		imageType: "icon",
		file: join(APP_DIR, expo.icon ?? "./assets/images/icon.png"),
		resize: { width: 512, height: 512 },
		required: true,
	},
	{
		// 配置・書体・コピーという設計判断を含む素材なので縮小せずそのまま送る。
		// 生成は build-play-feature-graphic（scripts/mobile/build-play-feature-graphic.mjs）。
		imageType: "featureGraphic",
		file: join(APP_DIR, "assets/store/play-feature-graphic.png"),
		required: false,
	},
];

async function upload(editId, language, imageType, file) {
	const res = await fetch(
		`https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PKG}/edits/${editId}/listings/${language}/${imageType}?uploadType=media`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${await token()}`,
				"Content-Type": "image/png",
			},
			body: readFileSync(file),
		},
	);
	const json = await res.json();
	if (!res.ok) {
		throw new Error(
			`upload ${imageType} → ${res.status}: ${
				json.error?.message ?? JSON.stringify(json).slice(0, 300)
			}`,
		);
	}
	return json.image;
}

// ── 送る前の検証（Play 側で弾かれると原因が分かりにくい）────────────────────
for (const l of WANT_LISTINGS) {
	for (const [field, max] of Object.entries(LIMITS)) {
		const len = (l[field] ?? "").length;
		if (len > max) {
			throw new Error(
				`${l.language} の ${field} が ${len} 文字（上限 ${max}）`,
			);
		}
	}
}
const images = IMAGES.filter((img) => {
	if (existsSync(img.file)) return true;
	if (img.required) throw new Error(`画像がありません: ${img.file}`);
	log(`- ${img.imageType}: ファイルが無いので送りません（${img.file}）`);
	return false;
});

banner("Google Play: 掲載情報の反映");
log(`パッケージ: ${PKG}`);

const edit = await api("POST", `/applications/${PKG}/edits`);
let changed = false;
try {
	const current = await api(
		"GET",
		`/applications/${PKG}/edits/${edit.id}/listings`,
	);
	const byLang = new Map((current.listings ?? []).map((l) => [l.language, l]));

	// ── 文言 ────────────────────────────────────────────────────────────────
	for (const want of WANT_LISTINGS) {
		const cur = byLang.get(want.language);
		const same =
			cur &&
			cur.title === want.title &&
			cur.shortDescription === want.shortDescription &&
			cur.fullDescription === want.fullDescription;
		if (same) {
			log(`${want.language}: 文言は最新`);
			continue;
		}
		log(
			`${want.language}: 文言を${cur ? "更新" : "作成"}` +
				`（title=${want.title.length} / short=${want.shortDescription.length} / full=${want.fullDescription.length} 文字）`,
		);
		if (DRY) continue;
		await api(
			"PUT",
			`/applications/${PKG}/edits/${edit.id}/listings/${want.language}`,
			{
				language: want.language,
				title: want.title,
				shortDescription: want.shortDescription,
				fullDescription: want.fullDescription,
			},
		);
		changed = true;
	}

	// 文言の PUT で言語が増えうるので取り直す。存在しない言語へ画像を GET すると 404
	const languages = DRY
		? [...new Set([...byLang.keys(), ...WANT_LISTINGS.map((l) => l.language)])]
		: (
				await api("GET", `/applications/${PKG}/edits/${edit.id}/listings`)
			).listings.map((l) => l.language);

	// ── 単発画像（アイコン / フィーチャーグラフィック）──────────────────────
	for (const spec of images) {
		const file = spec.resize ? resized(spec.file, spec.resize) : spec.file;
		const sha = createHash("sha1").update(readFileSync(file)).digest("hex");
		log(`\n${spec.imageType} (sha1=${sha.slice(0, 12)})`);
		for (const language of languages) {
			if (DRY && !byLang.has(language)) {
				log(`  ${language}: [dry-run] 掲載を作成したあとアップロード`);
				continue;
			}
			const existing =
				(
					await api(
						"GET",
						`/applications/${PKG}/edits/${edit.id}/listings/${language}/${spec.imageType}`,
					)
				).images ?? [];
			if (existing.some((i) => i.sha1 === sha)) {
				log(`  ${language}: 同じ画像が登録済み`);
				continue;
			}
			if (DRY) {
				log(
					`  ${language}: [dry-run] アップロード（現在 ${existing.length} 件）`,
				);
				continue;
			}
			const image = await upload(edit.id, language, spec.imageType, file);
			log(`  ${language}: ✓ アップロード (id=${image?.id ?? "?"})`);
			changed = true;
		}
	}

	// ── スクリーンショット ──────────────────────────────────────────────────
	// 単発画像と違い**複数枚 + 順番**なので、差分があれば一度すべて消してから
	// 順に上げ直す（1 枚ずつ足すと既存と並びが混ざる）。
	// ディレクトリ名がそのまま Play の imageType（phoneScreenshots 等）。
	if (existsSync(ANDROID_ROOT)) {
		for (const language of readdirSync(ANDROID_ROOT, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name)) {
			if (!languages.includes(language)) {
				log(`\nスクリーンショット: ${language} の掲載がまだ無いので後回し`);
				continue;
			}
			const langDir = join(ANDROID_ROOT, language);
			for (const imageType of readdirSync(langDir, { withFileTypes: true })
				.filter((e) => e.isDirectory())
				.map((e) => e.name)) {
				const dir = join(langDir, imageType);
				const files = readdirSync(dir)
					.filter((f) => f.endsWith(".png"))
					.sort()
					.map((f) => join(dir, f));
				if (files.length === 0) continue;
				if (files.length > MAX_SCREENSHOTS) {
					throw new Error(
						`${language}/${imageType} が ${files.length} 枚（上限 ${MAX_SCREENSHOTS}）`,
					);
				}

				const want = files.map((f) =>
					createHash("sha1").update(readFileSync(f)).digest("hex"),
				);
				const existing =
					(
						await api(
							"GET",
							`/applications/${PKG}/edits/${edit.id}/listings/${language}/${imageType}`,
						)
					).images ?? [];
				const same =
					existing.length === want.length &&
					existing.every((image, i) => image.sha1 === want[i]);

				log(`\n${imageType} (${language}): ${files.length} 枚`);
				if (same) {
					log("  同じ並びが登録済み");
					continue;
				}
				if (DRY) {
					log(
						`  [dry-run] 既存 ${existing.length} 枚を削除して ${files.length} 枚を順に上げます`,
					);
					for (const f of files) log(`    - ${f.split("/").pop()}`);
					continue;
				}
				await api(
					"DELETE",
					`/applications/${PKG}/edits/${edit.id}/listings/${language}/${imageType}`,
				);
				for (const file of files) {
					const image = await upload(edit.id, language, imageType, file);
					log(`  ✓ ${file.split("/").pop()} (id=${image?.id ?? "?"})`);
				}
				changed = true;
			}
		}
	}

	if (DRY) {
		await api("DELETE", `/applications/${PKG}/edits/${edit.id}`);
		log("\n[dry-run] edit を破棄しました（何も変更していません）");
	} else if (changed) {
		await api("POST", `/applications/${PKG}/edits/${edit.id}:commit`);
		log("\n✓ edit を commit しました");
	} else {
		await api("DELETE", `/applications/${PKG}/edits/${edit.id}`);
		log("\n変更が無いので edit を破棄しました");
	}
} catch (e) {
	// commit していない edit を残すと次の編集と紛らわしい
	await api("DELETE", `/applications/${PKG}/edits/${edit.id}`).catch(() => {});
	throw e;
}
