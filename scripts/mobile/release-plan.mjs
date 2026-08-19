/**
 * リリース操作の**判断**だけを持つ純粋モジュール（ネットワークを触らない）。
 *
 * ## なぜ判断だけ切り出すのか
 *
 * ストアへの書き込み自体は HTTP を 1 回投げるだけで難しくない。難しいのは
 * 「**今この状態で、その操作をしてよいか**」のほうで、ここを誤ると取り返しがつかない:
 *
 * | 誤った操作 | 起きること |
 * |---|---|
 * | 審査中の版を編集する | 審査を取り下げないと直せない。しかも**一部だけ反映される**形で壊れる |
 * | 公開済みの版に書き込む | 400 になるが、原因が「版を作っていない」だと気づきにくい |
 * | `completed` に `userFraction` を付ける | Play が 400 を返す（両立しない） |
 * | 段階公開の割合に 0 / 1 を渡す | ロールアウトが作られない（API 上 0 < f < 1） |
 *
 * 人間は App Store Connect の画面を見て「審査中だから触らない」と判断できるが、
 * エージェントは状態文字列を渡されただけでは判断できない。**判断を関数にして
 * テストで固定する**ことで、エージェントが状態を読み違えても危険な操作に進めなくする。
 *
 * したがって `asc-*.mjs` / `play-*.mjs` 側に判断を書かないこと（重複した判断は必ずズレる）。
 *
 * 検証: `frontend/apps/mobile/src/shared/config/release-plan.test.ts`
 */

// ─────────────────────────────────────────────────────────────────────────────
// 上限値（ストアの仕様。超えると push が落ちる）
// ─────────────────────────────────────────────────────────────────────────────

/** App Store の「このバージョンの新機能」 */
export const APP_STORE_WHATS_NEW_LIMIT = 4000;

/**
 * Play のリリースノート（**言語ごと** 500 Unicode 文字）。
 * App Store の 1/8 なので、同じ文面を両ストアへ流すと Play だけ落ちる。
 */
export const PLAY_RELEASE_NOTES_LIMIT = 500;

// ─────────────────────────────────────────────────────────────────────────────
// App Store: 版の状態 → 次にしてよいこと
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 状態ごとの可否表。**ここに無い状態は既定で「待つ」**に倒す。
 *
 * Apple は状態を増やすこと（`READY_FOR_SALE` → `READY_FOR_DISTRIBUTION` の改称など）が
 * あるので、知らない状態を「たぶん編集していい」で通すと本番を壊す。
 *
 * `action` の意味:
 *   submit             … 編集して審査へ出せる
 *   release            … 承認済み。公開操作（手動リリース）へ進む
 *   create-new-version … この版はもう使えない。新しい版を作る
 *   wait               … 触らない
 */
const APP_STORE_VERSION_PLANS = {
	// 準備中・差し戻し → 触ってよい
	PREPARE_FOR_SUBMISSION: { canEdit: true, canSubmit: true, action: "submit" },
	REJECTED: { canEdit: true, canSubmit: true, action: "submit" },
	DEVELOPER_REJECTED: { canEdit: true, canSubmit: true, action: "submit" },
	METADATA_REJECTED: { canEdit: true, canSubmit: true, action: "submit" },
	INVALID_BINARY: { canEdit: true, canSubmit: true, action: "submit" },

	// Apple の手に渡っている → 触らない
	READY_FOR_REVIEW: {
		canEdit: false,
		canSubmit: false,
		action: "wait",
		reason: "提出処理中です。完了を待ってください",
	},
	WAITING_FOR_REVIEW: {
		canEdit: false,
		canSubmit: false,
		action: "wait",
		reason: "審査待ちです。編集すると審査を取り下げることになります",
	},
	IN_REVIEW: {
		canEdit: false,
		canSubmit: false,
		action: "wait",
		reason: "審査中です。編集すると審査を取り下げることになります",
	},
	PENDING_APPLE_RELEASE: {
		canEdit: false,
		canSubmit: false,
		action: "wait",
		reason: "Apple によるリリース待ちです",
	},
	WAITING_FOR_EXPORT_COMPLIANCE: {
		canEdit: false,
		canSubmit: false,
		action: "wait",
		// app.json の ios.config.usesNonExemptEncryption を設定していれば起きない
		reason:
			"輸出コンプライアンスの回答待ちです。app.json の ios.config.usesNonExemptEncryption を設定してください",
	},
	PROCESSING_FOR_APP_STORE: {
		canEdit: false,
		canSubmit: false,
		action: "wait",
		reason: "App Store 側で処理中です",
	},

	// 承認済み・手動リリース待ち → 公開操作へ
	PENDING_DEVELOPER_RELEASE: {
		canEdit: false,
		canSubmit: false,
		action: "release",
	},

	// 公開済み → 新しい版が要る
	READY_FOR_SALE: {
		canEdit: false,
		canSubmit: false,
		action: "create-new-version",
	},
	READY_FOR_DISTRIBUTION: {
		canEdit: false,
		canSubmit: false,
		action: "create-new-version",
	},
	REPLACED_WITH_NEW_VERSION: {
		canEdit: false,
		canSubmit: false,
		action: "create-new-version",
	},
	REMOVED_FROM_SALE: {
		canEdit: false,
		canSubmit: false,
		action: "create-new-version",
	},
	DEVELOPER_REMOVED_FROM_SALE: {
		canEdit: false,
		canSubmit: false,
		action: "create-new-version",
	},
};

