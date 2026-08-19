/**
 * TestFlight への配布を最後まで自動で行う。
 *
 *   store-testflight --dry-run
 *   store-testflight --wait                    # 処理完了を待ってから配布
 *   store-testflight --groups "QA,Beta"        # 配布先グループを明示
 *   store-testflight --build 42                # ビルド番号を指定
 *
 * ## なぜ要るのか
 *
 * `mobile-release-ios` は **アップロードまでしかやらない**。アップロード後の
 *
 *   1. Apple 側の処理（PROCESSING → VALID）を待つ
 *   2. テスターグループへ割り当てる
 *   3. 「このビルドの新機能」を書く
 *   4. 外部グループなら Beta App Review へ提出する
 *
 * は App Store Connect の画面で人が行う前提になっていた。つまり **リリースの度に
 * 人が張り付く必要があり、エージェントは最後まで完了できない**。ここを埋める。
 *
 * ## 「処理待ち」を人に任せてはいけない理由
 *
 * アップロード直後のビルドは `PROCESSING` で、この状態ではグループに割り当てられない
 * （409 になる）。処理は数分〜30 分かかるので、人は「あとで見る」ことになり、
 * **結果として配布されないまま忘れられる**。`--wait` は上限つきでこれを待つ。
 *
 * 資格情報は SSM Parameter Store（`store.sh` が注入する）。値はチャット・ログに出さない。
 */
import { api, apiAll, apiRaw, findApp } from "./asc-api-client.mjs";
import { pickBuildForRelease, validateReleaseNotes } from "./release-plan.mjs";
import {
	appVersion,
	banner,
	bundleId,
	DRY,
	loadAppConfig,
	log,
	withRetry,
} from "./store-config.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : undefined;
};

const WAIT = flag("wait");
/** 処理待ちの上限。Apple 側の処理は通常数分だが、混雑時は 30 分を超えることがある */
const WAIT_TIMEOUT_MS = Number(value("wait-timeout") ?? 45) * 60 * 1000;
const POLL_INTERVAL_MS = 60 * 1000;

banner("TestFlight への配布");

const app = await findApp(bundleId());
const version = appVersion();
log(`アプリ: ${app.attributes.name} / バージョン ${version}`);

// ─────────────────────────────────────────────────────────────────────────────
// 1. 対象ビルドを決める（必要なら処理完了を待つ）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `preReleaseVersion.version` で絞るのが要点。これを付けないと**過去のバージョンの
 * ビルド**まで候補に入り、古いビルドを配ってしまう。
 */
async function fetchBuilds() {
	return (
		await apiAll(
			`/v1/builds?filter[app]=${app.id}` +
				`&filter[preReleaseVersion.version]=${encodeURIComponent(version)}` +
				"&sort=-uploadedDate&limit=50",
		)
	).map((b) => ({
		id: b.id,
		version: b.attributes.version,
		processingState: b.attributes.processingState,
		uploadedDate: b.attributes.uploadedDate,
		expired: b.attributes.expired,
	}));
}

const wanted = value("build");
let build = null;
const deadline = Date.now() + WAIT_TIMEOUT_MS;

for (;;) {
	const builds = (await fetchBuilds()).filter((b) => !b.expired);
	if (builds.length === 0) {
		throw new Error(
			`バージョン ${version} のビルドが App Store Connect にありません。\n` +
				"  先に mobile-release-ios でアップロードしてください",
		);
	}

	// 指定ビルドが VALID でなければ pickBuildForRelease が理由付きで落とす
	build = pickBuildForRelease(builds, wanted ? { buildVersion: wanted } : {});
	if (build) break;

	const processing = builds.filter((b) => b.processingState === "PROCESSING");
	const summary = builds
		.map((b) => `${b.version}=${b.processingState}`)
		.join(", ");

	if (!WAIT || processing.length === 0 || Date.now() > deadline) {
		throw new Error(
			`配布できるビルド（VALID）がありません: ${summary}\n` +
				(processing.length > 0
					? "  Apple 側で処理中です。--wait を付けると完了まで待ちます"
					: "  ビルドが INVALID / FAILED です。App Store Connect でエラー内容を確認してください"),
		);
	}

	log(`  処理中: ${summary} — ${POLL_INTERVAL_MS / 1000}s 待って再確認します`);
	await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
}

