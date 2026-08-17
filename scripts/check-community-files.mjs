import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import YAML from "yaml";

const requiredFiles = [
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "GOVERNANCE.md",
  "README.md",
  "SECURITY.md",
  "SUPPORT.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/bug.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/ISSUE_TEMPLATE/feature.yml",
  "profile/README.md",
  ".github/workflows/reviewrouter-codex.yml",
  ".github/workflows/reviewrouter-interaction.yml",
  ".github/workflows/docs-protocol-check.yml",
  ".github/workflows/docs-cohort-append-only.yml",
  ".github/workflows/docs-admission-evidence.yml",
  "docs/organization-security-baseline.md",
  "docs/repository-admission.md",
  "governance/actions-policy.json",
  "governance/actions-policy.schema.json",
  "governance/code-security-defaults.json",
  "governance/code-security-defaults.schema.json",
  "governance/docs-protocol-policy.json",
  "governance/docs-protocol-policy.schema.json",
  "governance/docs-protocol-exceptions.json",
  "governance/docs-protocol-exceptions.schema.json",
  "governance/docs-qualified-cohorts.json",
  "governance/docs-qualified-cohorts.schema.json",
  "governance/executable-spec-qualification.json",
  "governance/executable-spec-qualification.schema.json",
  "governance/organization-repository-inventory.json",
  "governance/organization-repository-inventory.schema.json",
  "scripts/check-cohort-emergency-append.mjs",
  "scripts/fixtures/producer-docs-protocol.yml",
  "renovate-config.json",
  "renovate.json"
];

await Promise.all(requiredFiles.map((file) => access(file)));

const renovateConfig = JSON.parse(await readFile("renovate-config.json", "utf8"));
if (!renovateConfig.extends?.includes("config:best-practices")) {
  throw new Error("Renovate preset must extend config:best-practices.");
}

export function validateRenovateDocsCohortRule(config) {
  const managed = [
    "@agent-teams/docs-protocol",
    "@agent-teams/engineering-foundation",
  ];
  const matching = (config.packageRules ?? []).filter((rule) =>
    managed.some((name) => rule.matchPackageNames?.includes(name)));
  if (matching.length !== 1 || matching[0] !== config.packageRules.at(-1) ||
      JSON.stringify([...matching[0].matchPackageNames].sort()) !== JSON.stringify(managed) ||
      matching[0].enabled !== false || matching[0].automerge !== false) {
    throw new Error("Renovate must end with one Cohort rule disabling independent Foundation and Docs Protocol updates.");
  }
}

validateRenovateDocsCohortRule(renovateConfig);

const governance = await readFile("GOVERNANCE.md", "utf8");
const securityBaseline = await readFile("docs/organization-security-baseline.md", "utf8");
const repositoryAdmission = await readFile("docs/repository-admission.md", "utf8");
const securityPolicy = JSON.parse(
  await readFile("governance/code-security-defaults.json", "utf8"),
);
const contributing = await readFile("CONTRIBUTING.md", "utf8");
const pullRequestTemplate = await readFile(
  ".github/PULL_REQUEST_TEMPLATE.md",
  "utf8",
);
const docsProtocolWorkflowSource = await readFile(
  ".github/workflows/docs-protocol-check.yml",
  "utf8",
);
const docsProtocolWorkflow = YAML.parse(docsProtocolWorkflowSource);

function requireMarkers(source, path, markers) {
  const normalizedSource = source.replaceAll(/\s+/gu, " ");
  for (const marker of markers) {
    const normalizedMarker = marker.replaceAll(/\s+/gu, " ");
    if (!normalizedSource.includes(normalizedMarker)) {
      throw new Error(`${path} is missing required governance marker: ${marker}`);
    }
  }
}

requireMarkers(repositoryAdmission, "docs/repository-admission.md", [
  "both `trusted-validation` and `trusted-admission-evidence` as required checks",
  "Each trusted workflow runs on every pull request",
  "successful no-op only outside its own exact data mode",
  "Requiring only `trusted-validation` would leave admission updates checked only by its no-op path",
]);

