import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import YAML from "yaml";

import { validateDocsProtocolWorkflow } from "./check-community-files.mjs";
import {
  docsRuntimeClosureEvidence,
  validateDocsQualifiedCohorts,
} from "./docs-cohort-policy.mjs";
import { loadJson } from "./governance-policy.mjs";

const execFileAsync = promisify(execFile);

function assert(condition, message) {
  if (!condition) {throw new Error(message);}
}

async function command(program, args, options = {}) {
  return execFileAsync(program, args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 60_000,
    ...options,
  });
}

async function withIsolatedNpmOptions(options, execute) {
  const env = Object.fromEntries(Object.entries(process.env).filter(
    ([name]) => !name.toLowerCase().startsWith("npm_config_"),
  ));
  const configRoot = await mkdtemp(join(tmpdir(), "docs-cohort-npm-config-"));
  try {
    const userConfig = join(configRoot, "user.npmrc");
    const globalConfig = join(configRoot, "global.npmrc");
    await Promise.all([
      writeFile(userConfig, "", { flag: "wx" }),
      writeFile(globalConfig, "", { flag: "wx" }),
    ]);
    return await execute({
      ...options,
      env: {
        ...env,
        NPM_CONFIG_USERCONFIG: userConfig,
        NPM_CONFIG_GLOBALCONFIG: globalConfig,
      },
    });
  } finally {
    await rm(configRoot, { force: true, recursive: true });
  }
}

