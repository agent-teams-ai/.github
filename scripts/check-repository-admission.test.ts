import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseDocument } from "yaml";
import { ADMISSION_CALLER, BOOTSTRAP_GUIDE, checkRepositoryAdmission, directCommands, expandAdmissionScript, IDENTITY_REVISION, localAdmissionSource, MAX_FILE_BYTES, renderRepositoryAdmissionCaller } from "./check-repository-admission.ts";
import type { AdmissionSource } from "./check-repository-admission.ts";

const revision = "1".repeat(40);
const json = (value: unknown): string => `${JSON.stringify(value)}\n`;

test("reusable workflow executes the exact published central implementation on inert consumer files", async () => {
  const workflow = parseDocument(await readFile(new URL("../.github/workflows/repository-admission-check.yml", import.meta.url), "utf8")).toJS({ maxAliasCount: 0 }) as {
    on: unknown;
    permissions: unknown;
    jobs: { admission: { steps: { uses?: string; run?: string; with?: Record<string, unknown> }[] } };
  };
  assert.deepEqual(workflow.on, { workflow_call: null });
  assert.deepEqual(workflow.permissions, { contents: "read" });
  const steps = workflow.jobs.admission.steps;
  assert.deepEqual(steps.filter(step => step.run !== undefined).map(step => step.run), [
    "pnpm --dir central install --frozen-lockfile --ignore-scripts --ignore-pnpmfile",
    "node central/scripts/check-repository-admission.ts --root consumer",
  ]);
  assert.deepEqual(steps.filter(step => step.uses?.startsWith("actions/checkout@")).map(step => step.with), [
    { path: "consumer", "persist-credentials": false },
    { repository: "agent-teams-ai/.github", ref: "6d1fa7740d84cdf810b7c30f821c6e2ab1fd7b29", path: "central", "persist-credentials": false },
  ]);
  for (const actionStep of steps.filter(step => step.uses !== undefined)) { assert.match(actionStep.uses ?? "", /@(?!0{40}$)[a-f0-9]{40}$/u); }
});

