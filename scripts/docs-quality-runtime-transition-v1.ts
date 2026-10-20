import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// This version owns one independently approved retirement, not its own installation.
export const RETIREMENT = Object.freeze({
  repository: "agent-teams-ai/.github", repositoryId: 1316243981, pullRequest: 367, pullId: 4907731129,
  baseSHA: "3a203362c25c5ebbe6e44b745ba3f8a5eecbaad0",
  headSHA: "75b5147ecd144c20eb3cdcd215f5e50d30075361",
  baseTreeSHA: "7fdc614a842a539ee552e87ab9d80347b31e1129",
  headTreeSHA: "fa54a39ce8e71a480d03b819d59c0952c59e75d7",
} as const);
export const SOURCE_REF = "refs/heads/governance/quality-runtime-transition-v1";
const ownerId = 13103045;
export const SOURCE_WORKFLOW = ".github/workflows/docs-quality-runtime-transition-v1.yml";
export const BRIDGE_CONTEXTS = Object.freeze([
  "quality-runtime-retirement-source-v1", "quality-runtime-retirement-admission-v1",
] as const);
export const RETIREMENT_TUPLE = Object.freeze([
  ["GOVERNANCE.md", "8f44947a9b13b9e5f28d119eea8a1c6a52ee138f", "37af5965c41608802d715ffa820868c1ce7d2c47"],
  ["docs/organization-security-baseline.md", "de253b76d80b2d3bf5fc189b491aac5f60df315a", "899751b06cddc042f8755a2319798365a945bf1e"],
  ["docs/repository-admission.md", "ba3d32222b71ffaf3eefdb5ce96b1f14c1b947a5", "717d71ca05db1e52b60121ce2f1f7e8a0b73a331"],
  ["governance/docs-protocol-exceptions.json", "ac336b865d697b62c938623f2960864e85f7698a", "7fb208e80500a9ff3dfc449e03c9700e6e15e82e"],
  ["governance/docs-protocol-policy-v2.json", "770991ac05c87af4c39d2f87d38e593d8df758e6", "0f6dbdb6333bfdde814801ddfe53771ec8ac8a23"],
  ["governance/evidence/docs-admission/platform-required-check-exception-retirement-20261019.md", null, "f5f484cccd618456fa411f27c83667bdbfe0a437"],
  ["scripts/docs-admission-change.test.mjs", "ec825f0e38c41d94d20f88d426eddefafb9ea61f", "27f02afec53f5e154ceb82067306fcb3e99b10e2"],
  ["scripts/docs-cohort-policy.test.mjs", "472a63ee8a9c5b6f8d8d33f10f5e334065c4d3b8", "eacf1dd44bc74db14d0a02b9b7edf4f6ffe72142"],
  ["scripts/governance-policy.mjs", "2785168e13065fd6ade4927550ddfed1f2029ff9", "5a1b3166f8f087a9a13e53f2493d579298771f2b"],
  ["scripts/governance-policy.test.mjs", "a2275bf0a2d267dcd5c5753da87362b9b8d507d1", "a521d19f9757ef1a55ee3ae5de38ce16d2b9feee"],
] as const);

export interface RetirementTarget {
  readonly repository: string; readonly repositoryId: number; readonly pullRequest: number; readonly pullId: number;
  readonly baseSHA: string; readonly headSHA: string; readonly baseTreeSHA: string; readonly headTreeSHA: string;
}
export interface ProtectedExecutor {
  readonly repository: string; readonly sourceRef: string; readonly sourceSHA: string; readonly sourceTreeSHA: string;
  readonly workflowPath: string; readonly runId: number; readonly runAttempt: number; readonly event: "push";
}
export interface VerifiedDocument { readonly revision: string; readonly blob: string; readonly bytes: Buffer }
export type RetirementAdmissionDocuments = ReadonlyMap<string, VerifiedDocument>;
export interface GitHubReadApi { get(path: string): Promise<unknown> }
export interface GitHubStatusApi extends GitHubReadApi {
  postStatus(head: string, value: Readonly<{ context: string; state: "pending" | "success" | "failure"; target_url: string; description: string }>): Promise<unknown>;
}
export interface GitEntry { readonly path: string; readonly mode: string; readonly type: string; readonly sha: string; readonly size?: number }
export interface CompleteTree { readonly sha: string; readonly revision?: string; readonly entries: ReadonlyMap<string, GitEntry> }
export type ProtectionVisibility = "public_read" | "owner_full";
export const HOSTED_PROTECTION_OBSERVATION = Object.freeze({
  mode: "public_read", privateBypass: "not_attested", ownerFullReadRequiredForCutover: true,
} as const);

