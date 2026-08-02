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

console.log(`Organization defaults verified: ${requiredFiles.length} files`);
