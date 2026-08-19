/**
 * Google Play の Data safety（データセーフティ）申告を CSV から反映する。
 *
 *   store-push-data-safety --dry-run
 *   store-push-data-safety
 *   store-push-data-safety --file path/to/data-safety.csv
 *
 * ## これは API で自動化できる（よく「できない」と誤解されている）
 *
 * Data safety は Play Console の画面で答えるものだと思われがちだが、
 * **公式の Play Developer API に専用エンドポイントがある**:
 *
 *   POST /androidpublisher/v3/applications/{packageName}/dataSafety
 *   { "safetyLabels": "<CSV の中身>" }
 *
 * （Google の API discovery document に `applications.dataSafety` として載っている。
 *   説明文は "Writes the Safety Labels declaration of an app."）
 *
 * **edits のトランザクションには乗らない**点に注意。ここだけは edit を開かずに
 * 直接 POST し、**成功した時点で即座に反映される**（commit も rollback も無い）。
 *
 * ## CSV はどこから持ってくるか
 *
 * 中身は Play Console が入出力するものと同じ形式で、**自分で書き起こさない**:
 *
 *   Play Console → アプリ → ポリシー → アプリのコンテンツ → データセーフティ
 *     → 「CSV にエクスポート」で現在の回答を落とす（テンプレートもここから取れる）
 *
 * 一度エクスポートしてリポジトリに置けば、以降はそのファイルが正本になり、
 * **申告内容が Git の履歴に残る**（画面で答えると誰がいつ何を変えたか追えない）。
 *
 * ⚠️ **申告内容は実装と一致していなければならない。** Google は APK と SDK の実際の
 * 挙動を申告と突き合わせており、食い違うと**アプリの削除やアカウントの警告**につながる。
 * SDK を足したら（広告 / 解析 / クラッシュレポート / プッシュ）この CSV も更新する。
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { api, PKG } from "./play-api-client.mjs";
import { APP_DIR, banner, DRY, log } from "./store-config.mjs";

const args = process.argv.slice(2);
const value = (name) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : undefined;
};

/** 既定の置き場。派生プロジェクトはここに Play からエクスポートした CSV を置く */
const DEFAULT_PATH = join(APP_DIR, "store-listing", "play-data-safety.csv");
const csvPath = value("file") ?? DEFAULT_PATH;

banner("Google Play: Data safety の申告");

if (!existsSync(csvPath)) {
	throw new Error(
		`Data safety の CSV がありません: ${csvPath}\n\n` +
			"  取得方法（Play Console でこの操作だけ human が必要。以降は CSV が正本）:\n" +
			"    1. Play Console → 対象アプリ → ポリシー → アプリのコンテンツ\n" +
			"    2. 「データセーフティ」→ 開始 / 管理\n" +
			"    3. 右上の「CSV にエクスポート」でダウンロード\n" +
			`    4. ${csvPath} に置く\n\n` +
			"  --file で別のパスも指定できます",
	);
}

const safetyLabels = readFileSync(csvPath, "utf8");

if (safetyLabels.trim() === "") {
	throw new Error(`CSV が空です: ${csvPath}`);
}

// 行数だけ出す。中身は申告内容（＝公開情報だが量が多い）なのでログに流さない
const rows = safetyLabels.trim().split(/\r?\n/).length;
log(`CSV: ${csvPath}（${rows} 行）`);

if (DRY) {
	log(
		"\n[dry-run] POST /applications/" +
			`${PKG}/dataSafety を実行しません\n` +
			"  ⚠️ このエンドポイントは edits のトランザクションに乗りません。\n" +
			"     実行すると commit 無しでその場で反映されます（取り消せません）",
	);
	process.exit(0);
}

await api("POST", `/applications/${PKG}/dataSafety`, { safetyLabels });

log(
	"\n✓ Data safety を反映しました\n" +
		"  Play Console の「アプリのコンテンツ」で内容を確認できます\n" +
		"  ⚠️ 申告は実装と一致している必要があります（SDK を足したら CSV も更新する）",
);
