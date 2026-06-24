#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * MCP 設定の一元管理ジェネレータ。
 *
 * 正本 = リポジトリ root の `.mcp.json`（Claude Code が直接読む形式）。
 * ここを編集して devenv の `mcp-sync` script を実行すると、各エージェントの
 * 設定形式へ投影する:
 *   - .cursor/mcp.json       (JSON, mcpServers)     … マージ（他キー保持）
 *   - .codex/config.toml     (TOML, [mcp_servers.*]) … 全体再生成
 *
 * 各ツールは読む設定ファイルと形式が異なる（Codex は TOML）ため単一ファイルの共有は
 * 不可。本スクリプトが形式差を吸収する。
 *
 * 対象外:
 *   - Claude Code … .mcp.json を直接読む（正本そのもの）
 *   - Antigravity（旧 Gemini CLI の後継）… ワークスペーススキルは .agents/skills/、MCP は
 *     グローバル ~/.gemini/config/mcp_config.json でリポジトリ管理外。`.gemini/` は廃止済み。
 *
 * 直接 `deno run` せず、devenv の `mcp-sync` から実行すること（.claude/rules/commands.md）。
 * 生成物は手動編集禁止（.claude/rules/auto-generated.md）。MCP を追加/変更する時は
 * `.mcp.json` を編集して `mcp-sync` を再実行する。
 */

// Deno ランタイムで実行する（`deno run`）。非 Deno の TS サーバ向けに最小宣言を置く。
// 実行時は本物の Deno グローバルが使われる。
declare const Deno: {
	cwd(): string;
	readTextFileSync(path: string): string;
	writeTextFileSync(path: string, data: string): void;
	statSync(path: string): unknown;
};

type Server = {
	type?: string;
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	url?: string;
	headers?: Record<string, string>;
};
type McpJson = { mcpServers?: Record<string, Server> };

const root = `${Deno.cwd()}/`; // devenv の mcp-sync が cd "$DEVENV_ROOT" 済み
const read = (p: string) => Deno.readTextFileSync(root + p);
const fileExists = (p: string): boolean => {
	try {
		Deno.statSync(root + p);
		return true;
	} catch {
		return false;
	}
};

const isStdio = (s: Server): boolean => Boolean(s.command);
const nonEmpty = (o?: Record<string, string>) =>
	o && Object.keys(o).length > 0 ? o : undefined;
const clean = <T extends Record<string, unknown>>(o: T): Partial<T> =>
	Object.fromEntries(
		Object.entries(o).filter(([, v]) => v !== undefined),
	) as Partial<T>;

// ---- 形式別トランスフォーム ----
function toCursor(s: Server) {
	// Cursor は command→stdio / url→remote を推論。type は不要。
	if (isStdio(s))
		return clean({ command: s.command, args: s.args, env: nonEmpty(s.env) });
	return clean({ url: s.url, headers: nonEmpty(s.headers) });
}
function toCodex(s: Server) {
	if (isStdio(s))
		return clean({ command: s.command, args: s.args, env: nonEmpty(s.env) });
	return clean({ type: "http", url: s.url, headers: nonEmpty(s.headers) });
}

// ---- JSON 書き出し（mcpServers のみ差し替え、他キーは保持）----
function writeJsonMerge(path: string, mcpServers: Record<string, unknown>) {
	let base: Record<string, unknown> = {};
	if (fileExists(path)) {
		try {
			base = JSON.parse(read(path)) as Record<string, unknown>;
		} catch {
			base = {};
		}
	}
	base.mcpServers = mcpServers;
	Deno.writeTextFileSync(root + path, `${JSON.stringify(base, null, 2)}\n`);
}

// ---- TOML 書き出し（本ジェネレータが出す限定スキーマのみ対応）----
const tomlStr = (s: string) =>
	`"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const tomlKey = (k: string) => (/^[A-Za-z0-9_-]+$/.test(k) ? k : tomlStr(k));
const tomlArr = (a: string[]) => `[${a.map(tomlStr).join(", ")}]`;
const tomlInline = (o: Record<string, string>) =>
	`{ ${Object.entries(o)
		.map(([k, v]) => `${tomlKey(k)} = ${tomlStr(v)}`)
		.join(", ")} }`;

function writeCodex(
	path: string,
	transformed: Record<string, Record<string, unknown>>,
) {
	let out =
		"# 自動生成ファイル — 手動編集禁止（.claude/rules/auto-generated.md）。\n" +
		"# 正本は リポジトリ root の .mcp.json。変更は .mcp.json を編集して `mcp-sync` を実行。\n" +
		"# Codex は MCP 設定を TOML（[mcp_servers.*]）で読むため Claude の .mcp.json から投影している。\n\n";
	for (const [name, s] of Object.entries(transformed)) {
		out += `[mcp_servers.${tomlKey(name)}]\n`;
		if (s.command) out += `command = ${tomlStr(s.command as string)}\n`;
		if (s.args) out += `args = ${tomlArr(s.args as string[])}\n`;
		if (s.type) out += `type = ${tomlStr(s.type as string)}\n`;
		if (s.url) out += `url = ${tomlStr(s.url as string)}\n`;
		if (s.env) out += `env = ${tomlInline(s.env as Record<string, string>)}\n`;
		if (s.headers)
			out += `headers = ${tomlInline(s.headers as Record<string, string>)}\n`;
		out += "\n";
	}
	Deno.writeTextFileSync(root + path, out);
}

// ---- 実行 ----
const source: McpJson = JSON.parse(read(".mcp.json"));
const servers = source.mcpServers ?? {};
const entries = Object.entries(servers);

const map = (fn: (s: Server) => unknown) =>
	Object.fromEntries(entries.map(([n, s]) => [n, fn(s)]));

writeJsonMerge(".cursor/mcp.json", map(toCursor));
writeCodex(
	".codex/config.toml",
	map(toCodex) as Record<string, Record<string, unknown>>,
);

console.log(
	`✅ mcp-sync: ${entries.length} servers (${entries.map(([n]) => n).join(", ")}) ` +
		`→ .cursor/mcp.json, .codex/config.toml`,
);