async function fixture(): Promise<{ files: Map<string, string>; source: AdmissionSource }> {
  const files = new Map<string, string>([
    [ADMISSION_CALLER, renderRepositoryAdmissionCaller(revision)],
    [".github/workflows/commit-author-identity.yml", (await readFile(new URL("./fixtures/commit-author-identity-caller.yml", import.meta.url), "utf8")).replaceAll("CENTRAL_REVISION", IDENTITY_REVISION)],
    ["AGENTS.md", `Follow ${BOOTSTRAP_GUIDE}\n`],
    ["CLAUDE.md", "@AGENTS.md\n"],
    ["README.md", "Read architecture/profile.json\n"],
    ["pnpm-lock.yaml", "lockfileVersion: '9.0'\n"],
    ["docs/adoption.md", "Owner decision: adopt all production modules including this SDK.\n"],
    ["package.json", json({ packageManager: "pnpm@11.25.0", devDependencies: { "@agent-teams/engineering-foundation": "2.1.1", "@agent-teams/feature-module-standard": "0.2.3" }, scripts: {
      check: "pnpm architecture:features:check && pnpm quality:scope && pnpm quality:typed && pnpm typecheck && pnpm foundation:check && pnpm foundation:dev && pnpm foundation:registry && pnpm test",
      "architecture:features:check": "node tools/check-feature-modules.ts",
      "quality:scope": "agent-teams-foundation quality check --consumer . --scope-only",
      "quality:typed": "agent-teams-foundation quality check --consumer .",
      typecheck: "tsc --project packages/sdk/tsconfig.json",
      "foundation:check": "agent-teams-foundation check",
      "foundation:dev": "agent-teams-foundation assert-dev-only",
      "foundation:registry": "agent-teams-foundation assert-registry",
      test: "node --test packages/sdk/test/features.test.ts",
    } })],
    ["foundation.config.yaml", json({ schemaVersion: 2, capabilities: {
      "architecture.source-dependencies": { configPath: "architecture/source.yaml" },
      "quality.source-coverage": { configPath: "architecture/coverage.yaml" },
      "quality.suppression-governance": { configPath: "architecture/suppressions.yaml" },
    } })],
    ["architecture/source.yaml", json({ governedRoots: ["packages/sdk/src"] })],
    ["architecture/suppressions.yaml", json({ schemaVersion: 1, suppressions: [] })],
    ["architecture/coverage.yaml", json({ sourcePolicyPath: "architecture/source.yaml", suppressionPolicyPath: "architecture/suppressions.yaml", lintConfigPath: "oxlint.json", featureProfilePath: "architecture/profile.json", compilerProjects: ["packages/sdk/tsconfig.json"], scripts: { full: "check", scope: "quality:scope", typed: "quality:typed" } })],
    ["oxlint.json", json({ extends: ["./node_modules/@agent-teams/engineering-foundation/presets/oxlint/type-aware.json"] })],
    ["packages/sdk/tsconfig.json", json({ extends: "../../tsconfig.base.json", include: ["src/**/*.ts"] })],
    ["tsconfig.base.json", json({ compilerOptions: { strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true } })],
    ["architecture/profile.json", json({ status: "adopted", standard: { id: "agent-teams.feature-module-standard", version: "v1.1", repository: "agent-teams-ai/.github", commit: revision, path: "docs/architecture/feature-module-standard/v1.1.md", digest: "sha256:cfa088ef7396139554fe5e3bcc839271b23299c6b60c569a3a7f1cd7c9f0bc6c" }, architectureDocument: "docs/adoption.md", decisionRecords: ["docs/adoption.md#decision"], productionRoots: ["packages"], applicationRoots: [], excludedRoots: [], extensions: [], deviations: [], modules: [{ id: "sdk", role: "sdk", root: "packages/sdk", sourceRoot: "packages/sdk/src", features: [{ id: "evidence", root: "packages/sdk/src/features/evidence", layers: [{ role: "application", root: "packages/sdk/src/features/evidence/application" }] }] }], enforcementCommands: ["pnpm architecture:features:check", "pnpm quality:scope", "pnpm quality:typed", "pnpm check"] })],
    [".github/workflows/checks.yaml", json({ on: { pull_request: null }, jobs: { check: { "runs-on": "ubuntu-24.04", steps: [{ run: "pnpm check" }] } } })],
  ]);
  return { files, source: { read: async path => files.get(path), workflows: async () => [...files.keys()].filter(path => /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(path)) } };
}

test("complete explicit SDK bootstrap reports configuration only without executing consumer code", async () => {
  const { source } = await fixture();
  const result = await checkRepositoryAdmission(source);
  assert.deepEqual(result.issues, []);
  assert.equal(result.status, "configured_not_qualified");
  assert.equal(result.guide, BOOTSTRAP_GUIDE);
  assert.ok(result.inspected_paths.includes("tsconfig.base.json"));
});

test("association successor requires its reviewed caller and rejects predecessor or unreviewed identity pins", async () => {
  const path = ".github/workflows/commit-author-identity.yml";
  const template = await readFile(new URL("./fixtures/commit-author-identity-caller.yml", import.meta.url), "utf8");
  const reviewed = "1f8dc7a2ee33e3cc3810f0c4c2d5e9f3f20241d0";
  const { files, source } = await fixture();
  files.set(path, template.replaceAll("CENTRAL_REVISION", reviewed));
  const accepted = await checkRepositoryAdmission(source);
  assert.deepEqual(accepted.issues, []);
  assert.equal(accepted.status, "configured_not_qualified");
  for (const pin of ["6d843f3a2c3f616aa2f4b902a866b1ff1a18f9c6", revision, "0".repeat(40), "main"]) {
    files.set(path, template.replaceAll("CENTRAL_REVISION", pin));
    const rejected = await checkRepositoryAdmission(source);
    assert.equal(rejected.status, "incomplete", pin);
    assert.equal(rejected.guide, BOOTSTRAP_GUIDE);
    assert.ok(rejected.issues.some(issue => issue.path === path && issue.message.includes("trusted implementation pin")), pin);
  }
  files.delete(path);
  const absent = await checkRepositoryAdmission(source);
  assert.equal(absent.status, "incomplete");
  assert.ok(absent.issues.some(issue => issue.path === path && issue.message.includes("missing")));
});

