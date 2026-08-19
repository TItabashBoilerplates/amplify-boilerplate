/**
 * Play のサブスクに無料トライアル（offer）を付けて有効化する。
 *
 *   store-create-play-offers --dry-run
 *   store-create-play-offers
 *
 * 正本: `frontend/apps/mobile/iap.config.js` の `freeTrial.play`
 *
 * ## iOS との構造の違い
 *
 * iOS は商品に「導入オファー」を地域ごとに 1 件ずつ足すが、Play は
 * **subscription → base plan → offer** の 3 層で、offer は base plan に紐づく。
 * 無料期間は phase（`duration` + 各地域 `free: {}`）として表現する。
 * **作成直後の offer は DRAFT** なので activate するまで適用されない。
 *
 * 地域は base plan に設定済みのものをそのまま使う。ここがずれると
 * 「販売しているのにオファーが無い地域」が生まれる。
 */
import { api, convertRegionPrices, PKG } from "./play-api-client.mjs";
import { banner, DRY, loadAppConfig, log } from "./store-config.mjs";

const { baseCurrency, freeTrial, products } = await loadAppConfig("iap");

if (!freeTrial) {
	log("iap.config.js で freeTrial が無効化されています。何もしません。");
	process.exit(0);
}
if (products.length === 0) {
	throw new Error("iap.config.js の products が空です");
}

banner("Google Play: 無料トライアル（offer）の作成");

const subs = await api("GET", `/applications/${PKG}/subscriptions?pageSize=50`);
const byId = new Map((subs.subscriptions ?? []).map((s) => [s.productId, s]));

for (const p of products) {
	const { basePlanId } = p.play;
	log(`\n${p.productId} / ${basePlanId}`);

	const sub = byId.get(p.productId);
	if (!sub) {
		throw new Error(
			"  サブスクがありません。先に store-create-play-subscriptions を実行してください",
		);
	}
	const basePlan = (sub.basePlans ?? []).find(
		(b) => b.basePlanId === basePlanId,
	);
	if (!basePlan) throw new Error(`  base plan ${basePlanId} がありません`);

	const existing = await api(
		"GET",
		`/applications/${PKG}/subscriptions/${p.productId}/basePlans/${basePlanId}/offers?pageSize=50`,
	);
	if (
		(existing.subscriptionOffers ?? []).some(
			(o) => o.offerId === freeTrial.play.offerId,
		)
	) {
		log("  既存のためスキップ");
		continue;
	}

	// base plan が販売している地域と完全に一致させる
	const regions = (basePlan.regionalConfigs ?? []).map((r) => r.regionCode);
	log(`  対象地域: ${regions.length}`);
	if (regions.length === 0) throw new Error("  base plan に地域がありません");

	// regionsVersion は価格換算 API が返す値をそのまま使う（推測しない）
	const { version: regionsVersion } = await convertRegionPrices(
		baseCurrency,
		p.basePrice,
	);

	if (DRY) {
		log(
			`  [dry-run] offer ${freeTrial.play.offerId} を作成 / ${freeTrial.play.duration} 無料 × ${regions.length} 地域` +
				`（regionsVersion=${regionsVersion}）→ activate`,
		);
		continue;
	}

	const created = await api(
		"POST",
		`/applications/${PKG}/subscriptions/${p.productId}/basePlans/${basePlanId}/offers` +
			`?offerId=${encodeURIComponent(freeTrial.play.offerId)}` +
			`&regionsVersion.version=${encodeURIComponent(regionsVersion)}`,
		{
			packageName: PKG,
			productId: p.productId,
			basePlanId,
			offerId: freeTrial.play.offerId,
			// 「アプリ内のどのサブスクも契約したことがない人」だけに配る。
			// iOS は同一サブスクグループで 1 度しか導入オファーを取れないので、
			// `thisSubscription` にすると**月額で試した人が年額でもう一度無料期間を
			// 取れて**しまい、ストア間で挙動がずれる。
			targeting: { acquisitionRule: { scope: { anySubscriptionInApp: {} } } },
			phases: [
				{
					duration: freeTrial.play.duration,
					recurrenceCount: 1,
					regionalConfigs: regions.map((regionCode) => ({
						regionCode,
						free: {},
					})),
					otherRegionsConfig: { free: {} },
				},
			],
			regionalConfigs: regions.map((regionCode) => ({
				regionCode,
				newSubscriberAvailability: true,
			})),
			otherRegionsConfig: { otherRegionsNewSubscriberAvailability: true },
		},
	);
	log(`  ✓ 作成: ${created.offerId} state=${created.state}`);

	// 作成直後は DRAFT。activate しないと適用されない
	await api(
		"POST",
		`/applications/${PKG}/subscriptions/${p.productId}/basePlans/${basePlanId}/offers/${freeTrial.play.offerId}:activate`,
		{},
	);
	log("  ✓ activate しました");
}

log(DRY ? "\n[dry-run] 何も変更していません" : "\n完了しました。");
