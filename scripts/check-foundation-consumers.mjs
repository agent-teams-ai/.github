import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import YAML from "yaml";

export const INVENTORY_PATH = "governance/engineering-foundation-consumers.yaml";
export const EXPECTED_CONSUMERS = [
  "agent-runtime",
  "agent-teams-orchestrator",
  "agent-teams-platform",
  "extension-foundation"
];

const EXACT_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\/\/)[^\0]+$/;
const PENDING_INTEGRITY = "pending-publication";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, keys, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object.`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label} keys must be exactly: ${expected.join(", ")}.`);
}

function validatePath(value, label) {
  assert(typeof value === "string" && EXACT_PATH.test(value), `${label} must be an exact repository-relative path.`);
}

function isCanonicalSha512(value) {
  if (typeof value !== "string" || !value.startsWith("sha512-")) return false;
  const encoded = value.slice("sha512-".length);
  try {
    const digest = Buffer.from(encoded, "base64");
    return digest.length === 64 && digest.toString("base64") === encoded;
  } catch {
    return false;
  }
}

export function validateInventory(document, { now = new Date() } = {}) {
  exactKeys(document, ["schemaVersion", "organization", "package", "requiredVersion", "registry", "requiredIntegrity", "sourceRepository", "consumers", "exceptions"], "Inventory");
  assert(document.schemaVersion === 1, "schemaVersion must be 1.");
  assert(document.organization === "agent-teams-ai", "organization must be agent-teams-ai.");
  assert(document.package === "@agent-teams/engineering-foundation", "Unexpected foundation package.");
  assert(document.requiredVersion === "0.16.1", "requiredVersion must be the exact string 0.16.1.");
  assert(document.registry === "https://registry.npmjs.org/", "registry must be the canonical npm registry.");
  assert(document.requiredIntegrity === PENDING_INTEGRITY || isCanonicalSha512(document.requiredIntegrity), "requiredIntegrity must be pending-publication or a canonical sha512 SRI.");
  assert(document.sourceRepository === "engineering-foundation", "sourceRepository must be engineering-foundation.");
  assert(Array.isArray(document.consumers), "consumers must be an array.");
  assert(Array.isArray(document.exceptions), "exceptions must be an array.");

  const seenConsumers = new Set();
  for (const [index, consumer] of document.consumers.entries()) {
    exactKeys(consumer, ["repository", "manifestPath", "lockfilePath"], `consumers[${index}]`);
    assert(typeof consumer.repository === "string" && consumer.repository.length > 0, `consumers[${index}].repository is required.`);
    assert(!seenConsumers.has(consumer.repository), `Duplicate consumer repository: ${consumer.repository}.`);
    seenConsumers.add(consumer.repository);
    validatePath(consumer.manifestPath, `consumers[${index}].manifestPath`);
    validatePath(consumer.lockfilePath, `consumers[${index}].lockfilePath`);
    assert(consumer.manifestPath === "package.json", `consumers[${index}].manifestPath must be the root package.json; nested manifests are prohibited.`);
    assert(consumer.lockfilePath === "pnpm-lock.yaml", `consumers[${index}].lockfilePath must be the root pnpm-lock.yaml; nested lockfiles are prohibited.`);
  }
  assert(JSON.stringify([...seenConsumers].sort()) === JSON.stringify([...EXPECTED_CONSUMERS].sort()), `Consumers must be exactly: ${EXPECTED_CONSUMERS.join(", ")}.`);
  assert(!seenConsumers.has(document.sourceRepository), "The source repository cannot be a consumer.");

  const seenExceptions = new Set();
  const today = now.toISOString().slice(0, 10);
  for (const [index, exception] of document.exceptions.entries()) {
    exactKeys(exception, ["repository", "path", "reason", "expiresOn", "approvalOwner"], `exceptions[${index}]`);
    assert(typeof exception.repository === "string" && exception.repository.length > 0, `exceptions[${index}].repository is required.`);
    validatePath(exception.path, `exceptions[${index}].path`);
    assert(exception.path === "package.json" || exception.path.endsWith("/package.json"), `exceptions[${index}].path must identify one exact package.json.`);
    assert(typeof exception.reason === "string" && exception.reason.trim().length >= 10, `exceptions[${index}].reason must explain the exception.`);
    assert(typeof exception.expiresOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(exception.expiresOn), `exceptions[${index}].expiresOn must be an ISO date.`);
    assert(exception.expiresOn >= today, `exceptions[${index}] expired on ${exception.expiresOn}.`);
    assert(typeof exception.approvalOwner === "string" && /^@[A-Za-z0-9-]+(?:\/[A-Za-z0-9_.-]+)?$/.test(exception.approvalOwner), `exceptions[${index}].approvalOwner must be an accountable GitHub user or team.`);
    const key = `${exception.repository}:${exception.path}`;
    assert(!seenExceptions.has(key), `Duplicate exception: ${key}.`);
    seenExceptions.add(key);
  }
  return document;
}

