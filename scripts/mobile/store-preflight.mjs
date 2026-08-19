/**
 * リリース前に「**人が画面で入力するしかないもの**」を、入力すべき値つきで一覧にする。
 *
 *   store-preflight              # 人が読む形
 *   store-preflight --json       # 機械が読む形
 *
 * **ネットワークも資格情報も要らない**（リポジトリの設定だけを読む）ので、
 * ストアのアカウントが無い段階でも実行できる。
 *
 * ## なぜ要るのか
 *
 * ストア提出でつまずく原因の多くは「コードの不備」ではなく
 * **「コンソールで答えていない申告がある」**ことで、しかもこれらは
 * **エラーではなく『提出ボタンが押せない』『反映されない』という形**で出る。
 * どの画面の何を埋めればよいかが分からないまま時間が溶ける。
 *
 * ここでは「何を・どこで・どんな値で」入力するかを具体的に出す。
 * 値はこのリポジトリの設定（app.json / store.config.js / package.json の依存）から
 * 引くので、**そのまま画面に写せる**。
 *
 * ## 自動化できるものはここに出さない
 *
 * 公式 API があるものは script 側でやる。ここに載るのは
 * **公開 API が本当に存在しないもの**だけ。
 *
 * | 項目 | API | 手段 |
 * |---|---|---|
 * | 年齢レーティング | **あり**（ageRatingDeclarations） | `mobile-metadata`（store.config.js の `advisory`） |
 * | Play の Data safety | **あり**（applications.dataSafety） | `store-push-data-safety` |
 * | Play のテスター登録 | **あり**（edits.testers） | Play Console か API（Google グループ単位） |
 * | 輸出コンプライアンス | **あり**（Info.plist） | `app.json` の `ios.config.usesNonExemptEncryption` |
 * | **App Privacy（Apple）** | **無し** | ← ここに出す |
 * | **EU DSA トレーダーステータス** | **無し** | ← ここに出す |
 * | **Play のコンテンツレーティング / 対象年齢** | **無し** | ← ここに出す |
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { APP_DIR, expo, log } from "./store-config.mjs";

const JSON_OUT = process.argv.includes("--json");

// ─────────────────────────────────────────────────────────────────────────────
// リポジトリから「入力すべき値」を集める
// ─────────────────────────────────────────────────────────────────────────────

const bundleId = expo?.ios?.bundleIdentifier ?? null;
const packageName = expo?.android?.package ?? null;
const appName = expo?.name ?? null;
const version = expo?.version ?? null;
const supportsTablet = expo?.ios?.supportsTablet === true;

/** 依存から「何を集めているか」を推定する。App Privacy の申告漏れが一番多いので */
function detectDataCollectors() {
	const pkgPath = join(APP_DIR, "package.json");
	if (!existsSync(pkgPath)) return [];
	const deps = {
		...JSON.parse(readFileSync(pkgPath, "utf8")).dependencies,
	};
	const has = (re) => Object.keys(deps).some((d) => re.test(d));

	/**
	 * 「この依存があるなら、この種類のデータを申告する必要が高い」という対応。
	 * **断定はしない**（実際に何を送るかは実装次第）。漏れやすいものを挙げて
	 * 人が判断できるようにするのが目的。
	 */
	const table = [
		{
			when: /expo-notifications|@aws-amplify\/pushnotification/i,
			sdk: "プッシュ通知（Pinpoint / AWS End User Messaging）",
			declare: "Identifiers（デバイスID / プッシュトークン）, Usage Data",
			note: "エンドポイントに Cognito の userId（sub）を紐付けているなら User ID も申告する",
		},
		{
			when: /@sentry|sentry-expo/i,
			sdk: "Sentry",
			declare: "Diagnostics（クラッシュログ / パフォーマンス）",
			note: "エラー内容にユーザー情報を載せているなら該当項目も追加する",
		},
		{
			when: /^aws-amplify$|@aws-amplify\//i,
			sdk: "AWS Amplify（Cognito / AppSync + DynamoDB / S3）",
			declare: "Contact Info（メールアドレス）, Identifiers（ユーザーID）",
			note: "認証を使うなら必須。a.schema に持たせているプロフィール項目もすべて申告する",
		},
		{
			when: /amazon-chime-sdk|livekit/i,
			sdk: "通話 / 会議 SDK",
			declare: "Audio Data / Video（通話中の音声・映像）",
			note: "録音・録画して保存するのかどうかで申告が変わる",
		},
		{
			when: /revenuecat|react-native-purchases|adapty/i,
			sdk: "課金 SDK",
			declare: "Purchases（購入履歴）, Identifiers",
			note: "",
		},
		{
			when: /@polar-sh|stripe/i,
			sdk: "決済 SDK（Polar 等）",
			declare: "Financial Info（支払い情報）, Purchases",
			note: "",
		},
		{
			when: /posthog|amplitude|mixpanel|firebase-analytics/i,
			sdk: "解析 SDK",
			declare: "Usage Data, Identifiers",
			note: "トラッキングに当たるなら ATT の同意も要る（AWS 既定は Pinpoint）",
		},
		{
			when: /expo-location/i,
			sdk: "expo-location",
			declare: "Location（正確 / おおよそ）",
			note: "バックグラウンド取得があるなら Play で事前開示画面が別途必要",
		},
		{
			when: /expo-camera|expo-image-picker/i,
			sdk: "カメラ / 写真",
			declare: "Photos or Videos",
			note: "第三者 AI へ送るなら事前同意が必須（store-review.md §1）",
		},
		{
			when: /expo-contacts/i,
			sdk: "expo-contacts",
			declare: "Contacts",
			note: "",
		},
	];

	return table.filter((t) => has(t.when));
}

