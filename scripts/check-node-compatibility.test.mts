import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

import { assertNodeRuntime } from "./assert-node-runtime.mts";
import { checkNodeCompatibility, compatibilityWorkflowPaths, loadInstalledYaml } from "./check-node-compatibility.mts";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const checkerCli = fileURLToPath(new URL("./check-node-compatibility.mts", import.meta.url));
const helperRoot = "tools/node-compatibility-tooling";
const strictFlags = "--config.engine-strict=true --config.strict-peer-dependencies=true";
const installed = await loadInstalledYaml(repositoryRoot);
const workflows = new Map<string, string>();
for (const path of [...compatibilityWorkflowPaths, ".github/workflows/docs-protocol-check.yml"]) {
  workflows.set(path, await readFile(join(repositoryRoot, path), "utf8"));
}
type Data = Record<string, unknown>;
type SourceMutation = (source: string) => string;
interface SourceCase { name: string; file: string; change: SourceMutation; expected: RegExp; }
function isData(value: unknown): value is Data {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function data(value: unknown): Data {
  assert.ok(isData(value));
  return value;
}
function json(source: string): Data {
  const value: unknown = JSON.parse(source);
  return data(value);
}
function sourceOf(file: string): string {
  const source = workflows.get(`.github/workflows/${file}`);
  assert.ok(source !== undefined);
  return source;
}
async function put(root: string, path: string, source: string): Promise<void> {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, source);
}
async function provisionChild(root: string): Promise<void> {
  const target = join(root, helperRoot, "node_modules/yaml");
  await mkdir(dirname(target), { recursive: true });
  await cp(installed.packageRoot, target, { recursive: true });
}
async function makeFixture(t: TestContext): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "node-compatibility-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [path, source] of workflows) { await put(root, path, source); }
  for (const name of ["package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml"]) {
    await put(root, `${helperRoot}/${name}`, await readFile(join(repositoryRoot, helperRoot, name), "utf8"));
  }
  await put(root, "package.json", await readFile(join(repositoryRoot, "package.json"), "utf8"));
  await put(root, ".node-version", "24.21.0\n");
  await put(root, ".npmrc", "engine-strict=true\nstrict-peer-dependencies=true\n");
  await put(root, "pnpm-workspace.yaml", "minimumReleaseAge: 0\n");
  await provisionChild(root);
  return root;
}
async function rejectsSource(t: TestContext, file: string, change: SourceMutation, expected: RegExp): Promise<void> {
  const root = await makeFixture(t);
  const source = sourceOf(file), mutated = change(source);
  assert.notEqual(mutated, source, `fixture mutation for ${file} must take effect`);
  await put(root, `.github/workflows/${file}`, mutated);
  await assert.rejects(checkNodeCompatibility(root), expected);
}
const ci = sourceOf("ci.yml");
const sourceCases: SourceCase[] = [
  { name: "rejects a renamed required CI context", file: "ci.yml", change: source => source.replace("    name: check\n", "    name: check (Node 24.21.0)\n"), expected: /exact required check context/u },
  { name: "rejects matrix-expanded required CI contexts", file: "ci.yml", change: source => source.replace("    name: check\n", "    name: check\n    strategy:\n      matrix:\n        os: [ubuntu-24.04]\n"), expected: /exact required check context/u },
  { name: "rejects coupling the independent Node 26 CI job to check", file: "ci.yml", change: source => source.replace("  node26-compatibility:\n", "  node26-compatibility:\n    needs: check\n"), expected: /keep the Node 26 job independent/u },
  { name: "rejects a workflow that loses the Node 26 compatibility lane", file: "ci.yml", change: source => source.replace("  node26-compatibility:", "  removed-compatibility:"), expected: /retain its node26-compatibility compatibility job/u },
  { name: "rejects a runtime comparison disabled by a shell comment", file: "ci.yml", change: source => source.replace("throw Error('Node runtime mismatch')", "console.log('Node runtime mismatch')"), expected: /execute the selected Node version comparison/u },
  { name: "rejects an install that relies on ignored npmrc strictness flags", file: "ci.yml", change: source => source.replace(`pnpm install --frozen-lockfile ${strictFlags}`, "pnpm install --frozen-lockfile --config.engine-strict=true"), expected: /CI must use a frozen strict install/u },
  { name: "rejects a matrix-coupled ReviewRouter interaction compatibility lane", file: "reviewrouter-interaction.yml", change: () => sourceOf("reviewrouter-codex.yml"), expected: /retain its node26-compatibility compatibility job/u },
  { name: "rejects a proof run with a shell override that suppresses failure", file: "ci.yml", change: source => source.replace("      - name: Prove selected Node runtime", "      - name: Prove selected Node runtime\n        shell: bash {0}"), expected: /execute the selected Node version comparison/u },
  { name: "rejects job defaults that remove the runtime proof failure shell", file: "ci.yml", change: source => source.replace("  check:\n", "  check:\n    defaults:\n      run:\n        shell: bash {0}\n"), expected: /must not override the job run shell/u },
  { name: "rejects skipped Node setup and proof steps", file: "ci.yml", change: source => source.replace("      - uses: actions/setup-node@", "      - if: false\n        uses: actions/setup-node@").replace("      - name: Prove selected Node runtime", "      - name: Prove selected Node runtime\n        if: false"), expected: /must not skip Node setup/u },
  { name: "rejects proof steps allowed to continue after failure", file: "ci.yml", change: source => source.replace("      - name: Prove selected Node runtime", "      - name: Prove selected Node runtime\n        continue-on-error: true"), expected: /execute the selected Node version comparison/u },
  { name: "rejects a fresh compatibility job without its isolated parser install", file: "reviewrouter-codex.yml", change: source => source.replace(`      - name: Install isolated compatibility parser\n        run: pnpm --dir ${helperRoot} install --frozen-lockfile --ignore-scripts --ignore-pnpmfile ${strictFlags}\n`, ""), expected: /install its pinned isolated parser/u },
  { name: "rejects a compatibility job that omits its parser check", file: "reviewrouter-codex.yml", change: source => source.replace("      - name: Check bounded Node compatibility contract", "      - name: Skipped Node compatibility contract"), expected: /install its pinned isolated parser before checking/u },
  { name: "rejects a parser check whose shell can hide the first command failure", file: "reviewrouter-codex.yml", change: source => source.replace("      - name: Check bounded Node compatibility contract", "      - name: Check bounded Node compatibility contract\n        shell: bash {0}"), expected: /install its pinned isolated parser before checking/u },
  { name: "rejects a strict lockgraph step whose shell can hide a failed peer check", file: "ci.yml", change: source => source.replace("      - run: |\n          pnpm install --frozen-lockfile", "      - shell: bash {0}\n        run: |\n          pnpm install --frozen-lockfile"), expected: /CI must use a frozen strict install/u },
  { name: "rejects replacing the CI file pin with a literal production runtime", file: "ci.yml", change: source => source.replace("node-version-file: .node-version", "node-version: 24.21.0"), expected: /CI must select the Node 24 production runtime from .node-version/u },
  { name: "rejects runtime drift in the current accepted public Docs workflow", file: "docs-protocol-check.yml", change: source => source.replaceAll("node-version: 24.21.0", "node-version: 26.10.0"), expected: /current public Docs reusable workflow must retain its accepted-main bytes/u },
  { name: "rejects substituting historical runtime pins into the current public Docs workflow", file: "docs-protocol-check.yml", change: source => source.replaceAll("node-version: 24.21.0", "node-version: 24.18.0"), expected: /current public Docs reusable workflow must retain its accepted-main bytes/u },
  { name: "rejects byte drift even when the current public Docs workflow semantics are unchanged", file: "docs-protocol-check.yml", change: source => `${source}\n`, expected: /current public Docs reusable workflow must retain its accepted-main bytes/u },
];
for (const scenario of sourceCases) {
  test(scenario.name, async t => rejectsSource(t, scenario.file, scenario.change, scenario.expected));
}