export async function loadInventory(path = INVENTORY_PATH) {
  const source = await readFile(path, "utf8");
  return validateInventory(YAML.parse(source));
}

function apiError(response, url) {
  const remaining = response.headers.get("x-ratelimit-remaining");
  if (response.status === 403 && remaining === "0") return `GitHub API rate limit exhausted for ${url}.`;
  return `GitHub API request failed (${response.status}) for ${url}.`;
}

export function createGitHubClient({ token, fetchImpl = globalThis.fetch, apiUrl = "https://api.github.com" }) {
  assert(typeof token === "string" && token.length > 0, "A read-only GitHub token is required.");
  assert(typeof fetchImpl === "function", "fetch is unavailable.");

  async function request(path) {
    const url = path.startsWith("http") ? path : `${apiUrl}${path}`;
    const response = await fetchImpl(url, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28"
      }
    });
    if (!response.ok) throw new Error(apiError(response, url));
    if (response.headers.get("x-ratelimit-remaining") === "0") throw new Error(`GitHub API rate limit exhausted after ${url}.`);
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error(`GitHub API returned invalid JSON for ${url}.`);
    }
    return { body, link: response.headers.get("link") };
  }

  async function paginate(path) {
    const items = [];
    let next = path;
    const visited = new Set();
    while (next) {
      assert(!visited.has(next), "GitHub API pagination loop detected.");
      visited.add(next);
      const { body, link } = await request(next);
      assert(Array.isArray(body), `Expected paginated array from ${next}.`);
      items.push(...body);
      const match = link?.match(/<([^>]+)>;\s*rel="next"/);
      next = match?.[1];
    }
    return items;
  }

  return { request, paginate };
}

function decodeBlob(blob, label) {
  assert(blob?.encoding === "base64" && typeof blob.content === "string" && blob.truncated !== true, `${label} blob is missing, truncated, or not base64.`);
  return Buffer.from(blob.content.replace(/\n/g, ""), "base64").toString("utf8");
}