const repositoryRoot = "repos/agent-teams-ai/.github";
const oid = /^(?!0{40}$)[0-9a-f]{40}$/u;
const object = (value: unknown): Record<string, unknown> => {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), "Expected a mapping");
  return value as Record<string, unknown>;
};
const array = (value: unknown): unknown[] => { assert.ok(Array.isArray(value), "Expected an array"); return value; };
const positive = (value: unknown): number => {
  assert.ok(Number.isSafeInteger(value) && Number(value) > 0, "Expected a positive safe integer"); return Number(value);
};
const sha = (value: unknown): string => { assert.ok(typeof value === "string" && oid.test(value), "Invalid Git identity"); return value; };
const pathValid = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 4096 &&
  !value.includes("\\") && [...value].every(character => character.codePointAt(0)! > 31 && character.codePointAt(0) !== 127) &&
  Buffer.from(value).toString("utf8") === value && value.split("/").every(part => part !== "" && part !== "." && part !== "..");
const gitHash = (kind: "blob" | "tree", bytes: Buffer): string =>
  createHash("sha1").update(`${kind} ${bytes.length}\0`).update(bytes).digest("hex");
const sameEntry = (left: GitEntry | undefined, right: GitEntry | undefined): boolean => left === undefined ? right === undefined :
  right !== undefined && left.path === right.path && left.type === right.type && left.mode === right.mode && left.sha === right.sha;

/** Rehash every directory, not only the API's declared root, to reject omissions. */
export function parseCompleteTree(raw: unknown, expectedSHA: string): CompleteTree {
  const data = object(raw);
  assert.equal(data.sha, sha(expectedSHA), "Unbound Git tree");
  assert.equal(data.truncated, false, "Truncated Git tree");
  const rawEntries = array(data.tree);
  assert.ok(rawEntries.length > 0 && rawEntries.length <= 20_000, "Invalid Git tree size");
  const entries = new Map<string, GitEntry>();
  for (const value of rawEntries) {
    const entry = object(value);
    assert.ok(pathValid(entry.path) && !entries.has(entry.path), "Invalid or duplicate Git path");
    const hash = sha(entry.sha);
    assert.ok((entry.type === "tree" && entry.mode === "040000" && entry.size === undefined) ||
      (entry.type === "commit" && entry.mode === "160000" && entry.size === undefined) ||
      (entry.type === "blob" && ["100644", "100755", "120000"].includes(String(entry.mode)) &&
        Number.isSafeInteger(entry.size) && Number(entry.size) >= 0), "Invalid Git type, mode or size");
    const normalized: GitEntry = { path: entry.path, type: String(entry.type), mode: String(entry.mode), sha: hash,
      ...(entry.size === undefined ? {} : { size: Number(entry.size) }) };
    entries.set(entry.path, normalized);
  }
  const children = new Map<string, GitEntry[]>([["", []]]);
  for (const entry of entries.values()) { if (entry.type === "tree") { children.set(entry.path, []); } }
  for (const entry of entries.values()) {
    const parent = entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "";
    const siblings = children.get(parent);
    assert.ok(siblings, "Missing Git tree parent"); siblings.push(entry);
  }
  for (const [path, direct] of children) {
    const name = (entry: GitEntry): string => entry.path.split("/").at(-1)!;
    const sortKey = (entry: GitEntry): Buffer => Buffer.from(name(entry) + (entry.type === "tree" ? "/" : ""));
    direct.sort((left, right) => Buffer.compare(sortKey(left), sortKey(right)));
    const bytes = Buffer.concat(direct.flatMap(entry => [Buffer.from(`${entry.mode.replace(/^0/u, "")} ${name(entry)}\0`), Buffer.from(entry.sha, "hex")]));
    assert.equal(gitHash("tree", bytes), path === "" ? expectedSHA : entries.get(path)!.sha, "Git tree metadata hash mismatch");
  }
  return { sha: expectedSHA, entries };
}