async function npmJson(args) {
  const { stdout } = await withIsolatedNpmOptions({}, (options) => command(
    "npm",
    [...args, "--registry=https://registry.npmjs.org/", "--json"],
    options,
  ));
  return JSON.parse(stdout);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function provenanceStatement(attestations, packageEntry) {
  const matches = attestations.filter(
    ({ predicateType }) => predicateType === "https://slsa.dev/provenance/v1",
  );
  assert(matches.length === 1, `${packageEntry.name} must have exactly one verified SLSA provenance attestation.`);
  return JSON.parse(Buffer.from(
    matches[0].bundle.dsseEnvelope.payload,
    "base64",
  ).toString("utf8"));
}

async function verifyPackage(packageEntry, adapters, verifiedEntry) {
  const specifier = `${packageEntry.name}@${packageEntry.version}`;
  const [metadata, times, attestations] = await Promise.all([
    adapters.npmView(specifier),
    adapters.npmTimes(packageEntry.name),
    adapters.fetchJson(packageEntry.provenance.registry_attestation_url),
  ]);
  assert(metadata.dist?.integrity === packageEntry.integrity,
    `${specifier} registry integrity differs from the Cohort.`);
  assert(times[packageEntry.version] === packageEntry.published_at,
    `${specifier} registry publication time differs from the Cohort.`);
  assert(metadata.dist?.attestations?.url === packageEntry.provenance.registry_attestation_url,
    `${specifier} registry attestation URL differs from the Cohort.`);
  assert(verifiedEntry?.name === packageEntry.name && verifiedEntry.version === packageEntry.version &&
    verifiedEntry.registry === "https://registry.npmjs.org/" &&
    verifiedEntry.attestations?.url === packageEntry.provenance.registry_attestation_url,
  `${specifier} is absent from the exact cryptographically verified npm audit result.`);
  assert(Array.isArray(verifiedEntry.attestationBundles) &&
    canonicalJson(verifiedEntry.attestationBundles) === canonicalJson(attestations.attestations),
  `${specifier} raw registry attestation differs from the cryptographically verified audit bundle.`);
  const statement = provenanceStatement(verifiedEntry.attestationBundles, packageEntry);
  const subject = statement.subject?.find(({ name }) => name.endsWith(`@${packageEntry.version}`));
  const integrityHex = Buffer.from(packageEntry.integrity.slice("sha512-".length), "base64")
    .toString("hex");
  assert(subject?.digest?.sha512 === integrityHex,
    `${specifier} provenance subject digest differs from registry integrity.`);
  const build = statement.predicate?.buildDefinition;
  const workflow = build?.externalParameters?.workflow;
  const commit = build?.resolvedDependencies?.find(({ digest }) => digest?.gitCommit)?.digest?.gitCommit;
  const invocation = statement.predicate?.runDetails?.metadata?.invocationId;
  assert(workflow?.repository === "https://github.com/agent-teams-ai/engineering-foundation" &&
    workflow.path === packageEntry.provenance.source_workflow,
  `${specifier} provenance workflow differs from the Cohort.`);
  assert(commit === packageEntry.provenance.source_commit,
    `${specifier} provenance source commit differs from the Cohort.`);
  assert(invocation ===
    `${packageEntry.provenance.workflow_run_url}/attempts/${packageEntry.provenance.workflow_run_attempt}`,
  `${specifier} provenance workflow run differs from the Cohort.`);
  const repository = await adapters.getRepository(packageEntry.provenance.source_repository);
  const branch = await adapters.getDefaultBranch(
    packageEntry.provenance.source_repository,
    repository.default_branch,
  );
  assert(repository.id === packageEntry.provenance.source_repository_id &&
    repository.full_name === packageEntry.provenance.source_repository &&
    branch.protected === true &&
    await adapters.isDefaultBranchAncestor(
      packageEntry.provenance.source_repository,
      repository.default_branch,
      packageEntry.provenance.source_commit,
    ), `${specifier} provenance source is not on its protected default branch.`);
  const workflowRun = await adapters.getWorkflowRun(
    packageEntry.provenance.source_repository,
    packageEntry.provenance.workflow_run_id,
  );
  assert(workflowRun.id === packageEntry.provenance.workflow_run_id &&
    workflowRun.run_attempt === packageEntry.provenance.workflow_run_attempt &&
    workflowRun.head_sha === packageEntry.provenance.source_commit &&
    workflowRun.head_branch === repository.default_branch && workflowRun.event === "push" &&
    workflowRun.conclusion === "success" && workflowRun.path === packageEntry.provenance.source_workflow &&
    workflowRun.repository?.id === packageEntry.provenance.source_repository_id &&
    workflowRun.repository?.full_name === packageEntry.provenance.source_repository,
  `${specifier} live release workflow run does not bind exact attempt/path/SHA/success.`);
}

export async function verifyInstalledPackageSignatures(packages, run = command) {
  const root = await mkdtemp(join(tmpdir(), "docs-cohort-signatures-"));
  try {
    await writeFile(join(root, "package.json"), "{\"name\":\"docs-cohort-signature-check\",\"private\":true}\n");
    await withIsolatedNpmOptions({ cwd: root }, (options) => run("npm", [
        "install", "--ignore-scripts", "--fund=false", "--audit=false", "--save-exact",
        "--registry=https://registry.npmjs.org/",
        ...packages.map(({ name, version }) => `${name}@${version}`),
      ], options));
    const { stdout } = await withIsolatedNpmOptions(
      { cwd: root },
      (options) => run("npm", [
        "audit", "signatures", "--json", "--include-attestations",
        "--registry=https://registry.npmjs.org/",
      ], options),
    );
    const result = JSON.parse(stdout);
    assert(Array.isArray(result.invalid) && result.invalid.length === 0 &&
      Array.isArray(result.missing) && result.missing.length === 0 &&
      Array.isArray(result.verified),
    "npm cryptographic signature audit did not return a complete verified attestation set.");
    for (const { name, version } of packages) {
      assert(result.verified.filter((entry) =>
        entry.name === name && entry.version === version).length === 1,
      `npm cryptographic signature audit did not verify exactly one ${name}@${version} entry.`);
    }
    return result.verified;
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

export async function resolvePublishedRuntimeClosure(packages, run = command) {
  const root = await mkdtemp(join(tmpdir(), "docs-cohort-runtime-closure-"));
  try {
    await Promise.all([
      writeFile(join(root, "package.json"), `${JSON.stringify({
        name: "docs-cohort-runtime-closure",
        private: true,
        packageManager: "pnpm@11.18.0",
        devDependencies: Object.fromEntries(packages.map(({ name, version }) => [name, version])),
      })}\n`),
      writeFile(join(root, ".npmrc"), [
        "registry=https://registry.npmjs.org/",
        "@agent-teams:registry=https://registry.npmjs.org/",
        "ignore-scripts=true",
        "verify-store-integrity=true",
        "strict-peer-dependencies=true",
        "",
      ].join("\n")),
    ]);
    await withIsolatedNpmOptions({}, (options) => run("pnpm", [
        "install", "--dir", root, "--lockfile-only", "--ignore-scripts",
        "--ignore-pnpmfile", "--ignore-workspace",
      ], options));
    const lock = YAML.parse(await readFile(join(root, "pnpm-lock.yaml"), "utf8"));
    return docsRuntimeClosureEvidence(lock, packages);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

export async function defaultIsDefaultBranchAncestor(
  repository,
  defaultBranch,
  revision,
  run = command,
) {
  const { stdout: branchOutput } = await run("gh", [
    "api", `repos/${repository}/branches/${defaultBranch}`, "--jq", ".commit.sha",
  ]);
  const head = branchOutput.trim();
  if (revision === head) {return true;}
  const { stdout: comparisonOutput } = await run("gh", [
    "api", `repos/${repository}/compare/${revision}...${head}`, "--jq", ".status",
  ]);
  return ["ahead", "identical"].includes(comparisonOutput.trim());
}

async function defaultReadPublishedPackage(packageEntry, paths) {
  const root = await mkdtemp(join(tmpdir(), "docs-cohort-package-"));
  try {
    const { stdout } = await withIsolatedNpmOptions(
      { cwd: root },
      (options) => command("npm", [
        "pack", `${packageEntry.name}@${packageEntry.version}`, "--ignore-scripts",
        "--registry=https://registry.npmjs.org/", "--json",
      ], options),
    );
    const packed = JSON.parse(stdout);
    const filename = packed[0]?.filename;
    assert(typeof filename === "string", `${packageEntry.name} npm pack did not return a tarball.`);
    assert(packed[0]?.integrity === packageEntry.integrity,
      `${packageEntry.name} packed tarball integrity differs from the Cohort.`);
    return new Map(await Promise.all(paths.map(async (path) => [
      path,
      (await command("tar", ["-xOf", filename, `package/${path}`], {
        cwd: root,
        encoding: null,
      })).stdout,
    ])));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

function sha256(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

const CALLER_WORKFLOW_PLACEHOLDERS = [
  ["{{REUSABLE_WORKFLOW_REPOSITORY}}", "repository"],
  ["{{REUSABLE_WORKFLOW_PATH}}", "path"],
  ["{{REUSABLE_WORKFLOW_REVISION}}", "revision"],
];

export function renderCallerWorkflowTemplate(content, reusableWorkflow) {
  const template = content.toString("utf8");
  assert(Buffer.from(template, "utf8").equals(content),
    "Published caller workflow template must be valid UTF-8.");
  const observed = template.match(/\{\{[^{}]+\}\}/gu) ?? [];
  assert(observed.length === CALLER_WORKFLOW_PLACEHOLDERS.length &&
    CALLER_WORKFLOW_PLACEHOLDERS.every(([token]) =>
      observed.filter((entry) => entry === token).length === 1),
  "Published caller workflow template must contain each exact authority placeholder once and no others.");
  let rendered = template;
  for (const [token, field] of CALLER_WORKFLOW_PLACEHOLDERS) {
    rendered = rendered.replace(token, reusableWorkflow[field]);
  }
  return Buffer.from(rendered, "utf8");
}

async function verifyPublishedContents(record, adapters) {
  const foundation = record.packages[0];
  const docs = record.packages[1];
  const paths = ["package.json", ...Object.values(record.assets).map(({ path }) => path)];
  const publishedFiles = await adapters.readPublishedPackage(docs, paths);
  const manifest = JSON.parse(publishedFiles.get("package.json").toString("utf8"));
  assert(manifest.dependencies?.[foundation.name] === foundation.version,
    `${docs.name}@${docs.version} must depend on exact ${foundation.name}@${foundation.version}.`);
  for (const [label, asset] of Object.entries(record.assets)) {
    assert(asset.package === docs.name, `${label} must be sourced from the published Docs package.`);
    assert(sha256(publishedFiles.get(asset.path)) === asset.digest,
      `${label} published asset digest differs from the Cohort.`);
  }
  const callerTemplate = publishedFiles.get(record.assets.caller_workflow.path);
  const renderedCaller = renderCallerWorkflowTemplate(callerTemplate, record.reusable_workflow);
  assert(sha256(renderedCaller) === record.assets.caller_workflow.rendered_digest,
    "caller_workflow rendered digest differs from its exact authority tuple.");
}

async function verifyCanaryEvidence(record, canaryEvent, adapters) {
  if (canaryEvent === undefined) {return;}
  for (const evidence of canaryEvent.canary_evidence) {
    const repository = await adapters.getRepository(evidence.repository);
    assert(repository.id === evidence.repository_id && repository.full_name === evidence.repository,
      `${evidence.repository} identity differs from CANARY evidence.`);
    assert(await adapters.isDefaultBranchAncestor(
      evidence.repository,
      repository.default_branch,
      evidence.merge_revision,
    ), `${evidence.repository} canary revision is not merged into its default branch.`);
    const checkRuns = await adapters.getCheckRuns(evidence.repository, evidence.merge_revision);
    const run = checkRuns.find(({ id }) => id === evidence.check_run_id);
    assert(run?.head_sha === evidence.merge_revision &&
      run.name === evidence.required_context &&
      run.app?.id === evidence.integration_id &&
      run.conclusion === "success" &&
      run.html_url === evidence.check_run_url,
    `${evidence.repository} hosted canary check does not exactly bind repo/head/context/integration/success.`);
    assert(evidence.check_run_url.includes(`/actions/runs/${evidence.workflow_run_id}`),
      `${evidence.repository} check URL does not bind the recorded workflow run.`);
    const workflowRun = await adapters.getWorkflowRun(
      evidence.repository,
      evidence.workflow_run_id,
    );
    assert(workflowRun.id === evidence.workflow_run_id &&
      workflowRun.head_sha === evidence.merge_revision &&
      workflowRun.head_branch === repository.default_branch &&
      workflowRun.event === "push" &&
      workflowRun.conclusion === "success" &&
      workflowRun.workflow_id === evidence.workflow_id &&
      workflowRun.path === evidence.caller_workflow_path &&
      workflowRun.repository?.id === evidence.repository_id &&
      workflowRun.repository?.full_name === evidence.repository,
    `${evidence.repository} Actions run does not exactly bind repo/default-branch head/workflow/path/success.`);
    const caller = await adapters.readRepositoryFile(
      evidence.repository,
      evidence.caller_workflow_path,
      evidence.merge_revision,
    );
    assert(evidence.caller_workflow_digest === record.assets.caller_workflow.rendered_digest &&
      sha256(caller) === evidence.caller_workflow_digest,
    `${evidence.repository} committed caller bytes differ from the qualified rendered caller.`);
  }
}

export async function verifyDocsAdmissionEvidence(policy, registry, schema, overrides = {}) {
  const lifecycle = validateDocsQualifiedCohorts(registry, schema, { asOf: overrides.asOf });
  const adapters = {
    getRepository: async (repository) => {
      const { stdout } = await command("gh", ["api", `repos/${repository}`]);
      return JSON.parse(stdout);
    },
    getDefaultBranch: async (repository, defaultBranch) => {
      const { stdout } = await command("gh", [
        "api", `repos/${repository}/branches/${defaultBranch}`,
      ]);
      return JSON.parse(stdout);
    },
    getDefaultBranchHead: async (repository, branch) => {
      const { stdout } = await command("gh", [
        "api", `repos/${repository}/branches/${branch}`, "--jq", ".commit.sha",
      ]);
      return stdout.trim();
    },
    getCheckRuns: async (repository, revision) => {
      const { stdout } = await command("gh", [
        "api", "--paginate", `repos/${repository}/commits/${revision}/check-runs?per_page=100`,
        "--jq", ".check_runs[]",
      ]);
      return stdout.trim().split("\n").filter(Boolean).map(JSON.parse);
    },
    getWorkflowRun: async (repository, runId) => {
      const { stdout } = await command("gh", ["api", `repos/${repository}/actions/runs/${runId}`]);
      return JSON.parse(stdout);
    },
    readRepositoryFile: async (repository, filePath, revision) => {
      const { stdout } = await command("gh", [
        "api", `repos/${repository}/contents/${filePath}?ref=${revision}`, "--jq", ".content",
      ]);
      return Buffer.from(stdout.replace(/\s/gu, ""), "base64");
    },
    ...overrides,
  };
  delete adapters.asOf;
  delete adapters.requireCredential;

  const candidates = policy.repositories.filter((entry) =>
    entry.repository_lifecycle === "active" && entry.docs_role === "consumer" &&
    ["bound", "rollout_pending"].includes(entry.cohort_binding_status));
  if (overrides.requireCredential === true && candidates.length > 0) {
    assert(typeof process.env.DOCS_GOVERNANCE_READ_TOKEN === "string" &&
      process.env.DOCS_GOVERNANCE_READ_TOKEN.length > 0,
    "Live admission verification requires DOCS_GOVERNANCE_READ_TOKEN for public and private consumers.");
  }
  for (const entry of candidates) {
    const evidence = entry.observed_default_branch_evidence;
    assert(entry.admission_status === "admitted" && evidence !== null,
      `${entry.repository} lacks live-verifiable admitted default-branch evidence.`);
    const record = lifecycle.cohortById.get(entry.observed_cohort_id);
    const qualification = lifecycle.qualificationEventById.get(entry.observed_cohort_id);
    assert(record !== undefined && qualification !== undefined,
      `${entry.repository} observed Cohort is not qualified.`);
    const repository = await adapters.getRepository(entry.repository);
    assert(repository.id === entry.repository_id && repository.full_name === entry.repository &&
      repository.default_branch === evidence.default_branch,
    `${entry.repository} live identity/default branch differs from admission evidence.`);
    assert(await adapters.getDefaultBranchHead(entry.repository, evidence.default_branch) === evidence.revision,
      `${entry.repository} admission revision is not the exact current default-branch head.`);
    const check = (await adapters.getCheckRuns(entry.repository, evidence.revision))
      .find(({ id }) => id === evidence.check_run_id);
    assert(check?.head_sha === evidence.revision && check.name === evidence.required_context &&
      check.app?.id === evidence.integration_id && check.conclusion === "success" &&
      check.html_url === evidence.check_run_url && evidence.required_context === entry.required_check_context,
    `${entry.repository} live required check does not bind the admitted head/context/app/success.`);
    assert(evidence.check_run_url.includes(`/actions/runs/${evidence.workflow_run_id}`),
      `${entry.repository} admission check URL does not bind its workflow run.`);
    const run = await adapters.getWorkflowRun(entry.repository, evidence.workflow_run_id);
    assert(run.id === evidence.workflow_run_id && run.workflow_id === evidence.workflow_id &&
      run.head_sha === evidence.revision && run.head_branch === evidence.default_branch &&
      run.event === "push" && run.conclusion === "success" &&
      run.path === evidence.caller_workflow_path &&
      run.repository?.id === entry.repository_id && run.repository?.full_name === entry.repository,
    `${entry.repository} live workflow run does not bind the admitted default-branch push.`);
    const [caller, projectionBytes] = await Promise.all([
      adapters.readRepositoryFile(entry.repository, evidence.caller_workflow_path, evidence.revision),
      adapters.readRepositoryFile(
        entry.repository,
        "architecture/foundation/docs-protocol-managed-state.json",
        evidence.revision,
      ),
    ]);
    assert(evidence.caller_workflow_path === entry.caller_workflow_path &&
      evidence.caller_workflow_digest === record.assets.caller_workflow.rendered_digest &&
      sha256(caller) === evidence.caller_workflow_digest,
    `${entry.repository} admitted caller bytes differ from its observed Cohort.`);
    let projection;
    try {projection = JSON.parse(projectionBytes.toString("utf8"));} catch {
      throw new Error(`${entry.repository} admitted managed projection is not JSON.`);
    }
    const authority = projection.cohortAuthority ?? projection;
    assert(projection.cohortId === record.cohort_id &&
      authority.recordDigest === record.record_digest &&
      authority.qualificationEventDigest === qualification.event_digest &&
      entry.observed_cohort_record_digest === record.record_digest &&
      entry.observed_cohort_event_digest === qualification.event_digest,
    `${entry.repository} admitted managed projection does not prove the observed Cohort.`);
  }
  return candidates.map(({ repository_id: id }) => id);
}

export async function verifyDocsCohortEvidence(registry, schema, cohortId, overrides = {}) {
  validateDocsQualifiedCohorts(registry, schema, { asOf: overrides.asOf });
  const record = registry.cohorts.find(({ cohort_id: id }) => id === cohortId);
  assert(record !== undefined, "Requested Qualified Docs Cohort does not exist.");
  const adapters = {
    npmView: (specifier) => npmJson(["view", specifier]),
    npmTimes: (name) => npmJson(["view", name, "time"]),
    fetchJson: async (url) => {
      const response = await fetch(url);
      assert(response.ok, `${url} returned HTTP ${response.status}.`);
      return response.json();
    },
    verifySignatures: verifyInstalledPackageSignatures,
    resolveRuntimeClosure: resolvePublishedRuntimeClosure,
    readRuntimeClosureEvidence: async (path) => {
      const revision = process.env.DOCS_COHORT_EVIDENCE_REF;
      if (revision === undefined) {return readFile(path, "utf8");}
      const { stdout } = await command("gh", [
        "api", `repos/agent-teams-ai/.github/contents/${path}?ref=${revision}`,
        "--jq", ".content",
      ]);
      return Buffer.from(stdout.replace(/\s/gu, ""), "base64").toString("utf8");
    },
    readPublishedPackage: defaultReadPublishedPackage,
    getWorkflowBlob: async (entry) => {
      const { stdout } = await command("gh", [
        "api", `repos/agent-teams-ai/.github/contents/${entry.path}?ref=${entry.revision}`, "--jq", ".sha",
      ]);
      return stdout.trim();
    },
    getWorkflowSource: async (entry) => {
      const { stdout } = await command("gh", [
        "api", `repos/agent-teams-ai/.github/contents/${entry.path}?ref=${entry.revision}`,
        "--jq", ".content",
      ]);
      return Buffer.from(stdout.replace(/\s/gu, ""), "base64");
    },
    getRepository: async (repository) => {
      const { stdout } = await command("gh", ["api", `repos/${repository}`]);
      return JSON.parse(stdout);
    },
    getDefaultBranch: async (repository, defaultBranch) => {
      const { stdout } = await command("gh", [
        "api", `repos/${repository}/branches/${defaultBranch}`,
      ]);
      return JSON.parse(stdout);
    },
    isDefaultBranchAncestor: defaultIsDefaultBranchAncestor,
    getCheckRuns: async (repository, revision) => {
      const { stdout } = await command("gh", [
        "api", "--paginate", `repos/${repository}/commits/${revision}/check-runs?per_page=100`,
        "--jq", ".check_runs[]",
      ]);
      return stdout.trim().split("\n").filter(Boolean).map(JSON.parse);
    },
    getWorkflowRun: async (repository, runId) => {
      const { stdout } = await command("gh", ["api", `repos/${repository}/actions/runs/${runId}`]);
      return JSON.parse(stdout);
    },
    readRepositoryFile: async (repository, filePath, revision) => {
      const { stdout } = await command("gh", [
        "api", `repos/${repository}/contents/${filePath}?ref=${revision}`, "--jq", ".content",
      ]);
      return Buffer.from(stdout.replace(/\s/gu, ""), "base64");
    },
    ...overrides,
  };
  delete adapters.asOf;
  delete adapters.verifyCanary;
  const verifiedAttestations = await adapters.verifySignatures(record.packages);
  assert(Array.isArray(verifiedAttestations),
    "Cryptographic signature verifier did not return its exact verified attestation bundles.");
  await Promise.all(record.packages.map((entry) => verifyPackage(
    entry,
    adapters,
    verifiedAttestations.find(({ name, version }) => name === entry.name && version === entry.version),
  )));
  await verifyPublishedContents(record, adapters);
  const runtimeClosure = await adapters.resolveRuntimeClosure(record.packages);
  const runtimeClosureSource = await adapters.readRuntimeClosureEvidence(
    record.runtime_closure.projection_path,
  );
  assert(runtimeClosure.authority.schema_version === record.runtime_closure.schema_version &&
    runtimeClosure.authority.package_manager === record.runtime_closure.package_manager &&
    runtimeClosure.authority.lockfile_version === record.runtime_closure.lockfile_version &&
    runtimeClosure.authority.package_count === record.runtime_closure.package_count &&
    runtimeClosure.authority.projection_path === record.runtime_closure.projection_path &&
    runtimeClosure.authority.digest === record.runtime_closure.digest &&
    runtimeClosure.source === runtimeClosureSource,
  "Published package runtime closure differs from the immutable Cohort authority.");
  assert(await adapters.getWorkflowBlob(record.reusable_workflow) === record.reusable_workflow.blob_sha,
    "Reusable workflow revision does not resolve to the recorded blob SHA.");
  const workflowRepository = await adapters.getRepository(record.reusable_workflow.repository);
  assert(workflowRepository.id === record.reusable_workflow.repository_id &&
    workflowRepository.full_name === record.reusable_workflow.repository,
    "Reusable workflow repository identity differs from the Cohort.");
  const workflowDefaultBranch = await adapters.getDefaultBranch(
    record.reusable_workflow.repository,
    workflowRepository.default_branch,
  );
  assert(workflowDefaultBranch.protected === true,
    "Reusable workflow default branch is not protected.");
  assert(await adapters.isDefaultBranchAncestor(
    record.reusable_workflow.repository,
    workflowRepository.default_branch,
    record.reusable_workflow.revision,
  ), "Reusable workflow revision is not merged into its protected default branch.");
  const liveWorkflowBlob = await adapters.getWorkflowBlob({
    ...record.reusable_workflow,
    revision: workflowDefaultBranch.commit.sha,
  });
  assert(liveWorkflowBlob === record.reusable_workflow.blob_sha,
    "Reusable workflow bytes differ from the exact current protected-default-branch workflow.");
  const workflowSource = (await adapters.getWorkflowSource(record.reusable_workflow)).toString("utf8");
  try {
    validateDocsProtocolWorkflow(YAML.parse(workflowSource), workflowSource);
  } catch (error) {
    throw new Error("Reusable workflow revision does not satisfy the qualified safe closure.", {
      cause: error,
    });
  }
  if (overrides.verifyCanary !== false) {
    const canaryEvent = registry.events.find(
      (event) => event.cohort_id === record.cohort_id && event.state === "CANARY",
    );
    await verifyCanaryEvidence(record, canaryEvent, adapters);
  }
}

export async function verifyChangedDocsCohortEvidence(
  previous,
  current,
  schema,
  overrides = {},
) {
  const lifecycle = validateDocsQualifiedCohorts(current, schema, { asOf: overrides.asOf });
  const previousCohortCount = previous.cohorts.length;
  const previousEventCount = previous.events.length;
  const changedIds = new Set([
    ...current.cohorts.slice(previousCohortCount).map(({ cohort_id: id }) => id),
    ...current.events.slice(previousEventCount).map(({ cohort_id: id }) => id),
  ]);
  const positiveStates = new Set([
    "PUBLISHED_UNQUALIFIED", "VERIFIED", "COOLDOWN", "QUALIFIED", "CANARY", "RECOMMENDED",
  ]);
  for (const cohortId of changedIds) {
    const appendedEvents = current.events.slice(previousEventCount).filter(
      (event) => event.cohort_id === cohortId,
    );
    const isNewRecord = current.cohorts.slice(previousCohortCount).some(
      (record) => record.cohort_id === cohortId,
    );
    if (!isNewRecord && !appendedEvents.some(({ state }) => positiveStates.has(state))) {
      continue;
    }
    const verifyCanary = ["CANARY", "RECOMMENDED"].includes(
      lifecycle.stateById.get(cohortId),
    );
    await verifyDocsCohortEvidence(current, schema, cohortId, {
      ...overrides,
      verifyCanary,
    });
  }
  return [...changedIds];
}

function exactArgument(argv, name, required = false) {
  const indexes = argv.flatMap((value, index) => value === name ? [index] : []);
  assert(indexes.length <= 1 && (!required || indexes.length === 1) &&
    (indexes.length === 0 || argv[indexes[0] + 1] !== undefined),
  `Invalid ${name} argument.`);
  return indexes.length === 0 ? undefined : argv[indexes[0] + 1];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const registryPath = exactArgument(argv, "--registry") ??
    "governance/docs-qualified-cohorts.json";
  const schemaPath = exactArgument(argv, "--schema") ??
    "governance/docs-qualified-cohorts.schema.json";
  const changedFrom = exactArgument(argv, "--changed-from");
  const admissionPolicyPath = exactArgument(argv, "--admission-policy");
  const cohortId = exactArgument(
    argv, "--cohort", changedFrom === undefined && admissionPolicyPath === undefined,
  );
  const registry = await loadJson(registryPath);
  const schema = await loadJson(schemaPath);
  if (admissionPolicyPath !== undefined) {
    const verified = await verifyDocsAdmissionEvidence(
      await loadJson(admissionPolicyPath), registry, schema, { requireCredential: true },
    );
    console.log(`Live Docs admission evidence verified for ${verified.length} bound consumer(s).`);
  } else if (changedFrom !== undefined) {
    const changed = await verifyChangedDocsCohortEvidence(
      await loadJson(changedFrom),
      registry,
      schema,
    );
    console.log(`Qualified Docs Cohort live evidence verified for ${changed.length} changed Cohort(s).`);
  } else {
    await verifyDocsCohortEvidence(registry, schema, cohortId);
    console.log(`Qualified Docs Cohort evidence verified: ${cohortId}`);
  }
}