test("accepts explicit Node 24 and Node 26 lanes with strict installs", async t => {
  const root = await makeFixture(t);
  assert.deepEqual(await checkNodeCompatibility(root), {
    productionDefault: "24.21.0", compatibility: "26.10.0", skippedMajor: 25, strictInstall: true,
  });
  const parser = await loadInstalledYaml(root);
  assert.equal(parser.name, "yaml");
  assert.equal(parser.version, "2.9.1");
  assert.deepEqual(parser.parse("value: installed\n"), { value: "installed" });
});
test("runtime proof rejects Node 25 and version mismatches", () => {
  assert.throws(() => assertNodeRuntime("25.0.0", "v25.0.0"), /Unsupported Node compatibility version/u);
  assert.throws(() => assertNodeRuntime("24.18.0", "v24.18.0"), /Unsupported Node compatibility version/u);
  assert.throws(() => assertNodeRuntime("24.21.0", "v24.18.0"), /Expected Node v24\.21\.0/u);
  assert.throws(() => assertNodeRuntime("26.10.0", "v24.21.0"), /Expected Node v26\.10\.0/u);
  assert.equal(assertNodeRuntime("24.21.0", "v24.21.0").lane, "production-default");
  assert.equal(assertNodeRuntime("26.10.0", "v26.10.0").lane, "node26-compatibility");
});
test("rejects a strict-install regression", async t => {
  const root = await makeFixture(t);
  await put(root, ".npmrc", "engine-strict=false\n");
  await assert.rejects(checkNodeCompatibility(root), /strict engine enforcement/u);
});
test("rejects a parser tool that loses the exact package manager pin", async t => {
  const root = await makeFixture(t), path = `${helperRoot}/package.json`;
  const manifest = json(await readFile(join(root, path), "utf8"));
  manifest.packageManager = "pnpm@11.17.0";
  await put(root, path, JSON.stringify(manifest));
  await assert.rejects(checkNodeCompatibility(root), /exact pnpm and YAML pins/u);
});
test("rejects stale Node 24 default and proof pins", async t => {
  const root = await makeFixture(t);
  await put(root, ".node-version", "24.18.0\n");
  await assert.rejects(checkNodeCompatibility(root), /Node 24 production default/u);
  await rejectsSource(t, "ci.yml", source => source.replace("EXPECTED_NODE_VERSION: 24.21.0", "EXPECTED_NODE_VERSION: 24.18.0"), /execute the selected Node version comparison/u);
});
test("required parser steps reject skipped setup, install, and check", async t => {
  for (const marker of ["      - uses: pnpm/action-setup@", "      - name: Install isolated compatibility parser", "      - name: Check bounded Node compatibility contract"]) {
    await rejectsSource(t, "reviewrouter-codex.yml", source => source.replace(marker, marker.replace("      - ", "      - if: false\n        ")), /install its pinned isolated parser/u);
  }
});
test("CI Node 26 rejects a reused root install and weakened parser isolation", async t => {
  const changes: SourceMutation[] = [
    source => source.replaceAll(`pnpm --dir ${helperRoot} install`, "pnpm install"),
    source => source.replaceAll("--frozen-lockfile --ignore-scripts --ignore-pnpmfile", "--ignore-scripts --ignore-pnpmfile"),
    source => source.replaceAll("--config.strict-peer-dependencies=true", "--config.strict-peer-dependencies=false"),
  ];
  for (const change of changes) { await rejectsSource(t, "ci.yml", change, /pinned isolated parser/u); }
  assert.ok(ci.length > 0);
});
test("rejects parser version or integrity drift", async t => {
  const cases: ReadonlyArray<readonly [string, SourceMutation, RegExp]> = [
    ["package.json", source => source.replace("2.9.1", "2.9.0"), /exact pnpm and YAML pins/u],
    ["pnpm-lock.yaml", source => source.replace("sha512-3NxN8+78", "sha512-4NxN8+78"), /exact lock integrity/u],
    ["package.json", source => JSON.stringify({ ...json(source), scripts: { postinstall: "node unexpected.mjs" } }), /private passive metadata package/u],
  ];
  for (const [name, change, expected] of cases) {
    const root = await makeFixture(t), path = `${helperRoot}/${name}`;
    const source = await readFile(join(root, path), "utf8"), mutated = change(source);
    assert.notEqual(mutated, source);
    await put(root, path, mutated);
    await assert.rejects(checkNodeCompatibility(root), expected);
  }
});