log(`対象ビルド: ${version} (${build.version}) — ${build.processingState}`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. 「このビルドの新機能」を書く
// ─────────────────────────────────────────────────────────────────────────────

/**
 * リリースノートの正本は `store.config.js` の `releaseNotes`。
 * TestFlight 用に別途書かせると**本番と食い違ったまま出る**ので流用する。
 */
const storeConfig = await loadAppConfig("store");
const notes = Object.fromEntries(
	Object.entries(storeConfig.apple?.info ?? {})
		.map(([locale, info]) => [locale, info.releaseNotes])
		.filter(([, text]) => text),
);

if (Object.keys(notes).length === 0) {
	log(
		"⚠ store.config.js に releaseNotes がありません。テスター向けの説明を省略します",
	);
} else {
	validateReleaseNotes(notes, "ios");

	const localizations = await apiAll(
		`/v1/builds/${build.id}/betaBuildLocalizations?limit=50`,
	);
	const byLocale = new Map(
		localizations.map((l) => [l.attributes.locale, l.id]),
	);

	for (const [locale, whatsNew] of Object.entries(notes)) {
		const existing = byLocale.get(locale);
		if (DRY) {
			log(`  [dry-run] ${locale} の説明を${existing ? "更新" : "作成"}します`);
			continue;
		}
		await withRetry(
			() =>
				existing
					? api("PATCH", `/v1/betaBuildLocalizations/${existing}`, {
							data: {
								type: "betaBuildLocalizations",
								id: existing,
								attributes: { whatsNew },
							},
						})
					: api("POST", "/v1/betaBuildLocalizations", {
							data: {
								type: "betaBuildLocalizations",
								attributes: { locale, whatsNew },
								relationships: {
									build: { data: { type: "builds", id: build.id } },
								},
							},
						}),
			{ label: `betaBuildLocalizations(${locale})` },
		);
		log(`  ✓ ${locale} の説明を設定しました`);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. テスターグループへ割り当てる
// ─────────────────────────────────────────────────────────────────────────────

const allGroups = (await apiAll(`/v1/apps/${app.id}/betaGroups?limit=200`)).map(
	(g) => ({
		id: g.id,
		name: g.attributes.name,
		isInternal: g.attributes.isInternalGroup,
	}),
);

if (allGroups.length === 0) {
	throw new Error(
		"TestFlight のグループがありません。\n" +
			"  App Store Connect > TestFlight でグループを作成してください（内部グループが手軽です）",
	);
}

const requested = value("groups")
	?.split(",")
	.map((s) => s.trim())
	.filter(Boolean);

let targets;
if (requested) {
	targets = requested.map((name) => {
		const found = allGroups.find((g) => g.name === name);
		if (!found) {
			throw new Error(
				`グループ ${name} がありません（存在するのは: ${allGroups.map((g) => g.name).join(", ")}）`,
			);
		}
		return found;
	});
} else {
	// 指定が無いときは**内部グループだけ**に配る。外部グループは Beta App Review を
	// 経由して不特定多数へ届くため、明示の指定なしに配ってはならない。
	targets = allGroups.filter((g) => g.isInternal);
	if (targets.length === 0) {
		throw new Error(
			"内部グループがありません。外部グループへ配るなら --groups で明示してください\n" +
				`  （存在するグループ: ${allGroups.map((g) => g.name).join(", ")}）`,
		);
	}
}

log(
	`\n配布先: ${targets.map((g) => `${g.name}${g.isInternal ? "" : "（外部）"}`).join(", ")}`,
);

if (DRY) {
	log("  [dry-run] グループへの割り当てを行いません");
} else {
	await api("POST", `/v1/builds/${build.id}/relationships/betaGroups`, {
		data: targets.map((g) => ({ type: "betaGroups", id: g.id })),
	});
	log("  ✓ 割り当てました");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 外部グループなら Beta App Review へ提出する
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 外部テスターへ配るには **Beta App Review の通過が必要**。割り当てただけでは
 * 誰にも届かず、しかも画面上は「グループに入っている」ように見えるので気づけない。
 */
if (targets.some((g) => !g.isInternal)) {
	if (DRY) {
		log("\n  [dry-run] Beta App Review へ提出します（外部グループがあるため）");
	} else {
		// 既提出（409）を失敗にしたくないので apiRaw でステータスを見る
		const { ok, status, json } = await apiRaw(
			"POST",
			"/v1/betaAppReviewSubmissions",
			{
				data: {
					type: "betaAppReviewSubmissions",
					relationships: { build: { data: { type: "builds", id: build.id } } },
				},
			},
		);
		if (ok) {
			log("\n  ✓ Beta App Review へ提出しました");
		} else if (status === 409) {
			// 既に提出済み。再提出はできないので、失敗ではなく現状として扱う
			log("\n  ・Beta App Review は提出済みです");
		} else {
			throw new Error(
				`Beta App Review への提出に失敗: HTTP ${status} ` +
					`${json?.errors?.[0]?.detail ?? JSON.stringify(json).slice(0, 200)}`,
			);
		}
	}
}

log(
	DRY
		? "\n[dry-run] 何も変更していません"
		: "\n完了しました。内部テスターにはすぐ届きます" +
				(targets.some((g) => !g.isInternal)
					? "（外部テスターは Beta App Review 通過後）"
					: ""),
);
