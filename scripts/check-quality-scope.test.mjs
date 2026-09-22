import assert from "node:assert/strict";
import test from "node:test";
import {
  assertLintPolicy,
  assertProfile,
  assertRoutes,
  classifySourcePath,
} from "./check-quality-scope.mjs";

const manifest = {
  packageManager: "pnpm@11.18.0",
  devDependencies: { oxlint: "1.85.0" },
  scripts: {
    "quality:scope": "node scripts/check-quality-scope.mjs",
    "quality:lint": "oxlint --config oxlint.json --deny-warnings --disable-nested-config scripts tools/feature-module-standard",
    "quality:check": "pnpm quality:scope && pnpm quality:lint",
    test: "node --test scripts/*.test.mjs tools/feature-module-standard/check.test.mjs",
    check: "pnpm quality:check && pnpm renovate:validate && pnpm governance:validate && pnpm governance:cohorts:append-only && node scripts/check-community-files.mjs && node scripts/check-reviewrouter-workflow.mjs && pnpm test",
  },
};
const workflow = "steps:\n  - run: pnpm check\n";
const config = {
  $schema: "https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/configuration_schema.json",
  categories: { correctness: "off", suspicious: "off" },
  rules: { "no-eval": "error", "no-implied-eval": "error", "no-new-func": "error" },
};
const profile = {
  schemaVersion: "consumer-quality-profile-v1",
  status: "active-equivalent",
  languages: ["javascript"],
  sourceRoots: {
    tooling: ["scripts/**/*.mjs", "tools/feature-module-standard/check.mjs"],
    tests: ["scripts/**/*.test.mjs", "tools/feature-module-standard/check.test.mjs"],
  },
  typedCoverage: false,
  requiredRoute: "pnpm check",
  foundationCompatibility: {
    attemptedVersion: "1.5.0",
    publicPresetDiagnostics: 352,
    result: "bounded-incompatible",
  },
};

test("classifies every current executable owner and rejects a new root", () => {
  assert.equal(classifySourcePath("scripts/validate-governance.mjs"), "tooling");
  assert.equal(classifySourcePath("scripts/governance-policy.test.mjs"), "test");
  assert.equal(classifySourcePath("tools/feature-module-standard/check.mjs"), "tooling");
  assert.equal(classifySourcePath("tools/feature-module-standard/check.test.mjs"), "test");
  assert.equal(classifySourcePath("governance/policy.json"), "non-source");
  assert.equal(classifySourcePath("new-owner/check.mjs"), null);
});

test("rejects no-op, incomplete, and detached required routes", () => {
  assert.doesNotThrow(() => assertRoutes(manifest, workflow));
  assert.throws(() => assertRoutes({ ...manifest, scripts: { ...manifest.scripts, "quality:check": "node -e process.exit(0)" } }, workflow), /composition/u);
  assert.throws(() => assertRoutes({ ...manifest, scripts: { ...manifest.scripts, "quality:lint": "oxlint scripts" } }, workflow), /source universe/u);
  assert.throws(() => assertRoutes({ ...manifest, scripts: { ...manifest.scripts, test: "node --test scripts/*.test.mjs" } }, workflow), /FMS/u);
  assert.throws(() => assertRoutes(manifest, "steps: []"), /CI must execute/u);
});

test("rejects disabled protected rules, ignores, and copied policy growth", () => {
  assert.doesNotThrow(() => assertLintPolicy(config));
  assert.throws(() => assertLintPolicy({ ...config, rules: { ...config.rules, "no-eval": "off" } }), /protected rule|inventory/u);
  assert.throws(() => assertLintPolicy({ ...config, ignorePatterns: ["scripts/**"] }), /cannot add overrides/u);
  assert.throws(() => assertLintPolicy({ ...config, rules: { ...config.rules, eqeqeq: "off" } }), /inventory/u);
});

test("rejects unsupported status and false typed coverage claims", () => {
  assert.doesNotThrow(() => assertProfile(profile));
  assert.throws(() => assertProfile({ ...profile, typedCoverage: true }), /cannot claim typed/u);
  assert.throws(() => assertProfile({ ...profile, status: "active-foundation" }));
  assert.throws(() => assertProfile({ ...profile, foundationCompatibility: { ...profile.foundationCompatibility, publicPresetDiagnostics: 0 } }));
});
