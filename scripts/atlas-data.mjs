// Generates mockups/atlas-data.js from the live scan: every field path in
// every raw source and the snapshot, with observed types, presence counts,
// real example values, and the declared type resolved from src/raw.ts and
// src/snapshot.ts through the TypeScript checker, so the possibilities
// show alongside what this machine happens to contain. The checker also
// drives the walk: an object whose declared type has a string index
// signature (a Record keyed by data) walks as one "{}" path rather than
// one path per key. The output carries live machine data, so it is
// gitignored like mockups/data.js. Run: node scripts/atlas-data.mjs
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
// The project's `typescript` is the native compiler (no JS API), so the
// checker comes from the aliased TypeScript 5 dev dependency.
import ts from "typescript5";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scanDir = join(root, ".scan");

// The scan files the current scanner writes, with their declared types.
// Anything else under .scan/raw/ is a stale leftover and is skipped.
const FILE_TYPES = {
	local: 'RawFiles["local"]',
	githubAccounts: 'RawFiles["githubAccounts"]',
	forgejoAccounts: 'RawFiles["forgejoAccounts"]',
	kuma: 'RawFiles["kuma"]',
	roadmap: 'RawFiles["roadmap"]',
	claudeSessions: 'RawFiles["claudeSessions"]',
	github: 'RawFiles["github"]',
	forgejo: 'RawFiles["forgejo"]',
	status: "StatusFile",
};

// ---- The checker over src/raw.ts and src/snapshot.ts ----

mkdirSync(join(tmpdir(), "perch-atlas"), { recursive: true });
const entryPath = join(tmpdir(), "perch-atlas", "entry.ts");
const rawPath = join(root, "src", "raw.ts").replaceAll("\\", "/");
const snapPath = join(root, "src", "snapshot.ts").replaceAll("\\", "/");
writeFileSync(entryPath, [
	`import type { RawFiles, StatusFile } from "${rawPath}";`,
	`import type { Snapshot } from "${snapPath}";`,
	...Object.entries(FILE_TYPES).map(([name, expr]) => `export type Root_${name} = ${expr};`),
	"export type Root_snapshot = Snapshot;",
].join("\n"));

const program = ts.createProgram([entryPath], {
	noEmit: true,
	strict: true,
	allowImportingTsExtensions: true,
	target: ts.ScriptTarget.ESNext,
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
});
const checker = program.getTypeChecker();
const entrySf = program.getSourceFile(entryPath);
const rootTypes = new Map();
for (const st of entrySf.statements) {
	if (ts.isTypeAliasDeclaration(st) && st.name.text.startsWith("Root_")) {
		rootTypes.set(st.name.text.slice(5), checker.getTypeFromTypeNode(st.type));
	}
}

const members = (t) => (t.isUnion() ? t.types : [t]);
const isNullish = (t) => (t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)) !== 0;

const parentOf = (path) => {
	if (path.endsWith("[]") || path.endsWith("{}")) return path.slice(0, -2);
	const i = path.lastIndexOf(".");
	return i === -1 ? "" : path.slice(0, i);
};
const lastSegOf = (path) => {
	if (path.endsWith("[]") || path.endsWith("{}")) return path.slice(-2);
	const i = path.lastIndexOf(".");
	return i === -1 ? path : path.slice(i + 1);
};

/** The declared types a path can hold, or null when unresolvable. */
function typesAt(rootType, path, cache) {
	if (path === "") return [rootType];
	if (cache.has(path)) return cache.get(path);
	const parents = typesAt(rootType, parentOf(path), cache);
	const seg = lastSegOf(path);
	let result = null;
	if (parents) {
		const next = [];
		for (const t of parents) {
			for (const m of members(t)) {
				if (isNullish(m)) continue;
				if (seg === "[]") {
					const idx = checker.getIndexTypeOfType(m, ts.IndexKind.Number);
					if (idx) next.push(idx);
				} else if (seg === "{}") {
					const idx = checker.getIndexTypeOfType(m, ts.IndexKind.String);
					if (idx) next.push(idx);
				} else {
					const sym = m.getProperty(seg);
					if (sym) next.push(checker.getTypeOfSymbolAtLocation(sym, entrySf));
					else {
						// An enumerated key of an index-signature object.
						const idx = checker.getIndexTypeOfType(m, ts.IndexKind.String);
						if (idx) next.push(idx);
					}
				}
			}
		}
		result = next.length ? next : null;
	}
	cache.set(path, result);
	return result;
}

function declaredAt(rootType, path, cache) {
	const types = typesAt(rootType, path, cache);
	if (!types) return null;
	const parts = [];
	for (const t of types) {
		for (const m of members(t)) {
			if ((m.flags & ts.TypeFlags.Undefined) !== 0) continue;
			const s = checker.typeToString(m, undefined, ts.TypeFormatFlags.NoTruncation);
			if (!parts.includes(s)) parts.push(s);
		}
	}
	return parts.length ? parts.join(" | ") : null;
}

/** Whether the declared type at this path is a Record keyed by data. */
function isDeclaredMap(rootType, path, cache) {
	const types = typesAt(rootType, path, cache);
	if (!types) return null;
	for (const t of types) {
		for (const m of members(t)) {
			if (isNullish(m)) continue;
			if (checker.getIndexTypeOfType(m, ts.IndexKind.String)) return true;
		}
	}
	return false;
}

// ---- The walk over the live JSON ----

function walkFile(json, rootType) {
	const cache = new Map();
	const stats = new Map();
	const rec = (path) => {
		let s = stats.get(path);
		if (!s) {
			s = { types: new Set(), count: 0, examples: [] };
			stats.set(path, s);
		}
		return s;
	};
	const isMap = (obj, path) => {
		const declared = isDeclaredMap(rootType, path, cache);
		if (declared !== null) return declared;
		// Untyped fallback: keys that look like data, not schema.
		return Object.keys(obj).some((k) => k.includes("/"));
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
			if (Object.keys(v).length && isMap(v, path)) {
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
			declared: declaredAt(rootType, path, cache),
		});
	}
	fields.sort((a, b) => a.path.localeCompare(b.path));
	return fields;
}

// ---- Assemble ----

const sources = [];
const skipped = [];
for (const file of readdirSync(join(scanDir, "raw")).sort()) {
	if (!file.endsWith(".json")) continue;
	const name = file.replace(".json", "");
	if (!(name in FILE_TYPES)) {
		skipped.push(file);
		continue;
	}
	const json = JSON.parse(readFileSync(join(scanDir, "raw", file), "utf8"));
	sources.push({ name, file: `.scan/raw/${file}`, fields: walkFile(json, rootTypes.get(name)) });
}
const snapshot = JSON.parse(readFileSync(join(scanDir, "snapshot.json"), "utf8"));
sources.push({ name: "snapshot (derived)", file: ".scan/snapshot.json", fields: walkFile(snapshot, rootTypes.get("snapshot")) });

const out = { generatedAt: new Date().toISOString(), sources };
writeFileSync(join(root, "mockups", "atlas-data.js"), `window.ATLAS = ${JSON.stringify(out, null, "\t")};\n`);
const total = sources.reduce((n, s) => n + s.fields.length, 0);
const unresolved = sources.reduce((n, s) => n + s.fields.filter((f) => !f.declared).length, 0);
console.log(`atlas-data.js written: ${sources.length} sources, ${total} field paths, ${unresolved} without a declared type`);
if (skipped.length) console.log(`skipped stale raw files: ${skipped.join(", ")}`);
