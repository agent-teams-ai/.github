import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATTERN = /\.(?:[cm]?[jt]sx?)$/u;
const PROTECTED_RULES = ["no-eval", "no-implied-eval", "no-new-func"];
const CONFIG_SCHEMA = "https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/configuration_schema.json";
const EXPECTED_CHECK = "pnpm quality:check && pnpm renovate:validate && pnpm governance:validate && pnpm governance:cohorts:append-only && node scripts/check-community-files.mjs && node scripts/check-reviewrouter-workflow.mjs && pnpm test";
const EXPECTED_TEST = "node --test scripts/*.test.mjs tools/feature-module-standard/check.test.mjs";
const EXPECTED_LINT = "oxlint --config oxlint.json --deny-warnings --disable-nested-config scripts tools/feature-module-standard";

export function classifySourcePath(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (!SOURCE_PATTERN.test(normalized)) return "non-source";
  if (/^scripts\/.*\.test\.[cm]?[jt]sx?$/u.test(normalized) ||
      normalized === "tools/feature-module-standard/check.test.mjs") return "test";
  if (normalized.startsWith("scripts/") ||
      normalized === "tools/feature-module-standard/check.mjs") return "tooling";
  return null;
}

export function assertRoutes(manifest, workflowText) {
  assert.equal(manifest.packageManager, "pnpm@11.18.0", "package manager changed without review");
  assert.equal(manifest.devDependencies?.oxlint, "1.85.0", "Oxlint must remain exact");
  assert.equal(manifest.devDependencies?.["@agent-teams/engineering-foundation"], undefined,
    "bounded fallback cannot pretend to execute Foundation");
  assert.equal(manifest.scripts?.["quality:scope"], "node scripts/check-quality-scope.mjs",
    "quality source-admission route changed");
  assert.equal(manifest.scripts?.["quality:lint"], EXPECTED_LINT, "quality lint source universe changed");
  assert.equal(manifest.scripts?.["quality:check"], "pnpm quality:scope && pnpm quality:lint",
    "quality composition changed");
  assert.equal(manifest.scripts?.test, EXPECTED_TEST, "FMS and governance tests must remain in the test route");
  assert.equal(manifest.scripts?.check, EXPECTED_CHECK, "canonical check route changed");
  if (!workflowText.includes("- run: pnpm check")) throw new Error("CI must execute the canonical check route");
}

export function assertLintPolicy(config) {
  assert.deepEqual(Object.keys(config).sort(), ["$schema", "categories", "rules"],
    "Oxlint config cannot add overrides or ignore surfaces");
  assert.equal(config.$schema, CONFIG_SCHEMA, "Oxlint schema changed");
  assert.deepEqual(config.categories, { correctness: "off", suspicious: "off" },
    "broad categories are outside the bounded fallback");
  assert.deepEqual(Object.keys(config.rules).sort(), [...PROTECTED_RULES].sort(),
    "protected rule inventory changed");
  for (const rule of PROTECTED_RULES) {
    if (config.rules[rule] !== "error") throw new Error("protected rule disabled: " + rule);
  }
}

export function assertProfile(profile) {
  assert.equal(profile.schemaVersion, "consumer-quality-profile-v1");
  assert.equal(profile.status, "active-equivalent");
  assert.deepEqual(profile.languages, ["javascript"]);
  assert.equal(profile.typedCoverage, false, "JavaScript lint cannot claim typed coverage");
  assert.equal(profile.requiredRoute, "pnpm check");
  assert.deepEqual(profile.sourceRoots, {
    tooling: ["scripts/**/*.mjs", "tools/feature-module-standard/check.mjs"],
    tests: ["scripts/**/*.test.mjs", "tools/feature-module-standard/check.test.mjs"],
  });
  assert.equal(profile.foundationCompatibility?.attemptedVersion, "1.5.0");
  assert.equal(profile.foundationCompatibility?.publicPresetDiagnostics, 352);
  assert.equal(profile.foundationCompatibility?.result, "bounded-incompatible");
}

function trackedSources() {
  const output = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" });
  return output.split("\0").filter(Boolean).filter((entry) => SOURCE_PATTERN.test(entry));
}

function verify() {
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const config = JSON.parse(readFileSync(path.join(root, "oxlint.json"), "utf8"));
  const profile = JSON.parse(readFileSync(path.join(root, "docs/engineering-quality-profile.json"), "utf8"));
  const workflow = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
  assertRoutes(manifest, workflow);
  assertLintPolicy(config);
  assertProfile(profile);
  const sources = trackedSources();
  const unclassified = sources.filter((entry) => classifySourcePath(entry) === null);
  if (unclassified.length > 0) throw new Error("unclassified executable source:\n" + unclassified.join("\n"));
  const counts = Object.create(null);
  for (const entry of sources) {
    const role = classifySourcePath(entry);
    counts[role] = (counts[role] ?? 0) + 1;
  }
  process.stdout.write("central quality scope verified: " + JSON.stringify(counts) + "\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) verify();
