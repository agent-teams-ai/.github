import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseCompleteTree, readVerifiedDocument, assertLocalSource, assertCurrentSuccessfulJobs,
  checkSourceSuccessor as checkFrozenV2, TARGET as HISTORICAL_TARGET } from "./docs-quality-source-successor-v2.ts";
export { parseCompleteTree, readVerifiedDocument, assertLocalSource, assertCurrentSuccessfulJobs };

// The content packet is reviewed provenance, separate from the actual Git/PR identity.
import { BOUND_TARGET, TARGET_TUPLE, CURRENT_CONTENT_PACKET_SHA256 } from "./docs-quality-source-successor-v3-target.ts";
export { TARGET_TUPLE, CURRENT_CONTENT_PACKET_SHA256 };
export const PREVIOUS_CONTENT_PACKET_SHA256 = "56b101258eccd51149dac8cc7ba61eddad81801ef9f272be4178485be4fad23e";
const IDENTITY = Object.freeze({ repository: "agent-teams-ai/.github", repositoryId: 1316243981 });
export interface BoundTarget extends SourceTarget { readonly commits: number; readonly changedFiles: number }
export const TARGET: BoundTarget = BOUND_TARGET;
export function requireTarget(): BoundTarget {
  assert.ok(CURRENT_CONTENT_PACKET_SHA256 !== null && /^(?!0{64}$)[a-f0-9]{64}$/u.test(CURRENT_CONTENT_PACKET_SHA256),
    "UNBOUND_V3_CONTENT: actual final reviewed packet is required");
  positive(TARGET.changedFiles);
  assert.ok(TARGET.changedFiles <= 3000 && TARGET_TUPLE.length === TARGET.changedFiles,
    "UNBOUND_V3_TUPLE: capture every actual committed regular-file pair");
  assert.equal(TARGET.repository, IDENTITY.repository); assert.equal(TARGET.repositoryId, IDENTITY.repositoryId);
  positive(TARGET.pullRequest); positive(TARGET.pullId); positive(TARGET.commits);
  for (const value of [TARGET.baseSHA, TARGET.headSHA, TARGET.baseTreeSHA, TARGET.headTreeSHA]) { sha(value); }
  assert.notEqual(TARGET.baseSHA, TARGET.headSHA, "Finite target must contain an actual reviewed change");
  assert.equal(new Set(TARGET_TUPLE.map(([path]) => path)).size, TARGET_TUPLE.length);
  for (const [path, before, after] of TARGET_TUPLE) {
    assert.ok(pathValid(path)); if (before !== null) { sha(before); } sha(after);
  }
  return TARGET;
}
export const SOURCE_REF = "refs/heads/governance/quality-source-successor-v3";
export const SOURCE_WORKFLOW = ".github/workflows/docs-quality-source-successor-v3.yml";
export const SOURCE_CONTEXT = "docs-quality-source-successor-v3";
export const CALLER_WORKFLOW = ".github/workflows/docs-quality-source-successor-v3-caller.yml";
export const ADR_PATH = "docs/decisions/0013-bounded-quality-source-successor-v3.md";
export const EVIDENCE_PATH = "governance/evidence/docs-source-successor/quality-source-successor-v3-installation.md";
export const INSTALL_PATHS = Object.freeze([CALLER_WORKFLOW, ADR_PATH, EVIDENCE_PATH]);
export const LEGACY_INPUTS = Object.freeze([
  "scripts/check-docs-source-successor-v1.mts", "scripts/check-docs-source-successor-v1.test.mts",
  ".github/workflows/docs-source-successor-v1.yml", "docs/decisions/0009-bounded-docs-source-successor.md",
  "tsconfig.docs-source-successor.json",
]);
const ADOPTION_INPUTS = ["toolchain.config.json", "tsconfig.json"] as const;
export const QUALITY_INPUTS = Object.freeze([
  ...ADOPTION_INPUTS,
  "scripts/quality-process.ts", "scripts/quality-process.test.ts",
  "scripts/run-governance-tests.ts", "scripts/run-governance-tests.test.ts",
]);
const ownerId = 13103045;
export const PREDECESSOR_INPUTS = Object.freeze([
  ...LEGACY_INPUTS,
  ".github/workflows/docs-quality-source-successor-v2-caller.yml",
  "docs/decisions/0012-bounded-quality-source-successor-v2.md",
  "governance/evidence/docs-source-successor/quality-source-successor-v2-installation.md",
  "scripts/docs-quality-source-successor-v2.ts", "scripts/docs-quality-source-successor-v2.test.ts",
  ".github/workflows/docs-quality-source-successor-v2.yml", "tsconfig.docs-quality-source-successor-v2.json",
]);

