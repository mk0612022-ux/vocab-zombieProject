// Writes public/version.json at every deploy on Cloudflare (new series,
// round 1, C1): set as the Worker's Build command, `node tools/make-version.mjs`
// (Workers Builds does not run a build step from wrangler.jsonc).
// tools/make-version.ps1 is the same for this computer -- the two must agree:
//   version  "YYYY.MM.DD-HHMM", the build time in Thailand (UTC+7)
//   build    the build time in ms (what the game compares)
//   files    path -> { size, hash }: text files hashed with CRLF read as LF
// The commit comes from Workers Builds (WORKERS_CI_COMMIT_SHA), else git.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(repo, "public");
const SKIP = new Set(["version.json", "_headers", ".assetsignore", "sw.js"]);
const TEXT = new Set([".html", ".js", ".css", ".json", ".txt", ".svg", ".webmanifest", ".csv"]);
const git = (args) => { try { return execSync("git " + args, { cwd: repo, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch (e) { return ""; } };

function walk(dir, base, out) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name), rel = base ? base + "/" + name : name;
    if (statSync(full).isDirectory()) walk(full, rel, out);
    else out.push({ full, rel });
  }
  return out;
}

const files = {};
let total = 0;
for (const f of walk(root, "", []).sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))) {
  if (SKIP.has(f.rel)) continue;
  let bytes = readFileSync(f.full);
  if (TEXT.has(extname(f.rel).toLowerCase())) bytes = Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
  files[f.rel] = { size: bytes.length, hash: createHash("sha256").update(bytes).digest("hex").slice(0, 16) };
  total += bytes.length;
}

const html = readFileSync(join(root, "index.html"), "utf8");
const external = [...html.matchAll(/<script src="(https:\/\/[^"]+)"/g)].map((m) => m[1]);

const now = new Date();
const th = new Date(now.getTime() + 7 * 3600 * 1000);
const p2 = (n) => String(n).padStart(2, "0");
const version = `${th.getUTCFullYear()}.${p2(th.getUTCMonth() + 1)}.${p2(th.getUTCDate())}-${p2(th.getUTCHours())}${p2(th.getUTCMinutes())}`;
const commit = (process.env.WORKERS_CI_COMMIT_SHA || git("rev-parse HEAD")).slice(0, 7);
// what changed: the last commits, newest first, { c: commit, s: subject }
// (the game shows those since the version a device has)
const changes = git("log -n 8 --abbrev=7 --format=%h%x09%s").split("\n").map((l) => l.split("\t")).filter((p) => p.length === 2 && p[1].trim())
  .map(([c, s]) => ({ c: c.slice(0, 7), s: s.trim().slice(0, 140) }));

const v = {
  format: 1, version, build: now.getTime(), date: now.toISOString(), commit,
  source: process.env.WORKERS_CI ? "cloudflare" : "local",
  changes, total, external, files,
};
writeFileSync(join(root, "version.json"), JSON.stringify(v) + "\n");
console.log(`version.json: ${version}  build ${v.build}  commit ${commit}  ${Object.keys(files).length} files, ${(total / 1048576).toFixed(2)} MB`);
