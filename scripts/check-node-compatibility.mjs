import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const toolingRequire = createRequire(new URL("./node-compatibility-tooling/package.json", import.meta.url));
const { parse: parseYaml } = toolingRequire("yaml");

export const NODE_COMPATIBILITY = Object.freeze({
  productionDefault: "24.18.0",
  compatibility: "26.10.0",
  skippedMajor: 25,
  engine: ">=24.18.0 <25 || >=26.10.0 <27",
});

const requiredWorkflowPaths = Object.freeze([
  ".github/workflows/ci.yml",
  ".github/workflows/reviewrouter-codex.yml",
  ".github/workflows/reviewrouter-interaction.yml",
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function verifyRuntimeProof(source, path) {
  const workflow = parseYaml(source);
  const expectedRun = 'node -e "if (process.version !== \'v\' + process.env.EXPECTED_NODE_VERSION) throw Error(\'Node runtime mismatch\')"';
  let setupCount = 0;
  assert(!workflow.defaults?.run?.shell, `${path} must not override the default run shell.`);
  for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
    if (jobName === "node-compatibility" || jobName === "node26-compatibility" || (path === ".github/workflows/ci.yml" && jobName === "check")) {
      assert(job.if === undefined, `${path} must not skip the compatibility job.`);
    }
    assert(!job.defaults?.run?.shell, `${path} must not override the job run shell.`);
    assert(job["continue-on-error"] === undefined, `${path} must require job success.`);
    for (const [index, step] of (job.steps ?? []).entries()) {
      if (typeof step.uses !== "string" || !step.uses.startsWith("actions/setup-node@")) {
        continue;
      }
      setupCount++;
      assert(step["continue-on-error"] === undefined, `${path} must require Node setup success.`);
      assert(step.if === undefined || (((path === ".github/workflows/docs-cohort-append-only.yml" && step.if === "steps.materialize.outputs.mode == 'full'") || (path === ".github/workflows/docs-admission-evidence.yml" && step.if === "steps.materialize.outputs.mode == 'admission'"))), `${path} must not skip Node setup.`);
      const proof = job.steps[index + 1];
      const expectedVersion = step.with?.["node-version"] ??
        (step.with?.["node-version-file"] === ".node-version" ? NODE_COMPATIBILITY.productionDefault : undefined);
      assert(expectedVersion, `${path} must select a known Node runtime.`);
      assert(
        proof?.name === "Prove selected Node runtime" &&
          proof.if === step.if &&
          proof.env?.EXPECTED_NODE_VERSION === expectedVersion &&
          proof.run === expectedRun &&
          proof.shell === undefined &&
          proof["continue-on-error"] === undefined,
        `${path} must execute the selected Node version comparison immediately after setup.`,
      );
    }
  }
  assert(setupCount > 0, `${path} must select a Node runtime explicitly.`);
}

function verifyIsolatedParser(workflow, path) {
  const requiredJobs = path === ".github/workflows/ci.yml"
    ? ["check", "node26-compatibility"]
    : path === ".github/workflows/reviewrouter-interaction.yml"
        ? ["node-compatibility", "node26-compatibility"]
        : ["node-compatibility"];
  for (const jobName of requiredJobs) {
    assert(workflow.jobs?.[jobName], `${path} must retain its ${jobName} compatibility job.`);
  }
  for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
    const steps = job.steps ?? [];
    const checkName = path === ".github/workflows/ci.yml" ? "Check Node compatibility contract"
        : "Check bounded Node compatibility contract";
    const checkIndex = steps.findIndex(step => step.name === checkName);
    if (checkIndex < 0 && !requiredJobs.includes(jobName)) { continue; }
    const setupIndex = steps.findIndex(step => step.uses?.startsWith("pnpm/action-setup@"));
    const installIndex = steps.findIndex(step => step.name === "Install isolated compatibility parser");
    const setup = steps[setupIndex];
    const install = steps[installIndex];
    const check = steps[checkIndex];
    assert(
      setupIndex >= 0 && setupIndex < installIndex && installIndex < checkIndex &&
        setup.uses === "pnpm/action-setup@008330803749db0355799c700092d9a85fd074e9" &&
        setup.with?.version === "11.18.0" && setup.with?.run_install === false &&
        setup.if === undefined && setup["continue-on-error"] === undefined &&
        install.run === `pnpm --dir scripts/node-compatibility-tooling install --frozen-lockfile --ignore-scripts --ignore-pnpmfile --config.engine-strict=true --config.strict-peer-dependencies=true` &&
        install.if === undefined && install.shell === undefined && install["continue-on-error"] === undefined &&
        install["working-directory"] === undefined &&
        check.run === "node scripts/check-node-compatibility.mjs\nnode --test scripts/check-node-compatibility.test.mjs\n" &&
        check.if === undefined && check.shell === undefined && check["continue-on-error"] === undefined &&
        check["working-directory"] === undefined,
      `${path} job ${jobName} must install its pinned isolated parser before checking the source contract.`,
    );
  }
}

