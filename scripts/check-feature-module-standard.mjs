import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);

export const MANIFEST_PATH = "governance/feature-module-standard.json";
export const STANDARD_ID = "agent-teams.feature-module-standard";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function exactKeys(value, expected, label) {
  assert(value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object.`);
  assert(
    JSON.stringify(Object.keys(value).toSorted()) === JSON.stringify([...expected].toSorted()),
    `${label} must contain exactly: ${expected.join(", ")}.`,
  );
}

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

function gitBlobSha(source) {
  const bytes = Buffer.isBuffer(source) ? source : Buffer.from(source);
  const header = Buffer.from(`blob ${bytes.length}\0`);
  return createHash("sha1").update(Buffer.concat([header, bytes])).digest("hex");
}

export function validateFeatureModuleStandardManifest(manifest, artifacts) {
  exactKeys(manifest, ["schema_version", "standard_id", "versions"], "manifest");
  assert(manifest.schema_version === 1, "Manifest schema_version must be 1.");
  assert(manifest.standard_id === STANDARD_ID, `Manifest standard_id must be ${STANDARD_ID}.`);
  assert(Array.isArray(manifest.versions) && manifest.versions.length > 0,
    "Manifest versions must be a non-empty array.");

  const seen = new Set();
  for (const record of manifest.versions) {
    exactKeys(record, [
      "version",
      "status",
      "published_at",
      "path",
      "git_blob_sha",
      "sha256",
      "profile_contract",
    ], `version ${record?.version ?? "<unknown>"}`);
    assert(/^v[1-9][0-9]*(?:\.[1-9][0-9]*)?$/u.test(record.version),
      `Invalid standard version: ${record.version}.`);
    assert(!seen.has(record.version), `Duplicate standard version: ${record.version}.`);
    seen.add(record.version);
    assert(record.status === "published", `${record.version} has invalid status.`);
    assert(/^\d{4}-\d{2}-\d{2}$/u.test(record.published_at),
      `${record.version} must have an ISO publication date.`);
    assert(/^docs\/architecture\/feature-module-standard\/v[^/]+\.md$/u.test(record.path),
      `${record.version} has an invalid canonical path.`);
    assert(/^[0-9a-f]{40}$/u.test(record.git_blob_sha),
      `${record.version} has an invalid Git blob SHA.`);
    assert(/^[0-9a-f]{64}$/u.test(record.sha256),
      `${record.version} has an invalid SHA-256 digest.`);
    assert(record.profile_contract === "adoption-contract",
      `${record.version} must use the adoption-contract profile contract.`);

    const source = artifacts.get(record.path);
    assert(source !== undefined, `${record.version} artifact is missing: ${record.path}.`);
    assert(sha256(source) === record.sha256, `${record.version} SHA-256 digest does not match.`);
    assert(gitBlobSha(source) === record.git_blob_sha,
      `${record.version} Git blob SHA does not match.`);

    const text = source.toString("utf8");
    for (const marker of [
      `# Feature Module Standard ${record.version}`,
      "Status: Accepted and immutable",
      `Standard ID: \`${STANDARD_ID}\``,
      `Version: \`${record.version}\``,
      "## Adoption contract",
      "## Conformance evidence",
    ]) {
      assert(text.includes(marker), `${record.version} is missing required marker: ${marker}`);
    }
  }
}

function recordKey(record) {
  return `${STANDARD_ID}\0${record.version}`;
}

export function validateAppendOnlyStandardHistory(current, historicalManifests) {
  const currentByKey = new Map(current.versions.map((record) => [recordKey(record), record]));
  for (const historical of historicalManifests) {
    if (historical.standard_id !== STANDARD_ID || !Array.isArray(historical.versions)) continue;
    for (const oldRecord of historical.versions) {
      const currentRecord = currentByKey.get(recordKey(oldRecord));
      assert(currentRecord !== undefined,
        `Published standard ${oldRecord.version} cannot be removed.`);
      assert(JSON.stringify(currentRecord) === JSON.stringify(oldRecord),
        `Published standard ${oldRecord.version} metadata is immutable.`);
    }
  }
}

async function historicalManifests(repositoryRoot) {
  const { stdout } = await execFileAsync(
    "git",
    ["log", "--format=%H", "--", MANIFEST_PATH],
    { cwd: repositoryRoot, maxBuffer: 1024 * 1024 },
  );
  const revisions = stdout.trim().split("\n").filter(Boolean);
  const manifests = [];
  for (const revision of revisions) {
    const result = await execFileAsync(
      "git",
      ["show", `${revision}:${MANIFEST_PATH}`],
      { cwd: repositoryRoot, maxBuffer: 1024 * 1024 },
    );
    manifests.push(JSON.parse(result.stdout));
  }
  return manifests;
}

export async function checkFeatureModuleStandard(repositoryRoot = process.cwd()) {
  const manifest = JSON.parse(await readFile(resolve(repositoryRoot, MANIFEST_PATH), "utf8"));
  const artifacts = new Map();
  for (const record of manifest.versions ?? []) {
    artifacts.set(record.path, await readFile(resolve(repositoryRoot, record.path)));
  }
  validateFeatureModuleStandardManifest(manifest, artifacts);
  validateAppendOnlyStandardHistory(manifest, await historicalManifests(repositoryRoot));
}

if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkFeatureModuleStandard();
  console.log("Feature Module Standard registry and immutable artifacts are valid.");
}