export interface SourceTarget {
  readonly repository: string; readonly repositoryId: number; readonly pullRequest: number; readonly pullId: number;
  readonly baseSHA: string; readonly headSHA: string; readonly baseTreeSHA: string; readonly headTreeSHA: string;
}
export interface ProtectedExecutor {
  readonly repository: string; readonly sourceRef: string; readonly sourceSHA: string; readonly sourceTreeSHA: string;
  readonly workflowPath: string; readonly runId: number; readonly runAttempt: number; readonly event: "push" | "pull_request_target";
  readonly mode: "push" | "reusable"; readonly callerWorkflowRef: string; readonly callerWorkflowSHA: string;
  readonly pullRequest: number; readonly targetBaseSHA: string; readonly targetHeadSHA: string;
}
export interface VerifiedDocument { readonly revision: string; readonly blob: string; readonly bytes: Buffer }
export type SourceDocuments = ReadonlyMap<string, VerifiedDocument>;
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

export function assertSourceTuple(base: CompleteTree, head: CompleteTree, pages: readonly (readonly unknown[])[]): void {
  assert.equal(base.sha, requireTarget().baseTreeSHA, "Quality source base tree drift");
  assert.equal(head.sha, requireTarget().headTreeSHA, "Quality source head tree drift");
  assert.ok(pages.length >= 1 && pages.length <= 32 && pages.every((page, index) =>
    page.length <= 100 && (index === pages.length - 1 ? page.length < 100 : page.length === 100)), "Incomplete file pagination");
  const files = pages.flat();
  assert.equal(files.length, TARGET_TUPLE.length, "Incomplete quality source file count");
  const observed = new Set<string>();
  for (const raw of files) {
    const file = object(raw);
    assert.ok(pathValid(file.filename) && !observed.has(file.filename), "Duplicate or invalid changed file");
    observed.add(file.filename);
    const tuple = TARGET_TUPLE.find(([path]) => path === file.filename);
    assert.ok(tuple, "Unreviewed quality source file");
    const [path, before, after] = tuple;
    assert.equal(file.previous_filename, undefined, "Rename or copy metadata is forbidden");
    assert.equal(file.status, before === null ? "added" : "modified", "Wrong quality source file status");
    assert.equal(file.sha, after, "Changed-file blob drift");
    const oldEntry = base.entries.get(path), newEntry = head.entries.get(path);
    assert.ok(before === null ? oldEntry === undefined : oldEntry?.mode === "100644" && oldEntry.type === "blob" && oldEntry.sha === before,
      `Quality source old regular blob mismatch: ${path}`);
    assert.ok(newEntry?.mode === "100644" && newEntry.type === "blob" && newEntry.sha === after,
      `Quality source new regular blob mismatch: ${path}`);
  }
  const changed = [...new Set([...base.entries.keys(), ...head.entries.keys()])].filter(path => {
    const before = base.entries.get(path), after = head.entries.get(path);
    return !sameEntry(before, after) && before?.type !== "tree" && after?.type !== "tree";
  });
  assert.deepEqual(changed.toSorted(), [...observed].toSorted(), "Hidden or omitted quality source leaf");
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
  assert.equal(lock.source, IDENTITY.repository, "Staging lock must be repository-owned");
  assert.equal(lock.source_type, "Repository", "Staging lock ownership drift");
  assertBypassObservation(lock, visibility);
  const rules = array(lock.rules).map(object);
  assert.deepEqual(rules.map(rule => rule.type).toSorted(), ["deletion", "non_fast_forward", "update"], "Incomplete staging source lock");
  for (const rule of rules) {
    if (rule.type === "update") {
      // GitHub normalizes the explicit false parameter to a bare update rule.
      // Both documented forms forbid updates; the repository must also be non-fork.
      if (Object.hasOwn(rule, "parameters")) {
        assert.deepEqual(Object.keys(rule).toSorted(), ["parameters", "type"], "Unknown update lock fields");
        assert.deepEqual(rule.parameters, { update_allows_fetch_and_merge: false }, "Staging lock permits updates by fetch-and-merge");
      } else { assert.deepEqual(Object.keys(rule), ["type"], "Unknown update lock fields"); }
    } else { assert.deepEqual(Object.keys(rule), ["type"], "Unknown staging lock parameters"); }
  }
  return positive(lock.id);
}
const nativeContexts = ["check", "trusted-admission-evidence", "trusted-admission-authority-evolution-v1", "trusted-validation", "docs-quality-source-successor-v2"];
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
  const bridge = nativeContexts.filter(name => name !== "docs-quality-source-successor-v2");
  const admittedSets = [nativeContexts, [...nativeContexts, SOURCE_CONTEXT], [...bridge, SOURCE_CONTEXT]].map(names => names.toSorted());
  assert.ok(admittedSets.some(names => JSON.stringify(names) === JSON.stringify(observed)), "Unapproved main required-context transition");
  assert.deepEqual(contexts(identityRules), ["commit-author-identity"], "Identity context drift");
  const pullRule = object(mainRules.find(rule => rule.type === "pull_request")!.parameters);
  assert.deepEqual(pullRule, { required_approving_review_count: 0, dismiss_stale_reviews_on_push: true,
    required_reviewers: [], require_code_owner_review: false, dismissal_restriction: { enabled: false, allowed_actors: [] },
    require_last_push_approval: false, required_review_thread_resolution: true,
    require_extra_approval_for_unattributed_changes: true, allowed_merge_methods: ["squash"] }, "Main PR protections changed");
}


