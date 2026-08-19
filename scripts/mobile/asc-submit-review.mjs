/**
 * App Store の審査提出を最後まで自動で行う（版の作成 → ビルド紐付け → 審査情報 → 提出）。
 *
 *   store-submit-ios --dry-run          # 何をするかだけ表示（必ず先に）
 *   store-submit-ios                    # 審査へ提出する
 *   store-submit-ios --status           # 今の状態を見るだけ（書き込まない）
 *   store-submit-ios --cancel           # 審査提出を取り下げる
 *   store-submit-ios --build 42         # 使うビルド番号を指定
 *   store-submit-ios --phased           # 承認後は段階的リリースにする
 *   store-submit-ios --release-manually # 承認後、手動で公開する（既定は自動公開）
 *
 * ## なぜ要るのか
 *
 * `eas submit` は **バイナリを App Store Connect へ上げるだけ**で、審査には出さない。
 * 「提出」は画面上の別操作で、実際には次の 5 つを順にやる必要がある:
 *
 *   1. そのバージョンの版（appStoreVersion）を作る（無ければ）
 *   2. アップロード済みのビルドを版に紐付ける
 *   3. 「このバージョンの新機能」を各ロケールに入れる
 *   4. 審査情報（**審査担当者用のログイン情報**）を入れる
 *   5. 審査へ提出する
 *
 * どれが欠けても提出できず、**エラーメッセージからは何が足りないか分からない**
 * （「一部のフィールドが不足しています」としか出ない）ことが多い。ここで順に埋める。
 *
 * ## 触ってはいけない状態がある
 *
 * 審査中の版を編集すると**審査を取り下げることになる**。判断は
 * `release-plan.mjs` の `planAppStoreVersion` に集約してあり（テスト済み）、
 * このスクリプトは判断結果に従うだけにしてある。
 *
 * 審査情報の資格情報は SSM Parameter Store（値はチャット・ログ・コミットに出さない）:
 *   APPLE_REVIEW_DEMO_ACCOUNT / APPLE_REVIEW_DEMO_PASSWORD
 *   APPLE_REVIEW_CONTACT_FIRST_NAME / _LAST_NAME / _EMAIL / _PHONE
 *   APPLE_REVIEW_NOTES（任意）
 */
import { api, apiAll, apiRaw, findApp } from "./asc-api-client.mjs";
import {
	pickBuildForRelease,
	planAppStoreVersion,
	validateReleaseNotes,
} from "./release-plan.mjs";
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

const STATUS_ONLY = flag("status");
const CANCEL = flag("cancel");
const PHASED = flag("phased");
const RELEASE_MANUALLY = flag("release-manually");
const PLATFORM = "IOS";

banner(
	STATUS_ONLY
		? "App Store: 状態の確認"
		: CANCEL
			? "App Store: 提出の取り下げ"
			: "App Store: 審査へ提出",
);

const app = await findApp(bundleId());
const version = appVersion();
log(`アプリ: ${app.attributes.name} / バージョン ${version}`);

// ─────────────────────────────────────────────────────────────────────────────
// 現在の版と、そこに対してしてよいことを調べる
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 版の状態は新しい `appVersionState` と旧 `appStoreState` の 2 つがある。
 * Apple は前者へ移行中なので**両方見て、あるほうを使う**（片方だけ見ると
 * ある日 undefined になって「未知の状態」に倒れる）。
 */
async function fetchVersion() {
	const { data } = await api(
		"GET",
		`/v1/apps/${app.id}/appStoreVersions` +
			`?filter[platform]=${PLATFORM}&filter[versionString]=${encodeURIComponent(version)}&limit=1`,
	);
	const v = data[0];
	if (!v) return null;
	return {
		id: v.id,
		versionString: v.attributes.versionString,
		state: v.attributes.appVersionState ?? v.attributes.appStoreState,
		releaseType: v.attributes.releaseType,
	};
}

let appStoreVersion = await fetchVersion();
let plan = planAppStoreVersion(appStoreVersion);

