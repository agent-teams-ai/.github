import assert from "node:assert/strict";
import test from "node:test";
import {
  assertQualityAdoption,
  classifySourcePath,
  classifyTrackedPaths,
  deriveLintPaths,
  readQualityAdoption,
} from "./check-quality-scope.mjs";
import { selectOxlintFiles } from "./run-quality-lint.mjs";

const accepted = await readQualityAdoption();

test("actual repository adopts the Foundation preset through the canonical route", () => {
  assertQualityAdoption(accepted);
});

test("actual tracked source census distinguishes tooling, tests, and authority data", () => {
  assert.equal(classifySourcePath("scripts/validate-governance.mjs"), "tooling");
  assert.equal(classifySourcePath("scripts/governance-policy.test.mjs"), "test");
  assert.equal(classifySourcePath("tools/feature-module-standard/check.mjs"), "tooling");
  assert.equal(classifySourcePath("tools/feature-module-standard/check.test.mjs"), "test");
  for (const authority of ["governance/policy.json", ".github/workflows/ci.yml", "GOVERNANCE.md"]) {
    assert.equal(classifySourcePath(authority), "non-source");
  }
  assert.equal(classifySourcePath("new-owner/check.mjs"), null);
});

test("actual derived tooling paths exactly match Oxlint debug selection", async () => {
  const census = assertQualityAdoption(accepted);
  const paths = deriveLintPaths(census, accepted.profile);
  assert.equal(paths.length, 18);
  assert.deepEqual(await selectOxlintFiles(paths), paths);
});

const mutations = {
  "a new unclassified executable source": value => { value.trackedPaths.push("other/new-source.ts"); },
  "a missing Foundation pin": value => { delete value.manifest.devDependencies["@agent-teams/engineering-foundation"]; },
  "a ranged Foundation pin": value => { value.manifest.devDependencies["@agent-teams/engineering-foundation"] = "^1.5.0"; },
  "a local lint rule": value => { value.lintConfig.rules = { "no-eval": "off" }; },
  "a local lint override": value => { value.lintConfig.overrides = []; },
  "a local lint ignore": value => { value.lintConfig.ignorePatterns = ["scripts/**"]; },
  "a replaced public preset": value => { value.lintConfig.extends = ["./local.json"]; },
  "a false typed claim": value => { value.profile.typedCoverage = true; },
  "a non-tooling included role": value => { value.profile.lint.includedRoles = ["test"]; },
  "a removed required route": value => { delete value.manifest.scripts.check; },
  "a no-op required route": value => { value.manifest.scripts.check = "true"; },
  "a conditional required route": value => { value.manifest.scripts.check += " || true"; },
  "a removed existing governance gate": value => { value.manifest.scripts.check = value.manifest.scripts.check.replace(" && pnpm governance:validate", ""); },
  "a missing FMS test route": value => { value.manifest.scripts.test = "node --test scripts/*.test.mjs"; },
  "authority JSON misclassified as source": value => { value.trackedPaths.push("governance/authority.ts"); },
  "a missing CI route": value => { value.workflow = value.workflow.replace("- run: pnpm check", "- run: pnpm test"); },
  "a conditional CI route": value => { value.workflow = value.workflow.replace("- run: pnpm check", "- if: always()\n        run: pnpm check"); },
  "a continue-on-error CI route": value => { value.workflow = value.workflow.replace("- run: pnpm check", "- run: pnpm check\n        continue-on-error: true"); },
};

for (const [name, mutate] of Object.entries(mutations)) {
  test(`quality adoption rejects ${name}`, () => {
    const value = structuredClone(accepted);
    mutate(value);
    assert.throws(() => assertQualityAdoption(value), assert.AssertionError);
  });
}

test("a changed derived tooling set differs from the actual Oxlint selection", async () => {
  const census = classifyTrackedPaths(accepted.trackedPaths);
  const paths = deriveLintPaths(census, accepted.profile);
  await assert.rejects(() => selectOxlintFiles([...paths, "README.md"]),
    /selected files differ/u);
});