const collectors = detectDataCollectors();

/** 法務 URL は store.config.js が持っている。無いと App Privacy を出せない */
async function legalUrls() {
	try {
		const { loadAppConfig } = await import("./store-config.mjs");
		const cfg = await loadAppConfig("store");
		const first = Object.values(cfg.apple?.info ?? {})[0];
		return {
			privacyPolicyUrl: first?.privacyPolicyUrl ?? null,
			supportUrl: first?.supportUrl ?? null,
		};
	} catch {
		// STORE_WEB_BASE_URL 未設定だと意図的に落ちる。ここでは「未設定」として扱う
		return { privacyPolicyUrl: null, supportUrl: null };
	}
}

const urls = await legalUrls();

// ─────────────────────────────────────────────────────────────────────────────
// 手作業が要る項目（公開 API が存在しないもの）
// ─────────────────────────────────────────────────────────────────────────────

const manual = [
	{
		id: "apple-dsa-trader",
		store: "App Store",
		title: "EU DSA トレーダーステータスの申告",
		blocking: "EU 27 か国で販売停止（審査では弾かれないので気づけない）",
		where:
			"App Store Connect → 上部の Business → Agreements タブ → Compliance →\n" +
			"    Digital Services Act の「Complete Compliance Requirements」",
		role: "Account Holder または Admin",
		inputs: [
			"事業者区分（トレーダー / 非トレーダー）※ EU に配信しなくても申告は必要",
			"法人の場合: 電話番号・メールアドレス（住所は D-U-N-S から自動入力）",
			"個人の場合: 住所または私書箱・電話番号・メールアドレス",
			"支払い口座情報（未入力の場合）",
			"EU 法への適合の証明（チェック）",
			"事業者名と住所を確認できる書類",
		],
		note: "2025-02-17 以降、新規提出にも更新にも必須。公開される連絡先なので個人開発者は私書箱の利用を検討する",
	},
	{
		id: "apple-app-privacy",
		store: "App Store",
		title: "App Privacy（プライバシーラベル）の回答",
		blocking: "未回答だと審査に提出できない",
		where:
			"App Store Connect → 対象アプリ → App Privacy → 「Get Started」/ 「Edit」",
		role: "Account Holder / Admin / App Manager",
		inputs: [
			"収集するデータの種類（下の「申告が要りそうなもの」を参照）",
			"各データの用途（App Functionality / Analytics / Product Personalization 等）",
			"ユーザーに紐づくか（Linked to You）/ トラッキングに使うか",
			urls.privacyPolicyUrl
				? `プライバシーポリシー URL: ${urls.privacyPolicyUrl}`
				: "プライバシーポリシー URL ※ store.config.js の privacyPolicyUrl が未設定",
		],
		note:
			"**公式 API が無い**（fastlane にはアップロード機能があるが、API キーではなく " +
			"Apple ID のパスワードと 2FA を要求する非公式 API を使うため、本リポジトリでは採用しない）。\n" +
			"    ios/PrivacyInfo.xcprivacy（privacy manifest）とは**別物**で、両方必要",
	},
	{
		id: "play-content-rating",
		store: "Google Play",
		title: "コンテンツレーティング（IARC アンケート）",
		blocking: "未回答だと公開できない",
		where:
			"Play Console → 対象アプリ → ポリシー → アプリのコンテンツ → コンテンツのレーティング",
		role: "アプリへの権限を持つユーザー",
		inputs: [
			"メールアドレス（IARC からの連絡先）",
			"アプリのカテゴリ",
			"暴力 / 性的表現 / 不適切な言葉 / 薬物 / ギャンブルの有無に関するアンケート",
		],
		note: "Play Developer API にコンテンツレーティングのエンドポイントは無い（discovery document で確認済み）",
	},
	{
		id: "play-target-audience",
		store: "Google Play",
		title: "対象年齢とコンテンツ / その他のアプリのコンテンツ申告",
		blocking: "未回答だと公開できない",
		where: "Play Console → 対象アプリ → ポリシー → アプリのコンテンツ",
		role: "アプリへの権限を持つユーザー",
		inputs: [
			"対象年齢層",
			"広告の有無",
			"ニュースアプリ / 金融商品 / 健康 に該当するかの申告",
			"アプリのアクセス権（ログインが要るなら審査用アカウント）",
		],
		note: "データセーフティだけは API があるので store-push-data-safety を使う（ここでは不要）",
	},
];