function parseJson(source, label) {
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

function splitSuffixGroups(suffix) {
  const groups = [];
  let index = 0;
  while (index < suffix.length) {
    if (suffix[index] !== "(") return null;
    const start = ++index;
    let depth = 1;
    while (index < suffix.length && depth > 0) {
      if (suffix[index] === "(") depth += 1;
      else if (suffix[index] === ")") depth -= 1;
      index += 1;
    }
    if (depth !== 0) return null;
    groups.push(suffix.slice(start, index - 1));
  }
  return groups;
}

function isAllowedPeerReference(reference) {
  if (reference.includes("patch_hash") || reference.includes("=") || reference.includes(":")) return false;
  const nestedAt = reference.indexOf("(");
  const head = nestedAt === -1 ? reference : reference.slice(0, nestedAt);
  const nested = nestedAt === -1 ? "" : reference.slice(nestedAt);
  const peerPattern = /^(?:@[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+|[A-Za-z0-9_.-]+)@[0-9][0-9A-Za-z.+_-]*$/;
  if (!peerPattern.test(head)) return false;
  const groups = splitSuffixGroups(nested);
  return groups !== null && groups.every(isAllowedPeerReference);
}

function isAllowedLockedVersion(value, requiredVersion) {
  if (value === requiredVersion) return true;
  if (typeof value !== "string" || !value.startsWith(`${requiredVersion}(`)) return false;
  const groups = splitSuffixGroups(value.slice(requiredVersion.length));
  return groups !== null && groups.length > 0 && groups.every(isAllowedPeerReference);
}

export function validateConsumerFiles({ inventory, consumer, manifestSource, lockfileSource }) {
  assert(inventory.requiredIntegrity !== PENDING_INTEGRITY, "Consumer files cannot be verified while registry integrity is pending publication.");
  const manifest = parseJson(manifestSource, `${consumer.repository}/${consumer.manifestPath}`);
  const dependencySections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
  const placements = dependencySections.filter((section) => Object.hasOwn(manifest[section] ?? {}, inventory.package));
  assert(placements.length === 1 && placements[0] === "devDependencies", `${consumer.repository}/${consumer.manifestPath} must declare ${inventory.package} only in devDependencies.`);
  assert(manifest.devDependencies[inventory.package] === inventory.requiredVersion, `${consumer.repository}/${consumer.manifestPath} must use exact devDependency ${inventory.package}@${inventory.requiredVersion}.`);
  assert(!targetsPackage(manifest.pnpm?.patchedDependencies, inventory.package), `${consumer.repository}/${consumer.manifestPath} must not patch ${inventory.package}.`);
  assert(!targetsPackage(manifest.pnpm?.overrides, inventory.package), `${consumer.repository}/${consumer.manifestPath} must not override ${inventory.package}.`);
  assert(!targetsPackage(manifest.overrides, inventory.package), `${consumer.repository}/${consumer.manifestPath} must not override ${inventory.package}.`);
  assert(!targetsPackage(manifest.resolutions, inventory.package), `${consumer.repository}/${consumer.manifestPath} must not resolve ${inventory.package} through an alternate source.`);

  let lockfile;
  try {
    lockfile = YAML.parse(lockfileSource);
  } catch {
    throw new Error(`${consumer.repository}/${consumer.lockfilePath} is not valid YAML.`);
  }
  assert(!targetsPackage(lockfile?.patchedDependencies, inventory.package), `${consumer.repository}/${consumer.lockfilePath} must not patch ${inventory.package}.`);
  assert(!targetsPackage(lockfile?.overrides, inventory.package), `${consumer.repository}/${consumer.lockfilePath} must not override ${inventory.package}.`);
  const locked = lockfile?.importers?.["."]?.devDependencies?.[inventory.package];
  assert(locked && typeof locked === "object", `${consumer.repository}/${consumer.lockfilePath} has no matching importer devDependency.`);
  assert(locked.specifier === inventory.requiredVersion, `${consumer.repository}/${consumer.lockfilePath} specifier does not match ${inventory.requiredVersion}.`);
  assert(isAllowedLockedVersion(locked.version, inventory.requiredVersion), `${consumer.repository}/${consumer.lockfilePath} resolved version has a disallowed source or suffix.`);

  const packageEntry = lockfile?.packages?.[`${inventory.package}@${inventory.requiredVersion}`];
  assert(packageEntry && typeof packageEntry === "object", `${consumer.repository}/${consumer.lockfilePath} has no package snapshot for ${inventory.package}@${inventory.requiredVersion}.`);
  assert(!Object.hasOwn(packageEntry.resolution ?? {}, "tarball"), `${consumer.repository}/${consumer.lockfilePath} must not use an alternate tarball for ${inventory.package}.`);
  assert(packageEntry.resolution?.integrity === inventory.requiredIntegrity, `${consumer.repository}/${consumer.lockfilePath} integrity does not match the canonical registry SRI.`);

  const snapshotPrefix = `${inventory.package}@${inventory.requiredVersion}`;
  const matchingSnapshotKeys = Object.keys(lockfile?.snapshots ?? {}).filter((key) => key === snapshotPrefix || key.startsWith(`${snapshotPrefix}(`));
  assert(matchingSnapshotKeys.length > 0, `${consumer.repository}/${consumer.lockfilePath} has no matching package snapshot.`);
  assert(matchingSnapshotKeys.every((key) => isAllowedLockedVersion(key.slice(`${inventory.package}@`.length), inventory.requiredVersion)), `${consumer.repository}/${consumer.lockfilePath} contains a snapshot with a disallowed source or suffix.`);
  assert(matchingSnapshotKeys.includes(`${inventory.package}@${locked.version}`), `${consumer.repository}/${consumer.lockfilePath} importer version has no exact matching snapshot.`);
}

function targetsPackage(value, packageName) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).some(([key, nested]) => key.includes(packageName) || targetsPackage(nested, packageName));
}

