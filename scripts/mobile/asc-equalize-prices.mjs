/**
 * サブスク価格を、販売地域すべてへ等価価格で展開する。
 *
 *   store-equalize-ios-prices --dry-run   # 何件足すかだけ出す
 *   store-equalize-ios-prices             # 実行
 *
 * ## なぜ必要か
 *
 * `store-create-ios-subscriptions` は**基準地域の価格しか作らない**。一方で販売地域は
 * 全地域にしてあるため、**残りの地域が「販売するのに価格が無い」**状態になり、
 * 商品は永久に MISSING_METADATA のままになる。
 * ローカライズもスクリーンショットも揃っているのに解消しないので原因が分かりにくい。
 *
 * App Store Connect の画面では基準価格を選ぶと Apple が他地域を自動補完するが、
 * **API 経由ではこの補完が走らない**ので自分で展開する。
 *
 * 等価価格は Apple 自身が返す `/v1/subscriptionPricePoints/{id}/equalizations` を使う
 * （為替を自前で計算しない）。
 *
 * ## 別案
 *
 * 全世界に売らないなら、逆に販売地域を絞れば整合する。その場合は App Store Connect の
 * 各商品「販売状況」から地域を減らすこと。
 */
import { api, apiAll, findApp } from "./asc-api-client.mjs";
import {
	banner,
	bundleId,
	DRY,
	inBatches,
	loadAppConfig,
	log,
	withRetry,
} from "./store-config.mjs";

const { baseTerritory, group, products } = await loadAppConfig("iap");

if (products.length === 0) {
	throw new Error("iap.config.js の products が空です");
}

banner("App Store: 販売地域へ等価価格を展開");

const app = await findApp(bundleId());

// 商品は **productId で引く**（ASC の数値 ID を設定へ書き写すと、作り直したときに
// 古い ID を指したまま「1 地域も見つからない」形で静かに壊れる）
const groups = await api(
	"GET",
	`/v1/apps/${app.id}/subscriptionGroups?limit=50`,
);
const subscriptionGroup = groups.data?.find(
	(g) => g.attributes.referenceName === group.referenceName,
);
if (!subscriptionGroup) {
	throw new Error(
		`サブスクリプショングループ "${group.referenceName}" がありません。` +
			"先に store-create-ios-subscriptions を実行してください",
	);
}
const subs = await api(
	"GET",
	`/v1/subscriptionGroups/${subscriptionGroup.id}/subscriptions?limit=50`,
);
const byProductId = new Map(
	(subs.data ?? []).map((s) => [s.attributes.productId, s]),
);

for (const p of products) {
	log(`\n${p.productId}`);
	const sub = byProductId.get(p.productId);
	if (!sub) {
		throw new Error(
			`  App Store に商品がありません。先に store-create-ios-subscriptions を実行してください`,
		);
	}

	const availability = await api(
		"GET",
		`/v1/subscriptions/${sub.id}/subscriptionAvailability`,
	);
	const availabilityId = availability.data?.id;
	if (!availabilityId) {
		throw new Error("  販売地域が未設定です。先に販売地域を作ってください");
	}
	const territories = await apiAll(
		`/v1/subscriptionAvailabilities/${availabilityId}/availableTerritories?limit=200`,
	);
	log(`  販売地域: ${territories.length}`);

	// ⚠️ `include=territory` を付けないと relationships.territory.data が空で返る
	//    （links だけになる）。付け忘れると「1 地域も見つからない」状態になる。
	const priced = new Set(
		(
			await apiAll(
				`/v1/subscriptions/${sub.id}/prices?limit=200&include=territory`,
			)
		)
			.map((x) => x.relationships?.territory?.data?.id)
			.filter(Boolean),
	);
	log(`  価格あり: ${priced.size} 地域`);
	if (!priced.has(baseTerritory)) {
		throw new Error(`  基準地域 ${baseTerritory} の価格がありません`);
	}

	// 基準の price point は「その商品の基準地域の価格ポイントのうち金額が一致するもの」で引く
	// （価格 → price point の relationship は list 応答から辿れないため）
	const basePoints = await apiAll(
		`/v1/subscriptions/${sub.id}/pricePoints?filter[territory]=${baseTerritory}&limit=200`,
	);
	const basePointId = basePoints.find(
		(x) => x.attributes.customerPrice === String(p.basePrice),
	)?.id;
	if (!basePointId) {
		throw new Error(
			`  ${p.basePrice} の価格ポイントが ${baseTerritory} にありません`,
		);
	}

	// Apple が返す等価価格（為替は自前で計算しない）
	const equalizations = await apiAll(
		`/v1/subscriptionPricePoints/${basePointId}/equalizations?include=territory&limit=200`,
	);
	const pointByTerritory = new Map();
	for (const pt of equalizations) {
		const t = pt.relationships?.territory?.data?.id;
		if (t) pointByTerritory.set(t, pt.id);
	}
	log(`  等価価格が取れた地域: ${pointByTerritory.size}`);

	const todo = territories
		.map((t) => t.id)
		.filter((t) => !priced.has(t))
		.map((t) => ({ territory: t, pointId: pointByTerritory.get(t) }));

	const missing = todo.filter((x) => !x.pointId).map((x) => x.territory);
	const doable = todo.filter((x) => x.pointId);
	if (missing.length) {
		// 黙って減らさない
		log(
			`  ⚠️ 等価価格が無く設定できない地域 ${missing.length}: ${missing.join(", ")}`,
		);
	}
	if (doable.length === 0) {
		log("  追加する地域はありません");
		continue;
	}
	if (DRY) {
		log(`  [dry-run] ${doable.length} 地域へ価格を追加します`);
		continue;
	}

	await inBatches(doable, 5, (x) =>
		withRetry(
			() =>
				api("POST", "/v1/subscriptionPrices", {
					data: {
						type: "subscriptionPrices",
						relationships: {
							subscription: { data: { type: "subscriptions", id: sub.id } },
							subscriptionPricePoint: {
								data: { type: "subscriptionPricePoints", id: x.pointId },
							},
							territory: { data: { type: "territories", id: x.territory } },
						},
					},
				}),
			{ label: `price ${x.territory}` },
		),
	);
	log(`  ✓ ${doable.length} 地域へ価格を追加しました`);

	const after = await api("GET", `/v1/subscriptions/${sub.id}`);
	log(`  状態: ${after.data.attributes.state}`);
}

log(DRY ? "\n[dry-run] 何も変更していません" : "\n完了しました。");