test("missing root foundation and wholly absent admission caller fail with the canonical guide", async () => {
  const { files, source } = await fixture();
  files.delete("foundation.config.yaml");
  files.delete(ADMISSION_CALLER);
  const result = await checkRepositoryAdmission(source);
  assert.equal(result.status, "incomplete");
  assert.equal(result.guide, BOOTSTRAP_GUIDE);
  assert.ok(result.issues.some(issue => issue.path === "foundation.config.yaml" && issue.message.includes("missing")));
  assert.ok(result.issues.some(issue => issue.path === ADMISSION_CALLER && issue.message.includes("missing")));
});

test("Bun native tests are leaves while explicit bun run references expand package scripts", async () => {
  assert.deepEqual([...expandAdmissionScript("check", { check: "bun run test", test: "bun test" }, "bun")], ["bun test"]);
  const { files, source } = await fixture();
  const manifest = JSON.parse(files.get("package.json") ?? "{}") as { packageManager: string; scripts: Record<string, string> };
  manifest.packageManager = "bun@1.0.0";
  for (const [name, command] of Object.entries(manifest.scripts)) { manifest.scripts[name] = command.replaceAll("pnpm ", "bun run "); }
  manifest.scripts.test = "bun test";
  files.set("package.json", json(manifest));
  const profile = JSON.parse(files.get("architecture/profile.json") ?? "{}") as { enforcementCommands: string[] };
  profile.enforcementCommands = profile.enforcementCommands.map(command => command.replaceAll("pnpm ", "bun run "));
  files.set("architecture/profile.json", json(profile));
  files.set(".github/workflows/checks.yaml", json({ on: { pull_request: null }, jobs: { check: { "runs-on": "ubuntu-24.04", steps: [{ run: "bun run check" }] } } }));
  files.set("bun.lock", "{}\n");
  files.delete("pnpm-lock.yaml");
  assert.deepEqual((await checkRepositoryAdmission(source)).issues, []);
});

test("known non-main default branches remain explicitly unsupported", async () => {
  const { source } = await fixture();
  const result = await checkRepositoryAdmission({ ...source, defaultBranch: "master" });
  assert.equal(result.status, "unsupported_stack_pending");
  assert.ok(result.issues.some(issue => issue.message.includes("branch layout")));
});

test("native no-op, comments and quoted command text cannot establish a gate", async () => {
  for (const command of ["# pnpm check\nexit 0", "echo pnpm check", "true && pnpm check", "pnpm check || true", "echo 'pnpm check'", "if true; then pnpm check; fi"]) {
    assert.deepEqual(directCommands(command), []);
    const { files, source } = await fixture();
    files.set(".github/workflows/checks.yaml", json({ on: { pull_request: null }, jobs: { check: { steps: [{ run: command }] } } }));
    assert.ok((await checkRepositoryAdmission(source)).issues.some(issue => issue.path === ".github/workflows"), command);
  }
  assert.deepEqual(directCommands("# documentation\npnpm check"), ["pnpm check"]);
});

test("conditional PRs, conditional dependencies, absent needs and cycles cannot cover native gates", async () => {
  const cases = [
    { on: { pull_request: { paths: ["src/**"] } }, jobs: { check: { steps: [{ run: "pnpm check" }] } } },
    { on: { pull_request: null }, jobs: { check: { if: "github.event_name == 'push'", steps: [{ run: "pnpm check" }] } } },
    { on: { pull_request: null }, jobs: { setup: { if: "false", steps: [] }, check: { needs: "setup", steps: [{ run: "pnpm check" }] } } },
    { on: { pull_request: null }, jobs: { check: { needs: "missing", steps: [{ run: "pnpm check" }] } } },
    { on: { pull_request: null }, jobs: { setup: { needs: "check", steps: [] }, check: { needs: "setup", steps: [{ run: "pnpm check" }] } } },
    { on: { pull_request: null }, jobs: { check: { steps: [{ if: "false", run: "pnpm check" }] } } },
  ];
  for (const workflow of cases) {
    const { files, source } = await fixture();
    files.set(".github/workflows/checks.yaml", json(workflow));
    assert.equal((await checkRepositoryAdmission(source)).status, "incomplete");
  }
});