async function getBlob(client, owner, repository, sha, path, treeByPath) {
  const entry = treeByPath.get(path);
  assert(entry?.type === "blob" && typeof entry.sha === "string", `${repository}/${path} is missing at ${sha}.`);
  const { body } = await client.request(`/repos/${owner}/${repository}/git/blobs/${entry.sha}`);
  return decodeBlob(body, `${repository}/${path}`);
}

async function inspectRepository(client, inventory, repository, consumer, exceptionPaths, usedExceptionPaths) {
  assert(typeof repository.default_branch === "string" && repository.default_branch.length > 0, `${repository.name} has no default branch.`);
  const branch = await client.request(`/repos/${inventory.organization}/${repository.name}/branches/${encodeURIComponent(repository.default_branch)}`);
  const sha = branch.body?.commit?.sha;
  assert(typeof sha === "string" && /^[0-9a-f]{40}$/.test(sha), `${repository.name} default branch did not resolve to an exact SHA.`);
  const treeResult = await client.request(`/repos/${inventory.organization}/${repository.name}/git/trees/${sha}?recursive=1`);
  assert(treeResult.body?.truncated === false && Array.isArray(treeResult.body.tree), `${repository.name} recursive tree is missing or truncated.`);
  const treeByPath = new Map(treeResult.body.tree.map((entry) => [entry.path, entry]));
  const manifestPaths = treeResult.body.tree.filter((entry) => entry.type === "blob" && (entry.path === "package.json" || entry.path.endsWith("/package.json"))).map((entry) => entry.path);
  const findings = [];

  for (const path of manifestPaths) {
    const source = await getBlob(client, inventory.organization, repository.name, sha, path, treeByPath);
    const manifest = parseJson(source, `${repository.name}/${path}`);
    const sections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
    const usesFoundation = sections.some((section) => Object.hasOwn(manifest[section] ?? {}, inventory.package));
    if (!usesFoundation) continue;
    if (exceptionPaths.has(`${repository.name}:${path}`)) {
      usedExceptionPaths.add(`${repository.name}:${path}`);
      continue;
    }
    assert(consumer, `Unregistered foundation consumer: ${repository.name}/${path}.`);
    assert(path === consumer.manifestPath, `Nested or unexpected foundation consumer: ${repository.name}/${path}.`);
    findings.push(path);
  }

  if (consumer) {
    assert(findings.length === 1, `${repository.name} must contain exactly one registered foundation consumer at ${consumer.manifestPath}.`);
    const manifestSource = await getBlob(client, inventory.organization, repository.name, sha, consumer.manifestPath, treeByPath);
    const lockfileSource = await getBlob(client, inventory.organization, repository.name, sha, consumer.lockfilePath, treeByPath);
    validateConsumerFiles({ inventory, consumer, manifestSource, lockfileSource });
  }
  return { repository: repository.name, defaultBranch: repository.default_branch, sha, consumer: Boolean(consumer), status: "passed" };
}

