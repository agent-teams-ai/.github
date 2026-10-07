import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const NODE_COMPATIBILITY = Object.freeze({
  productionDefault: "24.21.0",
  compatibility: "26.10.0",
  skippedMajor: 25,
  engine: ">=24.18.0 <25 || >=26.10.0 <27",
} as const);

const ACCEPTED_DOCS_WORKFLOW = Object.freeze({
  path: ".github/workflows/docs-protocol-check.yml",
  revision: "05b30bcc00cdf07cfde9ba60a1136bb9df7f7571",
  sha256: "f3a1e7bba95a8d309f6f4a97377d1c68fd2b956f2659e9576fc1350599cb514d",
});
const toolingRoot = "tools/node-compatibility-tooling";
const matrixVersion = "${{ matrix.node-version }}";
const strictFlags = "--config.engine-strict=true --config.strict-peer-dependencies=true";
const parserInstall = `pnpm --dir ${toolingRoot} install --frozen-lockfile --ignore-scripts --ignore-pnpmfile ${strictFlags}`;
const parserCheck = "node scripts/check-node-compatibility.mts\nnode --test scripts/check-node-compatibility.test.mts\n";
const runtimeProof = 'node -e "if (process.version !== \'v\' + process.env.EXPECTED_NODE_VERSION) throw Error(\'Node runtime mismatch\')"';
const setupNodeAction = "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020";
const pnpmAction = "pnpm/action-setup@008330803749db0355799c700092d9a85fd074e9";

export const compatibilityWorkflowPaths = Object.freeze([
  ".github/workflows/ci.yml",
  ".github/workflows/reviewrouter-codex.yml",
  ".github/workflows/reviewrouter-interaction.yml",
  ".github/workflows/docs-fleet-audit.yml",
  ".github/workflows/docs-platform-recovery-installation-r317.yml",
  ".github/workflows/docs-admission-evidence.yml",
  ".github/workflows/docs-cohort-append-only.yml",
  ".github/workflows/organization-inventory-drift.yml",
]);