export function assertRetirementTuple(base: CompleteTree, head: CompleteTree, pages: readonly (readonly unknown[])[]): void {
  assert.equal(base.sha, RETIREMENT.baseTreeSHA, "Retirement base tree drift");
  assert.equal(head.sha, RETIREMENT.headTreeSHA, "Retirement head tree drift");
  assert.ok(pages.length >= 1 && pages.length <= 32 && pages.every((page, index) =>
    page.length <= 100 && (index === pages.length - 1 ? page.length < 100 : page.length === 100)), "Incomplete file pagination");
  const files = pages.flat();
  assert.equal(files.length, RETIREMENT_TUPLE.length, "Incomplete retirement file count");
  const observed = new Set<string>();
  for (const raw of files) {
    const file = object(raw);
    assert.ok(pathValid(file.filename) && !observed.has(file.filename), "Duplicate or invalid changed file");
    observed.add(file.filename);
    const tuple = RETIREMENT_TUPLE.find(([path]) => path === file.filename);
    assert.ok(tuple, "Unreviewed retirement file");
    const [path, before, after] = tuple;
    assert.equal(file.previous_filename, undefined, "Rename or copy metadata is forbidden");
    assert.equal(file.status, before === null ? "added" : "modified", "Wrong retirement file status");
    assert.equal(file.sha, after, "Changed-file blob drift");
    const oldEntry = base.entries.get(path), newEntry = head.entries.get(path);
    assert.ok(before === null ? oldEntry === undefined : oldEntry?.mode === "100644" && oldEntry.type === "blob" && oldEntry.sha === before,
      `Retirement old regular blob mismatch: ${path}`);
    assert.ok(newEntry?.mode === "100644" && newEntry.type === "blob" && newEntry.sha === after,
      `Retirement new regular blob mismatch: ${path}`);
  }
  const changed = [...new Set([...base.entries.keys(), ...head.entries.keys()])].filter(path => {
    const before = base.entries.get(path), after = head.entries.get(path);
    return !sameEntry(before, after) && (before?.type !== "tree" || after?.type !== "tree");
  });
  assert.deepEqual(changed.toSorted(), [...observed].toSorted(), "Hidden or omitted retirement leaf");
}

async function arrayPages(api: GitHubReadApi, endpoint: string): Promise<unknown[][]> {
  const pages: unknown[][] = [];
  for (let page = 1; page <= 32; page += 1) {
    const values = array(await api.get(`${endpoint}${endpoint.includes("?") ? "&" : "?"}per_page=100&page=${page}`));
    assert.ok(values.length <= 100, "Oversized API page"); pages.push(values);
    if (values.length < 100) { return pages; }
  }
  throw new Error("API pagination exceeded its finite bound");
}
async function readTree(api: GitHubReadApi, revision: string): Promise<CompleteTree> {
  const commit = object(await api.get(`${repositoryRoot}/git/commits/${sha(revision)}`));
  assert.equal(commit.sha, revision, "Unbound Git commit");
  const treeSHA = sha(object(commit.tree).sha);
  return { ...parseCompleteTree(await api.get(`${repositoryRoot}/git/trees/${treeSHA}?recursive=1`), treeSHA), revision };
}
export async function readVerifiedDocument(api: GitHubReadApi, tree: CompleteTree, revision: string, path: string): Promise<VerifiedDocument> {
  const entry = tree.entries.get(path);
  assert.ok(entry?.type === "blob" && entry.mode === "100644" && entry.size !== undefined && entry.size <= 8 * 1024 * 1024,
    `Required document is not a bounded regular blob: ${path}`);
  const blob = object(await api.get(`${repositoryRoot}/git/blobs/${entry.sha}`));
  assert.ok(blob.sha === entry.sha && blob.encoding === "base64" && typeof blob.content === "string" &&
    blob.size === entry.size && blob.content.length <= 12 * 1024 * 1024 && /^[A-Za-z0-9+/=\r\n]*$/u.test(blob.content), "Unbound Git blob response");
  const encoded = blob.content.replace(/[\r\n]/gu, ""), bytes = Buffer.from(encoded, "base64");
  assert.ok(bytes.toString("base64") === encoded && bytes.length === entry.size && gitHash("blob", bytes) === entry.sha,
    "Git blob content/length mismatch");
  return { revision, blob: entry.sha, bytes };
}

