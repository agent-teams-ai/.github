import { execFile } from "node:child_process";
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
    "map({id, name, full_name, archived, fork, owner: .owner.login, visibility, default_branch, updated_at})",
  ], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 30_000,
  });
  return resolveForkParents(JSON.parse(stdout), fetchRepository);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const first = await observeStableRepositoryInventory(fetchPage);
  process.stdout.write(`${JSON.stringify({
    organization: "agent-teams-ai",
    repository_count: first.length,
    repositories: first,
  }, null, 2)}\n`);
}
