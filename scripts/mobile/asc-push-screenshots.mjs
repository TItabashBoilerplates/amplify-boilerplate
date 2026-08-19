/**
 * App Store のスクリーンショットを App Store Connect へ反映する。
 *
 *   store-push-ios-screenshots --dry-run   # 現状と計画だけ出す（必ず先にこれ）
 *   store-push-ios-screenshots             # 実行
 *
 * 正本: `store-listing/ios/<ロケール>/**\/*.png`（`screenshots-mobile` の出力先）
 *
 * ## EAS Metadata では出せない
 *
 * `store.config.js`（EAS Metadata）が扱うのは文言・カテゴリ・年齢レーティング等で、
 * **スクリーンショットは対象外**（公式の対応表で "Upload screenshots ✗"）。
 * したがってここで App Store Connect API を直接叩く。
 *
 * ## 端末クラス（表示タイプ）は画像の実ピクセルから引く
 *
 * `screenshotDisplayType` は端末クラスごとに別のセットになる。
 * 「既存セットが 1 つならそれを使う」で拾うと **iPad の画像を iPhone のセットへ
 * 入れてしまう**ので、必ず**型が一致するセットだけ**を対象にする（無ければ作る）。
 *
 * サイズ → 表示タイプの対応は `validate-screenshots.mjs` の `APP_STORE_SIZES` が
 * 単一の正本。ここで別表を持たない（片方だけ直した状態を作らないため）。
 *
 * ## 並び順
 *
 * **ファイル名順がそのまま掲載順**。アップロード順が保たれる保証は無いので、
 * 最後に並びを PATCH で確定する。連結（パノラマ）構成では順番が狂うと絵が繋がらない。
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { api, findApp } from "./asc-api-client.mjs";
import { banner, bundleId, DRY, LISTING_ROOT, log } from "./store-config.mjs";
import {
	APP_STORE_SIZES,
	collectImages,
	readImage,
} from "./validate-screenshots.mjs";

/** App Store の 1 表示タイプあたりの上限 */
const MAX_SCREENSHOTS = 10;

const IOS_ROOT = join(LISTING_ROOT, "ios");

/** 編集可能な App Store バージョンを 1 つ選ぶ（審査中・公開済みは編集できない） */
async function editableVersion(appId) {
	const { data } = await api(
		"GET",
		`/v1/apps/${appId}/appStoreVersions?limit=20`,
	);
	const EDITABLE = new Set([
		"PREPARE_FOR_SUBMISSION",
		"DEVELOPER_REJECTED",
		"REJECTED",
		"METADATA_REJECTED",
		"INVALID_BINARY",
	]);
	const version = data.find((v) => EDITABLE.has(v.attributes.appStoreState));
	if (!version) {
		const states = data
			.map((v) => `${v.attributes.versionString}=${v.attributes.appStoreState}`)
			.join(", ");
		throw new Error(
			`編集可能な App Store バージョンがありません（${states || "バージョン無し"}）`,
		);
	}
	return version;
}

/** 実ピクセルから表示タイプを引く。マッピングが無いものは黙って落とさず落とす */
function displayTypeOf(path) {
	const img = readImage(path);
	if (!img) throw new Error(`画像として読めません: ${path}`);
	const size = APP_STORE_SIZES.find(
		(s) =>
			(s.portrait[0] === img.width && s.portrait[1] === img.height) ||
			(s.portrait[1] === img.width && s.portrait[0] === img.height),
	);
	if (!size) {
		throw new Error(
			`${path}: ${img.width}x${img.height} は App Store の受付サイズに一致しません`,
		);
	}
	if (!size.displayType) {
		throw new Error(
			`${path}: ${size.label}（${img.width}x${img.height}）の screenshotDisplayType が未登録です。\n` +
				"  validate-screenshots.mjs の APP_STORE_SIZES に追記してください。\n" +
				"  値は推測せず、誤った値を送ったときに API が 400 で返す許容値一覧から取ること",
		);
	}
	return { displayType: size.displayType, label: size.label };
}

/** アップロードは「予約 → 分割 PUT → checksum 付きコミット」の 3 段。1 段でも欠けると壊れた枠が残る */
async function uploadScreenshot(setId, file) {
	const bytes = readFileSync(file);
	const created = await api("POST", "/v1/appScreenshots", {
		data: {
			type: "appScreenshots",
			attributes: { fileName: basename(file), fileSize: bytes.length },
			relationships: {
				appScreenshotSet: { data: { type: "appScreenshotSets", id: setId } },
			},
		},
	});
	const id = created.data.id;

	for (const op of created.data.attributes.uploadOperations ?? []) {
		const res = await fetch(op.url, {
			method: op.method,
			headers: Object.fromEntries(
				(op.requestHeaders ?? []).map((h) => [h.name, h.value]),
			),
			body: bytes.subarray(op.offset, op.offset + op.length),
		});
		if (!res.ok) {
			throw new Error(
				`${basename(file)} の転送に失敗: HTTP ${res.status} ${await res.text()}`,
			);
		}
	}

	// checksum を付けずに uploaded を立てると Apple 側で壊れた画像として残る
	await api("PATCH", `/v1/appScreenshots/${id}`, {
		data: {
			type: "appScreenshots",
			id,
			attributes: {
				uploaded: true,
				sourceFileChecksum: createHash("md5").update(bytes).digest("hex"),
			},
		},
	});
	return id;
}

