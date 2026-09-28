import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

export const NODE_COMPATIBILITY = Object.freeze({
  productionDefault: "24.18.0",
  compatibility: "26.10.0",
  skippedMajor: 25,
  engine: ">=24.18.0 <25 || >=26.10.0 <27",
});

const requiredWorkflowPaths = Object.freeze([
  ".github/workflows/ci.yml",
  ".github/workflows/docs-protocol-check.yml",
  ".github/workflows/reviewrouter-codex.yml",
  ".github/workflows/reviewrouter-interaction.yml",
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function count(source, marker) {
  return source.split(marker).length - 1;
}

function verifyRuntimeProof(source, path) {
  const workflow = parseYaml(source);
  const expectedRun = 'selected="$(node --version)"\ntest "$selected" = "v$EXPECTED_NODE_VERSION"\necho "Node runtime proved: requested=$EXPECTED_NODE_VERSION selected=$selected"\n';
  let setupCount = 0;
  for (const job of Object.values(workflow.jobs ?? {})) {
    for (const [index, step] of (job.steps ?? []).entries()) {
      if (typeof step.uses !== "string" || !step.uses.startsWith("actions/setup-node@")) {
        continue;
      }
      setupCount++;
      const proof = job.steps[index + 1];
      const expectedVersion = step.with?.["node-version"] ??
        (step.with?.["node-version-file"] === ".node-version" ? NODE_COMPATIBILITY.productionDefault : undefined);
      assert(expectedVersion, `${path} must select a known Node runtime.`);
      assert(
        proof?.name === "Prove selected Node runtime" &&
          proof.if === step.if &&
          proof.env?.EXPECTED_NODE_VERSION === expectedVersion &&
          proof.run === expectedRun &&
          !proof["continue-on-error"],
        `${path} must execute the selected Node version comparison immediately after setup.`,
      );
    }
  }
  assert(setupCount > 0, `${path} must select a Node runtime explicitly.`);
}

function verifyCompatibilityLane(source, path) {
  const lanes = [...source.matchAll(
    /node-version:\s*\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]/gu,
  )];
  assert(
    lanes.length === 1 &&
      lanes[0][1] === NODE_COMPATIBILITY.productionDefault &&
      lanes[0][2] === NODE_COMPATIBILITY.compatibility,
    `${path} must include explicit Node 24 and Node 26 compatibility lanes.`,
  );
}

function verifySplitInteractionLane(source, path) {
  assert(
    !/node-version:\s*\[/u.test(source) &&
      count(source, "node-version: 24.18.0") === 1 &&
      count(source, "node-version: 26.10.0") === 1,
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

  const workflowSources = new Map();
  for (const path of requiredWorkflowPaths) {
    workflowSources.set(path, await read(path));
  }

  for (const [path, source] of workflowSources) {
    verifyRuntimeProof(source, path);
  }

  verifyCompatibilityLane(workflowSources.get(".github/workflows/ci.yml"), ".github/workflows/ci.yml");
  verifyCompatibilityLane(
    workflowSources.get(".github/workflows/docs-protocol-check.yml"),
    ".github/workflows/docs-protocol-check.yml",
  );
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
    ".github/workflows/docs-protocol-check.yml",
    ".github/workflows/organization-inventory-drift.yml",
  ];
  for (const path of literalNode24Paths) {
    const source = await read(path);
    verifyRuntimeProof(source, path);
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
  const docsSource = workflowSources.get(".github/workflows/docs-protocol-check.yml");
  const ciSteps = parseYaml(ciSource).jobs?.check?.steps ?? [];
  const docsSteps = parseYaml(docsSource).jobs?.["node-compatibility"]?.steps ?? [];
  const strictFlags = "--config.engine-strict=true --config.strict-peer-dependencies=true";
  assert(
    ciSteps.some(step => step.run ===
      `pnpm install --frozen-lockfile ${strictFlags}\n` +
      `pnpm install --lockfile-only --resolution-only --ignore-scripts --ignore-pnpmfile ${strictFlags}\n` +
      "git diff --exit-code -- pnpm-lock.yaml\n"),
    "CI must use a frozen strict install in both Node lanes.",
  );
  assert(
    docsSteps.some(step => step.run ===
      `pnpm install --frozen-lockfile --ignore-scripts --ignore-pnpmfile ${strictFlags}\n` +
      `pnpm install --lockfile-only --resolution-only --ignore-scripts --ignore-pnpmfile ${strictFlags}\n` +
      "git diff --exit-code -- pnpm-lock.yaml\n"),
    "The docs compatibility lane must use a frozen strict install.",
  );

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
