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
  "renovate-config.json",
  "renovate.json"
];

await Promise.all(requiredFiles.map((file) => access(file)));

const renovateConfig = JSON.parse(await readFile("renovate-config.json", "utf8"));
if (!renovateConfig.extends?.includes("config:best-practices")) {
  throw new Error("Renovate preset must extend config:best-practices.");
}

const governance = await readFile("GOVERNANCE.md", "utf8");
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
  "Do not add Ajv, fast-check,",
  "empty dependency or placeholder model",
  "| `engineering-foundation` | Capability owner | Generic mechanism and evidence contracts only; it is not a material cross-axis donor",
  "| `agent-runtime` | Applicable | Repository-owned JSON Schema with Ajv validation, fast-check properties/fixtures, and XState",
  "| `agent-teams-platform` | Applicable | Internal Project Management model only; adoption makes no public wire-contract claim.",
  "| `agent-teams-orchestrator` | Applicable | Accepted, repository-owned state projections only",
  "| `.github` | Governance-only |",
  "| `craig-meeting-gateway` | N/A | Fork: N/A until an upstream-owned test/spec boundary exists",
]);
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