test("custom shells and non-failing package-script newlines never count as native gates", async () => {
  const shellFixture = await fixture();
  shellFixture.files.set(".github/workflows/checks.yaml", json({ on: { pull_request: null }, jobs: { check: { "runs-on": "ubuntu-24.04", steps: [{ shell: "echo {0}", run: "pnpm check" }] } } }));
  assert.equal((await checkRepositoryAdmission(shellFixture.source)).status, "incomplete");
  const newlineFixture = await fixture();
  const manifest = JSON.parse(newlineFixture.files.get("package.json") ?? "{}") as { scripts: Record<string, string> };
  manifest.scripts.check = manifest.scripts.check?.replaceAll(" && ", "\n") ?? "";
  newlineFixture.files.set("package.json", json(manifest));
  assert.equal((await checkRepositoryAdmission(newlineFixture.source)).status, "incomplete");
  for (const [path, text] of [[".npmrc", "script-shell=/bin/echo\n"], ["pnpm-workspace.yaml", "scriptShell: /bin/echo\n"], ["pnpm-workspace.yaml", "shellEmulator: true\n"]]) {
    assert.ok(path !== undefined && text !== undefined);
    const managerFixture = await fixture();
    managerFixture.files.set(path, text);
    assert.ok((await checkRepositoryAdmission(managerFixture.source)).issues.some(issue => issue.path === path));
  }
});

test("compiler probes and disabled checking cannot substitute for production compilation", async () => {
  for (const command of ["tsc --version", "tsc --help", "tsc --showConfig", "tsc --listFilesOnly", "tsc --build --dry", "tsc --build --clean", "tsc --noCheck", "tsc --project packages/sdk/tsconfig.json --strict false"]) {
    const { files, source } = await fixture();
    const manifest = JSON.parse(files.get("package.json") ?? "{}") as { scripts: Record<string, string> };
    manifest.scripts.typecheck = command;
    files.set("package.json", json(manifest));
    assert.ok((await checkRepositoryAdmission(source)).issues.some(issue => issue.message.includes("compiler/build")), command);
  }
});

test("native test and feature help probes cannot replace their actual gates", async () => {
  const { files, source } = await fixture();
  const manifest = JSON.parse(files.get("package.json") ?? "{}") as { scripts: Record<string, string> };
  manifest.scripts.test = "node --test --help";
  manifest.scripts["architecture:features:check"] = "feature-module-standard check --help";
  files.set("package.json", json(manifest));
  const result = await checkRepositoryAdmission(source);
  assert.ok(result.issues.some(issue => issue.message.includes("actual native tests")));
  assert.ok(result.issues.some(issue => issue.message.includes("actual deterministic FMS")));
});

test("duplicate script and needs DAGs have bounded memoized traversal", async () => {
  const moduleUrl = new URL("./check-repository-admission.ts", import.meta.url).href;
  execFileSync(process.execPath, ["--input-type=module", "-e", `import { expandAdmissionScript } from ${JSON.stringify(moduleUrl)};
    const scripts = {};
    for (let i = 0; i < 28; i++) scripts['s' + i] = i === 27 ? 'tsc --project tsconfig.json' : 'pnpm s' + (i + 1) + ' && pnpm s' + (i + 1);
    if (expandAdmissionScript('s0', scripts, 'pnpm').size !== 1) process.exit(1);`], { timeout: 2000, stdio: "pipe" });
  const { files, source } = await fixture();
  const jobs: Record<string, unknown> = {};
  for (let i = 0; i < 28; i++) {
    jobs[`job${i}`] = { "runs-on": "ubuntu-24.04", ...(i === 0 ? {} : { needs: [`job${i - 1}`, `job${i - 1}`] }), steps: i === 27 ? [{ run: "pnpm check" }] : [] };
  }
  files.set(".github/workflows/checks.yaml", json({ on: { pull_request: null }, jobs }));
  assert.deepEqual((await checkRepositoryAdmission(source)).issues, []);
});

