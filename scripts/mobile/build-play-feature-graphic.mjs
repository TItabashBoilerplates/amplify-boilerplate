/**
 * Google Play のフィーチャーグラフィック（1024x500）を生成する。
 *
 *   build-play-feature-graphic
 *
 * 正本: `frontend/apps/mobile/play.config.js` の `featureGraphic`
 * 出力: `<app>/assets/store/play-feature-graphic.png`（**リポジトリにコミットする**）
 *
 * アイコン（純粋な縮小）と違い、これは配置・書体・コピーという設計判断を含む
 * デザイン素材なので、派生物ではなく成果物として扱う。ロゴや文言を変えたら
 * 再生成して差分をレビューすること。
 *
 * 依存: ImageMagick（`devenv shell -P store-listing` で入る）
 *
 * ⚠️ ここで作れるのは**素朴な「ロゴ + 文字」**まで。凝った絵が要るなら
 *    デザインツールか画像生成モデルで作って同じパスに置けばよい
 *    （`store-push-play-listing` はファイルがあればそのまま送る）。
 *    作り方の指針は `.claude/skills/store-screenshots/`。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { APP_DIR, expo, loadAppConfig, log } from "./store-config.mjs";

const WIDTH = 1024;
const HEIGHT = 500;

const { featureGraphic: cfg } = await loadAppConfig("play");
if (!cfg) {
	throw new Error("play.config.js に featureGraphic がありません");
}

const icon = join(APP_DIR, expo.icon ?? "./assets/images/icon.png");
if (!existsSync(icon)) throw new Error(`アイコンがありません: ${icon}`);

const out = join(APP_DIR, "assets/store/play-feature-graphic.png");
mkdirSync(dirname(out), { recursive: true });

const work = mkdtempSync(join(tmpdir(), "play-feature-"));

/** ImageMagick は v7 が `magick`、v6 が `convert`。どちらでも動くようにする */
function magick(args) {
	for (const cmd of ["magick", "convert"]) {
		try {
			return execFileSync(cmd, args, { encoding: "utf8" });
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
	}
	throw new Error(
		"ImageMagick が見つかりません（devenv shell -P store-listing で入ります）",
	);
}

try {
	// 四隅から floodfill で地とドロップシャドウだけを抜く。
	// 色の全体置換にすると、ロゴ内の地に近い明色まで抜けて穴が空く。
	const mark = join(work, "logo-mark.png");
	magick([
		icon,
		"-alpha",
		"set",
		"-fuzz",
		"12%",
		"-fill",
		"none",
		"-draw",
		"alpha 0,0 floodfill",
		"-fill",
		"none",
		"-draw",
		"alpha 99999,0 floodfill",
		"-fill",
		"none",
		"-draw",
		"alpha 0,99999 floodfill",
		"-fill",
		"none",
		"-draw",
		"alpha 99999,99999 floodfill",
		"-trim",
		"+repage",
		mark,
	]);

	// フォントは環境で異なるので**名前を指定しない**（指定すると Linux で
	// "unable to read font" になる）。ImageMagick の既定フォントに任せ、
	// 日本語が要る場合は fontconfig が解決できるものが入っている前提にする。
	const subtitleLines = (cfg.subtitle ?? []).slice(0, 2);
	const args = [
		"-size",
		`${WIDTH}x${HEIGHT}`,
		`xc:${cfg.backgroundColor}`,
		"(",
		mark,
		"-resize",
		"310x310",
		")",
		"-gravity",
		"west",
		"-geometry",
		"+90+0",
		"-composite",
		"-gravity",
		"west",
		"-fill",
		cfg.titleColor,
		"-pointsize",
		"96",
		"-annotate",
		`+436${subtitleLines.length ? "-46" : "+0"}`,
		cfg.title,
	];
	subtitleLines.forEach((line, i) => {
		args.push(
			"-fill",
			cfg.subtitleColor,
			"-pointsize",
			"33",
			"-annotate",
			`+442+${36 + i * 52}`,
			line,
		);
	});
	args.push(
		// Play はアルファ付きを受け付けないので必ず不透明にする
		"-background",
		cfg.backgroundColor,
		"-alpha",
		"remove",
		"-alpha",
		"off",
		out,
	);
	magick(args);

	log(magick(["identify", "-format", "生成: %f %wx%h (%[channels])\\n", out]));
	log(`→ ${out}`);
	log("このファイルはコミットしてください（掲載用の設計素材です）");
} finally {
	rmSync(work, { recursive: true, force: true });
}
