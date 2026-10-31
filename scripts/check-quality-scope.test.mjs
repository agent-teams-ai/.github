import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import YAML from "yaml";
import { pathToFileURL } from "node:url";
import {
  assertQualityAdoption,
  assertRuntimeToolAdoption,
  readStackInstallation,
  classifySourcePath,
  classifyTrackedPaths,
  deriveLintPaths,
  readQualityAdoption,
} from "./check-quality-scope.mjs";
import { selectOxlintFiles } from "./run-quality-lint.mjs";
import { assertCompilerFloor } from "./compiler-floor.ts";

const accepted = await readQualityAdoption();

const acceptedRuntimeTool = JSON.parse(
  await readFile(new URL("../tools/renovate-validation/package.json", import.meta.url), "utf8"),
);

test("complete quality scope accepts the exact isolated runtime contract", () => {
  assertRuntimeToolAdoption(acceptedRuntimeTool);
});
test("complete quality scope rejects a missing isolated runtime contract", () => {
  assert.throws(() => assertRuntimeToolAdoption(undefined), assert.AssertionError);
});
for (const [name, mutate] of Object.entries({
  "ranged isolated Renovate pin": (value) => {
    value.devDependencies.renovate = "^44.24.2";
  },
  "wrong isolated validator runtime": (value) => {
    value.devEngines.runtime.version = "26.11.1";
  },
  "unbounded native validator build": (value) => {
    value.scripts["build:native"] = "pnpm rebuild";
  },
})) {
  test(`complete quality scope rejects ${name}`, () => {
    const value = structuredClone(acceptedRuntimeTool);
    mutate(value);
    assert.throws(() => assertRuntimeToolAdoption(value), assert.AssertionError);
  });
}

test("actual repository adopts the Foundation preset through the canonical route", () => {
  assertQualityAdoption(accepted);
});

test("actual tracked source census distinguishes tooling, tests, and authority data", () => {
  assert.equal(classifySourcePath("scripts/validate-governance.mjs"), "tooling");
  assert.equal(classifySourcePath("scripts/governance-policy.test.mjs"), "test");
  assert.equal(classifySourcePath("scripts/qualification-input-proof.mts"), "tooling");
  assert.equal(classifySourcePath("scripts/qualification-input-proof.test.mts"), "test");
  assert.equal(classifySourcePath("scripts/quality-process.ts"), "tooling");
  assert.equal(classifySourcePath("scripts/quality-process.test.ts"), "test");
  assert.equal(classifySourcePath("scripts/run-governance-tests.ts"), "tooling");
  assert.equal(classifySourcePath("scripts/run-governance-tests.test.ts"), "test");
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
  assert.equal(paths.length, 43);
  assert.ok(paths.includes("scripts/verify-docs-admission-change.mjs"));
  assert.ok(paths.includes("scripts/qualification-input-proof.mts"));
  assert.ok(paths.includes("scripts/qualification-input-proof.test.mts"));
  assert.ok(paths.includes("scripts/docs-portable-authority-r322.mjs"));
  assert.ok(paths.includes("scripts/read-docs-portable-authority-r322.mjs"));
  assert.ok(!paths.includes("scripts/check-docs-verifier-authority.mts"));
  assert.ok(!paths.includes("scripts/check-docs-verifier-authority.test.mts"));
  assert.ok(paths.includes("scripts/npm-publish.test.mts"));
  assert.ok(paths.includes("scripts/quality-process.ts"));
  assert.ok(paths.includes("scripts/quality-process.test.ts"));
  assert.ok(paths.includes("scripts/run-governance-tests.ts"));
  assert.ok(paths.includes("scripts/run-governance-tests.test.ts"));
  assert.ok(!paths.includes("scripts/check-docs-source-successor-v1.mts"));
  assert.ok(!paths.includes("scripts/check-docs-source-successor-v1.test.mts"));
  assert.ok(paths.includes("scripts/compiler-floor.ts"));
  assert.ok(paths.includes("scripts/compiler-floor.test.ts"));
  assert.ok(paths.includes("scripts/check-repository-admission.ts"));
  assert.ok(paths.includes("scripts/check-repository-admission.test.ts"));
  assert.ok(paths.includes("scripts/governance-schema.ts"));
  assert.ok(paths.includes("scripts/repository-registration.ts"));
  assert.ok(paths.includes("scripts/repository-registration.test.ts"));
  assert.ok(paths.includes("scripts/repository-bootstrap-observation.ts"));
  assert.ok(paths.includes("scripts/repository-bootstrap-observation.test.ts"));
  assert.ok(paths.includes("scripts/validate-renovate.ts"));
  assert.ok(paths.includes("scripts/validate-renovate.test.ts"));
  assert.ok(paths.includes("scripts/validate-renovate-abi.probe.ts"));
  assert.deepEqual(await selectOxlintFiles(paths), paths);
});

