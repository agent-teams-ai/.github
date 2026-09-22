import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parse as parseYaml } from "yaml";

const execFileAsync = promisify(execFile);
const root = new URL("../", import.meta.url);
const SOURCE_SUFFIXES = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"];
const FOUNDATION_PRESET = "./node_modules/@agent-teams/engineering-foundation/presets/oxlint/node.json";
const EXPECTED_SCRIPTS = {
  precheck: "node scripts/check-quality-scope.mjs",
  check: "pnpm quality:lint && pnpm renovate:validate && pnpm governance:validate && pnpm governance:cohorts:append-only && node scripts/check-community-files.mjs && node scripts/check-reviewrouter-workflow.mjs && pnpm test",
  "quality:scope": "node --test scripts/check-quality-scope.test.mjs",
  "quality:lint": "node scripts/run-quality-lint.mjs",
  "quality:check": "pnpm quality:scope && pnpm quality:lint",
  test: "node --test scripts/*.test.mjs tools/feature-module-standard/check.test.mjs",
};

const isTrackedSource = relativePath => SOURCE_SUFFIXES.some(suffix => relativePath.endsWith(suffix));

export function classifySourcePath(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (!isTrackedSource(normalized)) {return "non-source";}
  if (/^scripts\/[^/]+\.test\.mjs$/u.test(normalized) ||
      normalized === "tools/feature-module-standard/check.test.mjs") {return "test";}
  if (/^scripts\/[^/]+\.mjs$/u.test(normalized) ||
      normalized === "tools/feature-module-standard/check.mjs") {return "tooling";}
  return null;
}

export function classifyTrackedPaths(trackedPaths) {
  const classified = [];
  const unclassified = [];
  for (const relativePath of [...new Set(trackedPaths)].toSorted()) {
    const role = classifySourcePath(relativePath);
    if (role === null) {unclassified.push(relativePath);}
    else if (role !== "non-source") {classified.push({ path: relativePath, role });}
  }
  return { classified, unclassified };
}

export function deriveLintPaths(census, profile) {
  return census.classified
    .filter(entry => profile.lint.includedRoles.includes(entry.role))
    .map(entry => entry.path)
    .toSorted();
}

function assertLintPolicy(config) {
  assert.deepEqual(Object.keys(config).toSorted(), ["$schema", "extends", "options"].toSorted(),
    "Oxlint config must contain only schema, one public preset, and suppression options");
  assert.equal(config.$schema, "./node_modules/oxlint/configuration_schema.json");
  assert.deepEqual(config.extends, [FOUNDATION_PRESET], "Foundation public Node preset changed");
  assert.deepEqual(config.options, {
    reportUnusedDisableDirectives: "error",
    respectEslintDisableDirectives: false,
  });
}

function assertWorkflow(workflowText) {
  const workflow = parseYaml(workflowText);
  const steps = workflow?.jobs?.check?.steps;
  assert.ok(Array.isArray(steps), "CI check job steps are missing");
  const requiredSteps = steps.filter(step => step?.run === "pnpm check");
  assert.equal(requiredSteps.length, 1, "CI check job must contain exactly one pnpm check step");
  assert.deepEqual(requiredSteps[0], { run: "pnpm check" },
    "pnpm check step cannot be conditional or continue on error");
}

export function assertQualityAdoption({ manifest, profile, lintConfig, trackedPaths, workflow }) {
  assert.equal(manifest.devDependencies?.["@agent-teams/engineering-foundation"], "1.5.0",
    "Foundation dependency must use the exact released pin");
  assert.equal(manifest.devDependencies?.oxlint, "1.85.0", "Oxlint dependency must use the exact pin");
  for (const [name, command] of Object.entries(EXPECTED_SCRIPTS)) {
    assert.equal(manifest.scripts?.[name], command, `${name} route must stay canonical`);
  }
  assert.deepEqual(profile, {
    schemaVersion: "consumer-quality-profile-v1",
    status: "active-foundation",
    languages: ["javascript"],
    sourceRoots: {
      tooling: ["scripts/**/*.mjs", "tools/feature-module-standard/check.mjs"],
      tests: ["scripts/**/*.test.mjs", "tools/feature-module-standard/check.test.mjs"],
    },
    typedCoverage: false,
    requiredRoute: "pnpm check",
    foundation: { version: "1.5.0", publicPreset: FOUNDATION_PRESET },
    lint: { configPath: "oxlint.json", includedRoles: ["tooling"] },
    toolchain: { node: "24.18.0", pnpm: "11.18.0", oxlint: "1.85.0" },
  }, "quality profile changed");
  assertLintPolicy(lintConfig);
  assertWorkflow(workflow);
  const census = classifyTrackedPaths(trackedPaths);
  assert.deepEqual(census.unclassified, [], `unclassified executable source: ${census.unclassified.join(", ")}`);
  assert.ok(census.classified.some(entry => entry.role === "tooling"), "tooling census is empty");
  assert.ok(census.classified.some(entry => entry.role === "test"), "test census is empty");
  return census;
}

export async function readQualityAdoption(base = root) {
  const readJson = async relativePath => JSON.parse(await readFile(new URL(relativePath, base), "utf8"));
  const cwd = path.dirname(fileURLToPath(new URL("package.json", base)));
  const { stdout } = await execFileAsync("git", ["ls-files", "-z"], { cwd, encoding: "utf8" });
  return {
    manifest: await readJson("package.json"),
    profile: await readJson("docs/engineering-quality-profile.json"),
    lintConfig: await readJson("oxlint.json"),
    trackedPaths: stdout.split("\0").filter(Boolean),
    workflow: await readFile(new URL(".github/workflows/ci.yml", base), "utf8"),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const census = assertQualityAdoption(await readQualityAdoption());
  const counts = Object.fromEntries(["tooling", "test"].map(role => [
    role,
    census.classified.filter(entry => entry.role === role).length,
  ]));
  process.stdout.write(`central quality scope verified: ${JSON.stringify(counts)}\n`);
}