requireMarkers(governance, "GOVERNANCE.md", [
  "## Executable Specification Ownership",
  "Product repositories remain the only owners of their domain vocabulary",
  "guards, transitions, runtime binding, compatibility promises, and migrations",
  "deterministic local tooling in CI",
  "must not require hosted AI inference",
  "never an approval authority",
  "does not inherit the organization pull request template",
  "Every local override must mirror the executable-specification evidence block",
  "exact deterministic gate or an explicit `N/A` with ownership rationale",
  "Do not add Ajv, fast-check,",
  "empty dependency or placeholder model",
  "ledger is authoritative for the active in-scope organization repositories",
  "Repository values are owned by the ledger rather than mirrored in validator code",
  "not a claim of continuous live audit",
  "one-approval rule would deadlock a single-member organization",
  "active, non-archived governance and product repositories",
  "Archived one-shot security canaries are explicit exclusions",
  "Checked-in scope consistency is anchored separately by the dated, human-reviewed GitHub API snapshot",
  "a CI-enforced live completeness gate, or continuous inventory monitoring",
  "An `observed_absent` record means a dated successful query",
  "Do not copy repository applicability into another human table",
  "Configuration `266049` is enforced for new public repositories",
  "configuration `266048` is enforced for new private and internal repositories",
  "Dependabot owns security updates only; Renovate owns routine version updates",
  "transferred repository",
  "GitHub Free exception",
  "New repositories inherit the organization security",
  "architecturally unqualified",
  "action-reference enforcement is enabled organization-wide",
  "does not weaken immutable action-reference enforcement",
]);
if (governance.includes("| Repository | Applicability |")) {
  throw new Error("GOVERNANCE.md must not mirror the authoritative JSON applicability ledger.");
}
for (const { id } of securityPolicy.required_check_exceptions) {
  requireMarkers(governance, "GOVERNANCE.md", [id]);
  requireMarkers(securityBaseline, "docs/organization-security-baseline.md", [id]);
}
requireMarkers(contributing, "CONTRIBUTING.md", [
  "repository-owned schema or",
  "positive and negative fixtures",
  "exact command",
  "`N/A` with the ownership reason",
]);
requireMarkers(pullRequestTemplate, ".github/PULL_REQUEST_TEMPLATE.md", [
  "Repository-owned schema or contract and version:",
  "Positive fixture(s):",
  "Negative fixture(s):",
  "Exact deterministic gate command:",
  "Explicit `N/A` and ownership rationale",
  "Exact `@agent-teams/docs-protocol` registry version or explicit `N/A`:",
  "Repository-owned profile path or explicit `N/A`:",
  "Caller workflow path and consumer observed revision or explicit `N/A`:",
  "Central reusable-workflow immutable 40-hex revision or explicit `N/A`:",
  "Qualification evidence path at the consumer revision or explicit `N/A`:",
  "`pnpm docs:protocol:check` result or explicit `N/A`:",
]);