function repoIdentity(raw: unknown): Record<string, unknown> {
  const repo = object(raw);
  assert.ok(repo.id === IDENTITY.repositoryId && repo.full_name === IDENTITY.repository, "Repository identity drift");
  return repo;
}

export function targetPullSnapshot(raw: unknown, exact = true): string {
  const pull = object(raw), base = object(pull.base), head = object(pull.head);
  repoIdentity(base.repo); repoIdentity(head.repo);
  assert.ok(pull.state === "open" && pull.merged === false && typeof pull.draft === "boolean" && base.ref === "main" &&
    typeof head.ref === "string" && head.ref.length > 0 && Number.isSafeInteger(pull.changed_files) &&
    Number(pull.changed_files) >= 1 && Number(pull.changed_files) <= 3000, "Invalid live source PR metadata");
  positive(pull.number); positive(pull.id); sha(base.sha); sha(head.sha);
  if (exact) {
    const actor = object(pull.user);
    assert.ok(pull.number === requireTarget().pullRequest && pull.id === requireTarget().pullId && pull.draft === false &&
      base.sha === requireTarget().baseSHA && head.sha === requireTarget().headSHA && pull.changed_files === TARGET_TUPLE.length &&
      pull.commits === requireTarget().commits && actor.type === "User" && actor.login === "777genius" && actor.id === ownerId,
    "Live exact quality-runtime tuple drift");
  }
  return JSON.stringify([pull.id, pull.number, pull.state, pull.merged, pull.draft, base.sha, head.sha,
    base.ref, head.ref, pull.changed_files, pull.commits, pull.user, pull.updated_at]);
}

export function executorFromEnvironment(environment: NodeJS.ProcessEnv = process.env, event?: unknown): Omit<ProtectedExecutor, "sourceTreeSHA"> {
  const runId = Number(environment.GITHUB_RUN_ID), runAttempt = Number(environment.GITHUB_RUN_ATTEMPT);
  assert.ok(/^[1-9][0-9]*$/u.test(environment.GITHUB_RUN_ID ?? "") && /^[1-9][0-9]*$/u.test(environment.GITHUB_RUN_ATTEMPT ?? ""), "Invalid real run coordinates");
  positive(runId); positive(runAttempt);
  assert.equal(environment.GITHUB_REPOSITORY, IDENTITY.repository, "Wrong execution repository");
  assert.equal(environment.SOURCE_WORKFLOW_REPOSITORY, IDENTITY.repository, "Wrong called source repository");
  assert.equal(environment.SOURCE_WORKFLOW_PATH, SOURCE_WORKFLOW, "Wrong called source workflow path");
  const sourceSHA = sha(environment.SOURCE_WORKFLOW_SHA), callerWorkflowSHA = sha(environment.GITHUB_WORKFLOW_SHA);
  const common = { repository: IDENTITY.repository, sourceRef: SOURCE_REF, sourceSHA, workflowPath: SOURCE_WORKFLOW, runId, runAttempt,
    callerWorkflowRef: String(environment.GITHUB_WORKFLOW_REF), callerWorkflowSHA };
  if (environment.GITHUB_EVENT_NAME === "push") {
    assert.equal(environment.GITHUB_REF, SOURCE_REF, "Wrong staging push ref");
    assert.equal(environment.GITHUB_SHA, sourceSHA, "Push source and genuine event SHA differ");
    assert.equal(callerWorkflowSHA, sourceSHA, "Push defining workflow SHA differs");
    assert.equal(environment.SOURCE_WORKFLOW_REF, `${IDENTITY.repository}/${SOURCE_WORKFLOW}@${SOURCE_REF}`, "Wrong push defining workflow ref");
    assert.equal(environment.GITHUB_WORKFLOW_REF, environment.SOURCE_WORKFLOW_REF, "Push workflow provenance differs");
    return { ...common, mode: "push", event: "push", pullRequest: requireTarget().pullRequest, targetBaseSHA: requireTarget().baseSHA, targetHeadSHA: requireTarget().headSHA };
  }
  assert.equal(environment.GITHUB_EVENT_NAME, "pull_request_target", "Unsupported source successor event");
  assert.equal(environment.SOURCE_WORKFLOW_REF, `${IDENTITY.repository}/${SOURCE_WORKFLOW}@${sourceSHA}`, "Reusable workflow must use an immutable source SHA");
  assert.equal(environment.GITHUB_WORKFLOW_REF, `${IDENTITY.repository}/${CALLER_WORKFLOW}@refs/heads/main`, "Wrong protected main caller");
  assert.equal(environment.GITHUB_REF, "refs/heads/main", "Caller is not protected main");
  const pull = object(object(event).pull_request); targetPullSnapshot(pull, false);
  const baseSHA = sha(object(pull.base).sha), headSHA = sha(object(pull.head).sha);
  assert.equal(environment.GITHUB_SHA, baseSHA, "Caller event is not the actual target base");
  assert.equal(callerWorkflowSHA, baseSHA, "Main caller workflow is not target-base owned");
  return { ...common, mode: "reusable", event: "pull_request_target", pullRequest: positive(pull.number), targetBaseSHA: baseSHA, targetHeadSHA: headSHA };
}

