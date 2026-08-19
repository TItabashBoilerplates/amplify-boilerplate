/**
 * 両ストアの「今どうなっているか」と「次に何をすべきか」を 1 コマンドで出す。
 *
 *   store-status              # 人が読む形
 *   store-status --json       # 機械が読む形（エージェント・CI 用）
 *
 * ## なぜ要るのか
 *
 * リリース作業で一番時間を食うのは操作ではなく **状態の把握** である。
 * 「ビルドはもう処理が終わったか」「審査に出ているのか」「Play は draft のままか」を
 * 知るには、これまで App Store Connect と Play Console を人が開くしかなかった。
 * つまり**エージェントは自分が今どこにいるか分からないまま操作する**ことになり、
 * それが「審査中の版を編集して取り下げる」ような事故につながる。
 *
 * このスクリプトは**一切書き込まない**ので、迷ったらいつでも実行してよい。
 * 判断は `release-plan.mjs`（テスト済み）に委ねており、ここでは表示だけを行う。
 */
import { api, apiAll, findApp } from "./asc-api-client.mjs";
import { planAppStoreVersion } from "./release-plan.mjs";
import { appVersion, bundleId, log } from "./store-config.mjs";

const JSON_OUT = process.argv.includes("--json");
const PLATFORM = "IOS";

/** 収集結果。片方のストアが落ちても、もう片方は出す（両方見えないと判断できないため） */
const report = { ios: null, android: null, errors: [] };

// ─────────────────────────────────────────────────────────────────────────────
// App Store
// ─────────────────────────────────────────────────────────────────────────────

try {
	const app = await findApp(bundleId());
	const version = appVersion();

	// apiRaw ではなく api を使う。**取得に失敗したことを「版が無い」と混同しない**ため
	// （401 を握りつぶすと「版: 未作成」と表示され、新規作成へ誘導してしまう）
	const { data: versions } = await api(
		"GET",
		`/v1/apps/${app.id}/appStoreVersions?filter[platform]=${PLATFORM}&limit=5`,
	);

	const current = (versions ?? []).find(
		(v) => v.attributes.versionString === version,
	);
	const state = current
		? (current.attributes.appVersionState ?? current.attributes.appStoreState)
		: undefined;
	const plan = planAppStoreVersion(current ? { state } : null);

	const builds = (
		await apiAll(
			`/v1/builds?filter[app]=${app.id}` +
				`&filter[preReleaseVersion.version]=${encodeURIComponent(version)}` +
				"&sort=-uploadedDate&limit=10",
		)
	).map((b) => ({
		build: b.attributes.version,
		processingState: b.attributes.processingState,
		expired: b.attributes.expired,
	}));

	const submissions = (
		await apiAll(
			`/v1/apps/${app.id}/reviewSubmissions?filter[platform]=${PLATFORM}&limit=10`,
		)
	)
		.map((s) => ({ id: s.id, state: s.attributes.state }))
		.filter((s) => !["COMPLETE", "COMPLETING"].includes(s.state));

	report.ios = {
		app: app.attributes.name,
		version,
		versionState: state ?? "未作成",
		action: plan.action,
		reason: plan.reason,
		builds,
		openSubmissions: submissions,
		nextStep: iosNextStep(plan, builds, submissions),
	};
} catch (error) {
	// 握りつぶさない。ログに出したうえで、最後に exit code へ反映する
	console.error(`[App Store] 取得に失敗: ${error.message}`);
	report.errors.push({ store: "ios", message: error.message });
}

