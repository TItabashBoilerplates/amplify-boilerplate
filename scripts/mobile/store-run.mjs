/**
 * ストア反映スクリプトの起動ラッパ。
 *
 *   node store-run.mjs <スクリプト名.mjs>
 *
 * 目的は 1 つだけ: **失敗を読める形で出す**こと。
 *
 * 反映スクリプトはトップレベル await のモジュールなので、設定不足（bundle id が無い、
 * 資格情報が無い）や API エラーがモジュール評価中の throw になり、素の node だと
 * 生のスタックトレースが出る。実行するのは運用者（と AI）で、見たいのは
 * 「何が足りないか」なので、ここで整形して exit 1 する。
 *
 * ⚠️ ハンドラは**対象を import する前に**入れる必要がある（import 時点の throw を
 *    捕まえるため）。対象の import を静的に書くとハンドラより先に評価されてしまうので、
 *    動的 import にしてある。
 */
import { pathToFileURL } from "node:url";

const fail = (error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`\n[0;31m✗[0m ${message}`);
	// 原因の切り分けに要るので、スタックは要求されたときだけ出す
	if (process.env.STORE_DEBUG === "1" && error instanceof Error) {
		console.error(error.stack);
	} else {
		console.error(
			"  （詳細なスタックが要るときは STORE_DEBUG=1 を付けて再実行）",
		);
	}
	process.exit(1);
};

process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);

const target = process.argv[2];
if (!target) {
	console.error("usage: store-run.mjs <script.mjs> [args...]");
	process.exit(2);
}

/**
 * 自分の引数（対象スクリプト名）を argv から抜く。
 *
 * これをしないと、対象スクリプトの `process.argv.slice(2)` の先頭に
 * `asc-testflight.mjs` のようなファイル名が混ざる。**エラーにはならず**、
 * 「オプションを渡したのに効かない」形で静かに壊れるので必ず取り除く。
 */
process.argv.splice(2, 1);

await import(pathToFileURL(new URL(target, import.meta.url).pathname).href);