export async function auditConsumers({ inventory, token, fetchImpl, apiUrl, onProgress = () => {} }) {
  assert(inventory.requiredIntegrity !== PENDING_INTEGRITY, "Live audit is disabled until the stable registry SRI is pinned.");
  const client = createGitHubClient({ token, fetchImpl, apiUrl });
  const installation = await client.request("/installation/repositories?per_page=1");
  assert(installation.body?.repository_selection === "all", "GitHub App installation must have repository_selection=all; selected-repository access cannot prove completeness.");

  const repositories = await client.paginate(`/orgs/${inventory.organization}/repos?type=all&per_page=100`);
  const uniqueNames = new Set();
  for (const repository of repositories) {
    assert(typeof repository?.name === "string", "GitHub repository listing contained an invalid item.");
    assert(!uniqueNames.has(repository.name), `Duplicate repository returned by GitHub API: ${repository.name}.`);
    uniqueNames.add(repository.name);
  }
  for (const expected of inventory.consumers) assert(uniqueNames.has(expected.repository), `Registered consumer repository is missing or inaccessible: ${expected.repository}.`);
  assert(uniqueNames.has(inventory.sourceRepository), `Source repository is missing or inaccessible: ${inventory.sourceRepository}.`);

  const consumers = new Map(inventory.consumers.map((consumer) => [consumer.repository, consumer]));
  const exceptionPaths = new Set(inventory.exceptions.map((exception) => `${exception.repository}:${exception.path}`));
  const usedExceptionPaths = new Set();
  const results = [];
  for (const repository of repositories) {
    if (repository.name === inventory.sourceRepository) continue;
    const result = await inspectRepository(client, inventory, repository, consumers.get(repository.name), exceptionPaths, usedExceptionPaths);
    results.push(result);
    onProgress(result);
  }
  for (const exception of exceptionPaths) assert(usedExceptionPaths.has(exception), `Stale or unverifiable exception: ${exception}.`);
  return results;
}

function parseArguments(argv) {
  const options = { inventoryPath: INVENTORY_PATH, outputPath: null, validateOnly: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--validate-only") options.validateOnly = true;
    else if (argument === "--inventory") options.inventoryPath = argv[++index];
    else if (argument === "--output") options.outputPath = argv[++index];
    else throw new Error(`Unknown argument: ${argument}.`);
  }
  assert(typeof options.inventoryPath === "string" && options.inventoryPath.length > 0, "--inventory requires a path.");
  if (argv.includes("--output")) assert(typeof options.outputPath === "string" && options.outputPath.length > 0, "--output requires a path.");
  return options;
}

export async function runCli(argv = process.argv.slice(2), env = process.env) {
  const startedAt = new Date().toISOString();
  let options;
  let inventory;
  let report;
  const progress = { checkedRepositoryCount: 0, verifiedConsumerCount: 0 };
  try {
    options = parseArguments(argv);
    inventory = await loadInventory(options.inventoryPath);
    if (options.validateOnly) {
      console.log(`Foundation consumer inventory verified: ${inventory.consumers.length} consumers`);
      return 0;
    }
    await auditConsumers({
      inventory,
      token: env.GITHUB_TOKEN,
      apiUrl: env.GITHUB_API_URL,
      onProgress(result) {
        progress.checkedRepositoryCount += 1;
        if (result.consumer) progress.verifiedConsumerCount += 1;
      }
    });
    report = { status: "passed", startedAt, completedAt: new Date().toISOString(), requiredVersion: inventory.requiredVersion, registeredConsumerCount: inventory.consumers.length, ...progress };
    console.log(`Foundation consumer audit passed: ${inventory.consumers.length} registered consumers`);
  } catch (error) {
    report = {
      status: "failed",
      startedAt,
      completedAt: new Date().toISOString(),
      requiredVersion: inventory?.requiredVersion,
      registeredConsumerCount: inventory?.consumers?.length,
      ...progress,
      errorCode: "FOUNDATION_CONSUMER_AUDIT_FAILED"
    };
    console.error(report.errorCode);
  }
  if (options?.outputPath) await writeFile(options.outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report.status === "passed" ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await runCli();