function exactKeys(value, expected) {
  return value !== null &&
    typeof value === "object" &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function validateDocsProtocolWorkflow(workflow, source) {
  if (!exactKeys(workflow, ["name", "on", "permissions", "jobs"]) ||
      workflow.name !== "Documentation Protocol Check") {
    throw new Error("Documentation protocol reusable workflow root shape is not allowlisted.");
  }
  const workflowCall = workflow.on?.workflow_call;
  if (!exactKeys(workflow.on, ["workflow_call"]) ||
      (![null, undefined].includes(workflowCall) && !exactKeys(workflowCall, []))) {
    throw new Error("Documentation protocol workflow_call must be inputless.");
  }
  if (JSON.stringify(workflow.permissions) !== JSON.stringify({
    contents: "read",
    "id-token": "write",
  })) {
    throw new Error("Documentation protocol reusable workflow must have read-only contents and OIDC identity permission.");
  }
  if (!exactKeys(workflow.jobs, ["docs-protocol-check"])) {
    throw new Error("Documentation protocol reusable workflow must contain exactly one allowlisted job.");
  }
  const job = workflow.jobs["docs-protocol-check"];
  if (!exactKeys(job, ["name", "if", "runs-on", "timeout-minutes", "env", "steps"]) ||
      job.name !== "docs-protocol-check" ||
      job.if !== "github.event_name != 'push' || github.ref_name == github.event.repository.default_branch" ||
      job["runs-on"] !== "ubuntu-24.04" ||
      job["timeout-minutes"] !== 15 ||
      canonicalJson(job.env) !== canonicalJson({
        TRUSTED_GOVERNANCE_ROOT: "${{ github.workspace }}/.trusted/governance",
        CONSUMER_CHECKOUT: "${{ github.workspace }}/.trusted/consumer",
        AUTHORIZATION_PATH: "${{ github.workspace }}/.trusted/docs-gate-authorization.json",
        TRUSTED_INSTALL_ROOT: "${{ github.workspace }}/.trusted/install",
      })) {
    throw new Error("Documentation protocol job shape, runner, and timeout must match the allowlist.");
  }
  const steps = job.steps;
  const authorityScript = steps?.[0]?.with?.script;
  const expectedSteps = [
    { name: "Resolve trusted controller snapshot and called-workflow identity", id: "authority",
      uses: "actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd",
      env: {
        CALLER_REPOSITORY_ID: "${{ github.repository_id }}",
      }, with: { script: authorityScript } },
    { name: "Check out exact Cohort-bound validator implementation",
      uses: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      with: { repository: "${{ steps.authority.outputs.workflow-repository }}",
        ref: "${{ steps.authority.outputs.workflow-sha }}",
        path: ".trusted/governance", "persist-credentials": false } },
    { name: "Set up pnpm for trusted tooling",
      uses: "pnpm/action-setup@008330803749db0355799c700092d9a85fd074e9",
      with: { version: "11.18.0", run_install: false } },
    { name: "Set up Node for trusted tooling",
      uses: "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
      with: { "node-version": "24.18.0", cache: "pnpm",
        "cache-dependency-path": "${{ env.TRUSTED_GOVERNANCE_ROOT }}/pnpm-lock.yaml" } },
    { name: "Install only base-owned validator dependencies",
      run: "pnpm install --dir \"$TRUSTED_GOVERNANCE_ROOT\" --frozen-lockfile --ignore-scripts --ignore-pnpmfile" },
    { name: "Authorize exact consumer snapshot without executing consumer code",
      run: "node \"$TRUSTED_GOVERNANCE_ROOT/scripts/verify-docs-consumer-gate.mjs\" authorize",
      env: { GITHUB_TOKEN: "${{ github.token }}", GITHUB_REPOSITORY: "${{ github.repository }}",
        CALLER_REPOSITORY_ID: "${{ github.repository_id }}", GITHUB_SHA: "${{ github.sha }}",
        CONTROLLER_SNAPSHOT_SHA: "${{ steps.authority.outputs.controller-sha }}",
        JOB_WORKFLOW_SHA: "${{ steps.authority.outputs.workflow-sha }}",
        JOB_WORKFLOW_REF: "${{ steps.authority.outputs.workflow-ref }}",
        JOB_WORKFLOW_REPOSITORY: "${{ steps.authority.outputs.workflow-repository }}",
        JOB_WORKFLOW_FILE_PATH: "${{ steps.authority.outputs.workflow-file-path }}" } },
    { name: "Check out authorized immutable consumer snapshot",
      uses: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      with: { repository: "${{ github.repository }}", ref: "${{ github.sha }}",
        path: ".trusted/consumer", "persist-credentials": false } },
    { name: "Bind checkout bytes to central authorization",
      run: "node \"$TRUSTED_GOVERNANCE_ROOT/scripts/verify-docs-consumer-gate.mjs\" verify-checkout",
      env: { GITHUB_REPOSITORY: "${{ github.repository }}",
        CALLER_REPOSITORY_ID: "${{ github.repository_id }}", GITHUB_SHA: "${{ github.sha }}" } },
    { name: "Prepare isolated exact package installation",
      run: "node \"$TRUSTED_GOVERNANCE_ROOT/scripts/verify-docs-consumer-gate.mjs\" prepare-install" },
    { name: "Verify isolated lock before package installation",
      run: "node \"$TRUSTED_GOVERNANCE_ROOT/scripts/verify-docs-consumer-gate.mjs\" verify-install-lock" },
    { name: "Install isolated exact packages without lifecycle scripts",
      run: "pnpm install --dir \"$TRUSTED_INSTALL_ROOT\" --frozen-lockfile --ignore-scripts --ignore-pnpmfile" },
    { name: "Verify isolated package identities", id: "trusted-install",
      run: "node \"$TRUSTED_GOVERNANCE_ROOT/scripts/verify-docs-consumer-gate.mjs\" verify-install" },
    { name: "Confirm current controller authority stayed stable before checks",
      run: "node \"$TRUSTED_GOVERNANCE_ROOT/scripts/verify-docs-consumer-gate.mjs\" verify-controller-snapshot",
      env: { GITHUB_TOKEN: "${{ github.token }}" } },
    { name: "Run trusted absolute Consumer Integration CLI",
      run: "node \"${{ steps.trusted-install.outputs.cli }}\" consumer check --consumer \"$CONSUMER_CHECKOUT\" --json" },
    { name: "Run trusted absolute documentation structural check",
      run: "node \"${{ steps.trusted-install.outputs.cli }}\" check --consumer \"$CONSUMER_CHECKOUT\" --profile \"${{ steps.trusted-install.outputs.profile_path }}\" --json" },
    { name: "Confirm current controller authority stayed stable through checks",
      run: "node \"$TRUSTED_GOVERNANCE_ROOT/scripts/verify-docs-consumer-gate.mjs\" verify-controller-snapshot",
      env: { GITHUB_TOKEN: "${{ github.token }}" } },
  ];
  if (!Array.isArray(steps) || canonicalJson(steps) !== canonicalJson(expectedSteps) ||
      typeof authorityScript !== "string" ||
      createHash("sha256").update(authorityScript).digest("hex") !==
        "ce4429a953c765e037bb8cfbb90c6c615beb24d5b831678823ea7abda90e6f2c") {
    throw new Error("Documentation protocol reusable workflow must preserve trusted authorization, immutable checkout, preinstall lock validation, isolated install, and absolute trusted CLI ordering.");
  }
  for (const requiredSource of [
    "core.getIDToken(audience)",
    "claims.job_workflow_sha",
    "claims.job_workflow_ref",
    "claims.repository_id",
    "steps.authority.outputs.workflow-sha",
    "controller.data.id !== 1316243981",
    "controller.data.default_branch",
    "CONTROLLER_SNAPSHOT_SHA",
    "CALLER_REPOSITORY_ID: ${{ github.repository_id }}",
    "GITHUB_SHA: ${{ github.sha }}",
    "verify-install-lock",
    "steps.trusted-install.outputs.cli",
  ]) {
    if (!source.includes(requiredSource)) {
      throw new Error(`Documentation protocol trusted preflight is missing ${requiredSource}.`);
    }
  }
  if (/\bsecrets\s*:|\$\{\{\s*secrets\./u.test(source)) {
    throw new Error("Documentation protocol reusable workflow must not declare or consume secrets.");
  }
  if (source.includes("steps.authority.outputs.controller-sha }}\n          path: .trusted/governance")) {
    throw new Error("Trusted validator checkout must remain Cohort-bound, not current-main-bound.");
  }
}

validateDocsProtocolWorkflow(docsProtocolWorkflow, docsProtocolWorkflowSource);

console.log(`Organization defaults verified: ${requiredFiles.length} files`);