export function callerWorkflowDefinition(sourceSHA: string): object {
  const permissions = { actions: "read", contents: "read", "pull-requests": "read", statuses: "write" };
  return { name: "Trusted Quality Source Successor V3", on: { pull_request_target: { types: ["opened", "synchronize", "reopened", "edited"] } },
    permissions, jobs: { source: { uses: `${IDENTITY.repository}/${SOURCE_WORKFLOW}@${sha(sourceSHA)}`, permissions } } };
}

export async function assertCallerWorkflow(bytes: Buffer, sourceSHA: string): Promise<void> {
  const { parse } = await import("yaml");
  assert.deepEqual(parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)), callerWorkflowDefinition(sourceSHA), "Main caller does not pin the exact reviewed source/runtime contract");
}

function assertFiles(base: CompleteTree, head: CompleteTree, pages: readonly (readonly unknown[])[], count: number): unknown[] {
  assert.ok(pages.length >= 1 && pages.length <= 32 && pages.every((page, index) =>
    page.length <= 100 && (index === pages.length - 1 ? page.length < 100 : page.length === 100)), "Incomplete file pagination");
  const files = pages.flat(), seen = new Set<string>(), declared = new Set<string>();
  assert.equal(files.length, count, "Changed file count drift");
  for (const raw of files) {
    const file = object(raw);
    assert.ok(pathValid(file.filename) && !seen.has(file.filename), "Invalid or duplicate changed file");
    seen.add(file.filename); declared.add(file.filename); sha(file.sha);
    assert.ok(["added", "modified", "removed", "renamed", "copied", "changed"].includes(String(file.status)), "Unknown file status");
    assert.ok(file.previous_filename === undefined || pathValid(file.previous_filename), "Invalid rename origin");
    if (file.status === "renamed") {
      assert.ok(pathValid(file.previous_filename) && base.entries.has(file.previous_filename), "Missing rename origin");
      declared.add(file.previous_filename);
    }
    const selected = (file.status === "removed" ? base : head).entries.get(file.filename);
    assert.ok(selected && selected.type !== "tree" && selected.sha === file.sha, "Changed file is not bound to its complete Git tree");
    if (file.status === "added") { assert.equal(base.entries.get(file.filename), undefined, "Added file already exists"); }
    if (file.status === "removed") { assert.equal(head.entries.get(file.filename), undefined, "Removed file still exists"); }
  }
  const changed = [...new Set([...base.entries.keys(), ...head.entries.keys()])].filter(path => {
    const before = base.entries.get(path), after = head.entries.get(path);
    assert.ok(!before || !after || (before.type === "tree") === (after.type === "tree"), "Ancestor directory replacement");
    return !sameEntry(before, after) && before?.type !== "tree" && after?.type !== "tree";
  });
  assert.deepEqual(changed.toSorted(), [...declared].toSorted(), "Hidden or spurious changed Git leaf");
  return files;
}

function assertPreserved(base: CompleteTree, head: CompleteTree, paths: readonly string[], allowAbsent = false): void {
  for (const path of paths) {
    const before = base.entries.get(path), after = head.entries.get(path);
    if (allowAbsent && before === undefined && after === undefined) { continue; }
    assert.ok(before?.type === "blob" && before.mode === "100644" && after?.type === "blob" && after.mode === "100644" &&
      sameEntry(before, after), `Protected v2 input changed or missing: ${path}`);
  }
}

