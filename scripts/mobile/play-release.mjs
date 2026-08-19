/**
 * Google Play のトラック公開・段階的公開を行う（昇格 / ロールアウト / 停止）。
 *
 *   store-release-play --status                          # 各トラックの現状（書き込まない）
 *   store-release-play --track internal --rollout 1      # 内部テストへ全公開
 *   store-release-play --from internal --track production --rollout 0.1
 *                                                        # 内部테스트のビルドを本番へ 10% で
 *   store-release-play --track production --rollout 0.5  # 割合を上げる
 *   store-release-play --track production --halt         # 進行中のロールアウトを止める
 *   store-release-play --track production --rollout 1    # 全公開にする
 *
 * ## なぜ要るのか
 *
 * `mobile-release-android` は `eas.json` の submit 設定に従って
 * **`releaseStatus: "draft"` で内部テストに置くだけ**で終わる。つまり
 * **誰にも配られない**。そこから先（テスターへ配る / 本番へ上げる / 段階的に広げる）は
 * Play Console で人が押す前提だったので、エージェントはリリースを完了できなかった。
 *
 * ## edits はトランザクション。1 回で閉じる
 *
 * Play の変更は「edit を開く → 変更 → commit」で、**commit しない限り何も起きない**。
 * さらに **1 アプリにつき同時に開ける edit は 1 つ**で、他の誰かが Play Console で
 * 変更すると**開いている edit はすべて無効になる**。したがって
 * edit は開いたらすぐ閉じる（複数の操作をまたいで開きっぱなしにしない）。
 *
 * 判断（割合と status の組み合わせ）は `release-plan.mjs` に集約してある。
 */
import { api, PKG } from "./play-api-client.mjs";
import {
	planPlayRollout,
	toPlayLocale,
	validateReleaseNotes,
} from "./release-plan.mjs";
import { banner, DRY, loadAppConfig, log } from "./store-config.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : undefined;
};

const STATUS_ONLY = flag("status");
const TRACK = value("track") ?? "internal";
const FROM = value("from");
const HALT = flag("halt");
const DRAFT = flag("draft");
const rolloutArg = value("rollout");
const priorityArg = value("priority");

banner(
	STATUS_ONLY
		? "Google Play: トラックの状態"
		: `Google Play: ${TRACK} への公開`,
);

// ─────────────────────────────────────────────────────────────────────────────
// edit を開く（commit するまで本番には何も起きない）
// ─────────────────────────────────────────────────────────────────────────────

const edit = await api("POST", `/applications/${PKG}/edits`);
log(`edit ${edit.id} を開きました`);

/** 失敗しても edit を放置しない。開きっぱなしは次回の edit を壊す原因になる */
async function abandonEdit() {
	try {
		await api("DELETE", `/applications/${PKG}/edits/${edit.id}`);
	} catch {
		// 破棄の失敗自体は致命的でない（期限切れで自然に無効化される）
	}
}