test("single root Stack pin accepts a matching future identity as binding proof only", () => {
  const value = structuredClone(accepted);
  value.manifest.devDependencies["stack-toolchain"] = "0.2.0";
  value.stackInstallation.package.version = "0.2.0";
  value.stackDoctor.details.packageVersion = "0.2.0";
  assertQualityAdoption(value);
});

for (const pin of [
  "latest",
  "npm:stack-toolchain@0.1.1",
  "file:../stack",
  "git+https://example.test/stack",
  "workspace:*",
  "0.1.1-beta.1",
  "01.1.1",
  "0.1.1+metadata",
]) {
  test(`quality adoption rejects noncanonical Stack pin ${pin}`, () => {
    const value = structuredClone(accepted);
    value.manifest.devDependencies["stack-toolchain"] = pin;
    assert.throws(() => assertQualityAdoption(value), assert.AssertionError);
  });
}

for (const section of ["dependencies", "optionalDependencies", "peerDependencies"]) {
  test(`quality adoption rejects duplicate Stack in ${section}`, () => {
    const value = structuredClone(accepted);
    value.manifest[section] = { ...value.manifest[section], "stack-toolchain": "0.1.1" };
    assert.throws(() => assertQualityAdoption(value), assert.AssertionError);
  });
}

test("Stack reader rejects absent and escaping consumer-local installations", async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), "central-stack-binding-"));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const base = pathToFileURL(`${fixture}/`);
  await writeFile(join(fixture, "package.json"), "{}\n");
  await assert.rejects(() => readStackInstallation(base));
  await mkdir(join(fixture, "node_modules"));
  await symlink(
    resolve("node_modules/stack-toolchain"),
    join(fixture, "node_modules/stack-toolchain"),
    "dir",
  );
  await assert.rejects(() => readStackInstallation(base), /outside consumer node_modules/u);
});

test("Stack reader accepts a relocated public manifest within the physical package", async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), "central-stack-export-"));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const owner = join(fixture, "node_modules/stack-toolchain");
  await mkdir(join(owner, "metadata"), { recursive: true });
  await writeFile(join(fixture, "package.json"), "{}\n");
  await writeFile(
    join(owner, "package.json"),
    JSON.stringify({
      name: "stack-toolchain",
      version: accepted.manifest.devDependencies["stack-toolchain"],
      exports: {
        "./package.json": "./package.json",
        "./toolchain-manifest.json": "./metadata/tools.json",
      },
    }),
  );
  await writeFile(
    join(owner, "metadata/tools.json"),
    JSON.stringify(accepted.stackInstallation.toolManifest),
  );
  const observed = await readStackInstallation(pathToFileURL(`${fixture}/`));
  assert.deepEqual(observed.toolManifest, accepted.stackInstallation.toolManifest);
  assert.equal(observed.manifestPath, await realpath(join(owner, "metadata/tools.json")));
  const sibling = join(fixture, "node_modules/another-package");
  await mkdir(sibling);
  await writeFile(
    join(sibling, "tools.json"),
    JSON.stringify(accepted.stackInstallation.toolManifest),
  );
  await rm(join(owner, "metadata/tools.json"));
  await symlink(join(sibling, "tools.json"), join(owner, "metadata/tools.json"));
  await assert.rejects(
    () => readStackInstallation(pathToFileURL(`${fixture}/`)),
    /manifest escaped its package/u,
  );
});