export async function checkSourceSuccessor(raw: unknown, baseManifest: Buffer, baseLock: Buffer, sourceSHA: string): Promise<string> {
  sha(sourceSHA);
  const evidence = object(raw), rawBase = object(evidence.baseTree), rawHead = object(evidence.headTree);
  assert.equal(evidence.repository, IDENTITY.repository, "Wrong source envelope repository");
  positive(evidence.pullRequest); sha(evidence.baseSHA); sha(evidence.headSHA);
  assert.equal(evidence.sourceSHA, evidence.headSHA, "Legacy target source must be its live head");
  assert.equal(evidence.baseRef, "main"); assert.equal(evidence.defaultBranch, "main");
  assert.equal(evidence.headRepository, IDENTITY.repository); assert.equal(evidence.paginationComplete, true);
  const live = object(evidence.live);
  assert.equal(live.state, "open", "Target is not open");
  for (const key of ["pullRequest", "repository", "baseSHA", "headSHA", "sourceSHA", "baseRef", "defaultBranch", "headRepository", "changedFiles"]) {
    assert.equal(live[key], evidence[key], `Live source envelope drift: ${key}`);
  }
  const base = parseCompleteTree(rawBase, sha(rawBase.sha)), head = parseCompleteTree(rawHead, sha(rawHead.sha));
  for (const [path, bytes] of [["package.json", baseManifest], ["pnpm-lock.yaml", baseLock]] as const) {
    const entry = base.entries.get(path);
    assert.ok(entry?.type === "blob" && entry.mode === "100644" && gitHash("blob", bytes) === entry.sha && entry.size === bytes.length,
      `Actual target-base install bytes are unbound: ${path}`);
  }
  const flat = array(evidence.files);
  const pages = Array.from({ length: Math.floor(flat.length / 100) + 1 }, (_, index) => flat.slice(index * 100, (index + 1) * 100));
  assertFiles(base, head, pages, Number(evidence.changedFiles));
  if (evidence.pullRequest === TARGET.pullRequest && evidence.baseSHA === requireTarget().baseSHA && evidence.headSHA === requireTarget().headSHA) {
    assert.equal(evidence.repository, IDENTITY.repository); assert.equal(evidence.sourceSHA, requireTarget().headSHA);
    assert.equal(evidence.paginationComplete, true); assertSourceTuple(base, head, pages);
    assertPreserved(base, head, PREDECESSOR_INPUTS, true);
    return "quality-runtime";
  }
  const installation = flat.length === INSTALL_PATHS.length && flat.every(rawFile => {
    const file = object(rawFile);
    return INSTALL_PATHS.includes(String(file.filename)) && file.status === "added" && file.previous_filename === undefined;
  });
  assertPreserved(base, head, [...PREDECESSOR_INPUTS, ...ADOPTION_INPUTS], true);
  if (installation) {
    for (const path of INSTALL_PATHS) {
      const entry = head.entries.get(path);
      assert.ok(base.entries.get(path) === undefined && entry?.type === "blob" && entry.mode === "100644", "Installation is not three additive regular blobs");
    }
    const data = object(object(evidence.installationData)[CALLER_WORKFLOW]);
    assert.ok(typeof data.content === "string" && data.encoding === "base64", "Missing authenticated caller installation bytes");
    const bytes = Buffer.from(data.content, "base64");
    assert.equal(gitHash("blob", bytes), head.entries.get(CALLER_WORKFLOW)!.sha, "Caller installation blob drift");
    await assertCallerWorkflow(bytes, sourceSHA);
  } else { assertPreserved(base, head, INSTALL_PATHS, true); }
  // Existing ordinary, dependency, special and finite historical rules stay with their frozen owner.
  return checkFrozenV2(evidence, baseManifest, baseLock, sourceSHA);
}

async function protectedSourceSnapshot(api: GitHubReadApi, executor: ProtectedExecutor): Promise<string> {
  const [branchRaw, runRaw, summaries] = await Promise.all([
    api.get(`${repositoryRoot}/branches/${encodeURIComponent(SOURCE_REF.slice("refs/heads/".length))}`),
    api.get(`${repositoryRoot}/actions/runs/${executor.runId}/attempts/${executor.runAttempt}`),
    arrayPages(api, `${repositoryRoot}/rulesets?includes_parents=true`),
  ]);
  const branch = object(branchRaw), run = object(runRaw);
  assert.ok(branch.name === SOURCE_REF.slice("refs/heads/".length) && branch.protected === true, "Staged source is not visibly protected");
  assert.equal(object(branch.commit).sha, executor.sourceSHA, "Locked defining workflow source moved");
  repoIdentity(run.repository);
  assert.ok(run.id === executor.runId && run.run_attempt === executor.runAttempt && run.event === executor.event, "Current run provenance drift");
  if (executor.mode === "push") {
    assert.ok(run.path === SOURCE_WORKFLOW && run.head_sha === executor.sourceSHA &&
      run.head_branch === SOURCE_REF.slice("refs/heads/".length), "Genuine source push provenance drift");
    const actor = object(run.actor);
    assert.ok(actor.type === "User" && actor.login === "777genius" && actor.id === ownerId, "Staged source push must originate with the owner");
  } else {
    assert.ok(run.path === CALLER_WORKFLOW && run.head_sha === executor.targetHeadSHA, "Reusable target run provenance drift");
    const references = array(run.referenced_workflows).map(object);
    const matches = references.filter(value => value.path === `${IDENTITY.repository}/${SOURCE_WORKFLOW}@${executor.sourceSHA}` && value.sha === executor.sourceSHA);
    assert.equal(matches.length, 1, "Run does not reference the exact defining reusable workflow source");
  }
  const flat = summaries.flat().map(object);
  assert.equal(new Set(flat.map(value => value.id)).size, flat.length, "Duplicate ruleset pagination");
  const rules = await Promise.all(flat.map(value => api.get(`${repositoryRoot}/rulesets/${positive(value.id)}`)));
  const lockId = assertStagingProtection(rules, "public_read");
  return JSON.stringify({ source: object(branch.commit).sha, run: [run.id, run.run_attempt, run.event, run.path, run.head_sha,
    run.head_branch, run.referenced_workflows, run.actor], lock: rules.find(value => object(value).id === lockId) });
}

