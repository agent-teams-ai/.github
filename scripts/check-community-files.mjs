import { access, readFile } from "node:fs/promises";

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
  "docs/organization-security-baseline.md",
  "governance/actions-policy.json",
  "governance/actions-policy.schema.json",
  "governance/code-security-defaults.json",
  "governance/code-security-defaults.schema.json",
  "governance/executable-spec-qualification.json",
  "governance/executable-spec-qualification.schema.json",
  "governance/organization-repository-inventory.json",
  "governance/organization-repository-inventory.schema.json",
  "renovate-config.json",
  "renovate.json"
];

await Promise.all(requiredFiles.map((file) => access(file)));

const renovateConfig = JSON.parse(await readFile("renovate-config.json", "utf8"));
if (!renovateConfig.extends?.includes("config:best-practices")) {
  throw new Error("Renovate preset must extend config:best-practices.");
}

const governance = await readFile("GOVERNANCE.md", "utf8");
const securityBaseline = await readFile("docs/organization-security-baseline.md", "utf8");
const securityPolicy = JSON.parse(
  await readFile("governance/code-security-defaults.json", "utf8"),
);
const contributing = await readFile("CONTRIBUTING.md", "utf8");
const pullRequestTemplate = await readFile(
  ".github/PULL_REQUEST_TEMPLATE.md",
  "utf8",
);

function requireMarkers(source, path, markers) {
  const normalizedSource = source.replaceAll(/\s+/gu, " ");
  for (const marker of markers) {
    const normalizedMarker = marker.replaceAll(/\s+/gu, " ");
    if (!normalizedSource.includes(normalizedMarker)) {
      throw new Error(`${path} is missing required governance marker: ${marker}`);
    }
  }
}

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
]);

console.log(`Organization defaults verified: ${requiredFiles.length} files`);
