import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import YAML from "yaml";
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
  assert.equal(classifySourcePath("scripts/qualification-input-proof.mts"), "tooling");
  assert.equal(classifySourcePath("scripts/qualification-input-proof.test.mts"), "test");
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
  assert.equal(paths.length, 24);
  assert.ok(paths.includes("scripts/qualification-input-proof.mts"));
  assert.ok(paths.includes("scripts/qualification-input-proof.test.mts"));
  assert.deepEqual(await selectOxlintFiles(paths), paths);
});

const mutations = {
  "a ranged tooling compiler": value => { value.manifest.devDependencies.typescript = "^7.0.2"; },
  "foreign Node type definitions": value => { value.manifest.devDependencies["@types/node"] = "26.6.4"; },
  "disabled strict typechecking": value => { value.toolingTsconfig.compilerOptions.strict = false; },
  "blanket library typecheck suppression": value => { value.toolingTsconfig.compilerOptions.skipLibCheck = true; },
  "a dropped typed test entry": value => { value.toolingTsconfig.include.pop(); },
  "a missing mts test glob": value => { value.manifest.scripts.test = value.manifest.scripts.test.replace(" scripts/*.test.mts", ""); },
  "excluded typed lint selection": value => { value.profile.lint.includedExtensions = []; },
  "an unsupported critical tooling patch": value => { value.nodeVersion = "24.18.0\n"; },
  "Node 26 activation": value => { value.manifest.engines.node = "^24.18.0 || ^26.0.0"; },
  "a dropped critical entry file": value => { value.manifest.scripts["test:critical"] = value.manifest.scripts["test:critical"].replace(" tools/feature-module-standard/check.test.mjs", ""); },
  "a removed mandatory identity": value => { value.requiredTests.required.pop(); },
  "a blanket mandatory skip exception": value => { value.requiredTests.exceptions.push({ ...value.requiredTests.required[0], status: "skipped", reason: "not justified", applicability: { platforms: ["linux", "darwin", "win32"] } }); },
  "a dropped governed tooling root": value => { value.sourcePolicy.governedRoots.pop(); },
  "a disabled installed source gate": value => { delete value.foundationConfig.capabilities["architecture.source-dependencies"]; },
  "a new unclassified executable source": value => { value.trackedPaths.push("other/new-source.ts"); },
  "a missing Foundation pin": value => { delete value.manifest.devDependencies["@agent-teams/engineering-foundation"]; },
  "a ranged Foundation pin": value => { value.manifest.devDependencies["@agent-teams/engineering-foundation"] = "^1.7.2"; },
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

const foundationCli = resolve("node_modules/@agent-teams/engineering-foundation/dist/cli.js");
const mandatoryCli = resolve("node_modules/@agent-teams/engineering-foundation/dist/node-test-cli.js");

async function fixture(t) {
  const base = resolve(".quality-output/disposable");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "central-foundation-171-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (file, text) => {
    const target = join(root, file);
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, text);
  };
  return { root, put };
}

const runInstalled = (cli, args, root) => spawnSync(process.execPath, [cli, ...args], {
  cwd: root, encoding: "utf8", timeout: 30000, maxBuffer: 2 * 1024 * 1024,
});
const outputOf = result => result.stdout + result.stderr;