// ─────────────────────────────────────────────────────────────────────────────

banner("App Store: スクリーンショットの反映");

if (!existsSync(IOS_ROOT)) {
	throw new Error(
		`スクリーンショットがありません: ${IOS_ROOT}\n` +
			"  先に screenshots-mobile（または screenshots-storybook）で撮影してください",
	);
}

const app = await findApp(bundleId());
log(`アプリ: ${app.attributes.name} (id=${app.id})`);

const version = await editableVersion(app.id);
log(
	`バージョン ${version.attributes.versionString}（${version.attributes.appStoreState}）`,
);

const { data: localizations } = await api(
	"GET",
	`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`,
);
log(
	`ASC 側のロケール: ${localizations.map((l) => l.attributes.locale).join(", ")}`,
);

const localeDirs = readdirSync(IOS_ROOT, { withFileTypes: true })
	.filter((e) => e.isDirectory())
	.map((e) => e.name);
if (localeDirs.length === 0) {
	throw new Error(`${IOS_ROOT} にロケールのディレクトリがありません`);
}

for (const locale of localeDirs) {
	const localization = localizations.find(
		(l) => l.attributes.locale === locale,
	);
	if (!localization) {
		// 黙って飛ばすと「英語だけ画像が無い」に後で気づくことになる
		throw new Error(
			`ロケール ${locale} が この App Store バージョンにありません。\n` +
				`  ASC 側にあるのは: ${localizations.map((l) => l.attributes.locale).join(", ")}\n` +
				"  store.config.js の info に該当ロケールを足して mobile-metadata を実行してください",
		);
	}

	// **表示タイプごとにグループ化する**。1 ロケールのディレクトリに iPhone と iPad の
	// 画像が混在していても正しく振り分けられる（ディレクトリ命名規約に依存しない）。
	const byType = new Map();
	for (const file of collectImages(join(IOS_ROOT, locale))) {
		const { displayType, label } = displayTypeOf(file);
		if (!byType.has(displayType)) byType.set(displayType, { label, files: [] });
		byType.get(displayType).files.push(file);
	}

	const { data: sets } = await api(
		"GET",
		`/v1/appStoreVersionLocalizations/${localization.id}/appScreenshotSets?limit=50`,
	);

	for (const [displayType, { label, files }] of byType) {
		// 掲載順はファイル名順。パノラマ構成では順番が狂うと絵が繋がらない
		files.sort((a, b) => basename(a).localeCompare(basename(b)));
		if (files.length > MAX_SCREENSHOTS) {
			throw new Error(
				`${locale} / ${label} が ${files.length} 枚（上限 ${MAX_SCREENSHOTS}）`,
			);
		}

		let set = sets.find(
			(s) => s.attributes.screenshotDisplayType === displayType,
		);
		const existing = set
			? (
					await api(
						"GET",
						`/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`,
					)
				).data
			: [];

		log(
			`\n${locale} / ${label} (${displayType}): 既存 ${existing.length} 枚 → ${files.length} 枚`,
		);

		if (DRY) {
			for (const f of files) log(`    - ${basename(f)}`);
			continue;
		}

		if (!set) {
			set = (
				await api("POST", "/v1/appScreenshotSets", {
					data: {
						type: "appScreenshotSets",
						attributes: { screenshotDisplayType: displayType },
						relationships: {
							appStoreVersionLocalization: {
								data: {
									type: "appStoreVersionLocalizations",
									id: localization.id,
								},
							},
						},
					},
				})
			).data;
			log(`  セットを作成しました（${displayType}）`);
		}

		// 差分があれば全消ししてから上げ直す。1 枚ずつ足すと既存との並びが混ざる
		for (const image of existing) {
			await api("DELETE", `/v1/appScreenshots/${image.id}`);
		}

		const ids = [];
		for (const file of files) {
			ids.push(await uploadScreenshot(set.id, file));
			log(`  ✓ ${basename(file)}`);
		}

		await api(
			"PATCH",
			`/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`,
			{ data: ids.map((id) => ({ type: "appScreenshots", id })) },
		);
		log(`  並びを確定しました（${ids.length} 枚）`);
	}
}

log(DRY ? "\n[dry-run] 何も変更していません" : "\n完了しました。");
