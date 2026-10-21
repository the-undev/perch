// Generates mockups/atlas-data.js from the live scan: every field path in
// every raw source and the snapshot, with types, presence counts and real
// example values. The output carries live machine data, so it is
// gitignored like mockups/data.js. Run: node scripts/atlas-data.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scanDir = join(root, ".scan");

// Objects keyed by data rather than schema (repo full names, directory
// paths, remote names) walk as one "{}" path instead of one per key.
function isMapObject(obj, path) {
	const keys = Object.keys(obj);
	if (!keys.length) return false;
	if (keys.some((k) => k.includes("/"))) return true;
	if (path.endsWith(".remotes")) return true;
	return keys.length > 14;
}

const parentOf = (path) => {
	if (path.endsWith("[]") || path.endsWith("{}")) return path.slice(0, -2);
	const i = path.lastIndexOf(".");
	return i === -1 ? "" : path.slice(0, i);
};

function walkFile(json) {
	const stats = new Map();
	const rec = (path) => {
		let s = stats.get(path);
		if (!s) {
			s = { types: new Set(), count: 0, examples: [] };
			stats.set(path, s);
		}
		return s;
	};
	function walk(v, path) {
		const s = rec(path);
		s.count++;
		const t = v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
		s.types.add(t);
		if (t === "array") {
			const ex = `length ${v.length}`;
			if (!s.examples.includes(ex) && s.examples.length < 4) s.examples.push(ex);
			for (const e of v) walk(e, `${path}[]`);
			return;
		}
		if (t === "object") {
			if (isMapObject(v, path)) {
				const ex = `${Object.keys(v).length} keys`;
				if (!s.examples.includes(ex) && s.examples.length < 4) s.examples.push(ex);
				for (const e of Object.values(v)) walk(e, `${path}{}`);
				return;
			}
			for (const [k, e] of Object.entries(v)) walk(e, path ? `${path}.${k}` : k);
			return;
		}
		const raw = JSON.stringify(v);
		const ex = raw.length > 90 ? `${raw.slice(0, 87)}…` : raw;
		if (!s.examples.includes(ex) && s.examples.length < 4) s.examples.push(ex);
	}
	walk(json, "");
	const fields = [];
	for (const [path, s] of stats) {
		if (path === "") continue;
		const parent = stats.get(parentOf(path));
		fields.push({
			path,
			types: [...s.types].sort(),
			count: s.count,
			parentCount: parent ? parent.count : 1,
			examples: s.examples,
		});
	}
	fields.sort((a, b) => a.path.localeCompare(b.path));
	return fields;
}

const sources = [];
for (const file of readdirSync(join(scanDir, "raw")).sort()) {
	if (!file.endsWith(".json")) continue;
	const json = JSON.parse(readFileSync(join(scanDir, "raw", file), "utf8"));
	sources.push({ name: file.replace(".json", ""), file: `.scan/raw/${file}`, fields: walkFile(json) });
}
const snapshot = JSON.parse(readFileSync(join(scanDir, "snapshot.json"), "utf8"));
sources.push({ name: "snapshot (derived)", file: ".scan/snapshot.json", fields: walkFile(snapshot) });

const out = { generatedAt: new Date().toISOString(), sources };
writeFileSync(join(root, "mockups", "atlas-data.js"), `window.ATLAS = ${JSON.stringify(out, null, "\t")};\n`);
const total = sources.reduce((n, s) => n + s.fields.length, 0);
console.log(`atlas-data.js written: ${sources.length} sources, ${total} field paths`);