function repoIdentity(raw: unknown): Record<string, unknown> {
  const repo = object(raw);
  assert.ok(repo.id === RETIREMENT.repositoryId && repo.full_name === RETIREMENT.repository, "Repository identity drift"); return repo;
}
export function retirementPullSnapshot(raw: unknown): string {
  const pull = object(raw), base = object(pull.base), head = object(pull.head), actor = object(pull.user);
  repoIdentity(base.repo); repoIdentity(head.repo);
  assert.ok(pull.number === RETIREMENT.pullRequest && pull.id === RETIREMENT.pullId && pull.state === "open" &&
    pull.merged === false && pull.draft === false && base.sha === RETIREMENT.baseSHA && head.sha === RETIREMENT.headSHA &&
    base.ref === "main" && typeof head.ref === "string" && head.ref.length > 0 &&
    pull.changed_files === RETIREMENT_TUPLE.length && pull.commits === 3 &&
    actor.type === "User" && actor.login === "777genius" && actor.id === ownerId, "Live retirement PR tuple drift");
  return JSON.stringify([pull.id, pull.number, pull.state, pull.merged, pull.draft, base.sha, head.sha,
    base.ref, head.ref, pull.changed_files, pull.commits, actor.login, actor.id, pull.updated_at]);
}
export function executorFromEnvironment(environment: NodeJS.ProcessEnv = process.env): Omit<ProtectedExecutor, "sourceTreeSHA"> {
  const runId = Number(environment.GITHUB_RUN_ID), runAttempt = Number(environment.GITHUB_RUN_ATTEMPT);
  assert.ok(/^[1-9][0-9]*$/u.test(environment.GITHUB_RUN_ID ?? "") && /^[1-9][0-9]*$/u.test(environment.GITHUB_RUN_ATTEMPT ?? ""), "Invalid real run coordinates");
  positive(runId); positive(runAttempt);
  assert.equal(environment.GITHUB_REPOSITORY, RETIREMENT.repository, "Wrong execution repository");
  assert.equal(environment.GITHUB_EVENT_NAME, "push", "Retirement bootstrap requires a genuine push event");
  assert.equal(environment.GITHUB_REF, SOURCE_REF, "Wrong staging source ref");
  assert.equal(environment.GITHUB_WORKFLOW_REF, `${RETIREMENT.repository}/${SOURCE_WORKFLOW}@${SOURCE_REF}`, "Wrong staging workflow ref");
  return { repository: RETIREMENT.repository, sourceRef: SOURCE_REF, sourceSHA: sha(environment.GITHUB_SHA),
    workflowPath: SOURCE_WORKFLOW, runId, runAttempt, event: "push" };
}

