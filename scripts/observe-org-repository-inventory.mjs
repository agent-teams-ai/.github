import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { observeStableRepositoryInventory } from "./docs-cohort-policy.mjs";
import { ADMISSION_CALLER, BOOTSTRAP_GUIDE, BOOTSTRAP_START, checkRepositoryAdmission, MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES, safeAdmissionPath } from "./check-repository-admission.ts";

const execFileAsync = promisify(execFile);

export async function resolveForkParents(repositories, fetchRepositoryDetail) {
  return Promise.all(repositories.map(async (repository) => {
    if (!repository.fork) {return { ...repository, fork_parent: null };}
    const detail = await fetchRepositoryDetail(repository.full_name);
    if (detail.id !== repository.id || detail.full_name !== repository.full_name ||
        detail.fork !== true || typeof detail.parent?.full_name !== "string") {
      throw new Error(`${repository.full_name} individual fork metadata is incomplete or inconsistent.`);
    }
    return { ...repository, fork_parent: detail.parent.full_name };
  }));
}

async function fetchRepository(repository) {
  const { stdout } = await execFileAsync("gh", ["api", `repos/${repository}`], {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    timeout: 30_000,
  });
  return JSON.parse(stdout);
}

export async function fetchPage({ page, perPage }) {
  const { stdout } = await execFileAsync("gh", [
    "api",
    `orgs/agent-teams-ai/repos?type=all&per_page=${perPage}&page=${page}`,
    "--jq",
    "map({id, name, full_name, created_at, archived, fork, owner: .owner.login, visibility, default_branch})",
  ], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 30_000,
  });
  return resolveForkParents(JSON.parse(stdout), fetchRepository);
}

function liveProjection(repository) {
  return { repository: repository.full_name, id: repository.id, created_at: repository.created_at,
    archived: repository.archived, visibility: repository.visibility, default_branch: repository.default_branch,
    is_fork: repository.fork, fork_parent: repository.fork_parent };
}

export function repositoryInventoryDrift(liveRepositories, inventory, policy) {
  const live = new Map(liveRepositories.map((record) => [record.full_name, liveProjection(record)]));
  const declared = new Map(inventory.repositories.map((record) => [record.repository, record]));
  const activePolicy = new Map(policy.repositories.filter(({ repository_lifecycle }) => repository_lifecycle === "active").map((record) => [record.repository, record]));
  const missingFromSnapshot = [...live.keys()].filter((repository) => !declared.has(repository)).toSorted();
  const absentFromOrganization = [...declared.keys()].filter((repository) => !live.has(repository)).toSorted();
  const structuralChanges = [];
  for (const [repository, observed] of live) {
    const expected = declared.get(repository);
    if (!expected) {continue;}
    for (const field of ["id", "created_at", "archived", "visibility", "default_branch", "is_fork", "fork_parent"]) {
      if (expected[field] !== observed[field]) {structuralChanges.push({ repository, field, expected: expected[field], observed: observed[field] });}
    }
  }
  const missingClassification = [...live.values()].filter(({ repository, id }) => activePolicy.get(repository)?.repository_id !== id)
    .map(({ repository, id }) => ({ repository, repository_id: id, required_status: "pending_classification" }))
    .toSorted((left, right) => left.repository.localeCompare(right.repository));
  return { missingFromSnapshot, absentFromOrganization, structuralChanges, missingClassification };
}

export function assertRepositoryInventoryCurrent(liveRepositories, inventory, policy) {
  const drift = repositoryInventoryDrift(liveRepositories, inventory, policy);
  if (Object.values(drift).some((entries) => entries.length > 0)) {
    throw new Error(`Organization repository inventory drift detected. Add every new repository to the dated inventory and documentation policy as pending_classification before choosing adopted or N/A. Actionable diff:\n${JSON.stringify(drift, null, 2)}`);
  }
  return drift;
}

async function assertCompletePrivateRepositoryVisibility(liveRepositories) {
  const { stdout } = await execFileAsync("gh", ["api", "orgs/agent-teams-ai", "--jq", "{login,total_private_repos}"], {
    encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 30_000,
  });
  const organization = JSON.parse(stdout);
  const visiblePrivate = liveRepositories.filter(({ visibility }) => visibility === "private").length;
  if (organization.login !== "agent-teams-ai" || !Number.isInteger(organization.total_private_repos) ||
      organization.total_private_repos !== visiblePrivate) {
    throw new Error("ORG_INVENTORY_READ_TOKEN does not prove complete private-repository visibility for agent-teams-ai.");
  }
}

// Independent of consumer CI: a new repository with no caller still reaches
// this observer. Older repositories remain out of scope unless they opt in.
export async function auditRepositoryBootstrapConfigurations(repositories, loadSource) {
  const results = [];
  for (const repository of repositories) {
    if (repository.archived || repository.fork) {continue;}
    if (repository.owner !== undefined && repository.owner !== "agent-teams-ai") {throw new Error("Bootstrap audit received an unexpected repository owner.");}
    if (typeof repository.created_at !== "string" || !Number.isFinite(Date.parse(repository.created_at))) {throw new Error("Bootstrap audit needs each repository's exact creation timestamp.");}
    const source = await loadSource(repository);
    const caller = await source.read(ADMISSION_CALLER);
    const manifestText = await source.read("package.json");
    let explicitOptIn = false;
    if (manifestText !== undefined) {
      try {explicitOptIn = JSON.parse(manifestText).repositoryAdmission === 1;}
      catch { /* New or opted-in repositories are rejected by the full checker. */ }
    }
    const required = Date.parse(repository.created_at) >= Date.parse(BOOTSTRAP_START) || caller !== undefined || explicitOptIn;
    if (!required) {continue;}
    const result = await checkRepositoryAdmission(source);
    await source.recheck?.();
    results.push({ repository: repository.full_name, repository_id: repository.id, revision: source.revision ?? null, ...result });
  }
  return results;
}