test("Stack reader rejects an ancestor package and a borrowed whole node_modules root", async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), "central-stack-root-"));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  await mkdir(join(fixture, "node_modules"));
  await symlink(
    resolve("node_modules/stack-toolchain"),
    join(fixture, "node_modules/stack-toolchain"),
    "dir",
  );
  const consumer = join(fixture, "consumer");
  await mkdir(join(consumer, "node_modules"), { recursive: true });
  await writeFile(join(consumer, "package.json"), "{}\n");
  const base = pathToFileURL(`${consumer}/`);
  await assert.rejects(() => readStackInstallation(base), /outside consumer node_modules/u);
  await rm(join(consumer, "node_modules"), { recursive: true });
  await symlink(join(fixture, "node_modules"), join(consumer, "node_modules"), "dir");
  await assert.rejects(() => readStackInstallation(base), /node_modules root must be physical/u);
});

const mutations = {
  "a changed TypeScript ESM package contract": (value) => {
    value.manifest.type = "commonjs";
  },
  "an absorbed runtime-specific tool": (value) => {
    value.workspacePolicy.packages.push("tools/renovate-validation");
  },
  "ineffective engine policy": (value) => {
    value.workspacePolicy.engineStrict = false;
  },
  "ineffective peer policy": (value) => {
    delete value.workspacePolicy.strictPeerDependencies;
  },
  "implicit check-time installation": (value) => {
    value.workspacePolicy.verifyDepsBeforeRun = "install";
  },
  "missing isolated validator bootstrap": (value) => {
    value.workflow = value.workflow.replace(
      "pnpm --dir tools/renovate-validation install --frozen-lockfile --ignore-scripts",
      "true",
    );
  },
  "an ordinary TypeScript helper outside the strict project": (value) => {
    value.trackedPaths.push("scripts/unlisted-helper.ts");
  },
  "an ordinary TypeScript test outside the strict project": (value) => {
    value.trackedPaths.push("scripts/unlisted.test.ts");
  },

  "Bun build-script execution": (value) => {
    value.workspacePolicy.allowBuilds.bun = true;
  },
  "an undecided Bun build script": (value) => {
    delete value.workspacePolicy.allowBuilds.bun;
  },
  "another package build approval": (value) => {
    value.workspacePolicy.allowBuilds.extra = true;
  },
  "existing re2 build-policy drift": (value) => {
    value.workspacePolicy.allowBuilds.re2 = false;
  },
  "global script suppression": (value) => {
    value.workspacePolicy.ignoreScripts = true;
  },
  "global build permission": (value) => {
    value.workspacePolicy.dangerouslyAllowAllBuilds = true;
  },
  "disabled strict build decisions": (value) => {
    value.workspacePolicy.strictDepBuilds = false;
  },
  "a legacy build allowlist": (value) => {
    value.workspacePolicy.onlyBuiltDependencies = ["bun"];
  },
  "a legacy ignored-build list": (value) => {
    value.workspacePolicy.ignoredBuiltDependencies = ["bun"];
  },
  "an absent installed Stack identity": (value) => {
    value.stackInstallation = null;
  },
  "the wrong installed Stack name": (value) => {
    value.stackInstallation.package.name = "other";
  },
  "the wrong installed Stack version": (value) => {
    value.stackInstallation.package.version = "0.2.0";
  },
  "a borrowed Stack installation root": (value) => {
    value.stackInstallation.nodeModulesRoot = resolve("../borrowed/node_modules");
  },
  "escaping Stack package metadata": (value) => {
    value.stackInstallation.packagePath = resolve("../outside/package.json");
  },
  "escaping Stack tool metadata": (value) => {
    value.stackInstallation.manifestPath = resolve("../outside/toolchain-manifest.json");
  },
  "unsupported Stack configuration schema": (value) => {
    value.toolchainConfig.schemaVersion = 2;
  },
  "Stack metadata with no package record": (value) => {
    delete value.stackInstallation.package;
  },
  "unsupported Stack manifest schema": (value) => {
    value.stackInstallation.toolManifest.schemaVersion = 2;
  },
  "extra Stack manifest fields": (value) => {
    value.stackInstallation.toolManifest.extra = true;
  },
  "missing Stack compiler metadata": (value) => {
    delete value.stackInstallation.toolManifest.typescript;
  },
  "invalid Stack compiler metadata": (value) => {
    value.stackInstallation.toolManifest.typescript = "latest";
  },
  "an absent Stack doctor observation": (value) => {
    value.stackDoctor = null;
  },
  "unsupported Stack doctor schema": (value) => {
    value.stackDoctor.details.schemaVersion = 2;
  },
  "a mismatched Stack doctor identity": (value) => {
    value.stackDoctor.details.packageVersion = "0.2.0";
  },
  "a mismatched Stack doctor manifest": (value) => {
    value.stackDoctor.versions.typescript = "99.0.0";
  },
  "a failed companion graph": (value) => {
    value.stackDoctor.exitCode = 2;
  },
  "a companion error finding": (value) => {
    value.stackDoctor.details.findings.push({
      severity: "error",
      code: "TOOLCHAIN_TOOL_PIN_MISMATCH",
    });
  },
  "a bundled Stack declaration": (value) => {
    value.manifest.bundledDependencies = ["stack-toolchain"];
  },
  "a copied Stack profile release": (value) => {
    value.profile.toolchain.version = "0.1.1";
  },
  "a copied compiler profile release": (value) => {
    value.profile.typedTooling.compiler = "7.0.2";
  },
  "a changed format-only admission authority blob": (value) => {
    value.formatRetainedAuthorityBlobs[0].gitBlob = "1".repeat(40);
  },
  "an expanded format-only retained authority set": (value) => {
    value.profile.formatRetainedAuthoritySources.push({
      path: "scripts/run-quality-lint.mjs",
      gitBlob: "1".repeat(40),
    });
  },
  "a missing format-only retained authority identity": (value) => {
    value.profile.formatRetainedAuthoritySources.pop();
  },
  "the format-only authority removed from lint": (value) => {
    value.toolchainConfig.lint.paths = value.toolchainConfig.lint.paths.filter(
      (path) => path !== "scripts/verify-docs-admission-change.mjs",
    );
  },
  "formatting the byte-owned admission authority": (value) => {
    value.toolchainConfig.format.paths.push("scripts/verify-docs-admission-change.mjs");
  },
  "a nested ignore hiding current sources": (value) => {
    value.trackedPaths.push("scripts/.gitignore");
  },
  "a changed retained-authority blob": (value) => {
    value.retainedAuthorityBlobs[0].gitBlob = "1".repeat(40);
  },
  "a removed retained-authority classification": (value) => {
    value.profile.retainedAuthoritySources.pop();
  },
  "a new unknown source boundary": (value) => {
    value.trackedPaths.push("unknown/extra.ts");
  },
  "a hidden formatter ignore": (value) => {
    value.formatterIgnores[0] = "scripts/**";
  },
  "an expanded retained-authority exclusion": (value) => {
    value.profile.retainedAuthoritySources.push({
      path: "scripts/quality-process.ts",
      gitBlob: "1".repeat(40),
    });
  },
  "a hidden tracked formatter source": (value) => {
    value.gitignore += "scripts/quality-process.ts\n";
  },
  "a separate lint TypeScript program": (value) => {
    value.lintTsconfig.extends = "./other.json";
  },
  "a missing Stack pin": (value) => {
    delete value.manifest.devDependencies["stack-toolchain"];
  },
  "a second compiler owner": (value) => {
    value.manifest.devDependencies.typescript = "7.0.2";
  },
  "a second linter owner": (value) => {
    value.manifest.devDependencies.oxlint = "1.85.0";
  },
  "a dropped Stack lint input": (value) => {
    value.toolchainConfig.lint.paths.pop();
  },
  "dropping the owned WorkA formatter input .github/workflows/docs-protocol-check.yml": (value) => {
    value.toolchainConfig.format.paths = value.toolchainConfig.format.paths.filter(
      (path) => path !== ".github/workflows/docs-protocol-check.yml",
    );
  },
  "dropping the owned WorkA formatter input docs/governance/docs-gen3-current-policy-mapping.md": (
    value,
  ) => {
    value.toolchainConfig.format.paths = value.toolchainConfig.format.paths.filter(
      (path) => path !== "docs/governance/docs-gen3-current-policy-mapping.md",
    );
  },
  "dropping the owned WorkA formatter input governance/docs-protocol-policy-v2.schema.json": (
    value,
  ) => {
    value.toolchainConfig.format.paths = value.toolchainConfig.format.paths.filter(
      (path) => path !== "governance/docs-protocol-policy-v2.schema.json",
    );
  },
  "a dropped formatter input": (value) => {
    value.toolchainConfig.format.paths.pop();
  },
  "a no-op formatting gate": (value) => {
    value.manifest.scripts["format:check"] = "true";
  },
  "a different compiler project": (value) => {
    value.toolchainConfig.typecheck.projects = ["other.json"];
  },
  "a ranged Stack toolchain": (value) => {
    value.manifest.devDependencies["stack-toolchain"] = "^0.1.1";
  },
  "foreign Node type definitions": (value) => {
    value.manifest.devDependencies["@types/node"] = "26.6.4";
  },
  "disabled strict typechecking": (value) => {
    value.toolingTsconfig.compilerOptions.strict = false;
  },
  "blanket library typecheck suppression": (value) => {
    value.toolingTsconfig.compilerOptions.skipLibCheck = true;
  },
  "a dropped typed test entry": (value) => {
    value.toolingTsconfig.include.pop();
  },
  "a replaced complete test runner": (value) => {
    value.manifest.scripts.test = "node --test scripts/*.test.mjs";
  },
  "excluded typed lint selection": (value) => {
    value.profile.lint.includedExtensions = [];
  },
  "an unsupported critical tooling patch": (value) => {
    value.nodeVersion = "24.18.0\n";
  },
  "the previous Node 24 default": (value) => {
    value.nodeVersion = "24.21.0\n";
  },
  "a Node 24 profile toolchain": (value) => {
    value.profile.toolchain.node = "24.21.0";
  },
  "an engine range that drops Node 24": (value) => {
    value.manifest.engines.node = ">=26.10.0 <27";
  },
  "an engine range that drops Node 26": (value) => {
    value.manifest.engines.node = ">=24.18.0 <25";
  },
  "a widened Node 26 engine range": (value) => {
    value.manifest.engines.node = ">=24.18.0 <25 || >=26.0.0";
  },
  "a dropped critical entry file": (value) => {
    value.manifest.scripts["test:critical"] = value.manifest.scripts["test:critical"].replace(
      " tools/feature-module-standard/check.test.mjs",
      "",
    );
  },
  "a removed mandatory identity": (value) => {
    value.requiredTests.required.pop();
  },
  "a blanket mandatory skip exception": (value) => {
    value.requiredTests.exceptions.push({
      ...value.requiredTests.required[0],
      status: "skipped",
      reason: "not justified",
      applicability: { platforms: ["linux", "darwin", "win32"] },
    });
  },
  "a dropped governed tooling root": (value) => {
    value.sourcePolicy.governedRoots.pop();
  },
  "a disabled installed source gate": (value) => {
    delete value.foundationConfig.capabilities["architecture.source-dependencies"];
  },
  "a new unclassified executable source": (value) => {
    value.trackedPaths.push("other/new-source.ts");
  },
  "a missing Foundation pin": (value) => {
    delete value.manifest.devDependencies["@agent-teams/engineering-foundation"];
  },
  "a ranged Foundation pin": (value) => {
    value.manifest.devDependencies["@agent-teams/engineering-foundation"] = "^3.0.0";
  },
  "a missing process runtime pin": (value) => {
    delete value.manifest.devDependencies["node-or-bun"];
  },
  "a ranged process runtime pin": (value) => {
    value.manifest.devDependencies["node-or-bun"] = "^0.2.1";
  },
  "a local lint rule": (value) => {
    value.lintConfig.rules = { "no-eval": "off" };
  },
  "a local lint override": (value) => {
    value.lintConfig.overrides = [];
  },
  "a local lint ignore": (value) => {
    value.lintConfig.ignorePatterns = ["scripts/**"];
  },
  "a replaced public preset": (value) => {
    value.lintConfig.extends = ["./local.json"];
  },
  "a false typed claim": (value) => {
    value.profile.typedCoverage = true;
  },
  "a non-tooling included role": (value) => {
    value.profile.lint.includedRoles = ["test"];
  },
  "a removed required route": (value) => {
    delete value.manifest.scripts.check;
  },
  "a no-op required route": (value) => {
    value.manifest.scripts.check = "true";
  },
  "a conditional required route": (value) => {
    value.manifest.scripts.check += " || true";
  },
  "a removed existing governance gate": (value) => {
    value.manifest.scripts.check = value.manifest.scripts.check.replace(
      " && pnpm governance:validate",
      "",
    );
  },
  "a missing FMS test route": (value) => {
    value.manifest.scripts.test = "node --test scripts/*.test.mjs";
  },
  "authority JSON misclassified as source": (value) => {
    value.trackedPaths.push("governance/authority.ts");
  },
  "a missing CI route": (value) => {
    value.workflow = value.workflow.replace("- run: pnpm check", "- run: pnpm test");
  },
  "a conditional CI route": (value) => {
    value.workflow = value.workflow.replace(
      "- run: pnpm check",
      "- if: always()\n        run: pnpm check",
    );
  },
  "a continue-on-error CI route": (value) => {
    value.workflow = value.workflow.replace(
      "- run: pnpm check",
      "- run: pnpm check\n        continue-on-error: true",
    );
  },
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
  await assert.rejects(() => selectOxlintFiles([...paths, "README.md"]), /selected files differ/u);
});