/** エージェントがそのまま次のコマンドを選べる粒度で書く */
function iosNextStep(plan, builds, submissions) {
	if (
		submissions.some((s) =>
			["WAITING_FOR_REVIEW", "IN_REVIEW"].includes(s.state),
		)
	) {
		return "審査中です。結果を待ってください";
	}
	if (plan.action === "wait") return plan.reason ?? "待ちです";
	if (plan.action === "release")
		return "承認済みです。store-submit-ios を再実行すると公開します";
	if (plan.action === "create-new-version" && plan.state) {
		return "この版は公開済みです。app.json の expo.version を上げてください";
	}
	const usable = builds.filter(
		(b) => b.processingState === "VALID" && !b.expired,
	);
	if (usable.length === 0) {
		return builds.some((b) => b.processingState === "PROCESSING")
			? "ビルドを処理中です。store-testflight --wait で待てます"
			: "提出できるビルドがありません。mobile-release-ios を実行してください";
	}
	return "store-submit-ios で審査へ提出できます";
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Play
// ─────────────────────────────────────────────────────────────────────────────

try {
	// Play のクライアントは import 時に資格情報を要求するので、動的 import で
	// 「iOS だけ見たい」ケースを巻き込まないようにする
	const { api, PKG } = await import("./play-api-client.mjs");

	const edit = await api("POST", `/applications/${PKG}/edits`);
	try {
		const { tracks = [] } = await api(
			"GET",
			`/applications/${PKG}/edits/${edit.id}/tracks`,
		);
		const summary = tracks.map((t) => ({
			track: t.track,
			releases: (t.releases ?? []).map((r) => ({
				name: r.name,
				status: r.status,
				userFraction: r.userFraction,
				versionCodes: r.versionCodes ?? [],
			})),
		}));
		report.android = {
			package: PKG,
			tracks: summary,
			nextStep: playNextStep(summary),
		};
	} finally {
		// 読み取りだけなので必ず破棄する（開きっぱなしは次の edit を壊す）
		await api("DELETE", `/applications/${PKG}/edits/${edit.id}`).catch(
			() => {},
		);
	}
} catch (error) {
	console.error(`[Google Play] 取得に失敗: ${error.message}`);
	report.errors.push({ store: "android", message: error.message });
}

function playNextStep(tracks) {
	const production = tracks.find((t) => t.track === "production");
	const inProgress = production?.releases.find(
		(r) => r.status === "inProgress",
	);
	if (inProgress) {
		return (
			`本番を ${Math.round((inProgress.userFraction ?? 0) * 100)}% で配布中です。` +
			"store-release-play --track production --rollout 1 で全公開できます"
		);
	}
	if (production?.releases.some((r) => r.status === "completed")) {
		return "本番は全公開済みです";
	}
	const draft = tracks.find((t) =>
		t.releases.some((r) => r.status === "draft"),
	);
	if (draft) {
		return (
			`${draft.track} に draft のリリースがあります。` +
			`store-release-play --track ${draft.track} --rollout 1 で配布を開始できます`
		);
	}
	const withBuild = tracks.find((t) =>
		t.releases.some((r) => r.versionCodes.length > 0),
	);
	return withBuild
		? `${withBuild.track} のビルドを昇格できます（store-release-play --from ${withBuild.track} --track production --rollout 0.1）`
		: "ビルドがありません。mobile-release-android を実行してください";
}

// ─────────────────────────────────────────────────────────────────────────────
// 出力
// ─────────────────────────────────────────────────────────────────────────────

if (JSON_OUT) {
	console.log(JSON.stringify(report, null, 2));
} else {
	if (report.ios) {
		log("\n=== App Store ===");
		log(`アプリ: ${report.ios.app} / バージョン ${report.ios.version}`);
		log(`版の状態: ${report.ios.versionState}`);
		log(
			`ビルド: ${
				report.ios.builds.length === 0
					? "なし"
					: report.ios.builds
							.map(
								(b) =>
									`${b.build}=${b.processingState}${b.expired ? "(期限切れ)" : ""}`,
							)
							.join(", ")
			}`,
		);
		log(
			`審査提出: ${
				report.ios.openSubmissions.length === 0
					? "進行中なし"
					: report.ios.openSubmissions.map((s) => s.state).join(", ")
			}`,
		);
		log(`→ ${report.ios.nextStep}`);
	}

	if (report.android) {
		log("\n=== Google Play ===");
		log(`パッケージ: ${report.android.package}`);
		for (const t of report.android.tracks) {
			if (t.releases.length === 0) continue;
			log(
				`[${t.track}] ${t.releases
					.map(
						(r) =>
							`${r.status}${r.userFraction !== undefined ? `(${Math.round(r.userFraction * 100)}%)` : ""}` +
							` versionCode=${r.versionCodes.join(",") || "なし"}`,
					)
					.join(" / ")}`,
			);
		}
		log(`→ ${report.android.nextStep}`);
	}
}

// 片方でも取得に失敗したなら、成功したことにしない
if (report.errors.length > 0) {
	throw new Error(
		`${report.errors.map((e) => e.store).join(" / ")} の状態を取得できませんでした`,
	);
}