function assertBypassObservation(rule: Record<string, unknown>, visibility: ProtectionVisibility): void {
  assert.ok(visibility === "public_read" || visibility === "owner_full", "Unknown protection observation mode");
  // GitHub withholds bypass_actors from callers without ruleset write access.
  // Its absence is not an empty-list attestation. The owner must read it separately.
  if (visibility === "owner_full" || Object.hasOwn(rule, "bypass_actors")) {
    assert.deepEqual(rule.bypass_actors, [], "Protection rule permits bypass or private bypass evidence is missing");
  }
  if (visibility === "owner_full" || Object.hasOwn(rule, "current_user_can_bypass")) {
    assert.equal(rule.current_user_can_bypass, "never", "Execution can bypass protection or caller evidence is missing");
  }
}
export function assertStagingProtection(rulesets: readonly unknown[], visibility: ProtectionVisibility = "owner_full"): number {
  const matches = rulesets.map(object).filter(rule => {
    if (rule.target !== "branch" || rule.enforcement !== "active") { return false; }
    const ref = object(object(rule.conditions).ref_name);
    return JSON.stringify(ref.include) === JSON.stringify([SOURCE_REF]) && JSON.stringify(ref.exclude) === "[]";
  });
  assert.equal(matches.length, 1, "Exactly one dedicated active staging lock is required");
  const lock = matches[0]!;
  assert.equal(lock.source, RETIREMENT.repository, "Staging lock must be repository-owned");
  assert.equal(lock.source_type, "Repository", "Staging lock ownership drift");
  assertBypassObservation(lock, visibility);
  const rules = array(lock.rules).map(object);
  assert.deepEqual(rules.map(rule => rule.type).toSorted(), ["deletion", "non_fast_forward", "update"], "Incomplete staging source lock");
  for (const rule of rules) {
    if (rule.type === "update") {
      assert.deepEqual(Object.keys(rule).toSorted(), ["parameters", "type"], "Unknown update lock fields");
      assert.deepEqual(rule.parameters, { update_allows_fetch_and_merge: false }, "Staging lock permits updates by fetch-and-merge");
    } else { assert.deepEqual(Object.keys(rule), ["type"], "Unknown staging lock parameters"); }
  }
  return positive(lock.id);
}
const nativeContexts = ["check", "trusted-admission-evidence", "trusted-admission-authority-evolution-v1", "trusted-validation", "docs-source-successor-v1"];
export function assertMainProtection(mainRaw: unknown, identityRaw: unknown, visibility: ProtectionVisibility = "owner_full"): void {
  const main = object(mainRaw), identity = object(identityRaw);
  for (const [rule, expectedId] of [[main, 19979783], [identity, 24363205]] as const) {
    assert.ok(rule.id === expectedId && rule.enforcement === "active" && rule.target === "branch", "Required main rule identity drift");
    assert.deepEqual(object(rule.conditions).ref_name, { exclude: [], include: ["~DEFAULT_BRANCH"] }, "Required main scope drift");
    assertBypassObservation(rule, visibility);
  }
  const mainRules = array(main.rules).map(object), identityRules = array(identity.rules).map(object);
  assert.deepEqual(mainRules.map(rule => rule.type).toSorted(), ["deletion", "non_fast_forward", "pull_request", "required_linear_history", "required_status_checks"], "Main protection rule set drift");
  assert.deepEqual(identityRules.map(rule => rule.type), ["required_status_checks"], "Identity protection rule set drift");
  const contexts = (rules: Record<string, unknown>[]): string[] => {
    const matches = rules.filter(rule => rule.type === "required_status_checks"); assert.equal(matches.length, 1);
    const parameters = object(matches[0]!.parameters);
    assert.equal(parameters.strict_required_status_checks_policy, true, "Strict checks must remain enabled");
    assert.equal(parameters.do_not_enforce_on_create, false, "Creation check enforcement drift");
    const checks = array(parameters.required_status_checks).map(object);
    assert.ok(checks.every(check => typeof check.context === "string" && check.integration_id === 15368), "Required check App drift");
    assert.equal(new Set(checks.map(check => check.context)).size, checks.length, "Duplicate required context");
    return checks.map(check => String(check.context)).toSorted();
  };
  const observed = contexts(mainRules);
  const bridge = nativeContexts.filter(name => !["docs-source-successor-v1", "trusted-admission-evidence"].includes(name));
  const admittedSets = [nativeContexts, [...nativeContexts, ...BRIDGE_CONTEXTS], [...bridge, ...BRIDGE_CONTEXTS]].map(names => names.toSorted());
  assert.ok(admittedSets.some(names => JSON.stringify(names) === JSON.stringify(observed)), "Unapproved main required-context transition");
  assert.deepEqual(contexts(identityRules), ["commit-author-identity"], "Identity context drift");
  const pullRule = object(mainRules.find(rule => rule.type === "pull_request")!.parameters);
  assert.deepEqual(pullRule, { required_approving_review_count: 0, dismiss_stale_reviews_on_push: true,
    required_reviewers: [], require_code_owner_review: false, dismissal_restriction: { enabled: false, allowed_actors: [] },
    require_last_push_approval: false, required_review_thread_resolution: true,
    require_extra_approval_for_unattributed_changes: true, allowed_merge_methods: ["squash"] }, "Main PR protections changed");
}