function verifyCompatibilityLane(source, path) {
  const jobs = Object.values(parseYaml(source).jobs ?? {});
  const lanes = jobs.flatMap(job => {
    const version = job.strategy?.matrix?.["node-version"];
    return Array.isArray(version) ? [version] : [];
  });
  assert(
    lanes.length === 1 &&
      lanes[0].length === 2 &&
      lanes[0][0] === NODE_COMPATIBILITY.productionDefault &&
      lanes[0][1] === NODE_COMPATIBILITY.compatibility,
    `${path} must include explicit Node 24 and Node 26 compatibility lanes.`,
  );
}

function verifySplitInteractionLane(source, path) {
  const jobs = parseYaml(source).jobs ?? {};
  const setupVersion = name => jobs[name]?.steps?.find(step => step.uses?.startsWith("actions/setup-node@"))?.with?.["node-version"];
  if (path === ".github/workflows/ci.yml") {
    assert(
      jobs.check?.name === "check" && jobs.check?.strategy?.matrix === undefined &&
        jobs["node26-compatibility"]?.strategy?.matrix === undefined &&
        jobs["node26-compatibility"]?.needs === undefined,
      "CI must emit the exact required check context and keep the Node 26 job independent.",
    );
  }
  assert(
    (setupVersion(path === ".github/workflows/ci.yml" ? "check" : "node-compatibility") === NODE_COMPATIBILITY.productionDefault) &&
      setupVersion("node26-compatibility") === NODE_COMPATIBILITY.compatibility &&
      !Object.values(jobs).some(job => Array.isArray(job.strategy?.matrix?.["node-version"])),
    `${path} must keep independent literal Node 24 and Node 26 compatibility lanes.`,
  );
}

