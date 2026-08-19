/**
 * App Store Connect にサブスクリプショングループと商品を作る。
 *
 *   store-create-ios-subscriptions --dry-run   # POST せず計画だけ出す
 *   store-create-ios-subscriptions             # 実行
 *
 * 正本: `frontend/apps/mobile/iap.config.js`
 *
 * ## 設計
 *
 * - **冪等**。グループ・商品・ローカライズ・販売地域・価格・導入オファーは
 *   それぞれ既存を検出したら作らないので、途中で失敗しても再実行できる。
 * - 掲載文（name / description）は既存と差があれば **PATCH で揃える**。
 *   「作ったら終わり」にすると、機能を削ったのに商品説明が残って
 *   **購入直前に嘘を見せる**ことになる。
 * - `familySharable: false`。ファミリー共有の可否はアプリの権限設計に依存するので
 *   既定は無効にしてある（有効にすると後から戻せない）。
 *
 * ## 前提
 *
 * **有料 App 契約が有効**であること。未締結だと商品は MISSING_METADATA のままで、
 * StoreKit からも課金基盤（RevenueCat / Adapty）からも 1 件も返らない。
 */
import { api, apiAll, apiRaw, findApp } from "./asc-api-client.mjs";
import {
	banner,
	bundleId,
	DRY,
	inBatches,
	loadAppConfig,
	log,
	withRetry,
} from "./store-config.mjs";

const { baseTerritory, freeTrial, group, products } =
	await loadAppConfig("iap");

if (products.length === 0) {
	throw new Error(
		"iap.config.js の products が空です。\n" +
			"  販売する商品を定義してから実行してください（作成した商品 ID は後から変更できません）",
	);
}

/**
 * DRY_RUN 中に「この実行で作る予定」の ID か。
 *
 * DRY では POST しないので `create()` は `DRY_*` の偽 ID を返す。実在しない ID で
 * GET すると 404 になるため、その場合だけ読み取りを飛ばす。
 * **逆に、実在する ID の GET は DRY でも必ず行う** — 読み取りに副作用は無く、
 * 省くと既存のものまで「これから作る」と表示されて計画が嘘になる。
 */
const isPlanned = (id) => String(id).startsWith("DRY_");

async function create(label, path, body) {
	if (DRY) {
		log(
			`  [dry-run] POST ${path}  ${JSON.stringify(body.data.attributes ?? {})}`,
		);
		return { data: { id: `DRY_${label}` } };
	}
	const r = await withRetry(() => api("POST", path, body), { label });
	log(`  ✓ 作成: ${label} (id=${r.data.id})`);
	return r;
}

/**
 * 販売地域の一覧。新規アプリの既定と同じ「全世界で販売」に揃える。
 * 絞る場合は App Store Connect の各サブスクの「販売状況」から後で変更できる。
 */
let territoriesCache = null;
async function getTerritories() {
	if (!territoriesCache) {
		const r = await api("GET", "/v1/territories?limit=200");
		territoriesCache = (r.data ?? []).map((t) => ({
			type: "territories",
			id: t.id,
		}));
	}
	return territoriesCache;
}

// ── 1) アプリ ────────────────────────────────────────────────────────────────
banner("App Store: サブスクリプション商品の作成");

const app = await findApp(bundleId());
log(`アプリ: ${app.attributes.name} (id=${app.id})`);

// ── 2) サブスクリプショングループ ────────────────────────────────────────────
const groups = await api(
	"GET",
	`/v1/apps/${app.id}/subscriptionGroups?limit=50`,
);
let subscriptionGroup = groups.data?.find(
	(g) => g.attributes.referenceName === group.referenceName,
);
if (subscriptionGroup) {
	log(
		`グループ: 既存を使います "${group.referenceName}" (id=${subscriptionGroup.id})`,
	);
} else {
	log(`グループ: 新規作成 "${group.referenceName}"`);
	subscriptionGroup = (
		await create("subscriptionGroup", "/v1/subscriptionGroups", {
			data: {
				type: "subscriptionGroups",
				attributes: { referenceName: group.referenceName },
				relationships: { app: { data: { type: "apps", id: app.id } } },
			},
		})
	).data;
}