type Data = Record<string, unknown>;
interface Job extends Data { steps: Data[]; }
interface Workflow { value: Data; jobs: Map<string, Job>; }
interface YamlParser { readonly parse: (source: string) => unknown; }
export interface InstalledYaml extends YamlParser {
  readonly name: "yaml";
  readonly version: "2.9.1";
  readonly packageRoot: string;
  readonly entryPath: string;
}
export interface CompatibilityReport {
  readonly productionDefault: "24.21.0";
  readonly compatibility: "26.10.0";
  readonly skippedMajor: 25;
  readonly strictInstall: true;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) { throw new Error(message); }
}
function isRecord(value: unknown): value is Data {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function record(value: unknown, message: string): Data {
  assert(isRecord(value), message);
  return value;
}
function field(value: unknown, ...keys: string[]): unknown {
  let current: unknown = value;
  for (const key of keys) {
    if (!isRecord(current)) { return undefined; }
    current = current[key];
  }
  return current;
}
function sameKeys(value: unknown, expected: readonly string[]): boolean {
  return isRecord(value) && Object.keys(value).toSorted().join("\0") === expected.toSorted().join("\0");
}
function inside(parent: string, candidate: string): boolean {
  const path = relative(parent, candidate);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}
function isYamlParser(value: unknown): value is YamlParser {
  return isRecord(value) && typeof value.parse === "function";
}

export async function loadInstalledYaml(root: string): Promise<Readonly<InstalledYaml>> {
  let helper: string;
  let modules: string;
  let packageRoot: string;
  try {
    helper = await realpath(join(root, toolingRoot));
    modules = await realpath(join(helper, "node_modules"));
    packageRoot = await realpath(join(helper, "node_modules/yaml"));
  } catch (error: unknown) {
    throw new Error("Compatibility parser requires explicitly provisioned child YAML at tools/node-compatibility-tooling/node_modules/yaml.", { cause: error });
  }
  assert(inside(helper, modules) && inside(modules, packageRoot),
    "Compatibility parser requires explicitly provisioned child YAML; parent or external installation fallback is forbidden.");
  const decoded: unknown = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  assert(isRecord(decoded) && decoded.name === "yaml" && decoded.version === "2.9.1",
    "Compatibility parser installed YAML identity must be exactly yaml@2.9.1.");
  const helperRequire = createRequire(join(helper, "package.json"));
  // An absolute child dependency path has no bare-package parent search.
  const entryPath = await realpath(helperRequire.resolve(join(modules, "yaml")));
  assert(inside(packageRoot, entryPath),
    "Compatibility parser entry must belong to its explicitly provisioned child YAML package.");
  const loaded: unknown = helperRequire(entryPath);
  assert(isYamlParser(loaded), "Installed YAML must expose its callable parse contract.");
  const parser: InstalledYaml = {
    name: "yaml", version: "2.9.1", packageRoot, entryPath,
    parse: (source: string): unknown => loaded.parse(source),
  };
  return Object.freeze(parser);
}

function decodeWorkflow(parser: YamlParser, source: string, path: string): Workflow {
  const value = record(parser.parse(source), `${path} must contain a workflow mapping.`);
  const jobsValue = record(value.jobs, `${path} must contain a jobs mapping.`);
  const jobs = new Map<string, Job>();
  for (const [name, input] of Object.entries(jobsValue)) {
    const job = record(input, `${path} job ${name} must be a mapping.`);
    const stepsValue = job.steps ?? [];
    assert(Array.isArray(stepsValue), `${path} job ${name} must contain a steps array.`);
    const entries: unknown[] = stepsValue;
    const steps = entries.map(step => record(step, `${path} job ${name} has an invalid step.`));
    jobs.set(name, { ...job, steps });
  }
  return { value, jobs };
}
function requiredJob(workflow: Workflow, path: string, name: string): Job {
  const job = workflow.jobs.get(name);
  assert(job, `${path} must retain its ${name} compatibility job.`);
  return job;
}
function nodeSetups(job: Job): Data[] {
  return job.steps.filter(step => typeof step.uses === "string" && step.uses.startsWith("actions/setup-node@"));
}
function requiredNodeSetup(job: Job, path: string): Data {
  const setups = nodeSetups(job);
  const setup = setups[0];
  assert(setups.length === 1 && setup !== undefined && setup.uses === setupNodeAction,
    `${path} required compatibility job must contain exactly one pinned Node setup.`);
  return setup;
}
function verifyRuntimeProof(workflow: Workflow, path: string): void {
  let setupCount = 0;
  assert(field(workflow.value, "defaults", "run", "shell") === undefined,
    `${path} must not override the default run shell.`);
  for (const [jobName, job] of workflow.jobs) {
    if (jobName === "node-compatibility" || jobName === "node26-compatibility" ||
        (path === ".github/workflows/ci.yml" && jobName === "check")) {
      assert(job.if === undefined, `${path} must not skip the compatibility job.`);
    }
    assert(field(job, "defaults", "run", "shell") === undefined,
      `${path} must not override the job run shell.`);
    assert(job["continue-on-error"] === undefined, `${path} must require job success.`);
    for (const [index, step] of job.steps.entries()) {
      if (typeof step.uses !== "string" || !step.uses.startsWith("actions/setup-node@")) { continue; }
      setupCount++;
      assert(step["continue-on-error"] === undefined, `${path} must require Node setup success.`);
      assert(step.if === undefined ||
        (path === ".github/workflows/docs-cohort-append-only.yml" && step.if === "steps.materialize.outputs.mode == 'full'") ||
        (path === ".github/workflows/docs-admission-evidence.yml" && step.if === "steps.materialize.outputs.mode == 'admission'"),
      `${path} must not skip Node setup.`);
      const literal = field(step, "with", "node-version");
      const file = field(step, "with", "node-version-file");
      const expectedVersion = literal ?? (file === ".node-version" ? NODE_COMPATIBILITY.productionDefault : undefined);
      assert((literal === undefined || file === undefined) &&
        (expectedVersion === NODE_COMPATIBILITY.productionDefault ||
          expectedVersion === NODE_COMPATIBILITY.compatibility || expectedVersion === matrixVersion),
      `${path} must select a known Node runtime.`);
      const proof = job.steps[index + 1];
      assert(proof !== undefined && proof.name === "Prove selected Node runtime" &&
        proof.if === step.if && field(proof, "env", "EXPECTED_NODE_VERSION") === expectedVersion &&
        proof.run === runtimeProof && proof.shell === undefined && proof["continue-on-error"] === undefined,
      `${path} must execute the selected Node version comparison immediately after setup.`);
    }
  }
  assert(setupCount > 0, `${path} must select a Node runtime explicitly.`);
}
function verifyIsolatedParser(workflow: Workflow, path: string): void {
  const requiredJobs = path === ".github/workflows/ci.yml" ? ["check", "node26-compatibility"]
    : path === ".github/workflows/reviewrouter-interaction.yml" ? ["node-compatibility", "node26-compatibility"]
      : ["node-compatibility"];
  for (const name of requiredJobs) { requiredJob(workflow, path, name); }
  for (const [jobName, job] of workflow.jobs) {
    const checkName = path === ".github/workflows/ci.yml"
      ? "Check Node compatibility contract" : "Check bounded Node compatibility contract";
    const checkIndex = job.steps.findIndex(step => step.name === checkName);
    if (checkIndex < 0 && !requiredJobs.includes(jobName)) { continue; }
    const setupIndex = job.steps.findIndex(step => typeof step.uses === "string" && step.uses.startsWith("pnpm/action-setup@"));
    const installIndex = job.steps.findIndex(step => step.name === "Install isolated compatibility parser");
    const setup = job.steps[setupIndex], install = job.steps[installIndex], check = job.steps[checkIndex];
    assert(setup !== undefined && install !== undefined && check !== undefined &&
      setupIndex >= 0 && setupIndex < installIndex && installIndex < checkIndex &&
      setup.uses === pnpmAction && field(setup, "with", "version") === "11.18.0" &&
      field(setup, "with", "run_install") === false && setup.if === undefined && setup["continue-on-error"] === undefined &&
      install.run === parserInstall && install.if === undefined && install.shell === undefined &&
      install["continue-on-error"] === undefined && install["working-directory"] === undefined &&
      check.run === parserCheck && check.if === undefined && check.shell === undefined &&
      check["continue-on-error"] === undefined && check["working-directory"] === undefined,
    `${path} job ${jobName} must install its pinned isolated parser before checking the source contract.`);
  }
}
function verifyCompatibilityLane(workflow: Workflow, path: string): void {
  const job = requiredJob(workflow, path, "node-compatibility");
  const strategy = field(job, "strategy");
  const matrix = field(strategy, "matrix");
  const versions = field(matrix, "node-version");
  assert(sameKeys(strategy, ["fail-fast", "matrix"]) && field(strategy, "fail-fast") === false &&
    sameKeys(matrix, ["node-version"]) && Array.isArray(versions) && versions.length === 2 &&
    versions[0] === NODE_COMPATIBILITY.productionDefault && versions[1] === NODE_COMPATIBILITY.compatibility &&
    job.name === "node-compatibility (Node ${{ matrix.node-version }})" && job.needs === undefined &&
    [...workflow.jobs].every(([name, other]) => name === "node-compatibility" ||
      field(other, "strategy", "matrix", "node-version") === undefined),
  `${path} required matrix compatibility job must retain exactly Node 24 and Node 26 with no include, exclude, replacement, or dependency.`);
  const setup = requiredNodeSetup(job, path);
  const index = job.steps.indexOf(setup);
  const proof = job.steps[index + 1];
  assert(field(setup, "with", "node-version") === matrixVersion &&
    field(setup, "with", "node-version-file") === undefined &&
    proof !== undefined && field(proof, "env", "EXPECTED_NODE_VERSION") === matrixVersion && proof.run === runtimeProof,
  `${path} required matrix compatibility setup and runtime proof must both select matrix.node-version.`);
}
function verifySplitInteractionLane(workflow: Workflow, path: string): void {
  const ci = path === ".github/workflows/ci.yml";
  const production = requiredJob(workflow, path, ci ? "check" : "node-compatibility");
  const compatibility = requiredJob(workflow, path, "node26-compatibility");
  const productionSetup = requiredNodeSetup(production, path);
  const compatibilitySetup = requiredNodeSetup(compatibility, path);
  if (ci) {
    assert(production.name === "check" && field(production, "strategy", "matrix") === undefined &&
      field(compatibility, "strategy", "matrix") === undefined && compatibility.needs === undefined,
    "CI must emit the exact required check context and keep the Node 26 job independent.");
    assert(field(productionSetup, "with", "node-version-file") === ".node-version" &&
      field(productionSetup, "with", "node-version") === undefined,
    "CI must select the Node 24 production runtime from .node-version.");
  }
  assert((ci || field(productionSetup, "with", "node-version") === NODE_COMPATIBILITY.productionDefault) &&
    field(compatibilitySetup, "with", "node-version") === NODE_COMPATIBILITY.compatibility &&
    field(compatibilitySetup, "with", "node-version-file") === undefined &&
    compatibility.name === "node26-compatibility (Node 26.10.0)" && compatibility.needs === undefined &&
    (ci || (production.name === "node-compatibility (Node 24.21.0)" && production.needs === undefined)) &&
    [...workflow.jobs.values()].every(job => field(job, "strategy", "matrix") === undefined),
  `${path} must keep independent exact Node 24 and Node 26 compatibility lanes.`);
}

export async function checkNodeCompatibility(root: string = process.cwd()): Promise<Readonly<CompatibilityReport>> {
  const parser = await loadInstalledYaml(root);
  const read = (path: string): Promise<string> => readFile(join(root, path), "utf8");
  const readJson = async (path: string): Promise<unknown> => {
    const decoded: unknown = JSON.parse(await read(path));
    return decoded;
  };
  const packageJson = await readJson("package.json");
  const nodeVersion = (await read(".node-version")).trim();
  const npmrc = await read(".npmrc");
  const workspace = await read("pnpm-workspace.yaml");
  const toolingPackage = await readJson(`${toolingRoot}/package.json`);
  const toolingWorkspace = parser.parse(await read(`${toolingRoot}/pnpm-workspace.yaml`));
  const toolingLock = parser.parse(await read(`${toolingRoot}/pnpm-lock.yaml`));
  assert(field(packageJson, "engines", "node") === NODE_COMPATIBILITY.engine,
    "package.json must allow production Node 24 and compatibility Node 26 while skipping Node 25.");
  assert(nodeVersion === NODE_COMPATIBILITY.productionDefault, ".node-version must remain the Node 24 production default.");
  assert(npmrc.split(/\r?\n/u).includes("engine-strict=true"), ".npmrc must retain strict engine enforcement.");
  assert(npmrc.split(/\r?\n/u).includes("strict-peer-dependencies=true"), ".npmrc must retain strict peer-dependency enforcement.");
  assert(workspace.includes("minimumReleaseAge:"), "pnpm-workspace.yaml must remain present.");
  assert(sameKeys(toolingPackage, ["name", "version", "private", "packageManager", "engines", "dependencies"]) &&
    field(toolingPackage, "name") === "node-compatibility-tooling" && field(toolingPackage, "version") === "0.0.0" &&
    field(toolingPackage, "private") === true && sameKeys(field(toolingPackage, "engines"), ["node"]) &&
    field(toolingPackage, "engines", "node") === NODE_COMPATIBILITY.engine &&
    sameKeys(field(toolingPackage, "dependencies"), ["yaml"]),
  "Compatibility parser must remain an exact private passive metadata package with one dependency and no executable package surface.");
  assert(field(toolingPackage, "packageManager") === "pnpm@11.18.0" && field(toolingPackage, "dependencies", "yaml") === "2.9.1",
    "Compatibility parser must retain exact pnpm and YAML pins.");
  const packages = field(toolingWorkspace, "packages");
  assert(sameKeys(toolingWorkspace, ["packages", "minimumReleaseAge"]) && Array.isArray(packages) &&
    packages.length === 1 && packages[0] === "." && field(toolingWorkspace, "minimumReleaseAge") === 0 &&
    sameKeys(field(toolingLock, "importers"), ["."]) &&
    field(toolingLock, "importers", ".", "dependencies", "yaml", "specifier") === "2.9.1" &&
    field(toolingLock, "importers", ".", "dependencies", "yaml", "version") === "2.9.1" &&
    sameKeys(field(toolingLock, "packages"), ["yaml@2.9.1"]) &&
    sameKeys(field(toolingLock, "snapshots"), ["yaml@2.9.1"]) &&
    field(toolingLock, "packages", "yaml@2.9.1", "resolution", "integrity") ===
      "sha512-3NxN8+78OdzbT7C/WjGsyfPAtJaN3FNDsWxv7Y7mcDsT/oOmgW8BpyQQFFBnvZE3j9Y2Sdz1ULFLezL7Eb2yFw==",
  "Compatibility parser must retain isolated workspace and exact lock integrity.");

  // Current public bytes and independently recorded historical snapshots have separate identities.
  const acceptedWorkflowBytes = await readFile(join(root, ACCEPTED_DOCS_WORKFLOW.path));
  assert(createHash("sha256").update(acceptedWorkflowBytes).digest("hex") === ACCEPTED_DOCS_WORKFLOW.sha256,
    `The current public Docs reusable workflow must retain its accepted-main bytes (${ACCEPTED_DOCS_WORKFLOW.revision}).`);

  const workflows = new Map<string, Workflow>();
  for (const path of compatibilityWorkflowPaths) {
    const workflow = decodeWorkflow(parser, await read(path), path);
    workflows.set(path, workflow);
    verifyRuntimeProof(workflow, path);
    verifyIsolatedParser(workflow, path);
    if (path === ".github/workflows/ci.yml" || path === ".github/workflows/reviewrouter-interaction.yml") {
      verifySplitInteractionLane(workflow, path);
    } else { verifyCompatibilityLane(workflow, path); }
  }
  const productionSites: ReadonlyArray<readonly [string, string, boolean]> = [
    [".github/workflows/docs-fleet-audit.yml", "current-fleet", false],
    [".github/workflows/docs-platform-recovery-installation-r317.yml", "trusted-platform-recovery-installation-r317", false],
    [".github/workflows/docs-admission-evidence.yml", "trusted-admission-evidence", false],
    [".github/workflows/docs-cohort-append-only.yml", "trusted-validation", false],
    [".github/workflows/organization-inventory-drift.yml", "audit", true],
  ];
  for (const [path, jobName, fromFile] of productionSites) {
    const workflow = workflows.get(path);
    assert(workflow !== undefined, `${path} must be checked.`);
    const job = requiredJob(workflow, path, jobName);
    const setup = requiredNodeSetup(job, path);
    assert(fromFile
      ? field(setup, "with", "node-version-file") === ".node-version" && field(setup, "with", "node-version") === undefined
      : field(setup, "with", "node-version") === NODE_COMPATIBILITY.productionDefault && field(setup, "with", "node-version-file") === undefined,
    `${path} must retain its literal Node 24 production site or owning .node-version selection.`);
  }
  const ciPath = ".github/workflows/ci.yml";
  const ci = workflows.get(ciPath);
  assert(ci !== undefined, "CI must be checked.");
  const ciSteps = requiredJob(ci, ciPath, "check").steps;
  const ci26Steps = requiredJob(ci, ciPath, "node26-compatibility").steps;
  const ciInstall = ciSteps.find(step => typeof step.run === "string" && step.run.startsWith("pnpm install --frozen-lockfile "));
  assert(ciInstall !== undefined && ciInstall.if === undefined && ciInstall.shell === undefined && ciInstall["continue-on-error"] === undefined &&
    ciInstall.run === `pnpm install --frozen-lockfile ${strictFlags}\n` +
      "pnpm peers check --lockfile-only\n" +
      `pnpm install --lockfile-only --resolution-only --ignore-scripts --ignore-pnpmfile ${strictFlags}\n` +
      "git diff --exit-code -- pnpm-lock.yaml\n",
  "CI must use a frozen strict install and lockgraph peer check in the Node 24 check job.");
  assert(ci26Steps.some(step => step.run === parserInstall) && ci26Steps.some(step => step.run === parserCheck) &&
    !ci26Steps.some(step => typeof step.run === "string" && /(?:^|\n)\s*pnpm install\b/u.test(step.run)),
  "CI Node 26 must check source with isolated parser, without the unsupported root install.");
  const result: CompatibilityReport = {
    productionDefault: NODE_COMPATIBILITY.productionDefault,
    compatibility: NODE_COMPATIBILITY.compatibility,
    skippedMajor: NODE_COMPATIBILITY.skippedMajor,
    strictInstall: true,
  };
  return Object.freeze(result);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await checkNodeCompatibility();
  console.log(`Node compatibility contract verified: production=${result.productionDefault} compatibility=${result.compatibility} skipped=${result.skippedMajor} strict-install=${result.strictInstall}`);
}