/** アカウント側の一度きりの作業。該当しないこともあるので条件つきで出す */
const accountLevel = [
	{
		id: "apple-paid-apps",
		store: "App Store",
		title: "有料 App 契約（Paid Applications Agreement）の締結",
		when: "アプリ内課金 / 有料アプリを出す場合",
		blocking: "サブスク商品が永久に MISSING_METADATA のままになる",
		where: "App Store Connect → Business → Agreements",
		role: "Account Holder のみ",
	},
	{
		id: "play-closed-testing",
		store: "Google Play",
		title: "クローズドテスト（12 人 × 14 日間の継続参加）",
		when: "2023-11-13 以降に作成した**個人**アカウントの場合（組織アカウントは対象外）",
		blocking: "本番公開を申請できない",
		where: "Play Console → テストとリリース → テスト → クローズドテスト",
		role: "アプリへの権限を持つユーザー",
		note:
			"テスターの登録自体は API（edits.testers）で Google グループ単位に自動化できるが、\n" +
			"    **14 日間の継続参加そのもの**は自動化できない。却下理由の最多は\n" +
			"    「テスト参加が不十分」＝インストールされただけで使われていないこと",
	},
	{
		id: "play-developer-verification",
		store: "Google Play",
		title: "Android デベロッパー認証",
		when: "2026-09-30 以降、対象国（ブラジル / インドネシア / シンガポール / タイ）から順次",
		blocking: "対象国の認証済み端末へのインストールが制限される",
		where: "Play Console の案内に従う",
		role: "Account Holder",
	},
];

// ─────────────────────────────────────────────────────────────────────────────
// 出力
// ─────────────────────────────────────────────────────────────────────────────

const report = {
	app: { appName, version, bundleId, packageName, supportsTablet },
	detectedCollectors: collectors.map((c) => ({
		sdk: c.sdk,
		declare: c.declare,
		note: c.note,
	})),
	manual,
	accountLevel,
};

if (JSON_OUT) {
	console.log(JSON.stringify(report, null, 2));
	process.exit(0);
}

log("\n══════════════════════════════════════════════════════════════════");
log(" 人が画面で入力するしかない項目（公開 API が存在しないもの）");
log("══════════════════════════════════════════════════════════════════");
log(
	`\nアプリ: ${appName ?? "(app.json に name が無い)"} ${version ?? ""}\n` +
		`  iOS     : ${bundleId ?? "⚠ expo.ios.bundleIdentifier が未設定"}\n` +
		`  Android : ${packageName ?? "⚠ expo.android.package が未設定"}` +
		`${supportsTablet ? "\n  ※ supportsTablet=true のため iPad のスクリーンショットが必須" : ""}`,
);

for (const item of manual) {
	log(`\n──────────────────────────────────────────────────────────────────`);
	log(`[${item.store}] ${item.title}`);
	log(`  未対応だと: ${item.blocking}`);
	log(`  場所: ${item.where}`);
	log(`  権限: ${item.role}`);
	log("  入力する値:");
	for (const i of item.inputs) log(`    - ${i}`);
	if (item.note) log(`  補足: ${item.note}`);
}

if (collectors.length > 0) {
	log(`\n──────────────────────────────────────────────────────────────────`);
	log("App Privacy / Data safety で申告が要りそうなもの（依存から推定）");
	log("  ※ 実際に何を送るかは実装次第。**これは下書きであって答えではない**");
	for (const c of collectors) {
		log(`\n  ${c.sdk}`);
		log(`    → ${c.declare}`);
		if (c.note) log(`      ${c.note}`);
	}
}

log(`\n──────────────────────────────────────────────────────────────────`);
log("アカウント側の作業（該当する場合のみ・一度きり）");
for (const item of accountLevel) {
	log(`\n[${item.store}] ${item.title}`);
	log(`  対象: ${item.when}`);
	log(`  未対応だと: ${item.blocking}`);
	log(`  場所: ${item.where}（権限: ${item.role}）`);
	if (item.note) log(`  補足: ${item.note}`);
}

log(`\n──────────────────────────────────────────────────────────────────`);
log("これ以外は自動化済み。コマンドで実行できる:");
log(
	"  年齢レーティング     mobile-metadata（store.config.js の apple.advisory）",
);
log("  Data safety          store-push-data-safety");
log(
	"  輸出コンプライアンス  app.json の ios.config.usesNonExemptEncryption（設定済み）",
);
log("  掲載情報 / 画像 / 課金 store-push-* / store-create-*");
log(
	"  配布 / 審査 / 公開    store-testflight / store-submit-ios / store-release-play",
);
log("\n手順の正本: docs/store/release-runbook.md\n");
