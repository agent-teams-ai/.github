import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { ADMISSION_CALLER, BOOTSTRAP_START, checkRepositoryAdmission, MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES, safeAdmissionPath } from "./check-repository-admission.ts";
import type { AdmissionResult, AdmissionSource } from "./check-repository-admission.ts";

type Data = Record<string, unknown>;
export interface BootstrapRepository {
  full_name: string; id: number; created_at: string; archived: boolean; fork: boolean;
  default_branch: string; owner?: string;
}
export interface BootstrapSource extends AdmissionSource { revision?: string; recheck?: () => Promise<void> }
export interface BootstrapObservation extends AdmissionResult { repository: string; repository_id: number; revision: string | null }
export type BootstrapRequest = (endpoint: string, maxBuffer?: number) => Promise<unknown>;
const execFileAsync = promisify(execFile);
const object = (value: unknown): Data => {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), "Expected GitHub response mapping");
  return value as Data;
};
const sha = (value: unknown): value is string => typeof value === "string" && /^(?!0{40}$)[a-f0-9]{40}$/u.test(value);

export async function auditRepositoryBootstrapConfigurations(repositories: readonly BootstrapRepository[],
  loadSource: (repository: BootstrapRepository) => Promise<BootstrapSource>, requiredRepositoryIds: ReadonlySet<number> = new Set()):
  Promise<BootstrapObservation[]> {
  const results: BootstrapObservation[] = [];
  for (const repository of repositories) {
    if (repository.archived || repository.fork) { continue; }
    assert.ok(repository.owner === undefined || repository.owner === "agent-teams-ai", "Bootstrap audit received an unexpected repository owner.");
    assert.ok(typeof repository.created_at === "string" && Number.isFinite(Date.parse(repository.created_at)),
      "Bootstrap audit needs each repository's exact creation timestamp.");
    const source = await loadSource(repository);
    const caller = await source.read(ADMISSION_CALLER), manifestText = await source.read("package.json");
    let explicitOptIn = false;
    if (manifestText !== undefined) {
      try { explicitOptIn = object(JSON.parse(manifestText) as unknown).repositoryAdmission === 1; }
      catch { /* Required repositories are rejected by the full checker. */ }
    }
    const required = requiredRepositoryIds.has(repository.id) || Date.parse(repository.created_at) >= Date.parse(BOOTSTRAP_START) ||
      caller !== undefined || explicitOptIn;
    if (!required) { continue; }
    const result = await checkRepositoryAdmission({ ...source, defaultBranch: repository.default_branch });
    await source.recheck?.();
    results.push({ repository: repository.full_name, repository_id: repository.id, revision: source.revision ?? null, ...result });
  }
  return results;
}

async function githubJson(endpoint: string, maxBuffer = 8 * 1024 * 1024): Promise<unknown> {
  const { stdout } = await execFileAsync("gh", ["api", endpoint], { encoding: "utf8", maxBuffer, timeout: 30_000 });
  return JSON.parse(stdout) as unknown;
}

export async function loadRemoteBootstrapSource(repository: BootstrapRepository, request: BootstrapRequest = githubJson): Promise<BootstrapSource> {
  assert.match(repository.full_name, /^agent-teams-ai\/[A-Za-z0-9_.-]+$/u, "Unexpected bootstrap repository identity.");
  const endpoint = `repos/${repository.full_name}`;
  const commitEndpoint = `${endpoint}/commits/${encodeURIComponent(repository.default_branch)}`;
  const commit = object(await request(commitEndpoint)), commitTree = object(object(commit.commit).tree);
  assert.ok(sha(commit.sha) && sha(commitTree.sha), "Bootstrap default branch did not resolve to an immutable commit and tree.");
  const revision = commit.sha;
  const tree = object(await request(`${endpoint}/git/trees/${commitTree.sha}?recursive=1`));
  assert.ok(tree.sha === commitTree.sha && tree.truncated === false && Array.isArray(tree.tree) && tree.tree.length <= 100_000,
    "Complete bounded Git tree is required for bootstrap auditing.");
  const entries = new Map<string, Data>();
  for (const raw of tree.tree) {
    const entry = object(raw);
    assert.ok(typeof entry.path === "string" && !entries.has(entry.path), "Bootstrap tree paths are incomplete or duplicated.");
    entries.set(entry.path, entry);
  }
  const cache = new Map<string, string | undefined>();
  let totalBytes = 0;
  return {
    revision,
    defaultBranch: repository.default_branch,
    workflows: async () => {
      const paths = [...entries.keys()].filter(path => /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(path)).toSorted();
      assert.ok(paths.length <= MAX_FILES, "Bootstrap workflow census exceeds the read budget.");
      return paths;
    },
    read: async path => {
      assert.ok(safeAdmissionPath(path), "Unsafe bootstrap Git path.");
      if (cache.has(path)) { return cache.get(path); }
      const entry = entries.get(path);
      if (entry === undefined) { cache.set(path, undefined); return; }
      assert.ok(cache.size < MAX_FILES && entry.type === "blob" && typeof entry.mode === "string" && ["100644", "100755"].includes(entry.mode) &&
        typeof entry.size === "number" && Number.isSafeInteger(entry.size) && entry.size <= MAX_FILE_BYTES,
      "Bootstrap inputs must be bounded regular Git files.");
      const response = object(await request(`${endpoint}/git/blobs/${String(entry.sha)}`, 2 * MAX_FILE_BYTES));
      assert.ok(response.sha === entry.sha && response.encoding === "base64" && typeof response.content === "string",
        "Bootstrap blob identity is incomplete.");
      const bytes = Buffer.from(response.content, "base64");
      totalBytes += bytes.length;
      const hash = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
      assert.ok(bytes.length === entry.size && response.size === entry.size && totalBytes <= MAX_TOTAL_BYTES && hash === entry.sha,
        "Bootstrap blob bytes do not match the bounded immutable tree.");
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      cache.set(path, text);
      return text;
    },
    recheck: async () => {
      const metadata = object(await request(endpoint)), current = object(await request(commitEndpoint));
      assert.ok(metadata.id === repository.id && metadata.full_name === repository.full_name &&
        metadata.default_branch === repository.default_branch && current.sha === revision,
      "Bootstrap repository identity or default branch moved during observation.");
    },
  };
}