try {
	// ───────────────────────────────────────────────────────────────────────────
	// --status: 全トラックの現状を出すだけ
	// ───────────────────────────────────────────────────────────────────────────

	if (STATUS_ONLY) {
		const { tracks = [] } = await api(
			"GET",
			`/applications/${PKG}/edits/${edit.id}/tracks`,
		);
		for (const t of tracks) {
			const releases = t.releases ?? [];
			log(`\n[${t.track}]`);
			if (releases.length === 0) {
				log("  リリースなし");
				continue;
			}
			for (const r of releases) {
				log(
					`  ${r.name ?? "(名前なし)"} — status=${r.status}` +
						`${r.userFraction !== undefined ? ` / ${Math.round(r.userFraction * 100)}%` : ""}` +
						` / versionCodes=${(r.versionCodes ?? []).join(",") || "なし"}`,
				);
			}
		}
		log("\n（読み取りのみ。edit は破棄します）");
		await abandonEdit();
		process.exit(0);
	}

	// ───────────────────────────────────────────────────────────────────────────
	// 1. 配るビルド（versionCodes）を決める
	// ───────────────────────────────────────────────────────────────────────────

	/**
	 * `--from` があれば「昇格」。元トラックの最新リリースの versionCodes を引き継ぐ。
	 * 無ければ、対象トラックに既にあるリリース（`eas submit` が draft で置いたもの）を使う。
	 */
	const sourceTrackName = FROM ?? TRACK;
	const source = await api(
		"GET",
		`/applications/${PKG}/edits/${edit.id}/tracks/${sourceTrackName}`,
	);
	const sourceReleases = source.releases ?? [];
	if (sourceReleases.length === 0) {
		throw new Error(
			`トラック ${sourceTrackName} にリリースがありません。\n` +
				"  先に mobile-release-android でビルドを提出してください",
		);
	}

	// versionCode が最大のリリースを選ぶ（複数残っているとき最新を取り違えない）
	const latest = sourceReleases
		.filter((r) => (r.versionCodes ?? []).length > 0)
		.sort(
			(a, b) =>
				Math.max(...b.versionCodes.map(Number)) -
				Math.max(...a.versionCodes.map(Number)),
		)[0];

	if (!latest) {
		throw new Error(
			`トラック ${sourceTrackName} に versionCode を持つリリースがありません`,
		);
	}

	const versionCodes = latest.versionCodes;
	log(
		`対象: versionCode ${versionCodes.join(", ")}` +
			`${FROM ? `（${FROM} → ${TRACK} へ昇格）` : ""}`,
	);

	// ───────────────────────────────────────────────────────────────────────────
	// 2. 公開の仕方を決める（判断は release-plan.mjs）
	// ───────────────────────────────────────────────────────────────────────────

	const rollout = planPlayRollout({
		fraction: rolloutArg !== undefined ? Number(rolloutArg) : undefined,
		status: HALT ? "halted" : DRAFT ? "draft" : undefined,
		priority: priorityArg !== undefined ? Number(priorityArg) : undefined,
	});

	log(
		`公開: status=${rollout.status}` +
			`${rollout.userFraction !== undefined ? ` / ${Math.round(rollout.userFraction * 100)}%` : ""}`,
	);

	// ───────────────────────────────────────────────────────────────────────────
	// 3. リリースノート
	// ───────────────────────────────────────────────────────────────────────────

	/**
	 * 正本は `store.config.js` の `releaseNotes`（App Store と同じ文面）。
	 * Play 用に別途書かせると**片方だけ更新されて食い違う**ので流用し、
	 * ロケール表記だけ変換する。上限は Play のほうが厳しい（500 文字）ので必ず検証する。
	 */
	const storeConfig = await loadAppConfig("store");
	const notes = Object.fromEntries(
		Object.entries(storeConfig.apple?.info ?? {})
			.map(([locale, info]) => [toPlayLocale(locale), info.releaseNotes])
			.filter(([, text]) => text),
	);

	const releaseNotes =
		Object.keys(notes).length > 0
			? Object.entries(validateReleaseNotes(notes, "android")).map(
					([language, text]) => ({ language, text }),
				)
			: undefined;

	if (!releaseNotes) {
		log(
			"⚠ store.config.js に releaseNotes がありません。ノート無しで公開します",
		);
	}

	// ───────────────────────────────────────────────────────────────────────────
	// 4. トラックを更新して commit
	// ───────────────────────────────────────────────────────────────────────────

	if (DRY) {
		log(
			`\n[dry-run] トラック ${TRACK} を更新します:\n` +
				`  ${JSON.stringify({ ...rollout, versionCodes }, null, 2).replace(/\n/g, "\n  ")}`,
		);
		log("\n[dry-run] commit しないので本番は変わりません");
		await abandonEdit();
		process.exit(0);
	}

	await api("PUT", `/applications/${PKG}/edits/${edit.id}/tracks/${TRACK}`, {
		track: TRACK,
		releases: [
			{
				...rollout,
				versionCodes,
				...(releaseNotes ? { releaseNotes } : {}),
			},
		],
	});
	log(`トラック ${TRACK} を更新しました（まだ commit していません）`);

	const committed = await api(
		"POST",
		`/applications/${PKG}/edits/${edit.id}:commit`,
	);
	log(`\n✓ commit しました（edit ${committed.id}）`);
	log(
		rollout.status === "draft"
			? "  draft なので配布は始まりません。Play Console でリリースを開始してください"
			: rollout.status === "halted"
				? "  ロールアウトを停止しました。既にインストール済みの端末はそのままです"
				: rollout.status === "completed"
					? "  全ユーザーへの公開に進みます（反映まで数時間かかることがあります）"
					: `  ${Math.round(rollout.userFraction * 100)}% のユーザーへ配布を開始しました`,
	);
} catch (error) {
	// 握りつぶさない。edit だけ片付けて投げ直す
	await abandonEdit();
	throw error;
}