async function protectedSourceSnapshot(api: GitHubReadApi, executor: ProtectedExecutor): Promise<string> {
  const [branchRaw, runRaw, summaries] = await Promise.all([
    api.get(`${repositoryRoot}/branches/${encodeURIComponent(SOURCE_REF.slice("refs/heads/".length))}`),
    api.get(`${repositoryRoot}/actions/runs/${executor.runId}/attempts/${executor.runAttempt}`),
    arrayPages(api, `${repositoryRoot}/rulesets?includes_parents=true`),
  ]);
  const branch = object(branchRaw), run = object(runRaw);
  assert.ok(branch.name === SOURCE_REF.slice("refs/heads/".length) && branch.protected === true, "Staging branch is not visibly protected");
  assert.equal(object(branch.commit).sha, executor.sourceSHA, "Locked source branch moved from the genuine event SHA");
  assert.ok(run.id === executor.runId && run.run_attempt === executor.runAttempt && run.event === "push" &&
    run.path === SOURCE_WORKFLOW && run.head_sha === executor.sourceSHA && run.head_branch === SOURCE_REF.slice("refs/heads/".length), "Genuine staging run provenance drift");
  repoIdentity(run.repository);
  const actor = object(run.actor);
  assert.ok(actor.type === "User" && actor.login === "777genius" && actor.id === ownerId, "Staging source must originate with the owner");
  const flat = summaries.flat().map(object);
  assert.equal(new Set(flat.map(item => item.id)).size, flat.length, "Duplicate ruleset pagination");
  const rules = await Promise.all(flat.map(item => api.get(`${repositoryRoot}/rulesets/${positive(item.id)}`)));
  const lockId = assertStagingProtection(rules, "public_read");
  return JSON.stringify({ branch: object(branch.commit).sha, run: [run.id, run.run_attempt, run.event, run.path, run.head_sha, run.head_branch, actor.login],
    actorId: actor.id, lock: rules.find(value => object(value).id === lockId) });
}
export const RETIREMENT_ADMISSION_DOCUMENT_PATHS = [
  "governance/docs-protocol-policy-v2.json", "governance/docs-protocol-exceptions.json", "governance/organization-repository-inventory.json",
  "governance/docs-qualified-cohorts.json", "governance/code-security-defaults.json", "governance/executable-spec-qualification.json", "governance/actions-policy.json",
  "governance/docs-protocol-policy-v2.schema.json", "governance/docs-protocol-exceptions.schema.json", "governance/organization-repository-inventory.schema.json",
  "governance/docs-qualified-cohorts.schema.json", "governance/code-security-defaults.schema.json", "governance/executable-spec-qualification.schema.json", "governance/actions-policy.schema.json",
  "governance/docs-protocol-policy.json", "governance/docs-protocol-policy.schema.json",
] as const;
export interface RetirementEvidence {
  readonly target: RetirementTarget; readonly executor: ProtectedExecutor; readonly documents: RetirementAdmissionDocuments;
  readonly sourceTree: CompleteTree; readonly recheck: () => Promise<void>; readonly tupleDigest: string;
  readonly protectionObservation: typeof HOSTED_PROTECTION_OBSERVATION;
}
export async function collectRetirementEvidence(api: GitHubReadApi, executorInput: Omit<ProtectedExecutor, "sourceTreeSHA">): Promise<RetirementEvidence> {
  assert.ok(executorInput.repository === RETIREMENT.repository && executorInput.sourceRef === SOURCE_REF &&
    executorInput.workflowPath === SOURCE_WORKFLOW && executorInput.event === "push", "Wrong protected execution context");
  sha(executorInput.sourceSHA); positive(executorInput.runId); positive(executorInput.runAttempt);
  const sourceTree = await readTree(api, executorInput.sourceSHA);
  const executor: ProtectedExecutor = { ...executorInput, sourceTreeSHA: sourceTree.sha };
  const sourceSnapshot = await protectedSourceSnapshot(api, executor);
  const readLive = async (): Promise<string> => {
    const [controllerRaw, pullRaw, branchRaw, mainRaw, identityRaw] = await Promise.all([
      api.get(repositoryRoot), api.get(`${repositoryRoot}/pulls/${RETIREMENT.pullRequest}`), api.get(`${repositoryRoot}/branches/main`),
      api.get(`${repositoryRoot}/rulesets/19979783`), api.get(`${repositoryRoot}/rulesets/24363205`),
    ]);
    const controller = repoIdentity(controllerRaw);
    assert.ok(controller.default_branch === "main" && controller.archived === false && controller.disabled === false, "Live default repository drift");
    assert.equal(object(object(branchRaw).commit).sha, RETIREMENT.baseSHA, "Live main moved from the retirement base");
    assertMainProtection(mainRaw, identityRaw, "public_read");
    const pull = retirementPullSnapshot(pullRaw);
    assert.equal(retirementPullSnapshot(await api.get(`${repositoryRoot}/pulls/367`)), pull, "Target moved during the metadata observation");
    assert.equal(object(object(await api.get(`${repositoryRoot}/branches/main`)).commit).sha, RETIREMENT.baseSHA, "Main moved during the metadata observation");
    return JSON.stringify({ pull, main: mainRaw, identity: identityRaw });
  };
  const snapshot = await readLive();
  const [base, head, files, comparisonRaw, commitPages] = await Promise.all([
    readTree(api, RETIREMENT.baseSHA), readTree(api, RETIREMENT.headSHA), arrayPages(api, `${repositoryRoot}/pulls/367/files`),
    api.get(`${repositoryRoot}/compare/${RETIREMENT.baseSHA}...${RETIREMENT.headSHA}`), arrayPages(api, `${repositoryRoot}/pulls/367/commits`),
  ]);
  const comparison = object(comparisonRaw);
  assert.ok(comparison.status === "ahead" && comparison.behind_by === 0 && comparison.ahead_by === 3 && comparison.total_commits === 3 &&
    object(comparison.base_commit).sha === RETIREMENT.baseSHA && object(comparison.merge_base_commit).sha === RETIREMENT.baseSHA, "Retirement head does not contain the exact base");
  const commits = commitPages.flat().map(object);
  assert.ok(commits.length === 3 && new Set(commits.map(commit => sha(commit.sha))).size === 3 && commits.at(-1)!.sha === RETIREMENT.headSHA, "Incomplete retirement source commits");
  for (const commit of commits) {
    for (const role of ["author", "committer"] as const) {
      const identity = object(commit[role]), raw = object(object(commit.commit)[role]);
      assert.ok(identity.type === "User" && identity.login === "777genius" && identity.id === ownerId &&
        raw.name === "iliya" && raw.email === "iliyazelenkog@gmail.com", "Retirement source author/committer drift");
    }
  }
  assertRetirementTuple(base, head, files);
  const documents = new Map<string, VerifiedDocument>();
  await Promise.all(RETIREMENT_ADMISSION_DOCUMENT_PATHS.map(async path => {
    const proposed = ["governance/docs-protocol-policy-v2.json", "governance/docs-protocol-exceptions.json"].includes(path);
    documents.set(path, await readVerifiedDocument(api, proposed ? head : base, proposed ? RETIREMENT.headSHA : RETIREMENT.baseSHA, path));
  }));
  documents.set("basePolicy", await readVerifiedDocument(api, base, RETIREMENT.baseSHA, "governance/docs-protocol-policy-v2.json"));
  const recheck = async (): Promise<void> => {
    assert.equal(await protectedSourceSnapshot(api, executor), sourceSnapshot, "Protected staging authority moved during verification");
    assert.equal(await readLive(), snapshot, "Live target or effective main protections changed during verification");
  };
  await recheck();
  return { target: RETIREMENT, executor, documents, sourceTree, recheck, protectionObservation: HOSTED_PROTECTION_OBSERVATION,
    tupleDigest: `sha256:${createHash("sha256").update(JSON.stringify(RETIREMENT_TUPLE)).digest("hex")}` };
}