// ── 3) グループのローカライズ ────────────────────────────────────────────────
const existingGroupLocs = isPlanned(subscriptionGroup.id)
	? { data: [] }
	: await api(
			"GET",
			`/v1/subscriptionGroups/${subscriptionGroup.id}/subscriptionGroupLocalizations?limit=50`,
		);
for (const loc of group.localizations) {
	if (existingGroupLocs.data?.some((l) => l.attributes.locale === loc.locale)) {
		log(`  - グループ ${loc.locale}: 既存`);
		continue;
	}
	await create(
		`groupLocalization ${loc.locale}`,
		"/v1/subscriptionGroupLocalizations",
		{
			data: {
				type: "subscriptionGroupLocalizations",
				attributes: { name: loc.name, locale: loc.locale },
				relationships: {
					subscriptionGroup: {
						data: { type: "subscriptionGroups", id: subscriptionGroup.id },
					},
				},
			},
		},
	);
}

// ── 4) 商品 ──────────────────────────────────────────────────────────────────
const existingSubs = isPlanned(subscriptionGroup.id)
	? { data: [] }
	: await api(
			"GET",
			`/v1/subscriptionGroups/${subscriptionGroup.id}/subscriptions?limit=50`,
		);

for (const p of products) {
	log(`\n商品 ${p.productId}`);
	let sub = existingSubs.data?.find(
		(s) => s.attributes.productId === p.productId,
	);
	if (sub) {
		log(`  既存 (id=${sub.id}, state=${sub.attributes.state})`);
	} else {
		sub = (
			await create(p.productId, "/v1/subscriptions", {
				data: {
					type: "subscriptions",
					attributes: {
						name: p.referenceName,
						productId: p.productId,
						subscriptionPeriod: p.apple.subscriptionPeriod,
						familySharable: false,
						groupLevel: 1,
					},
					relationships: {
						group: {
							data: { type: "subscriptionGroups", id: subscriptionGroup.id },
						},
					},
				},
			})
		).data;
	}
	const plannedSub = isPlanned(sub.id);

	// 4-1) 商品のローカライズ（表示名・説明）— 差分があれば PATCH で揃える
	const locs = plannedSub
		? { data: [] }
		: await api(
				"GET",
				`/v1/subscriptions/${sub.id}/subscriptionLocalizations?limit=50`,
			);
	for (const loc of p.localizations) {
		const current = locs.data?.find((l) => l.attributes.locale === loc.apple);
		if (current) {
			const same =
				current.attributes.name === loc.name &&
				current.attributes.description === loc.description;
			if (same) {
				log(`  - ${loc.apple}: 既存（最新）`);
				continue;
			}
			if (DRY) {
				log(`  [dry-run] PATCH localization ${loc.apple}: ${loc.name}`);
				continue;
			}
			await api("PATCH", `/v1/subscriptionLocalizations/${current.id}`, {
				data: {
					type: "subscriptionLocalizations",
					id: current.id,
					attributes: { name: loc.name, description: loc.description },
				},
			});
			log(`  ✓ 更新: localization ${loc.apple}`);
			continue;
		}
		await create(`localization ${loc.apple}`, "/v1/subscriptionLocalizations", {
			data: {
				type: "subscriptionLocalizations",
				attributes: {
					name: loc.name,
					locale: loc.apple,
					description: loc.description,
				},
				relationships: {
					subscription: { data: { type: "subscriptions", id: sub.id } },
				},
			},
		});
	}

	// 4-2) 販売地域
	//
	// ⚠️ **価格より先に作らないと価格の POST が 409 で落ちる**
	//    （ENTITY_ERROR.RELATIONSHIP.INVALID が subscriptionPricePoint を指して返る）。
	//    価格ポイント側は正しいので原因が分かりにくい。実測で確定した順序制約。
	const availability = plannedSub
		? { status: 404 }
		: await apiRaw(
				"GET",
				`/v1/subscriptions/${sub.id}/subscriptionAvailability`,
			);
	if (availability.status === 200) {
		log("  - 販売地域: 既存");
	} else {
		const territories = await getTerritories();
		await create(
			`availability (${territories.length} 地域)`,
			"/v1/subscriptionAvailabilities",
			{
				data: {
					type: "subscriptionAvailabilities",
					attributes: { availableInNewTerritories: true },
					relationships: {
						subscription: { data: { type: "subscriptions", id: sub.id } },
						availableTerritories: { data: territories },
					},
				},
			},
		);
	}

	// 4-3) 基準地域の価格（残りの地域は store-equalize-ios-prices が展開する）
	const prices = plannedSub
		? { data: [] }
		: await api("GET", `/v1/subscriptions/${sub.id}/prices?limit=10`);
	if (prices.data?.length) {
		log(`  - 価格: 既存 ${prices.data.length} 件`);
	} else if (DRY) {
		log(
			`  [dry-run] ${baseTerritory} の価格ポイント ${p.basePrice} を検索して設定`,
		);
	} else {
		const pts = await apiAll(
			`/v1/subscriptions/${sub.id}/pricePoints?filter[territory]=${baseTerritory}&limit=200`,
		);
		const pt = pts.find(
			(x) => x.attributes.customerPrice === String(p.basePrice),
		);
		if (!pt) {
			const near = pts
				.map((x) => x.attributes.customerPrice)
				.filter((v) => Math.abs(Number(v) - Number(p.basePrice)) < 200);
			throw new Error(
				`${p.basePrice} の価格ポイントが ${baseTerritory} にありません（近い候補: ${near.join(", ") || "なし"}）`,
			);
		}
		await create(`price ${p.basePrice}`, "/v1/subscriptionPrices", {
			data: {
				type: "subscriptionPrices",
				attributes: { startDate: null, preserveCurrentPrice: false },
				relationships: {
					subscription: { data: { type: "subscriptions", id: sub.id } },
					subscriptionPricePoint: {
						data: { type: "subscriptionPricePoints", id: pt.id },
					},
				},
			},
		});
	}

	// 4-4) 導入オファー（無料トライアル）
	//
	// ⚠️ 導入オファーは **地域ごとに 1 件**。OpenAPI spec では territory が optional だが
	//    実際の API は必須（"You must provide a value for the relationship 'territory'"）。
	if (!freeTrial) {
		log("  - 導入オファー: iap.config.js で無効化されています");
		continue;
	}
	const territories = await getTerritories();
	const existing = plannedSub
		? { data: [] }
		: await api(
				"GET",
				`/v1/subscriptions/${sub.id}/introductoryOffers?include=territory&limit=200`,
			);
	const done = new Set(
		(existing.data ?? [])
			.map((o) => o.relationships?.territory?.data?.id)
			.filter(Boolean),
	);
	const todo = territories.filter((t) => !done.has(t.id));
	if (todo.length === 0) {
		log(`  - 導入オファー: 既存 ${done.size} 地域`);
	} else if (DRY) {
		log(
			`  [dry-run] 導入オファーを ${todo.length} 地域へ作成（既存 ${done.size}）  ${JSON.stringify(freeTrial.apple)}`,
		);
	} else {
		// 一気に並列で投げると 429 を貰うので少しずつ流す
		await inBatches(todo, 5, (t) =>
			withRetry(
				() =>
					api("POST", "/v1/subscriptionIntroductoryOffers", {
						data: {
							type: "subscriptionIntroductoryOffers",
							attributes: {
								...freeTrial.apple,
								startDate: null,
								endDate: null,
							},
							relationships: {
								subscription: { data: { type: "subscriptions", id: sub.id } },
								territory: { data: { type: "territories", id: t.id } },
							},
						},
					}),
				{ label: `introductoryOffer ${t.id}` },
			),
		);
		log(
			`  ✓ 導入オファー: ${todo.length} 地域に作成${done.size ? `（既存 ${done.size}）` : ""}`,
		);
	}
}

log(
	DRY
		? "\n[dry-run] 何も変更していません"
		: "\n完了しました。次は store-equalize-ios-prices で全地域へ価格を展開してください。",
);