async function provisionParent290(root: string): Promise<void> {
  const target = join(root, "node_modules/yaml");
  await mkdir(dirname(target), { recursive: true });
  const existing = join(repositoryRoot, "node_modules/yaml");
  let useExisting = false;
  try { useExisting = json(await readFile(join(existing, "package.json"), "utf8")).version === "2.9.0"; }
  catch (error: unknown) {
    if (data(error).code !== "ENOENT") { throw error; }
  }
  if (useExisting) { await cp(await realpath(existing), target, { recursive: true }); return; }
  // Standalone Node 26 CI installs only the helper. Provision a real public
  // yaml@2.9.0 TEST parent using the unchanged root lock's exact package entry.
  const rootLock = data(installed.parse(await readFile(join(repositoryRoot, "pnpm-lock.yaml"), "utf8")));
  const packageEntry = data(data(rootLock.packages)["yaml@2.9.0"]);
  assert.equal(typeof data(packageEntry.resolution).integrity, "string");
  const staging = join(root, "parent-parser-provision");
  await put(staging, "package.json", JSON.stringify({
    name: "node-compatibility-parent-fixture", version: "0.0.0", private: true,
    packageManager: "pnpm@11.18.0", engines: { node: ">=24.18.0 <25 || >=26.10.0 <27" },
    dependencies: { yaml: "2.9.0" },
  }));
  await put(staging, "pnpm-workspace.yaml", "packages:\n  - .\nminimumReleaseAge: 0\n");
  await put(staging, "pnpm-lock.yaml", JSON.stringify({
    lockfileVersion: "9.0", settings: { autoInstallPeers: true, excludeLinksFromLockfile: false },
    importers: { ".": { dependencies: { yaml: { specifier: "2.9.0", version: "2.9.0" } } } },
    packages: { "yaml@2.9.0": packageEntry }, snapshots: { "yaml@2.9.0": {} },
  }));
  const result = spawnSync("pnpm", ["--dir", staging, "install", "--frozen-lockfile", "--ignore-scripts", "--ignore-pnpmfile",
    "--config.engine-strict=true", "--config.strict-peer-dependencies=true"], {
    cwd: staging, encoding: "utf8", timeout: 90000, maxBuffer: 2 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stdout + result.stderr);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const actual = await realpath(join(staging, "node_modules/yaml"));
  assert.equal(json(await readFile(join(actual, "package.json"), "utf8")).version, "2.9.0");
  await cp(actual, target, { recursive: true });
}

for (const version of ["2.9.0", "2.9.1"] as const) {
  test(`actual checker rejects parent-only installed yaml@${version}`, { timeout: 120000 }, async t => {
    const root = await makeFixture(t);
    if (version === "2.9.0") { await provisionParent290(root); }
    else {
      await mkdir(join(root, "node_modules"), { recursive: true });
      await cp(installed.packageRoot, join(root, "node_modules/yaml"), { recursive: true });
    }
    await rm(join(root, helperRoot, "node_modules"), { recursive: true });
    const fallback = createRequire(join(root, helperRoot, "package.json"));
    assert.equal(await realpath(fallback.resolve("yaml")), await realpath(createRequire(join(root, "package.json")).resolve("yaml")));
    const parentIdentity = json(await readFile(join(root, "node_modules/yaml/package.json"), "utf8"));
    assert.equal(parentIdentity.name, "yaml");
    assert.equal(parentIdentity.version, version);
    const parent: unknown = fallback("yaml");
    const parentParser = data(parent);
    assert.equal(typeof parentParser.parse, "function");
    if (typeof parentParser.parse !== "function") { throw new Error("Parent fixture parser is unavailable."); }
    const parsed: unknown = parentParser.parse("value: parent-parser-works\n");
    assert.deepEqual(parsed, { value: "parent-parser-works" });
    await assert.rejects(checkNodeCompatibility(root), /explicitly provisioned child YAML/u);
    const refused = spawnSync(process.execPath, [checkerCli], { cwd: root, encoding: "utf8", timeout: 30000 });
    assert.ifError(refused.error);
    assert.equal(refused.status, 1, refused.stdout + refused.stderr);
    assert.match(refused.stderr, /explicitly provisioned child YAML/u);
    await provisionChild(root);
    await assert.doesNotReject(checkNodeCompatibility(root));
    const restored = spawnSync(process.execPath, [checkerCli], { cwd: root, encoding: "utf8", timeout: 30000 });
    assert.ifError(restored.error);
    assert.equal(restored.status, 0, restored.stdout + restored.stderr);
  });
}
test("actual checker rejects a locally installed yaml 2.9.0 despite correct helper metadata", { timeout: 120000 }, async t => {
  const root = await makeFixture(t);
  await provisionParent290(root);
  const child = join(root, helperRoot, "node_modules/yaml");
  await rm(child, { recursive: true });
  await cp(join(root, "node_modules/yaml"), child, { recursive: true });
  await assert.rejects(checkNodeCompatibility(root), /installed YAML identity must be exactly yaml@2\.9\.1/u);
});
test("actual checker rejects a child link to a parent parser with the correct version", async t => {
  const root = await makeFixture(t);
  const parent = join(root, "node_modules/yaml"), child = join(root, helperRoot, "node_modules/yaml");
  await mkdir(dirname(parent), { recursive: true });
  await cp(installed.packageRoot, parent, { recursive: true });
  await rm(child, { recursive: true });
  await symlink(parent, child, "junction");
  await assert.rejects(checkNodeCompatibility(root), /parent or external installation fallback is forbidden/u);
});

interface MatrixCase { name: string; mutate: (workflow: Data, job: Data, matrix: Data) => void; expected: RegExp; }
function stepsOf(job: Data): Data[] {
  assert.ok(Array.isArray(job.steps));
  const entries: unknown[] = job.steps;
  return entries.map(data);
}
const matrixCases: MatrixCase[] = [
  { name: "fixed Node 24 setup and proof behind a nominal two-version matrix", mutate: (_workflow, job) => {
    const steps = stepsOf(job);
    const setup = steps.find(step => typeof step.uses === "string" && step.uses.startsWith("actions/setup-node@"));
    const proof = steps.find(step => step.name === "Prove selected Node runtime");
    assert.ok(setup && proof);
    data(setup.with)["node-version"] = "24.21.0";
    data(proof.env).EXPECTED_NODE_VERSION = "24.21.0";
  }, expected: /setup and runtime proof must both select matrix.node-version/u },
  { name: "Node 26 matrix exclusion", mutate: (_workflow, _job, matrix) => { matrix.exclude = [{ "node-version": "26.10.0" }]; }, expected: /required matrix compatibility job must retain exactly Node 24 and Node 26/u },
  { name: "removed Node 26 matrix entry", mutate: (_workflow, _job, matrix) => { matrix["node-version"] = ["24.21.0"]; }, expected: /required matrix compatibility job must retain exactly Node 24 and Node 26/u },
  { name: "matrix include overriding runtime coordinates", mutate: (_workflow, _job, matrix) => { matrix.include = [{ "node-version": "24.21.0" }]; }, expected: /required matrix compatibility job must retain exactly Node 24 and Node 26/u },
  { name: "matrix moved to an unrelated nominal job", mutate: (workflow, job) => {
    const jobs = data(workflow.jobs);
    jobs["nominal-matrix"] = { strategy: job.strategy, steps: [] };
    delete job.strategy;
  }, expected: /required matrix compatibility job must retain exactly Node 24 and Node 26/u },
  { name: "skipped required matrix job", mutate: (_workflow, job) => { job.if = "matrix.node-version == '24.21.0'"; }, expected: /must not skip the compatibility job/u },
  { name: "fixed proof under a matrix-selected setup", mutate: (_workflow, job) => {
    const proof = stepsOf(job).find(step => step.name === "Prove selected Node runtime");
    assert.ok(proof);
    data(proof.env).EXPECTED_NODE_VERSION = "24.21.0";
  }, expected: /execute the selected Node version comparison/u },
];
for (const path of compatibilityWorkflowPaths.filter(workflowPath => workflowPath !== ".github/workflows/ci.yml" && workflowPath !== ".github/workflows/reviewrouter-interaction.yml")) {
  for (const scenario of matrixCases) {
    test(`actual checker rejects ${scenario.name} in ${path}`, async t => {
      const root = await makeFixture(t);
      const original = await readFile(join(root, path), "utf8");
      const workflow = data(installed.parse(original));
      const job = data(data(workflow.jobs)["node-compatibility"]);
      const matrix = data(data(job.strategy).matrix);
      scenario.mutate(workflow, job, matrix);
      const mutated = JSON.stringify(workflow);
      assert.notEqual(mutated, original);
      await put(root, path, mutated);
      await assert.rejects(checkNodeCompatibility(root), scenario.expected);
      await put(root, path, original);
      await assert.doesNotReject(checkNodeCompatibility(root));
    });
  }
}