/**
 * App Store の版に対して次にしてよいことを返す。
 *
 * @param {{ state?: string } | null} version 対象の版（無ければ null）
 * @returns {{ canEdit: boolean, canSubmit: boolean, action: string, reason?: string }}
 */
export function planAppStoreVersion(version) {
	if (!version) {
		return {
			canEdit: false,
			canSubmit: false,
			action: "create-new-version",
			reason: "編集できる版がありません",
		};
	}

	const state = version.state;
	const plan = APP_STORE_VERSION_PLANS[state];
	if (plan) return { ...plan, state };

	// 知らない状態は必ず止める（「たぶん大丈夫」で通さない）
	return {
		canEdit: false,
		canSubmit: false,
		action: "wait",
		state,
		reason:
			`未知の版ステータス ${state} です。自動では判断できないので ` +
			"App Store Connect で確認してください",
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// App Store: 提出に使うビルドの選択
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 提出・配布に使うビルドを選ぶ。
 *
 * **VALID 以外を掴まない**のが要点。`PROCESSING` のビルドを版に紐付けようとすると
 * 409 で落ちるが、エラー文からは「待てばよい」のか「壊れている」のか分からない。
 * ここで区別して、待つべきときは null（＝呼び出し側がポーリングする）を返す。
 *
 * @param {Array<{id: string, version: string, processingState?: string, uploadedDate?: string}>} builds
 * @param {{ buildVersion?: string }} [options] ビルド番号を指定する場合
 */
export function pickBuildForRelease(builds, options = {}) {
	const list = builds ?? [];

	if (options.buildVersion) {
		const wanted = list.find(
			(b) => String(b.version) === String(options.buildVersion),
		);
		if (!wanted) {
			throw new Error(
				`ビルド ${options.buildVersion} が App Store Connect にありません` +
					`（見つかったのは: ${list.map((b) => b.version).join(", ") || "なし"}）`,
			);
		}
		if (wanted.processingState !== "VALID") {
			throw new Error(
				`ビルド ${options.buildVersion} は ${wanted.processingState} です。` +
					"VALID になるまで待つか、別のビルドを指定してください",
			);
		}
		return wanted;
	}

	const usable = list.filter((b) => b.processingState === "VALID");
	if (usable.length === 0) return null;

	// アップロード時刻の降順。同着はビルド番号で決める（順序が不定だと結果が再現しない）
	return usable.sort((a, b) => {
		const byDate =
			new Date(b.uploadedDate ?? 0).getTime() -
			new Date(a.uploadedDate ?? 0).getTime();
		return byDate !== 0 ? byDate : Number(b.version) - Number(a.version);
	})[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Play: 段階的公開
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Play のリリース状態を組み立てる。
 *
 * API の制約が独特で、素直に書くと 400 になる:
 *   - `userFraction` は **0 < f < 1**。1.0（全公開）は割合ではなく `completed`
 *   - `completed` に `userFraction` を付けると弾かれる
 *   - `inAppUpdatePriority` は 0〜5。**ロールアウト開始後は変更できない**
 *
 * @param {{ fraction?: number, status?: string, priority?: number }} input
 */
export function planPlayRollout(input = {}) {
	const { fraction, status, priority } = input;

	const plan = {};

	if (status === "draft") {
		plan.status = "draft";
	} else if (status === "halted") {
		plan.status = "halted";
		// 停止時は「どこまで配ったか」を保つ必要があるので割合を残す
		if (fraction !== undefined) plan.userFraction = assertFraction(fraction);
	} else if (fraction === 1) {
		// 全公開。userFraction は付けない（付けると 400）
		plan.status = "completed";
	} else if (fraction !== undefined) {
		plan.status = "inProgress";
		plan.userFraction = assertFraction(fraction);
	} else if (status === "completed" || status === "inProgress") {
		throw new Error(
			`status=${status} には割合の指定が必要です（--rollout 0.1 / --rollout 1）`,
		);
	} else {
		// 既定で全公開しない。「何も指定しなかったら全ユーザーに配られた」を防ぐ
		throw new Error(
			"公開の指定がありません。--rollout <0〜1> か --status draft|halted を指定してください",
		);
	}

	if (priority !== undefined) {
		if (!Number.isInteger(priority) || priority < 0 || priority > 5) {
			throw new Error(`inAppUpdatePriority は 0〜5 の整数です: ${priority}`);
		}
		plan.inAppUpdatePriority = priority;
	}

	return plan;
}

function assertFraction(fraction) {
	// 0 と 1 は「割合」として無効。境界を通すとロールアウトが作られない
	if (typeof fraction !== "number" || !(fraction > 0) || !(fraction < 1)) {
		throw new Error(
			`段階公開の割合は 0 < f < 1 です: ${fraction}（全公開は 1、停止は --status halted）`,
		);
	}
	return fraction;
}

// ─────────────────────────────────────────────────────────────────────────────
// リリースノート
// ─────────────────────────────────────────────────────────────────────────────

/**
 * App Store のロケール → Play のロケール。
 *
 * 両ストアで綴りが違うものがある。取り違えると**その言語だけノートが付かない**という
 * 形で静かに失敗する（エラーにならない）ので、対応表を 1 か所に置く。
 * 知らないロケールは落とさずそのまま返す（Play 側で弾かれれば分かる）。
 */
const PLAY_LOCALES = {
	ja: "ja-JP",
	en: "en-US",
	ko: "ko-KR",
	"zh-Hans": "zh-CN",
	"zh-Hant": "zh-TW",
};

export function toPlayLocale(locale) {
	return PLAY_LOCALES[locale] ?? locale;
}

/**
 * リリースノートを送る前に検証する。
 *
 * Play は **commit のときにまとめて**落ちるため、実行箇所とエラー箇所が遠い
 * （「アップロードは成功したのに反映されない」に見える）。ここで先に弾く。
 *
 * @param {Record<string, string>} notes ロケール → 本文
 * @param {'ios' | 'android'} platform
 */
export function validateReleaseNotes(notes, platform) {
	const limit =
		platform === "android"
			? PLAY_RELEASE_NOTES_LIMIT
			: APP_STORE_WHATS_NEW_LIMIT;

	const entries = Object.entries(notes ?? {});
	if (entries.length === 0) {
		throw new Error(
			"リリースノートが空です。App Store は 2 回目以降の版で必須なので、" +
				"黙って空のまま出さないでください",
		);
	}

	for (const [locale, text] of entries) {
		if (!text || text.trim() === "") {
			throw new Error(`リリースノートが空です: ${locale}`);
		}
		// 絵文字を含む文面で数え方がずれないよう、コードポイントで数える
		const length = [...text].length;
		if (length > limit) {
			throw new Error(
				`リリースノートが上限を超えています: ${locale} は ${length} 文字（上限 ${limit}）`,
			);
		}
	}

	return notes;
}