export interface SourceEvidence {
  readonly executor: ProtectedExecutor; readonly sourceTree: CompleteTree; readonly baseTree: CompleteTree; readonly headTree: CompleteTree;
  readonly evidence: Readonly<Record<string, unknown>>; readonly baseManifest: Buffer; readonly baseLock: Buffer;
  readonly recheck: () => Promise<void>; readonly protectionObservation: typeof HOSTED_PROTECTION_OBSERVATION;
}

const blobData = (document: VerifiedDocument): object => ({ sha: document.blob, size: document.bytes.length,
  encoding: "base64", content: document.bytes.toString("base64") });
const treeData = (tree: CompleteTree): object => ({ sha: tree.sha, truncated: false, tree: [...tree.entries.values()] });
const inputData = (tree: CompleteTree): object => Object.fromEntries(LEGACY_INPUTS.map(path => {
  const entry = tree.entries.get(path);
  return [path, entry === undefined ? null : { path: entry.path, sha: entry.sha, mode: entry.mode, type: entry.type }];
}));

export async function collectSourceEvidence(api: GitHubReadApi, input: Omit<ProtectedExecutor, "sourceTreeSHA">): Promise<SourceEvidence> {
  requireTarget();
  assert.ok(input.repository === IDENTITY.repository && input.sourceRef === SOURCE_REF && input.workflowPath === SOURCE_WORKFLOW &&
    ((input.mode === "push" && input.event === "push") || (input.mode === "reusable" && input.event === "pull_request_target")), "Wrong protected execution context");
  sha(input.sourceSHA); sha(input.targetBaseSHA); sha(input.targetHeadSHA); positive(input.runId); positive(input.runAttempt); positive(input.pullRequest);
  if (input.mode === "push") {
    assert.ok(input.pullRequest === requireTarget().pullRequest && input.targetBaseSHA === requireTarget().baseSHA && input.targetHeadSHA === requireTarget().headSHA &&
      input.callerWorkflowSHA === input.sourceSHA && input.callerWorkflowRef === `${IDENTITY.repository}/${SOURCE_WORKFLOW}@${SOURCE_REF}`, "Push cannot choose another target");
  } else {
    assert.ok(input.callerWorkflowSHA === input.targetBaseSHA && input.callerWorkflowRef === `${IDENTITY.repository}/${CALLER_WORKFLOW}@refs/heads/main`, "Unprotected main caller binding");
  }
  const sourceTree = await readTree(api, input.sourceSHA), executor: ProtectedExecutor = { ...input, sourceTreeSHA: sourceTree.sha };
  const sourceSnapshot = await protectedSourceSnapshot(api, executor);
  let firstPull: Record<string, unknown> | undefined;
  const readLive = async (): Promise<string> => {
    const [controllerRaw, pullRaw, branchRaw, mainRaw, identityRaw] = await Promise.all([
      api.get(repositoryRoot), api.get(`${repositoryRoot}/pulls/${input.pullRequest}`), api.get(`${repositoryRoot}/branches/main`),
      api.get(`${repositoryRoot}/rulesets/19979783`), api.get(`${repositoryRoot}/rulesets/24363205`),
    ]);
    const controller = repoIdentity(controllerRaw), pull = object(pullRaw), branch = object(branchRaw);
    assert.ok(controller.default_branch === "main" && controller.archived === false && controller.disabled === false && controller.fork === false, "Live default repository drift");
    assert.ok(branch.name === "main" && branch.protected === true && object(branch.commit).sha === input.targetBaseSHA, "Live protected main moved");
    const snapshot = targetPullSnapshot(pull, input.mode === "push");
    assert.ok(pull.number === input.pullRequest && object(pull.base).sha === input.targetBaseSHA && object(pull.head).sha === input.targetHeadSHA, "Target differs from genuine event");
    assertMainProtection(mainRaw, identityRaw, "public_read");
    assert.equal(targetPullSnapshot(await api.get(`${repositoryRoot}/pulls/${input.pullRequest}`), input.mode === "push"), snapshot, "Target moved during observation");
    assert.equal(object(object(await api.get(`${repositoryRoot}/branches/main`)).commit).sha, input.targetBaseSHA, "Main moved during observation");
    firstPull ??= pull;
    return JSON.stringify({ pull: snapshot, main: mainRaw, identity: identityRaw });
  };
  const snapshot = await readLive(), pull = firstPull!;
  const [baseTree, headTree, pages] = await Promise.all([
    readTree(api, input.targetBaseSHA), readTree(api, input.targetHeadSHA), arrayPages(api, `${repositoryRoot}/pulls/${input.pullRequest}/files`),
  ]);
  const files = assertFiles(baseTree, headTree, pages, Number(pull.changed_files));
  if (input.mode === "push") {
    assertSourceTuple(baseTree, headTree, pages);
    const [comparisonRaw, commitPages] = await Promise.all([
      api.get(`${repositoryRoot}/compare/${requireTarget().baseSHA}...${requireTarget().headSHA}`), arrayPages(api, `${repositoryRoot}/pulls/${requireTarget().pullRequest}/commits`),
    ]);
    const comparison = object(comparisonRaw), commits = commitPages.flat().map(object);
    assert.ok(comparison.status === "ahead" && comparison.behind_by === 0 && comparison.ahead_by === requireTarget().commits &&
      comparison.total_commits === requireTarget().commits && object(comparison.base_commit).sha === requireTarget().baseSHA &&
      object(comparison.merge_base_commit).sha === requireTarget().baseSHA, "Finite target is not based on the exact current main");
    assert.ok(commits.length === requireTarget().commits && new Set(commits.map(value => sha(value.sha))).size === commits.length &&
      commits.at(-1)!.sha === requireTarget().headSHA, "Incomplete finite source commits");
    for (const commit of commits) {
      for (const role of ["author", "committer"] as const) {
        const identity = object(commit[role]), raw = object(object(commit.commit)[role]);
        assert.ok(identity.type === "User" && identity.login === "777genius" && identity.id === ownerId &&
          raw.name === "iliya" && raw.email === "iliyazelenkog@gmail.com", "Finite source author/committer drift");
      }
    }
  }
  const [baseManifest, baseLock, headManifest, headLock] = await Promise.all([
    readVerifiedDocument(api, baseTree, input.targetBaseSHA, "package.json"), readVerifiedDocument(api, baseTree, input.targetBaseSHA, "pnpm-lock.yaml"),
    readVerifiedDocument(api, headTree, input.targetHeadSHA, "package.json"), readVerifiedDocument(api, headTree, input.targetHeadSHA, "pnpm-lock.yaml"),
  ]);
  const installationData: Record<string, unknown> = {};
  if (executor.mode === "reusable") {
    assertPreserved(baseTree, headTree, [...INSTALL_PATHS, ...QUALITY_INPUTS]);
    const caller = await readVerifiedDocument(api, baseTree, input.targetBaseSHA, CALLER_WORKFLOW);
    // Publisher remains dependency-free; canonical YAML semantics are evaluated in the actual source job.
    installationData[CALLER_WORKFLOW] = blobData(caller);
  }
  const live = { state: "open", pullRequest: input.pullRequest, repository: IDENTITY.repository, baseSHA: input.targetBaseSHA,
    headSHA: input.targetHeadSHA, sourceSHA: input.targetHeadSHA, baseRef: "main", defaultBranch: "main", headRepository: IDENTITY.repository,
    changedFiles: pull.changed_files };
  const evidence = { ...live, base: "5abed741aff64506d0e9f87f76541a4e93af7e4a", reviewTarget: "96cb95a89ca4a133fbb626133eb3ac6289938ff7",
    files, paginationComplete: true, baseTree: treeData(baseTree), headTree: treeData(headTree), baseInputs: inputData(baseTree), headInputs: inputData(headTree),
    headData: { "package.json": blobData(headManifest), "pnpm-lock.yaml": blobData(headLock) }, installationData, live };
  const recheck = async (): Promise<void> => {
    assert.equal(await protectedSourceSnapshot(api, executor), sourceSnapshot, "Protected source/run moved during verification");
    assert.equal(await readLive(), snapshot, "Target or main protections changed during verification");
  };
  await recheck();
  return { executor, sourceTree, baseTree, headTree, evidence, baseManifest: baseManifest.bytes, baseLock: baseLock.bytes,
    recheck, protectionObservation: HOSTED_PROTECTION_OBSERVATION };
}