test("installed source boundary rejects missing inputs and governed dist source", async t => {
  const { root, put } = await fixture(t);
  const policy = structuredClone(accepted.sourcePolicy);
  await put("package.json", JSON.stringify({ name: "@agent-teams/fixture", private: true, type: "module" }));
  await put("pnpm-workspace.yaml", "packages: []\n");
  await put("foundation.config.yaml", YAML.stringify(accepted.foundationConfig));
  await put("docs/engineering-quality-source-policy.yaml", YAML.stringify(policy));
  await put("scripts/sample.mjs", 'import { value } from "../tools/feature-module-standard/check.mjs"; console.log(value);\n');
  await put("tools/feature-module-standard/check.mjs", "export const value = 1;\n");
  const run = () => runInstalled(foundationCli, ["check", "architecture.source-dependencies", "--format", "json"], root);
  assert.equal(run().status, 0, "ordinary declared tooling must qualify");
  // Failure: the installed parser silently exempts typed imports in governed roots.
  await put("scripts/forbidden.mts", 'import "node:net";\n');
  const typedViolation = run();
  assert.equal(typedViolation.status, 1, outputOf(typedViolation));
  assert.match(outputOf(typedViolation), /node:net/u);
  await rm(join(root, "scripts/forbidden.mts"));
  await rm(join(root, "tools/feature-module-standard/check.mjs"));
  const missing = run();
  assert.equal(missing.status, 1, outputOf(missing));
  assert.match(outputOf(missing), /entrypoint|unavailable|missing/iu);
  await put("tools/feature-module-standard/check.mjs", "export const value = 1;\n");
  await rm(join(root, "scripts"), { recursive: true });
  const missingRoot = run();
  assert.equal(missingRoot.status, 2, outputOf(missingRoot));
  assert.match(outputOf(missingRoot), /root|unavailable|missing/iu);
  await put("scripts/sample.mjs", "export const value = 1;\n");
  const config = join(root, "docs/engineering-quality-source-policy.yaml");
  const policyBytes = YAML.stringify(policy);
  await put("docs/engineering-quality-source-policy.yaml", policyBytes);
  const regular = run();
  assert.equal(regular.status, 0, outputOf(regular));
  await put("docs/source-policy-target.yaml", policyBytes);
  await rm(config);
  await symlink(join(root, "docs/source-policy-target.yaml"), config);
  const nonRegular = run();
  assert.equal(nonRegular.status, 2, outputOf(nonRegular));
  assert.match(outputOf(nonRegular), /CONFIG_SYMLINK_PROHIBITED/u);
  await rm(config);
  policy.governedRoots[0] = "scripts/dist";
  policy.boundaries[0].roots = ["scripts/dist"];
  await put("docs/engineering-quality-source-policy.yaml", YAML.stringify(policy));
  await put("scripts/dist/hidden.mjs", 'import "node:net";\n');
  const governedDist = run();
  assert.equal(governedDist.status, 1, "governed dist import must reach the installed parser");
  assert.match(outputOf(governedDist), /node:net/u);
});

test("installed mandatory runner rejects omitted and skipped identities with exact OS exceptions", async t => {
  const { root, put } = await fixture(t);
  const file = "critical.test.mjs";
  const identity = { file, names: ["critical invariant"], kind: "test" };
  const contract = { schemaVersion: 1, required: [identity], exceptions: [] };
  const run = () => runInstalled(mandatoryCli, ["--contract", "required.json", "--", file], root);
  await put("required.json", JSON.stringify(contract));
  await put(file, 'import test from "node:test"; import assert from "node:assert/strict"; import { writeFile, readFile } from "node:fs/promises"; test("critical invariant", async () => { await writeFile("result", "observed"); assert.equal(await readFile("result", "utf8"), "observed"); });\n');
  const completed = run();
  assert.equal(completed.status, 0, outputOf(completed));
  await put(file, 'import test from "node:test"; test("other test", () => {});\n');
  const omitted = run();
  assert.equal(omitted.status, 1, outputOf(omitted));
  assert.match(outputOf(omitted), /omitted/u);
  await put(file, 'import test from "node:test"; test("critical invariant", { skip: true }, () => {});\n');
  const skipped = run();
  assert.equal(skipped.status, 1, outputOf(skipped));
  assert.match(outputOf(skipped), /skipped/u);
  contract.exceptions = [{ ...identity, status: "skipped", reason: "Blanket exception is deliberately rejected", applicability: { platforms: ["linux", "darwin", "win32"] } }];
  await put("required.json", JSON.stringify(contract));
  assert.equal(run().status, 1, "all-platform exceptions must reject");
  // This disposable Windows filesystem fixture needs a Windows filesystem;
  // no exception is added to Central's platform-independent critical contract.
  identity.names = ["Windows filesystem case folding"];
  contract.required = [identity];
  const exception = { ...identity, status: "skipped", reason: "Windows filesystem case folding requires Windows; POSIX filesystems use different semantics", applicability: { platforms: ["linux", "darwin"] } };
  contract.exceptions = [exception];
  await put("required.json", JSON.stringify(contract));
  await put(file, 'import test from "node:test"; import { writeFile, readFile } from "node:fs/promises"; import assert from "node:assert/strict"; test("Windows filesystem case folding", { skip: process.platform !== "win32" }, async () => { await writeFile("CaseFile", "data"); assert.equal(await readFile("casefile", "utf8"), "data"); });\n');
  assert.equal(run().status, 0, "exact platform exception or real Windows completion must pass");
  if (process.platform !== "win32") {
    exception.applicability.platforms = ["win32"];
    await put("required.json", JSON.stringify(contract));
    assert.equal(run().status, 1, "an exception for a different OS cannot admit this skip");
  }
});