export async function checkNodeCompatibility(root = process.cwd()) {
  const read = async (path) => readFile(join(root, path), "utf8");
  const packageSource = await read("package.json");
  const packageJson = JSON.parse(packageSource);
  const nodeVersion = (await read(".node-version")).trim();
  const npmrc = await read(".npmrc");
  const workspace = await read("pnpm-workspace.yaml");
  const toolingPackage = JSON.parse(await read("scripts/node-compatibility-tooling/package.json"));
  const toolingWorkspace = await read("scripts/node-compatibility-tooling/pnpm-workspace.yaml");
  const toolingLock = parseYaml(await read("scripts/node-compatibility-tooling/pnpm-lock.yaml"));

  assert(
    packageJson.engines?.node === NODE_COMPATIBILITY.engine,
    "package.json must allow production Node 24 and compatibility Node 26 while skipping Node 25.",
  );
  assert(
    nodeVersion === NODE_COMPATIBILITY.productionDefault,
    ".node-version must remain the Node 24 production default.",
  );
  assert(
    npmrc.split(/\r?\n/u).includes("engine-strict=true"),
    ".npmrc must retain strict engine enforcement.",
  );
  assert(
    npmrc.split(/\r?\n/u).includes("strict-peer-dependencies=true"),
    ".npmrc must retain strict peer-dependency enforcement.",
  );
  assert(workspace.includes("minimumReleaseAge:"), "pnpm-workspace.yaml must remain present.");
  assert(toolingPackage.packageManager === "pnpm@11.18.0" && toolingPackage.dependencies?.yaml === "2.9.1", "Compatibility parser must retain exact pnpm and YAML pins.");
  assert(toolingWorkspace.includes("packages:\n  - .") && toolingLock.importers?.["."]?.dependencies?.yaml?.version === "2.9.1" && toolingLock.packages?.["yaml@2.9.1"]?.resolution?.integrity === "sha512-3NxN8+78OdzbT7C/WjGsyfPAtJaN3FNDsWxv7Y7mcDsT/oOmgW8BpyQQFFBnvZE3j9Y2Sdz1ULFLezL7Eb2yFw==", "Compatibility parser must retain isolated workspace and exact lock integrity.");

  // Stable30 binds these exact bytes; source compatibility runs in central CI.
  const frozenWorkflow = await read(".github/workflows/docs-protocol-check.yml");
  assert(
    createHash("sha256").update(frozenWorkflow).digest("hex") === "ddee57a5e685407548ad8eebaa6f1e934600104af192dcd542160915c24fd1d6",
    "The stable30 Docs reusable workflow must retain its exact frozen Node 24 bytes.",
  );

  const workflowSources = new Map();
  for (const path of requiredWorkflowPaths) {
    workflowSources.set(path, await read(path));
  }

  for (const [path, source] of workflowSources) {
    verifyRuntimeProof(source, path);
    verifyIsolatedParser(parseYaml(source), path);
  }

  verifySplitInteractionLane(workflowSources.get(".github/workflows/ci.yml"), ".github/workflows/ci.yml");
  verifyCompatibilityLane(
    workflowSources.get(".github/workflows/reviewrouter-codex.yml"),
    ".github/workflows/reviewrouter-codex.yml",
  );
  const interactionPath = ".github/workflows/reviewrouter-interaction.yml";
  verifySplitInteractionLane(workflowSources.get(interactionPath), interactionPath);

  const literalNode24Paths = [
    ".github/workflows/docs-fleet-audit.yml",
    ".github/workflows/docs-platform-recovery-installation-r317.yml",
    ".github/workflows/docs-admission-evidence.yml",
    ".github/workflows/docs-cohort-append-only.yml",
    ".github/workflows/organization-inventory-drift.yml",
  ];
  for (const path of literalNode24Paths) {
    const source = await read(path);
    verifyRuntimeProof(source, path);
    verifyIsolatedParser(parseYaml(source), path);
    verifyCompatibilityLane(source, path);
    assert(
      source.includes('EXPECTED_NODE_VERSION: 24.18.0'),
      `${path} must prove the literal Node 24 production site.`,
    );
    if (path !== ".github/workflows/organization-inventory-drift.yml") {
      assert(
        source.includes("node-version: 24.18.0"),
        `${path} must retain its literal Node 24 production site.`,
      );
    }
  }

  const ciSource = workflowSources.get(".github/workflows/ci.yml");
  const ciJobs = parseYaml(ciSource).jobs ?? {};
  const ciSteps = ciJobs.check?.steps ?? [];
  const ci26Steps = ciJobs["node26-compatibility"]?.steps ?? [];
  const strictFlags = "--config.engine-strict=true --config.strict-peer-dependencies=true";
  const ciInstall = ciSteps.find(step => step.run?.startsWith("pnpm install --frozen-lockfile "));
  assert(
    ciInstall?.if === undefined && ciInstall.shell === undefined && ciInstall["continue-on-error"] === undefined &&
      ciInstall.run ===
        `pnpm install --frozen-lockfile ${strictFlags}\n` +
        `pnpm peers check --lockfile-only\n` +
        `pnpm install --lockfile-only --resolution-only --ignore-scripts --ignore-pnpmfile ${strictFlags}\n` +
        "git diff --exit-code -- pnpm-lock.yaml\n",
    "CI must use a frozen strict install and lockgraph peer check in the Node 24 check job.",
  );
  assert(ci26Steps.some(step => step.run?.includes("scripts/node-compatibility-tooling install --frozen-lockfile")) &&
    ci26Steps.some(step => step.run === "node scripts/check-node-compatibility.mjs\nnode --test scripts/check-node-compatibility.test.mjs\n") &&
    !ci26Steps.some(step => step.run?.includes("pnpm install --frozen-lockfile --config.engine-strict=true")),
  "CI Node 26 must check source with isolated parser, without the unsupported root install.");

  return Object.freeze({
    productionDefault: NODE_COMPATIBILITY.productionDefault,
    compatibility: NODE_COMPATIBILITY.compatibility,
    skippedMajor: NODE_COMPATIBILITY.skippedMajor,
    strictInstall: true,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await checkNodeCompatibility();
  console.log(
    `Node compatibility contract verified: production=${result.productionDefault} compatibility=${result.compatibility} skipped=${result.skippedMajor} strict-install=${result.strictInstall}`,
  );
}