export function createGitHubReadApi(token: string): GitHubStatusApi {
  assert.ok(token.length > 0, "A job-scoped GitHub token is required");
  const request = async (method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> => {
    assert.ok(path === repositoryRoot || path.startsWith(`${repositoryRoot}/`), "Cross-repository core request refused");
    assert.ok(!/[\\\r\n#]/u.test(path) && !/(?:^|\/)\.\.(?:\/|$|\?)/u.test(decodeURIComponent(path)), "Unsafe GitHub API path");
    const response = await fetch(`https://api.github.com/${path}`, { method, redirect: "error", signal: AbortSignal.timeout(30_000),
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.ok(response.ok, `GitHub ${method} ${path} failed with HTTP ${response.status}`);
    const text = await response.text(); assert.ok(Buffer.byteLength(text) <= 16 * 1024 * 1024, "Oversized GitHub API response");
    return JSON.parse(text) as unknown;
  };
  return { get: path => request("GET", path), postStatus: (head, value) => {
    sha(head); assert.equal(value.context, SOURCE_CONTEXT, "Legacy or unowned status context refused");
    assert.ok(["pending", "success", "failure"].includes(value.state), "Unknown source status state");
    return request("POST", `${repositoryRoot}/statuses/${head}`, value);
  } };
}

export async function publishSourceSuccessor(api: GitHubStatusApi, executor: Omit<ProtectedExecutor, "sourceTreeSHA">): Promise<void> {
  requireTarget();
  const initial = object(await api.get(`${repositoryRoot}/pulls/${positive(executor.pullRequest)}`));
  targetPullSnapshot(initial, executor.mode === "push");
  assert.ok(object(initial.base).sha === executor.targetBaseSHA && object(initial.head).sha === executor.targetHeadSHA, "Unsafe status target drift");
  const status = (state: "pending" | "success" | "failure"): Promise<unknown> => api.postStatus(executor.targetHeadSHA, {
    context: SOURCE_CONTEXT, state, target_url: `https://github.com/${IDENTITY.repository}/actions/runs/${executor.runId}/attempts/${executor.runAttempt}`,
    description: `Protected source successor v3: ${state}`,
  });
  try {
    await status("pending");
    const bound = await collectSourceEvidence(api, executor); await assertLocalSource(bound.sourceTree);
    await assertCurrentSuccessfulJobs(api, bound.executor); await bound.recheck();
    await status("success"); await bound.recheck();
  } catch (error) { await status("failure"); throw error; }
}

/** Fetch immutable fixture objects only; never check out, install or execute them. */
export function fetchReviewedFixtures(): void {
  const target = requireTarget();
  const fixtureRef = "refs/fixtures/docs-quality-source-successor-v3/target";
  const options = { cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } };
  execFileSync("git", ["fetch", "--no-tags", "--no-recurse-submodules",
    "https://github.com/agent-teams-ai/.github.git", `${target.headSHA}:${fixtureRef}`],
    { ...options, stdio: "inherit", timeout: 120_000 });
  const actual = execFileSync("git", ["rev-parse", `${fixtureRef}^{commit}`, `${fixtureRef}^{tree}`],
    { ...options, encoding: "utf8" }).trim().split("\n");
  if (actual[0] !== target.headSHA || actual[1] !== target.headTreeSHA) {
    throw new Error("Historical target commit or tree differs from the reviewed binding");
  }
  const predecessorSource = "d2904ef5181b1a3f42da2b6fad7e5f7fccad1ecd";
  const predecessorSourceRef = "refs/fixtures/docs-quality-source-successor-v3/predecessor-source";
  execFileSync("git", ["fetch", "--no-tags", "--no-recurse-submodules",
    "https://github.com/agent-teams-ai/.github.git", `${predecessorSource}:${predecessorSourceRef}`],
    { ...options, stdio: "inherit", timeout: 120_000 });
  if (execFileSync("git", ["rev-parse", `${predecessorSourceRef}^{commit}`], { ...options, encoding: "utf8" }).trim()
    !== predecessorSource) { throw new Error("Frozen predecessor source fixture drift"); }
  const historicalRef = "refs/fixtures/docs-quality-source-successor-v3/predecessor";
  execFileSync("git", ["fetch", "--no-tags", "--no-recurse-submodules",
    "https://github.com/agent-teams-ai/.github.git", `${HISTORICAL_TARGET.headSHA}:${historicalRef}`],
    { ...options, stdio: "inherit", timeout: 120_000 });
  if (execFileSync("git", ["rev-parse", `${historicalRef}^{commit}`], { ...options, encoding: "utf8" }).trim()
    !== HISTORICAL_TARGET.headSHA) { throw new Error("Frozen predecessor fixture drift"); }
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === "fetch-fixtures") {
  assert.equal(process.argv.length, 3, "Use fetch-fixtures without arguments");
  fetchReviewedFixtures();
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  requireTarget();
  const mode = process.argv[2]; assert.ok(process.argv.length === 3 && ["qualify", "source", "publish"].includes(String(mode)), "Use qualify, source or publish");
  const event = process.env.GITHUB_EVENT_NAME === "pull_request_target"
    ? JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH ?? "", "utf8")) as unknown : undefined;
  const executor = executorFromEnvironment(process.env, event), api = createGitHubReadApi(process.env.GITHUB_TOKEN ?? "");
  if (mode === "publish") { await publishSourceSuccessor(api, executor); }
  else {
    const bound = await collectSourceEvidence(api, executor); await assertLocalSource(bound.sourceTree);
    if (mode === "source") {
      if (executor.mode === "reusable") {
        const caller = object(object(bound.evidence.installationData)[CALLER_WORKFLOW]);
        await assertCallerWorkflow(Buffer.from(String(caller.content), "base64"), executor.sourceSHA);
      }
      const result = await checkSourceSuccessor(bound.evidence, bound.baseManifest, bound.baseLock, executor.sourceSHA);
      await bound.recheck(); console.log(JSON.stringify({ result, executor: bound.executor, protectionObservation: bound.protectionObservation }));
    } else { await bound.recheck(); console.log(JSON.stringify({ result: "source-qualified-semantics-separate", executor: bound.executor, protectionObservation: bound.protectionObservation })); }
  }
}