const foundationCli = resolve("node_modules/@agent-teams/engineering-foundation/dist/cli.js");
const mandatoryCli = resolve(
  "node_modules/@agent-teams/engineering-foundation/dist/node-test-cli.js",
);

async function fixture(t) {
  // Disposable repositories live in the physical OS temp, never inside the governed source tree,
  // so concurrent source censuses cannot observe their scripts/ and tools/ files.
  const root = await mkdtemp(join(await realpath(tmpdir()), "central-foundation-171-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (file, text) => {
    const target = join(root, file);
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, text);
  };
  return { root, put };
}

const runInstalled = (cli, args, root) => {
  assertCompilerFloor();
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 2 * 1024 * 1024,
  });
};
const outputOf = (result) => result.stdout + result.stderr;

test("installed source boundary rejects missing inputs and governed dist source", async (t) => {
  const { root, put } = await fixture(t);
  const policy = structuredClone(accepted.sourcePolicy);
  await put(
    "package.json",
    JSON.stringify({ name: "@agent-teams/fixture", private: true, type: "module" }),
  );
  await put("pnpm-workspace.yaml", "packages: []\n");
  await put("foundation.config.yaml", YAML.stringify(accepted.foundationConfig));
  await put("docs/engineering-quality-source-policy.yaml", YAML.stringify(policy));
  await put(
    "scripts/sample.mjs",
    'import { value } from "../tools/feature-module-standard/check.mjs"; console.log(value);\n',
  );
  await put("tools/feature-module-standard/check.mjs", "export const value = 1;\n");
  for (const path of [
    "tools/renovate-validation/package.json",
    "tools/renovate-validation/pnpm-workspace.yaml",
    "tools/renovate-validation/pnpm-lock.yaml",
  ]) {
    await put(path, await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
  }
  const run = () =>
    runInstalled(
      foundationCli,
      ["check", "architecture.source-dependencies", "--format", "json"],
      root,
    );
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

test("installed mandatory runner rejects omitted and skipped identities with exact OS exceptions", async (t) => {
  const { root, put } = await fixture(t);
  const file = "critical.test.mjs";
  const identity = { file, names: ["critical invariant"], kind: "test" };
  const contract = { schemaVersion: 1, required: [identity], exceptions: [] };
  const run = () => runInstalled(mandatoryCli, ["--contract", "required.json", "--", file], root);
  await put("required.json", JSON.stringify(contract));
  await put(
    file,
    'import test from "node:test"; import assert from "node:assert/strict"; import { writeFile, readFile } from "node:fs/promises"; test("critical invariant", async () => { await writeFile("result", "observed"); assert.equal(await readFile("result", "utf8"), "observed"); });\n',
  );
  const completed = run();
  assert.equal(completed.status, 0, outputOf(completed));
  await put(file, 'import test from "node:test"; test("other test", () => {});\n');
  const omitted = run();
  assert.equal(omitted.status, 1, outputOf(omitted));
  assert.match(outputOf(omitted), /omitted/u);
  await put(
    file,
    'import test from "node:test"; test("critical invariant", { skip: true }, () => {});\n',
  );
  const skipped = run();
  assert.equal(skipped.status, 1, outputOf(skipped));
  assert.match(outputOf(skipped), /skipped/u);
  contract.exceptions = [
    {
      ...identity,
      status: "skipped",
      reason: "Blanket exception is deliberately rejected",
      applicability: { platforms: ["linux", "darwin", "win32"] },
    },
  ];
  await put("required.json", JSON.stringify(contract));
  assert.equal(run().status, 1, "all-platform exceptions must reject");
  // This disposable Windows filesystem fixture needs a Windows filesystem;
  // no exception is added to Central's platform-independent critical contract.
  identity.names = ["Windows filesystem case folding"];
  contract.required = [identity];
  const exception = {
    ...identity,
    status: "skipped",
    reason:
      "Windows filesystem case folding requires Windows; POSIX filesystems use different semantics",
    applicability: { platforms: ["linux", "darwin"] },
  };
  contract.exceptions = [exception];
  await put("required.json", JSON.stringify(contract));
  await put(
    file,
    'import test from "node:test"; import { writeFile, readFile } from "node:fs/promises"; import assert from "node:assert/strict"; test("Windows filesystem case folding", { skip: process.platform !== "win32" }, async () => { await writeFile("CaseFile", "data"); assert.equal(await readFile("casefile", "utf8"), "data"); });\n',
  );
  assert.equal(run().status, 0, "exact platform exception or real Windows completion must pass");
  if (process.platform !== "win32") {
    exception.applicability.platforms = ["win32"];
    await put("required.json", JSON.stringify(contract));
    assert.equal(run().status, 1, "an exception for a different OS cannot admit this skip");
  }
});

test("installed Stack lint accepts ordinary source and rejects a real eval diagnostic", async (t) => {
  const { root, put } = await fixture(t);
  await symlink(
    await realpath(resolve("node_modules")),
    join(root, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await put(
    "package.json",
    JSON.stringify({ name: "central-stack-lint-test", private: true, type: "module" }),
  );
  await put(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, types: [] },
      files: ["probe.ts"],
    }),
  );
  await put(
    "oxlint.json",
    JSON.stringify({ extends: ["./node_modules/stack-toolchain/presets/oxlint/node.json"] }),
  );
  await put(
    "toolchain.config.json",
    JSON.stringify({
      schemaVersion: 1,
      profile: "typescript-node",
      typecheck: { projects: ["tsconfig.json"] },
      lint: { config: "oxlint.json", paths: ["probe.ts"] },
      format: { paths: ["probe.ts"] },
    }),
  );
  const cli = resolve("node_modules/stack-toolchain/dist/cli.js");
  const run = () => runInstalled(cli, ["lint"], root);
  await put("probe.ts", "export const value = 1;\n");
  const positive = run();
  assert.equal(positive.status, 0, outputOf(positive));
  await put("probe.ts", 'export const value = eval("1");\n');
  const negative = run();
  assert.equal(negative.status, 1, outputOf(negative));
  assert.match(outputOf(negative), /no-eval/u);
});

test("source census preserves default UTF-16 ordering for portable names", () => {
  const paths = [
    "scripts/a,.mjs",
    "scripts/a.mjs",
    "scripts/ä.mjs",
    "scripts/Z.mjs",
    "scripts/😀.mjs",
  ];
  assert.deepEqual(
    classifyTrackedPaths(paths).classified.map((entry) => entry.path),
    paths.toSorted(),
  );
});