async function githubJson(endpoint, maxBuffer = 8 * 1024 * 1024) {
  const { stdout } = await execFileAsync("gh", ["api", endpoint], { encoding: "utf8", maxBuffer, timeout: 30_000 });
  return JSON.parse(stdout);
}

export async function loadRemoteBootstrapSource(repository, request = githubJson) {
  if (!/^agent-teams-ai\/[A-Za-z0-9_.-]+$/u.test(repository.full_name)) {throw new Error("Unexpected bootstrap repository identity.");}
  const endpoint = `repos/${repository.full_name}`;
  const commitEndpoint = `${endpoint}/commits/${encodeURIComponent(repository.default_branch)}`;
  const commit = await request(commitEndpoint);
  if (!/^(?!0{40}$)[a-f0-9]{40}$/u.test(commit.sha) || !/^(?!0{40}$)[a-f0-9]{40}$/u.test(commit.commit?.tree?.sha)) {throw new Error("Bootstrap default branch did not resolve to an immutable commit and tree.");}
  const tree = await request(`${endpoint}/git/trees/${commit.commit.tree.sha}?recursive=1`);
  if (tree.sha !== commit.commit.tree.sha || tree.truncated !== false || !Array.isArray(tree.tree) || tree.tree.length > 100_000) {throw new Error("Complete bounded Git tree is required for bootstrap auditing.");}
  const entries = new Map();
  for (const entry of tree.tree) {
    if (typeof entry.path !== "string" || entries.has(entry.path)) {throw new Error("Bootstrap tree paths are incomplete or duplicated.");}
    entries.set(entry.path, entry);
  }
  const cache = new Map();
  let totalBytes = 0;
  return {
    revision: commit.sha,
    workflows: async () => {
      const paths = [...entries.keys()].filter(path => /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(path)).toSorted();
      if (paths.length > MAX_FILES) {throw new Error("Bootstrap workflow census exceeds the read budget.");}
      return paths;
    },
    read: async path => {
      if (!safeAdmissionPath(path)) {throw new Error("Unsafe bootstrap Git path.");}
      if (cache.has(path)) {return cache.get(path);}
      const entry = entries.get(path);
      if (entry === undefined) {cache.set(path, undefined); return;}
      if (cache.size >= MAX_FILES || entry.type !== "blob" || !["100644", "100755"].includes(entry.mode) || !Number.isSafeInteger(entry.size) || entry.size > MAX_FILE_BYTES) {throw new Error("Bootstrap inputs must be bounded regular Git files.");}
      const response = await request(`${endpoint}/git/blobs/${entry.sha}`, 2 * MAX_FILE_BYTES);
      if (response.sha !== entry.sha || response.encoding !== "base64" || typeof response.content !== "string") {throw new Error("Bootstrap blob identity is incomplete.");}
      const bytes = Buffer.from(response.content, "base64");
      totalBytes += bytes.length;
      const hash = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
      if (bytes.length !== entry.size || response.size !== entry.size || totalBytes > MAX_TOTAL_BYTES || hash !== entry.sha) {throw new Error("Bootstrap blob bytes do not match the bounded immutable tree.");}
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      cache.set(path, text);
      return text;
    },
    recheck: async () => {
      const metadata = await request(endpoint);
      const current = await request(commitEndpoint);
      if (metadata.id !== repository.id || metadata.full_name !== repository.full_name || metadata.default_branch !== repository.default_branch || current.sha !== commit.sha) {throw new Error("Bootstrap repository identity or default branch moved during observation.");}
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (typeof process.env.GH_TOKEN !== "string" || process.env.GH_TOKEN.length === 0) {
    throw new Error("ORG_INVENTORY_READ_TOKEN is required for the bounded organization inventory audit.");
  }
  const policy = JSON.parse(await readFile("governance/docs-protocol-policy-v2.json", "utf8"));
  const inventory = JSON.parse(await readFile("governance/organization-repository-inventory.json", "utf8"));
  const first = await observeStableRepositoryInventory(fetchPage, { maxPages: policy.admission.live_drift_audit.max_pages });
  await assertCompletePrivateRepositoryVisibility(first);
  let driftError;
  let bootstrap = [];
  if (process.argv.includes("--audit")) {
    try {assertRepositoryInventoryCurrent(first, inventory, policy);}
    catch (error) {driftError = error;}
    // Run even when inventory drifts, so a wholly absent caller is actionable
    // alongside the pending-classification requirement for a new repository.
    bootstrap = await auditRepositoryBootstrapConfigurations(first, loadRemoteBootstrapSource);
  }
  const bootstrapFailed = bootstrap.some(({ status }) => status !== "configured_not_qualified");
  process.stdout.write(`${JSON.stringify({
    organization: "agent-teams-ai",
    repository_count: first.length,
    drift_status: process.argv.includes("--audit") ? driftError ? "drift_detected" : "current" : "not_evaluated",
    bootstrap_status: process.argv.includes("--audit") ? bootstrapFailed ? "incomplete" : "configured_not_qualified" : "not_evaluated",
    bootstrap_guide: BOOTSTRAP_GUIDE,
    bootstrap,
    repositories: first,
  }, null, 2)}\n`);
  if (driftError) {throw driftError;}
  if (bootstrapFailed) {throw new Error(`Repository bootstrap configuration is incomplete. Follow ${BOOTSTRAP_GUIDE}`);}
}