log(
	`版: ${appStoreVersion ? `${appStoreVersion.versionString} — ${appStoreVersion.state}` : "未作成"}`,
);
log(`判定: ${plan.action}${plan.reason ? `（${plan.reason}）` : ""}`);

// ─────────────────────────────────────────────────────────────────────────────
// --status: 見るだけ（書き込まない）
// ─────────────────────────────────────────────────────────────────────────────

if (STATUS_ONLY) {
	const submissions = await apiAll(
		`/v1/apps/${app.id}/reviewSubmissions?filter[platform]=${PLATFORM}&limit=10`,
	);
	const open = submissions.filter(
		(s) =>
			!["COMPLETING", "COMPLETE", "CANCELING"].includes(s.attributes.state),
	);
	log(
		`\n審査提出: ${
			open.length === 0
				? "進行中のものはありません"
				: open
						.map((s) => `${s.id} — ${s.attributes.state}`)
						.join("\n          ")
		}`,
	);
	log(`\n次にすべきこと: ${describeNextStep(plan)}`);
	process.exit(0);
}

/** エージェントが読んで次の一手を決められる粒度で書く */
function describeNextStep(p) {
	switch (p.action) {
		case "submit":
			return "store-submit-ios で審査へ提出できます";
		case "release":
			return "承認済みです。store-submit-ios を再実行すると公開します";
		case "create-new-version":
			return "この版は編集できません。app.json の version を上げてビルドし直してください";
		default:
			return `待ちです（${p.reason ?? p.state}）`;
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// --cancel: 提出の取り下げ
// ─────────────────────────────────────────────────────────────────────────────

if (CANCEL) {
	const submissions = await apiAll(
		`/v1/apps/${app.id}/reviewSubmissions?filter[platform]=${PLATFORM}&limit=10`,
	);
	const open = submissions.filter((s) =>
		[
			"READY_FOR_REVIEW",
			"WAITING_FOR_REVIEW",
			"IN_REVIEW",
			"UNRESOLVED_ISSUES",
		].includes(s.attributes.state),
	);
	if (open.length === 0) {
		log("\n取り下げられる審査提出がありません");
		process.exit(0);
	}
	for (const s of open) {
		if (DRY) {
			log(`  [dry-run] ${s.id}（${s.attributes.state}）を取り下げます`);
			continue;
		}
		await api("PATCH", `/v1/reviewSubmissions/${s.id}`, {
			data: {
				type: "reviewSubmissions",
				id: s.id,
				attributes: { canceled: true },
			},
		});
		log(`  ✓ ${s.id} を取り下げました`);
	}
	process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 版が無い / 使えないなら作る
// ─────────────────────────────────────────────────────────────────────────────

if (plan.action === "wait") {
	// 触ると壊れる状態。ここで止めるのが本スクリプトの一番大事な仕事
	throw new Error(
		`今は操作できません: ${appStoreVersion?.state}\n  ${plan.reason}\n` +
			"  取り下げてよいなら store-submit-ios --cancel を使ってください",
	);
}

if (plan.action === "release") {
	if (DRY) {
		log("\n  [dry-run] 承認済みの版を公開します");
	} else {
		await api("POST", "/v1/appStoreVersionReleaseRequests", {
			data: {
				type: "appStoreVersionReleaseRequests",
				relationships: {
					appStoreVersion: {
						data: { type: "appStoreVersions", id: appStoreVersion.id },
					},
				},
			},
		});
		log("\n  ✓ 公開しました");
	}
	process.exit(0);
}

if (plan.action === "create-new-version") {
	if (appStoreVersion) {
		// 同じ versionString の版が公開済み。app.json の version を上げないと進めない
		throw new Error(
			`バージョン ${version} は既に ${appStoreVersion.state} です。\n` +
				"  app.json の expo.version を上げてから、ビルドし直してください",
		);
	}
	if (DRY) {
		log(`\n  [dry-run] 版 ${version} を作成します`);
	} else {
		const created = await api("POST", "/v1/appStoreVersions", {
			data: {
				type: "appStoreVersions",
				attributes: { platform: PLATFORM, versionString: version },
				relationships: { app: { data: { type: "apps", id: app.id } } },
			},
		});
		appStoreVersion = {
			id: created.data.id,
			versionString: version,
			state:
				created.data.attributes.appVersionState ??
				created.data.attributes.appStoreState,
		};
		log(`\n  ✓ 版 ${version} を作成しました`);
		plan = planAppStoreVersion(appStoreVersion);
	}
}

if (DRY && !appStoreVersion) {
	// dry-run では版を作っていないので、以降は「やること」の表示だけにする
	log("\n[dry-run] 版が未作成のため、以降の手順は表示のみです:");
	log("  1. ビルドの紐付け  2. リリースノート  3. 審査情報  4. 審査へ提出");
	process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ビルドを紐付ける
// ─────────────────────────────────────────────────────────────────────────────

const builds = (
	await apiAll(
		`/v1/builds?filter[app]=${app.id}` +
			`&filter[preReleaseVersion.version]=${encodeURIComponent(version)}` +
			"&sort=-uploadedDate&limit=50",
	)
)
	.map((b) => ({
		id: b.id,
		version: b.attributes.version,
		processingState: b.attributes.processingState,
		uploadedDate: b.attributes.uploadedDate,
		expired: b.attributes.expired,
	}))
	.filter((b) => !b.expired);

const wanted = value("build");
const build = pickBuildForRelease(
	builds,
	wanted ? { buildVersion: wanted } : {},
);
if (!build) {
	throw new Error(
		`紐付けられるビルド（VALID）がありません: ` +
			`${builds.map((b) => `${b.version}=${b.processingState}`).join(", ") || "1 件も無し"}\n` +
			"  処理中なら store-testflight --wait で完了を待てます",
	);
}
log(`\nビルド: ${build.version}`);

if (DRY) {
	log("  [dry-run] 版へ紐付けます");
} else {
	await api(
		"PATCH",
		`/v1/appStoreVersions/${appStoreVersion.id}/relationships/build`,
		{
			data: { type: "builds", id: build.id },
		},
	);
	log("  ✓ 紐付けました");
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. リリースノート（このバージョンの新機能）
// ─────────────────────────────────────────────────────────────────────────────

const storeConfig = await loadAppConfig("store");
const notes = Object.fromEntries(
	Object.entries(storeConfig.apple?.info ?? {})
		.map(([locale, info]) => [locale, info.releaseNotes])
		.filter(([, text]) => text),
);

if (Object.keys(notes).length > 0) {
	validateReleaseNotes(notes, "ios");

	const localizations = await apiAll(
		`/v1/appStoreVersions/${appStoreVersion.id}/appStoreVersionLocalizations?limit=50`,
	);
	const byLocale = new Map(
		localizations.map((l) => [l.attributes.locale, l.id]),
	);

	for (const [locale, whatsNew] of Object.entries(notes)) {
		const existing = byLocale.get(locale);
		if (!existing) {
			// ロケール自体は mobile-metadata（eas metadata:push）が作る。
			// 無いのに作りに行くと掲載文が空のロケールが生まれるので、警告に留める
			log(
				`  ⚠ ${locale} のローカライズがありません。先に mobile-metadata を実行してください`,
			);
			continue;
		}
		if (DRY) {
			log(`  [dry-run] ${locale} のリリースノートを更新します`);
			continue;
		}
		await withRetry(
			() =>
				api("PATCH", `/v1/appStoreVersionLocalizations/${existing}`, {
					data: {
						type: "appStoreVersionLocalizations",
						id: existing,
						attributes: { whatsNew },
					},
				}),
			{ label: `appStoreVersionLocalizations(${locale})` },
		);
		log(`  ✓ ${locale} のリリースノートを設定しました`);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 審査情報（審査担当者がログインできないと 2.1 でリジェクトされる）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ログインが要るアプリで審査用アカウントを渡さないと、審査担当者はアプリに入れず
 * **Guideline 2.1(a) でリジェクトされる**（`.claude/rules/auth.md`）。
 * 資格情報はファイルに置かず env から読む（SSM から注入される）。
 */
const review = {
	contactFirstName: process.env.APPLE_REVIEW_CONTACT_FIRST_NAME,
	contactLastName: process.env.APPLE_REVIEW_CONTACT_LAST_NAME,
	contactEmail: process.env.APPLE_REVIEW_CONTACT_EMAIL,
	contactPhone: process.env.APPLE_REVIEW_CONTACT_PHONE,
	demoAccountName: process.env.APPLE_REVIEW_DEMO_ACCOUNT,
	demoAccountPassword: process.env.APPLE_REVIEW_DEMO_PASSWORD,
	notes: process.env.APPLE_REVIEW_NOTES,
};
review.demoAccountRequired = Boolean(review.demoAccountName);

const missingContact = [
	"contactFirstName",
	"contactLastName",
	"contactEmail",
	"contactPhone",
].filter((k) => !review[k]);
if (missingContact.length > 0) {
	throw new Error(
		`審査情報の連絡先が足りません: ${missingContact.join(", ")}\n` +
			"  SSM に APPLE_REVIEW_CONTACT_FIRST_NAME / _LAST_NAME / _EMAIL / _PHONE を登録してください\n" +
			"  （値はチャットにもログにも出さないこと）",
	);
}
if (!review.demoAccountName) {
	// ログイン不要のアプリなら正しい状態なので、落とさず警告に留める
	log(
		"\n⚠ 審査用アカウント（APPLE_REVIEW_DEMO_ACCOUNT）が未設定です。\n" +
			"  ログインが要るアプリなら Guideline 2.1(a) でリジェクトされます",
	);
}

// 既存があれば PATCH、無ければ POST（無条件 POST は 409 になる）
const { ok: hasDetail, json: detailJson } = await apiRaw(
	"GET",
	`/v1/appStoreVersions/${appStoreVersion.id}/appStoreReviewDetail`,
);
const detailId = hasDetail ? detailJson?.data?.id : null;

// 値は出さない。何を設定したかだけ出す
log(
	`\n審査情報: 連絡先 ${review.contactEmail ? "設定済み" : "未設定"} / ` +
		`審査用アカウント ${review.demoAccountName ? "設定済み" : "なし"}`,
);

if (DRY) {
	log(`  [dry-run] 審査情報を${detailId ? "更新" : "作成"}します`);
} else if (detailId) {
	await api("PATCH", `/v1/appStoreReviewDetails/${detailId}`, {
		data: { type: "appStoreReviewDetails", id: detailId, attributes: review },
	});
	log("  ✓ 更新しました");
} else {
	await api("POST", "/v1/appStoreReviewDetails", {
		data: {
			type: "appStoreReviewDetails",
			attributes: review,
			relationships: {
				appStoreVersion: {
					data: { type: "appStoreVersions", id: appStoreVersion.id },
				},
			},
		},
	});
	log("  ✓ 作成しました");
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. 公開方法（自動公開 / 手動公開 / 段階的リリース）
// ─────────────────────────────────────────────────────────────────────────────

const releaseType = RELEASE_MANUALLY ? "MANUAL" : "AFTER_APPROVAL";
if (DRY) {
	log(
		`\n[dry-run] releaseType=${releaseType}${PHASED ? " / 段階的リリース有効" : ""}`,
	);
} else {
	await api("PATCH", `/v1/appStoreVersions/${appStoreVersion.id}`, {
		data: {
			type: "appStoreVersions",
			id: appStoreVersion.id,
			attributes: { releaseType },
		},
	});
	log(
		`\n公開方法: ${releaseType === "MANUAL" ? "承認後に手動で公開" : "承認後に自動公開"}`,
	);

	if (PHASED) {
		// 既にあれば 409。段階的リリースは「有効になっていること」が目的なので許容する
		const { ok, status } = await apiRaw(
			"POST",
			"/v1/appStoreVersionPhasedReleases",
			{
				data: {
					type: "appStoreVersionPhasedReleases",
					relationships: {
						appStoreVersion: {
							data: { type: "appStoreVersions", id: appStoreVersion.id },
						},
					},
				},
			},
		);
		log(
			ok
				? "  ✓ 段階的リリースを有効にしました"
				: status === 409
					? "  ・段階的リリースは設定済み"
					: `  ⚠ 段階的リリースを設定できません (HTTP ${status})`,
		);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. 審査へ提出（3 段階。順番を守らないと 422 になる）
// ─────────────────────────────────────────────────────────────────────────────

if (DRY) {
	log("\n[dry-run] 審査へ提出します（reviewSubmissions → items → submitted）");
	log("\n[dry-run] 何も変更していません");
	process.exit(0);
}

/**
 * 提出は 3 段階:
 *   1. POST /v1/reviewSubmissions          … 提出の箱を作る
 *   2. POST /v1/reviewSubmissionItems      … 箱に版を入れる
 *   3. PATCH /v1/reviewSubmissions/{id}    … submitted=true で送る
 *
 * 旧 `appStoreVersionSubmissions` は文書から消えているので使わない。
 * 順番を入れ替えると 422 になる。
 */
let submissionId;
const {
	ok: created,
	status: createStatus,
	json: createJson,
} = await apiRaw("POST", "/v1/reviewSubmissions", {
	data: {
		type: "reviewSubmissions",
		attributes: { platform: PLATFORM },
		relationships: { app: { data: { type: "apps", id: app.id } } },
	},
});

if (created) {
	submissionId = createJson.data.id;
} else if (createStatus === 409) {
	// 既に開いている提出がある。作り直せないので、それを使う
	const existing = await apiAll(
		`/v1/apps/${app.id}/reviewSubmissions?filter[platform]=${PLATFORM}&filter[state]=READY_FOR_REVIEW&limit=1`,
	);
	submissionId = existing[0]?.id;
	if (!submissionId) {
		throw new Error(
			"審査提出が既に存在しますが取得できませんでした。\n" +
				"  store-submit-ios --status で状態を確認してください",
		);
	}
	log(`\n既存の提出を使います: ${submissionId}`);
} else {
	throw new Error(
		`審査提出を作成できません: HTTP ${createStatus} ` +
			`${createJson?.errors?.[0]?.detail ?? JSON.stringify(createJson).slice(0, 300)}`,
	);
}

/**
 * 同じ版を二重に入れると 409 になるので、入っていなければ足す。
 *
 * 既存項目の照会は**失敗しても致命的にしない**。この関連のパスが変わっていた場合でも、
 * 追加そのものは POST の 409 で二重登録を防げる。**照会のために提出全体を止めない**
 * （提出は「ここまで来て最後の 1 手が残っている」状態なので、止めると人手が必要になる）。
 */
const { ok: listedItems, json: itemsJson } = await apiRaw(
	"GET",
	`/v1/reviewSubmissions/${submissionId}/items?limit=50`,
);
const alreadyIncluded =
	listedItems &&
	(itemsJson.data ?? []).some(
		(i) => i.relationships?.appStoreVersion?.data?.id === appStoreVersion.id,
	);

if (!alreadyIncluded) {
	const { ok, status, json } = await apiRaw(
		"POST",
		"/v1/reviewSubmissionItems",
		{
			data: {
				type: "reviewSubmissionItems",
				relationships: {
					reviewSubmission: {
						data: { type: "reviewSubmissions", id: submissionId },
					},
					appStoreVersion: {
						data: { type: "appStoreVersions", id: appStoreVersion.id },
					},
				},
			},
		},
	);
	if (ok) {
		log("  ✓ 版を提出に追加しました");
	} else if (status === 409) {
		log("  ・版は既に提出に含まれています");
	} else {
		throw new Error(
			`版を提出に追加できません: HTTP ${status} ` +
				`${json?.errors?.[0]?.detail ?? JSON.stringify(json).slice(0, 300)}`,
		);
	}
}

await api("PATCH", `/v1/reviewSubmissions/${submissionId}`, {
	data: {
		type: "reviewSubmissions",
		id: submissionId,
		attributes: { submitted: true },
	},
});

log(
	`\n✓ 審査へ提出しました（submission ${submissionId}）\n` +
		"  状態確認: store-submit-ios --status\n" +
		"  取り下げ: store-submit-ios --cancel",
);
