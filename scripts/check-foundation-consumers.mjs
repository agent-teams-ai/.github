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

export function validateInventory(document) {
  exactKeys(document, ["schemaVersion", "organization", "package", "requiredVersion", "sourceRepository", "consumers", "exceptions"], "Inventory");
  assert(document.schemaVersion === 1, "schemaVersion must be 1.");
  assert(document.organization === "agent-teams-ai", "organization must be agent-teams-ai.");
  assert(document.package === "@agent-teams/engineering-foundation", "Unexpected foundation package.");
  assert(document.requiredVersion === "0.16.1", "requiredVersion must be the exact string 0.16.1.");
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
    assert(consumer.manifestPath === "package.json" || consumer.manifestPath.endsWith("/package.json"), `consumers[${index}].manifestPath must identify package.json.`);
    assert(consumer.lockfilePath === "pnpm-lock.yaml" || consumer.lockfilePath.endsWith("/pnpm-lock.yaml"), `consumers[${index}].lockfilePath must identify pnpm-lock.yaml.`);
  }
  assert(JSON.stringify([...seenConsumers].sort()) === JSON.stringify([...EXPECTED_CONSUMERS].sort()), `Consumers must be exactly: ${EXPECTED_CONSUMERS.join(", ")}.`);
  assert(!seenConsumers.has(document.sourceRepository), "The source repository cannot be a consumer.");

  const seenExceptions = new Set();
  for (const [index, exception] of document.exceptions.entries()) {
    exactKeys(exception, ["repository", "path", "reason"], `exceptions[${index}]`);
    assert(typeof exception.repository === "string" && exception.repository.length > 0, `exceptions[${index}].repository is required.`);
    validatePath(exception.path, `exceptions[${index}].path`);
    assert(typeof exception.reason === "string" && exception.reason.trim().length >= 10, `exceptions[${index}].reason must explain the exception.`);
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

function normalizedLockedVersion(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(?:npm:)?([^()]+)(?:\(.*\))?$/);
  return match?.[1] ?? null;
}

export function validateConsumerFiles({ inventory, consumer, manifestSource, lockfileSource }) {
  const manifest = parseJson(manifestSource, `${consumer.repository}/${consumer.manifestPath}`);
  const dependencySections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
  const placements = dependencySections.filter((section) => Object.hasOwn(manifest[section] ?? {}, inventory.package));
  assert(placements.length === 1 && placements[0] === "devDependencies", `${consumer.repository}/${consumer.manifestPath} must declare ${inventory.package} only in devDependencies.`);
  assert(manifest.devDependencies[inventory.package] === inventory.requiredVersion, `${consumer.repository}/${consumer.manifestPath} must use exact devDependency ${inventory.package}@${inventory.requiredVersion}.`);

  let lockfile;
  try {
    lockfile = YAML.parse(lockfileSource);
  } catch {
    throw new Error(`${consumer.repository}/${consumer.lockfilePath} is not valid YAML.`);
  }
  const manifestDirectory = consumer.manifestPath.includes("/") ? consumer.manifestPath.slice(0, consumer.manifestPath.lastIndexOf("/")) : ".";
  const locked = lockfile?.importers?.[manifestDirectory]?.devDependencies?.[inventory.package];
  assert(locked && typeof locked === "object", `${consumer.repository}/${consumer.lockfilePath} has no matching importer devDependency.`);
  assert(locked.specifier === inventory.requiredVersion, `${consumer.repository}/${consumer.lockfilePath} specifier does not match ${inventory.requiredVersion}.`);
  assert(normalizedLockedVersion(locked.version) === inventory.requiredVersion, `${consumer.repository}/${consumer.lockfilePath} resolved version does not match ${inventory.requiredVersion}.`);

  const packageEntry = lockfile?.packages?.[`${inventory.package}@${inventory.requiredVersion}`];
  assert(packageEntry && typeof packageEntry === "object", `${consumer.repository}/${consumer.lockfilePath} has no package snapshot for ${inventory.package}@${inventory.requiredVersion}.`);
  assert(typeof packageEntry.resolution?.integrity === "string" && packageEntry.resolution.integrity.length > 20, `${consumer.repository}/${consumer.lockfilePath} is missing package integrity for ${inventory.package}@${inventory.requiredVersion}.`);
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

export async function auditConsumers({ inventory, token, fetchImpl, apiUrl }) {
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
    results.push(await inspectRepository(client, inventory, repository, consumers.get(repository.name), exceptionPaths, usedExceptionPaths));
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
  try {
    options = parseArguments(argv);
    inventory = await loadInventory(options.inventoryPath);
    if (options.validateOnly) {
      console.log(`Foundation consumer inventory verified: ${inventory.consumers.length} consumers`);
      return 0;
    }
    const repositories = await auditConsumers({ inventory, token: env.GITHUB_TOKEN, apiUrl: env.GITHUB_API_URL });
    report = { status: "passed", startedAt, completedAt: new Date().toISOString(), organization: inventory.organization, package: inventory.package, requiredVersion: inventory.requiredVersion, repositories };
    console.log(`Foundation consumer audit passed: ${inventory.consumers.length} registered consumers`);
  } catch (error) {
    report = {
      status: "failed",
      startedAt,
      completedAt: new Date().toISOString(),
      organization: inventory?.organization,
      package: inventory?.package,
      requiredVersion: inventory?.requiredVersion,
      error: error instanceof Error ? error.message : String(error)
    };
    console.error(report.error);
  }
  if (options?.outputPath) await writeFile(options.outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report.status === "passed" ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await runCli();
