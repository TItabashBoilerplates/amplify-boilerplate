/**
 * Google Play にサブスクリプションを作る（iOS と同じ商品 ID）。
 *
 *   store-create-play-subscriptions --dry-run   # 何を作るか出すだけ
 *   store-create-play-subscriptions             # 実行
 *
 * 正本: `frontend/apps/mobile/iap.config.js`
 *
 * ## 設計
 *
 * - **冪等**。既存の productId は作り直さない。ただし掲載文（listings）が設定と
 *   食い違っていたら PATCH で揃える（**実装から機能を消したのに商品説明が残る**のを防ぐ）。
 *   価格・基本プランには触れない。
 * - 地域価格は `pricing:convertRegionPrices` に基準価格を渡して
 *   **Google 自身に換算させる**（為替を自前計算しない）。iOS 側で Apple の
 *   equalizations を使ったのと同じ考え方。
 * - `regionsVersion` は換算 API の応答に入っている値をそのまま使う（推測しない）。
 *
 * ## iOS との構造の違い
 *
 * Play は subscription → base plan → offer の 3 層。無料トライアルは base plan に
 * 紐づく **offer** なので、本スクリプトでは作らない（`store-create-play-offers`）。
 * また **作成直後の base plan は DRAFT** で、Play Console で有効化するまで購入できない。
 */
import { api, convertRegionPrices, PKG } from "./play-api-client.mjs";
import { banner, DRY, loadAppConfig, log } from "./store-config.mjs";

const { baseCurrency, products } = await loadAppConfig("iap");

if (products.length === 0) {
	throw new Error(
		"iap.config.js の products が空です。\n" +
			"  販売する商品を定義してから実行してください（作成した商品 ID は後から変更できません）",
	);
}

/** iap.config.js の localizations を Play の listings 形へ変換する */
const playListings = (p) =>
	p.localizations.map((l) => ({
		languageCode: l.play,
		title: l.name,
		benefits: l.benefits ?? [],
		description: l.description,
	}));

/**
 * listings が設定と食い違っていないか。
 * 既存をただスキップすると、掲載文が永久にずれたままになる。
 */
function listingsDiffer(current = [], want = []) {
	const key = (l) => JSON.stringify([l.title, l.benefits ?? [], l.description]);
	const byLang = new Map(current.map((l) => [l.languageCode, l]));
	return want.some((l) => {
		const c = byLang.get(l.languageCode);
		return !c || key(c) !== key(l);
	});
}

banner("Google Play: サブスクリプション商品の作成");
log(`パッケージ: ${PKG}`);

const existing = await api(
	"GET",
	`/applications/${PKG}/subscriptions?pageSize=100`,
);
const existingById = new Map(
	(existing.subscriptions ?? []).map((s) => [s.productId, s]),
);
log(`既存のサブスク: ${existingById.size} 件`);

for (const p of products) {
	log(`\n${p.productId}`);
	const want = playListings(p);
	const current = existingById.get(p.productId);

	if (current) {
		if (!listingsDiffer(current.listings, want)) {
			log("  既存・掲載文も最新のためスキップ");
			continue;
		}
		// listings だけを更新する。価格・基本プランには触れない。
		// regionsVersion は掲載文だけ直す場合でも必須クエリパラメータ（Play API の仕様）
		const { version } = await convertRegionPrices(baseCurrency, p.basePrice);
		if (DRY) {
			log(`  [dry-run] 掲載文を更新（regionsVersion=${version}）`);
			for (const l of want) log(`  [dry-run]   ${l.languageCode}: ${l.title}`);
			continue;
		}
		await api(
			"PATCH",
			`/applications/${PKG}/subscriptions/${encodeURIComponent(p.productId)}` +
				`?updateMask=listings&regionsVersion.version=${encodeURIComponent(version)}`,
			{ packageName: PKG, productId: p.productId, listings: want },
		);
		log("  ✓ 掲載文を更新しました");
		continue;
	}

	const { converted, version: regionsVersion } = await convertRegionPrices(
		baseCurrency,
		p.basePrice,
	);
	const regionMap = converted.convertedRegionPrices ?? {};
	const other = converted.convertedOtherRegionsPrice;

	const regionalConfigs = Object.values(regionMap).map((r) => ({
		regionCode: r.regionCode,
		newSubscriberAvailability: true,
		price: r.price,
	}));
	log(
		`  換算: ${regionalConfigs.length} 地域 / regionsVersion=${regionsVersion}` +
			`${other ? ` / other=USD ${other.usdPrice?.units}, EUR ${other.eurPrice?.units}` : ""}`,
	);

	if (DRY) {
		log(
			`  [dry-run] 作成: basePlan=${p.play.basePlanId} (${p.play.billingPeriodDuration}) / listings=${want.length}`,
		);
		continue;
	}

	const created = await api(
		"POST",
		`/applications/${PKG}/subscriptions?productId=${encodeURIComponent(p.productId)}` +
			`&regionsVersion.version=${encodeURIComponent(regionsVersion)}`,
		{
			packageName: PKG,
			productId: p.productId,
			listings: want,
			basePlans: [
				{
					basePlanId: p.play.basePlanId,
					autoRenewingBasePlanType: {
						billingPeriodDuration: p.play.billingPeriodDuration,
					},
					regionalConfigs,
					...(other
						? {
								otherRegionsConfig: {
									usdPrice: other.usdPrice,
									eurPrice: other.eurPrice,
									newSubscriberAvailability: true,
								},
							}
						: {}),
				},
			],
		},
	);
	log(`  ✓ 作成: ${created.productId}`);
	for (const bp of created.basePlans ?? []) {
		log(`    basePlan ${bp.basePlanId}: state=${bp.state}`);
	}
}

log(
	DRY
		? "\n[dry-run] 何も変更していません"
		: "\n完了しました。**作成直後の base plan は DRAFT** です。" +
				"Play Console で有効化し、無料トライアルは store-create-play-offers を実行してください。",
);