/** Check actual checkout bytes, including all tracked resolution/configuration inputs. */
export async function assertLocalSource(tree: CompleteTree, root = new URL("../", import.meta.url)): Promise<void> {
  const directory = fileURLToPath(root);
  const git = (...args: string[]): string => execFileSync("git", args, { cwd: directory, encoding: "utf8", timeout: 20_000, maxBuffer: 8 * 1024 * 1024 }).trim();
  assert.equal(git("rev-parse", "HEAD"), sha(tree.revision), "Local checkout commit is not the actual protected source event");
  assert.equal(git("rev-parse", "HEAD^{tree}"), tree.sha, "Local checkout tree is not the protected source tree");
  assert.equal(git("status", "--porcelain=v1", "--untracked-files=all"), "", "Modified or untracked staging source");
  for (const entry of tree.entries.values()) {
    const localPath = join(directory, ...entry.path.split("/")), info = await lstat(localPath);
    assert.ok(!info.isSymbolicLink(), `Symlinked checkout input: ${entry.path}`);
    if (entry.type === "tree") { assert.ok(info.isDirectory(), "Checkout source directory type drift"); continue; }
    assert.equal(entry.mode, "100644", "Staged execution permits only regular source blobs");
    assert.ok(info.isFile(), "Checkout source input is not regular");
    const bytes = await readFile(localPath);
    assert.equal(gitHash("blob", bytes), entry.sha, `Checkout source blob drift: ${entry.path}`);
  }
}

