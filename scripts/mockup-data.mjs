// Derive mockups/data.js from the latest snapshot, for the design mockups.
// Run: node scripts/mockup-data.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const snapshot = JSON.parse(
	readFileSync(join(repoRoot, ".scan", "snapshot.json"), "utf8"),
);

// Provisional adoption and tiers for the mockups only. The real app derives
// these from config; nothing here is a decision.
const TIERS = {
	".dotfiles": ["machine-home", "Machine"],
	"dev/dotfiles-nimbus": ["machine-home", "Machine"],
	"dev/hearth-config": ["machine-home", "Tech"],
	"obsidian/Hothouse": ["machine-home", "Tech"],
	"obsidian/Pocket": ["machine-home", "Personal"],
	"dev/perch": ["projects", "Projects"],
	"undev/harbour": ["projects", "Projects"],
	"undev/skiff": ["projects", "Projects"],
	"undev/oxbow": ["projects", "Projects"],
	"undev/spool": ["projects", "Projects"],
	"undev/gramophone": ["projects", "Projects"],
	"undev/glyph-docs": ["projects", "Projects"],
	"undev/prism": ["projects", "Projects"],
	"undev/mark-this": ["projects", "Projects"],
	"undev/Hollow-legacy": ["projects", "Projects"],
};

// Provisional human-readable names for the mockups; the real app takes
// these from config, defaulting to the repo name.
const NAMES = {
	".dotfiles": "Dotfiles",
	"dev/dotfiles-nimbus": "Nimbus Dotfiles",
	"dev/hearth-config": "Hearth Config",
	"obsidian/Hothouse": "Hothouse Vault",
	"obsidian/Pocket": "Pocket Vault",
	"dev/perch": "Perch",
	"undev/harbour": "Harbour",
	"undev/skiff": "Skiff",
	"undev/oxbow": "Oxbow",
	"undev/spool": "Spool",
	"undev/gramophone": "Gramophone",
	"undev/glyph-docs": "Glyph Docs",
	"undev/prism": "Prism",
	"undev/mark-this": "Mark This",
	"undev/Hollow-legacy": "Hollow (legacy)",
};

const days = (iso, now) =>
	iso === null || iso === undefined
		? null
		: Math.floor((now - Date.parse(iso)) / 86_400_000);

const now = Date.parse(snapshot.scannedAt ?? new Date().toISOString());

const items = snapshot.items
	.filter((item) => item.kind !== "server")
	.map((item) => {
		const git = item.sources?.git ?? null;
		const roadmap = item.sources?.roadmap ?? null;
		const claude = item.sources?.claudeSessions ?? null;
		const forgeSources = ["github", "forgejo"]
			.map((forge) => ({ forge, data: item.sources?.[forge] }))
			.filter((f) => f.data);

		const ci = forgeSources
			.map((f) => f.data.latestCi ?? f.data.latestRun ?? null)
			.find((run) => run !== null) ?? null;
		const pulls = forgeSources.flatMap((f) => f.data.openPullRequests ?? []);
		const finalised = forgeSources.flatMap((f) =>
			(f.data.finalisedCommits ?? []).map((c) => ({
				subject: c.subject ?? c.message ?? "",
				at: c.committedAt ?? c.at ?? null,
				forge: f.forge,
			})),
		);

		const bugs = roadmap?.counts?.bug ?? 0;
		const features = roadmap?.counts?.feature ?? 0;
		const driftLevel = git?.drift?.level ?? "green";
		const ciFailing = ci?.conclusion === "failure" || ci?.state === "failure";

		// Health ignores not-set-up: that is triage, not ill health.
		let health = "green";
		if (driftLevel === "amber" || git?.backup === "no-remote") health = "amber";
		if (driftLevel === "red" || ciFailing || bugs > 0) health = "red";

		const [tier, category] = TIERS[item.id] ?? [null, null];
		const adopted = tier !== null;

		const lastTouched = Math.max(
			Date.parse(git?.lastCommitAt ?? 0) || 0,
			Date.parse(claude?.lastSessionAt ?? 0) || 0,
		);

		return {
			id: item.id,
			name: item.name,
			displayName: NAMES[item.id] ?? item.name,
			kind: item.kind,
			importance: item.importance,
			tier,
			category,
			adopted,
			local: Boolean(item.presences?.local),
			forges: (item.presences?.forges ?? []).map((f) => ({
				forge: f.forge,
				fullName: f.fullName,
				url: f.url,
			})),
			flags: (item.flags ?? []).map((f) => ({
				flag: f.flag,
				level: f.level,
				detail: f.detail,
			})),
			git: git
				? {
						branch: git.branch,
						backup: git.backup,
						uncommitted: git.uncommittedCount,
						unpushed: git.unpushedCount,
						ahead: git.ahead,
						behind: git.behind,
						activity: git.activity,
						driftDays: git.drift?.driftDays ?? null,
						driftLevel,
						lastCommitAt: git.lastCommitAt,
						branches: (git.branches ?? []).slice(0, 6).map((b) => ({
							name: b.name,
							subject: b.subject,
							daysAgo: days(b.lastCommitAt, now),
						})),
					}
				: null,
			work: { bugs, features, total: bugs + features },
			groups: (roadmap?.files ?? []).flatMap((f) =>
				(f.groups ?? [])
					.filter((g) => g.role !== "structure")
					.slice(0, 8)
					.map((g) => ({
						heading: g.heading,
						items: (g.items ?? []).length,
						done: (g.items ?? []).filter((i) => i.checkbox === "done").length,
					})),
			),
			ci: ci
				? {
						name: ci.name ?? "CI",
						conclusion: ci.conclusion ?? ci.state ?? "unknown",
						daysAgo: days(ci.completedAt ?? ci.at ?? null, now),
					}
				: null,
			pulls: pulls.length,
			finalised: finalised
				.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
				.slice(0, 5),
			lastSessionDays: days(claude?.lastSessionAt ?? null, now),
			lastTouchedDays: lastTouched ? days(new Date(lastTouched).toISOString(), now) : null,
			health,
		};
	});

const rank = { red: 0, amber: 1, green: 2 };
items.sort(
	(a, b) =>
		rank[a.health] - rank[b.health] ||
		(a.lastTouchedDays ?? 9999) - (b.lastTouchedDays ?? 9999),
);

const out = `window.PERCH_DATA = ${JSON.stringify(
	{ scannedAt: snapshot.scannedAt, items },
	null,
	"\t",
)};\n`;
mkdirSync(join(repoRoot, "mockups"), { recursive: true });
writeFileSync(join(repoRoot, "mockups", "data.js"), out);
console.log(`mockups/data.js written: ${items.length} items`);