test("a legitimate single-package root module maps to its root compiler project", async () => {
  const { files, source } = await fixture();
  const profile = JSON.parse(files.get("architecture/profile.json") ?? "{}") as { modules: { root: string }[] };
  assert.ok(profile.modules[0]);
  profile.modules[0].root = ".";
  files.set("architecture/profile.json", json(profile));
  assert.deepEqual((await checkRepositoryAdmission(source)).issues, []);
});

test("canonical callers reject secrets, moving pins and identity template drift", async () => {
  for (const replacement of [renderRepositoryAdmissionCaller(revision).replace(revision, "main"), `${renderRepositoryAdmissionCaller(revision)}    secrets: inherit\n`, renderRepositoryAdmissionCaller(revision).replace("  admission:", "  admission:\n    if: false")]) {
    const { files, source } = await fixture();
    files.set(ADMISSION_CALLER, replacement);
    assert.ok((await checkRepositoryAdmission(source)).issues.some(issue => issue.path === ADMISSION_CALLER));
  }
  const { files, source } = await fixture();
  files.set(".github/workflows/commit-author-identity.yml", files.get(".github/workflows/commit-author-identity.yml")?.replace(IDENTITY_REVISION, revision) ?? "");
  assert.ok((await checkRepositoryAdmission(source)).issues.some(issue => issue.path === ".github/workflows/commit-author-identity.yml"));
});

test("compiler weakening and an empty SDK profile remain incomplete", async () => {
  const { files, source } = await fixture();
  files.set("tsconfig.base.json", json({ compilerOptions: { strict: false } }));
  const result = await checkRepositoryAdmission(source);
  assert.ok(result.issues.some(issue => issue.path === "packages/sdk/tsconfig.json" && issue.message.includes("strict")));
  for (const overrides of [{ noCheck: true }, { strictNullChecks: false }]) {
    files.set("tsconfig.base.json", json({ compilerOptions: { strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, ...overrides } }));
    assert.ok((await checkRepositoryAdmission(source)).issues.some(issue => issue.path === "packages/sdk/tsconfig.json" && issue.message.includes("weakening")));
  }
  files.set("architecture/profile.json", json({ modules: [] }));
  assert.ok((await checkRepositoryAdmission(source)).issues.some(issue => issue.message.includes("every production module")));
  assert.throws(() => expandAdmissionScript("check", { check: "pnpm alias", alias: "pnpm check" }, "pnpm"), /cyclic/u);
});

test("local reader rejects symlinks, oversized files, invalid UTF-8 and traversal", async () => {
  const root = await mkdtemp(join(tmpdir(), "repository-admission-reader-"));
  try {
    await writeFile(join(root, "target"), "inert");
    await symlink(join(root, "target"), join(root, "link"));
    await writeFile(join(root, "large"), Buffer.alloc(MAX_FILE_BYTES + 1));
    await writeFile(join(root, "invalid"), Buffer.from([0xc3, 0x28]));
    execFileSync("mkfifo", [join(root, "fifo")]);
    const source = await localAdmissionSource(root);
    assert.equal(await source.read("target"), "inert");
    for (const path of ["link", "large", "invalid", "../target"]) { await assert.rejects(source.read(path)); }
    execFileSync(process.execPath, ["--input-type=module", "-e", `import { localAdmissionSource } from ${JSON.stringify(new URL("./check-repository-admission.ts", import.meta.url).href)};
      const source = await localAdmissionSource(${JSON.stringify(root)});
      try { await source.read('fifo'); process.exit(1); } catch {}`], { timeout: 2000, stdio: "pipe" });
  } finally { await rm(root, { recursive: true, force: true }); }
});
