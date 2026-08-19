/**
 * Storybook からストア掲載用スクショを撮るときの撮影リスト。
 *
 * ⚠️ 使い分け（ここを間違えると実機と違う絵をストアに出すことになる）
 *   - 実機描画が要る画面（ネイティブ部品・shadow/elevation・セーフエリアが写るもの）
 *       → `screenshots-mobile`（Maestro + simulator/emulator）
 *   - レイアウトとトークンだけで構成され、到達しづらい状態を撮りたい画面
 *       → こちら（Storybook）。多ロケール × 多サイズを一気に回せる
 *   判断材料は `screenshots-storybook` が出す**忠実度警告**（native 部品や box-shadow を
 *   検出したら報告する）。警告が出た画面は Maestro 側で撮り直すこと。
 */

/**
 * 撮影に使う端末。**論理ポイント × DPR がストア要求ピクセルちょうどになる**組み合わせだけを置く。
 * ここを崩すと validate-screenshots.mjs で落ちる。
 */
export const devices = {
	"iphone-6-9": {
		// 440x956 pt @3x = 1320x2868 → App Store 6.9"（必須サイズ）
		width: 440,
		height: 956,
		scale: 3,
		platform: "ios",
	},
	"ipad-13": {
		// 1032x1376 pt @2x = 2064x2752 → App Store 13"
		width: 1032,
		height: 1376,
		scale: 2,
		platform: "ios",
	},
	"android-phone": {
		// 360x640 pt @3x = 1080x1920（16:9）
		// Play の「最大辺 ≤ 最小辺 x2」を満たす必要があるため 16:9 にしている。
		// 実機に多い 412x915(20:9) のまま撮ると 2.22 倍で**アップロードが弾かれる**。
		// 360dp は Android で最も一般的な幅バケットなのでレイアウト確認としても妥当。
		width: 360,
		height: 640,
		scale: 3,
		platform: "android",
	},
};

/**
 * ロケール。`browserLocale` は Playwright の context locale に渡され、
 * expo-localization が `navigator.languages` 経由で拾ってアプリの言語が切り替わる。
 * キー名は App Store Connect のロケールコード（Play 側の対応は screenshots.sh の locale_meta）。
 */
export const locales = {
	"en-US": { browserLocale: "en-US" },
	ja: { browserLocale: "ja-JP" },
};

/**
 * 撮影するストーリー。`id` は storybook-static/index.json の story id。
 * `name` が出力ファイル名になる（先頭の連番が掲載順になるので 01_, 02_ を付ける）。
 *
 * 画面（views）のストーリーを使うこと。部品単体のストーリーはストア掲載には向かない
 * （Apple のガイドライン 2.3.3「アプリが使用されている状態を示すこと」）。
 */
export const shots = [
	{
		id: "apps-mobile-views-home-ui-homescreen--default",
		name: "01-home",
		theme: "light",
	},
	{
		id: "apps-mobile-views-explore-ui-explorescreen--default",
		name: "02-explore",
		theme: "light",
	},
	{
		id: "apps-mobile-views-home-ui-homescreen--default",
		name: "03-home-dark",
		theme: "dark",
	},
];

export default { devices, locales, shots };
