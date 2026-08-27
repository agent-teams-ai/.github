import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { observeStableRepositoryInventory } from "./docs-cohort-policy.mjs";

const execFileAsync = promisify(execFile);

export async function resolveForkParents(repositories, fetchRepository) {
  return Promise.all(repositories.map(async (repository) => {
    if (!repository.fork) {return { ...repository, fork_parent: null };}
    const detail = await fetchRepository(repository.full_name);
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
  const missingFromSnapshot = [...live.keys()].filter((repository) => !declared.has(repository)).sort();
  const absentFromOrganization = [...declared.keys()].filter((repository) => !live.has(repository)).sort();
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
    .sort((left, right) => left.repository.localeCompare(right.repository));
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (typeof process.env.GH_TOKEN !== "string" || process.env.GH_TOKEN.length === 0) {
    throw new Error("ORG_INVENTORY_READ_TOKEN is required for the bounded organization inventory audit.");
  }
  const policy = JSON.parse(await readFile("governance/docs-protocol-policy-v2.json", "utf8"));
  const inventory = JSON.parse(await readFile("governance/organization-repository-inventory.json", "utf8"));
  const first = await observeStableRepositoryInventory(fetchPage, { maxPages: policy.admission.live_drift_audit.max_pages });
  await assertCompletePrivateRepositoryVisibility(first);
  if (process.argv.includes("--audit")) {assertRepositoryInventoryCurrent(first, inventory, policy);}
  process.stdout.write(`${JSON.stringify({
    organization: "agent-teams-ai",
    repository_count: first.length,
    drift_status: process.argv.includes("--audit") ? "current" : "not_evaluated",
    repositories: first,
  }, null, 2)}\n`);
}