export function createGitHubReadApi(token: string): GitHubStatusApi {
  assert.ok(typeof token === "string" && token.length > 0, "A job-scoped GitHub token is required");
  const request = async (method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> => {
    assert.ok(path.startsWith(`${repositoryRoot}/`) || path === repositoryRoot, "Cross-repository core request refused");
    assert.ok(!/[\\\r\n#]/u.test(path) && !/(?:^|\/)\.\.(?:\/|$|\?)/u.test(decodeURIComponent(path)), "Unsafe GitHub API path");
    const response = await fetch(`https://api.github.com/${path}`, { method, redirect: "error", signal: AbortSignal.timeout(30_000),
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.ok(response.ok, `GitHub ${method} ${path} failed with HTTP ${response.status}`);
    const text = await response.text(); assert.ok(Buffer.byteLength(text) <= 16 * 1024 * 1024, "Oversized GitHub API response");
    return JSON.parse(text) as unknown;
  };
  return { get: path => request("GET", path), postStatus: (head, value) => {
    assert.equal(head, RETIREMENT.headSHA, "Bridge cannot publish on an unrelated head");
    assert.ok(BRIDGE_CONTEXTS.includes(value.context as typeof BRIDGE_CONTEXTS[number]), "Legacy or unowned status context refused");
    assert.ok(["pending", "success", "failure"].includes(value.state), "Unknown bridge state");
    return request("POST", `${repositoryRoot}/statuses/${head}`, value);
  } };
}

async function assertCurrentSuccessfulJobs(api: GitHubReadApi, executor: ProtectedExecutor): Promise<void> {
  const pages: Record<string, unknown>[] = [];
  let expectedCount: number | undefined;
  for (let page = 1; page <= 32; page += 1) {
    const data = object(await api.get(`${repositoryRoot}/actions/runs/${executor.runId}/attempts/${executor.runAttempt}/jobs?per_page=100&page=${page}`));
    const count = positive(data.total_count), jobs = array(data.jobs).map(object);
    expectedCount ??= count; assert.equal(count, expectedCount, "Moving job pagination");
    assert.ok(jobs.length <= 100, "Oversized job page"); pages.push(...jobs);
    if (jobs.length < 100) { break; }
    assert.ok(page < 32, "Job pagination exceeded bound");
  }
  assert.ok(expectedCount === pages.length && new Set(pages.map(job => positive(job.id))).size === pages.length, "Incomplete current-attempt job evidence");
  for (const name of ["qualify", "admission"]) {
    const matches = pages.filter(job => job.name === name); assert.equal(matches.length, 1, `Missing or duplicate ${name} job`);
    const job = matches[0]!;
    assert.ok(job.run_id === executor.runId && job.run_attempt === executor.runAttempt && job.head_sha === executor.sourceSHA &&
      job.status === "completed" && job.conclusion === "success", `Current-attempt ${name} did not succeed`);
    const steps = array(job.steps).map(object);
    assert.ok(steps.length > 0 && steps.every(step => step.status === "completed" && ["success", "skipped"].includes(String(step.conclusion))) &&
      steps.some(step => step.conclusion === "success"), `Incomplete ${name} execution steps`);
  }
}

export async function publishRetirementBridge(api: GitHubStatusApi, executor: Omit<ProtectedExecutor, "sourceTreeSHA">): Promise<void> {
  // Bind the exact open owner target before touching even our own pending contexts.
  retirementPullSnapshot(await api.get(`${repositoryRoot}/pulls/367`));
  const targetURL = `https://github.com/${RETIREMENT.repository}/actions/runs/${executor.runId}/attempts/${executor.runAttempt}`;
  const status = async (state: "pending" | "success" | "failure"): Promise<void> => {
    for (const context of BRIDGE_CONTEXTS) {
      await api.postStatus(RETIREMENT.headSHA, { context, state, target_url: targetURL, description: `Exact Platform retirement bridge: ${state}` });
    }
  };
  try {
    await status("pending");
    const evidence = await collectRetirementEvidence(api, executor);
    await assertLocalSource(evidence.sourceTree);
    await assertCurrentSuccessfulJobs(api, evidence.executor);
    await evidence.recheck();
    await status("success");
    // A failed final reread revokes our contexts rather than reusing an earlier green SHA.
    await evidence.recheck();
  } catch (error) {
    await status("failure"); throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2]; assert.ok(process.argv.length === 3 && ["qualify", "publish"].includes(String(mode)), "Use qualify or publish");
  const executor = executorFromEnvironment(), api = createGitHubReadApi(process.env.GITHUB_TOKEN ?? "");
  if (mode === "publish") { await publishRetirementBridge(api, executor); }
  else {
    const evidence = await collectRetirementEvidence(api, executor); await assertLocalSource(evidence.sourceTree); await evidence.recheck();
    console.log(JSON.stringify({ target: evidence.target, executor: evidence.executor, tupleDigest: evidence.tupleDigest,
      protectionObservation: evidence.protectionObservation, result: "source_qualified_admission_separate" }));
  }
}
