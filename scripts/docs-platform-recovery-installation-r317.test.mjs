import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { INSTALLATION_PATHS, validateAcceptedInstallation, classifyInstallationPR,
  verifyInstallationTransition, parseIncidentJson, selectLatestFailedSourceCheck,
  validateStagedIRecord, readEffectiveProtections } from "./verify-docs-platform-recovery-installation-r317.mjs";

const digest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const blob = (bytes) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
const id = (bytes) => ({ type: "blob", mode: "100644", blob: blob(bytes), bytes: bytes.length, sha256: digest(bytes) });
const repo = { id: 1316243981, full_name: "agent-teams-ai/.github", default_branch: "main",
  archived: false, disabled: false };
const base = "a".repeat(40), head = "b".repeat(40);
const forwardBase = "c".repeat(40), installed = "d".repeat(40), forwardHead = "e".repeat(40);
const fixtureNow = Date.parse("2026-09-24T12:00:00Z");
test("E accepts historical check runs but requires the latest decisive failed job", () => {
  const source = "a3ce96e00df2f9958fbd614e7fa6cb965f83cab8";
  const context = "docs-protocol / docs-protocol-check";
  const check = (id, run, conclusion = "failure") => ({ id, name: context, head_sha: source,
    app: { id: 15368 }, conclusion,
    html_url: `https://github.com/agent-teams-ai/agent-teams-platform/actions/runs/${run}/job/${id}` });
  const historical = [check(11, 101), check(12, 102), check(13, 103)];
  assert.equal(selectLatestFailedSourceCheck(historical, context, 13, 103).id, 13);
  assert.throws(() => selectLatestFailedSourceCheck(historical, context, 12, 102), /latest decisive/u);
  assert.throws(() => selectLatestFailedSourceCheck([...historical, check(14, 104, "success")],
    context, 13, 103), /latest decisive/u);
});
test("installed guard noops for ordinary changes and retains authority coverage", () => {
  const file = (filename, previous_filename) => ({ filename, previous_filename });
  assert.equal(classifyInstallationPR([file("docs/README.md")], 1), "noop");
  assert.equal(classifyInstallationPR([file("governance/docs-protocol-policy-v2.json")], 1), "noop");
  for (const path of [INSTALLATION_PATHS.E[1], INSTALLATION_PATHS.I[0],
    ".github/workflows/other.yml", "scripts/other.mjs", "governance/new.schema.json", "pnpm-lock.yaml"]) {
    assert.equal(classifyInstallationPR([file(path)], 1), "guarded");
    assert.equal(classifyInstallationPR([file("docs/renamed.md", path)], 1), "guarded");
  }
  assert.throws(() => classifyInstallationPR([file("docs/README.md")], 2), /inventory/u);
});
const requiredContexts = ["check", "trusted-admission-evidence", "trusted-authority-evolution",
  "trusted-admission-authority-evolution-v1", "trusted-platform-recovery-installation-r317", "trusted-validation"];
function protectionSnapshot() {
  return { rulesets: [{ summary: { id: 19979783, name: "Protect main", enforcement: "active" },
    detail: { id: 19979783, name: "Protect main", target: "branch", enforcement: "active",
      conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } }, bypass_actors: [],
      rules: ["deletion", "non_fast_forward", "required_linear_history", "pull_request"]
        .map((type) => ({ type })).concat([{ type: "required_status_checks", parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: requiredContexts.map((context) => ({ context, integration_id: 15368 })) } }]) } }],
  classic_branch_protection: null };
}
function gitTree(files, revision) {
  const root = new Map(), entries = [];
  for (const [path, value] of files) {
    const parts = path.split("/"); let parent = root;
    for (const part of parts.slice(0, -1)) {
      if (!parent.has(part)) parent.set(part, new Map());
      parent = parent.get(part);
    }
    parent.set(parts.at(-1), value);
  }
  function directory(children, prefix) {
    const rows = [];
    for (const [name, value] of children) {
      const path = prefix ? `${prefix}/${name}` : name;
      const entry = value instanceof Map ? { path, type: "tree", mode: "040000",
        sha: directory(value, path) } : { path, type: "blob", mode: value.mode,
        sha: value.blob, size: value.bytes };
      entries.push(entry); rows.push({ ...entry, name });
    }
    rows.sort((a, b) => Buffer.compare(Buffer.from(a.name + (a.type === "tree" ? "/" : "")),
      Buffer.from(b.name + (b.type === "tree" ? "/" : ""))));
    const bytes = Buffer.concat(rows.flatMap((entry) => [
      Buffer.from(`${entry.mode.replace(/^0/u, "")} ${entry.name}\0`), Buffer.from(entry.sha, "hex")
    ]));
    return createHash("sha1").update(`tree ${bytes.length}\0`).update(bytes).digest("hex");
  }
  const sha = directory(root, "");
  return { commit: { sha: revision, tree: { sha } }, tree: { sha, truncated: false, tree: entries } };
}
function fixture(stage = "E", direction = "forward") {
  const clock = { now: fixtureNow };
  const bodies = new Map();
  const body = (name) => { const bytes = Buffer.from(name); bodies.set(blob(bytes), bytes); return id(bytes); };
  const guard = body("base-owned guard workflow\n"), guardTest = body("base-owned guard test\n"),
    verifier = body("base-owned verifier\n");
  const oldFiles = new Map([[INSTALLATION_PATHS.G[0], guard], [INSTALLATION_PATHS.G[1], guardTest],
    [INSTALLATION_PATHS.G[2], verifier]]);
  const acceptedProof = body("synthetic accepted E proof\n");
  if (stage === "I") {
    oldFiles.set(INSTALLATION_PATHS.E[0], body("# ADR-0007: Synthetic\nStatus: Accepted\n"));
    oldFiles.set(INSTALLATION_PATHS.E[1], acceptedProof);
  }
  const newFiles = new Map(oldFiles);
  const addedInI = new Set(["governance/docs-platform-admission-recovery.json",
    "scripts/docs-platform-admission-recovery.mjs", "scripts/docs-platform-admission-recovery.test.mjs"]);
  const manifest = INSTALLATION_PATHS[stage].toSorted().map((path) => {
    const old = stage === "E" || (stage === "I" && addedInI.has(path)) ? null : body(`old:${path}`);
    const next = body(path === "governance/docs-platform-admission-recovery.json" ? JSON.stringify({
      schema_version: 1, id: "platform-a3-admission-cycle", state: "active",
      valid_from: "2026-09-24T00:00:00Z", expires_at: "2026-09-25T00:00:00Z",
      central_pull: 314, execution_decision_id: 8317,
      before_policy_blob: "55717f3171b0359b4eedba338f616ae72d943496",
      after_policy_blob: "17a2c987aed7d0fa10cf9e2c5788f45d3ab41aad",
      registry_blob: "18f59fc7312d78782f65b5f40dcc3774695211af",
      exceptions_blob: "ac336b865d697b62c938623f2960864e85f7698a",
      proof: { revision: base, path: "governance/evidence/docs-admission-recovery/platform-a3.json",
        blob: acceptedProof.blob }, owner_decision: { comment_id: 1, actor_id: 42,
        actor_login: "synthetic-owner", body_digest: digest(Buffer.from("synthetic decision")) },
      failure: { run_id: 1, attempt: 1, workflow_id: 2, authorize_job_id: 3,
        semantic_job_id: 4, diagnostic_digest: digest(Buffer.from("synthetic log")) },
    }) : `new:${path}`);
    if (old) oldFiles.set(path, old);
    newFiles.set(path, next);
    const forward = { path, status: old ? "modified" : "added", old, new: next };
    return direction === "inverse" ? { path, status: old ? "modified" : "removed",
      old: next, new: old } : forward;
  });
  const originalOld = new Map(oldFiles), originalNew = new Map(newFiles);
  const retainedBase = new Map(originalOld);
  const before = direction === "inverse" ? originalNew : originalOld;
  const after = direction === "inverse" ? originalOld : originalNew;
  const protections = protectionSnapshot();
  const accepted = { schema_version: 1, stage, direction, repository: repo.full_name, repository_id: repo.id,
    pull_number: 317, pull_id: 3317, branch: "main", head_ref: "synthetic-r317", base, head, manifest,
    manifest_digest: digest(Buffer.from(JSON.stringify(manifest))), guard_blob: guard.blob,
    guard_test_blob: guardTest.blob, verifier_blob: verifier.blob,
    run_id: 7317, run_attempt: 2, decision_comment_id: 8317,
    owner_id: 42, owner_login: "synthetic-owner",
    deadline: "2026-09-24T13:00:00Z",
    expected_protections_digest: digest(Buffer.from(JSON.stringify(protections))),
    forward_decision_comment_id: direction === "inverse" ? 9317 : null };
  const retainedForward = direction === "inverse" ? { ...structuredClone(accepted),
    direction: "forward", pull_number: 316, pull_id: 3316,
    base: forwardBase, head: forwardHead, decision_comment_id: 9317,
    forward_decision_comment_id: null, manifest: manifest.map((row) => ({ path: row.path,
      status: row.new ? "modified" : "added", old: row.new, new: row.old })) } : null;
  if (retainedForward) retainedForward.manifest_digest = digest(Buffer.from(JSON.stringify(retainedForward.manifest)));
  const pull = { id: accepted.pull_id, number: accepted.pull_number, state: "open", merged: false,
    draft: false, changed_files: manifest.length, commits: 1, updated_at: "2026-09-24T00:00:00Z",
    base: { sha: base, ref: "main", repo }, head: { sha: head, ref: "synthetic-r317", repo } };
  const event = { action: "synchronize", execution_base: base, run_id: 7317, run_attempt: 2,
    repository: structuredClone(repo),
    pull_request: structuredClone(pull) };
  const forwardPull = retainedForward && { id: retainedForward.pull_id, number: retainedForward.pull_number,
    state: "closed", merged: true, draft: false, merge_commit_sha: installed,
    merged_at: "2026-09-24T00:01:00Z", changed_files: manifest.length, commits: 1,
    base: { sha: forwardBase, ref: "main", repo },
    head: { sha: forwardHead, ref: retainedForward.head_ref, repo } };
  const api = {
    getDecisionComment: async (id) => ({ id, user: { id: 42,
      login: "synthetic-owner", type: "User" },
      body: JSON.stringify(id === 9317 ? retainedForward : accepted),
      issue_url: `https://api.github.com/repos/${repo.full_name}/issues/${id === 9317 ?
        retainedForward.pull_number : accepted.pull_number}` }),
    getRepository: async () => repo,
    getPull: async (number) => number === 317 ? pull : forwardPull,
    getBranchHead: async () => base,
    compare: async (from) => ({ status: "ahead", merge_base_commit: { sha: from }, behind_by: 0, ahead_by: 1 }),
    getEffectiveProtections: async () => protections,
    getCollaboratorPermission: async () => ({ permission: "admin", user: { id: 42, login: "synthetic-owner" } }),
    getPullFiles: async () => [manifest.map((row) => ({ filename: row.path, status: row.status,
      sha: row.new?.blob }))],
    getTree: async (revision) => gitTree(revision === base ? before :
      revision === forwardBase ? retainedBase :
        revision === installed || revision === forwardHead ? originalNew : after, revision),
    getBlob: async (sha) => bodies.get(sha),
    verifyHostedProof: async (proofBytes, decisionBytes) => {
      assert.equal(blob(proofBytes), acceptedProof.blob);
      assert.match(decisionBytes.toString(), /Status: Accepted/u);
    },
  };
  const rebind = () => { accepted.manifest_digest = digest(Buffer.from(JSON.stringify(accepted.manifest))); };
  return { event, accepted, api, pull, forwardPull, before, after, bodies, protections, rebind,
    clock,
    rebindProtections: () => { accepted.expected_protections_digest =
      digest(Buffer.from(JSON.stringify(protections))); },
    run: () => verifyInstallationTransition(event, accepted, api, () => clock.now) };
}
for (const [stage, direction] of [["I", "forward"], ["I", "inverse"]]) {
  test(`synthetic exact ${stage} ${direction} tuple verifies from base`, async () => {
    const f = fixture(stage, direction);
    assert.equal((await f.run()).status, "exact_candidate_verified");
  });
}
test("inverse accepts a distinct squash merge commit bound to the forward PR", async () => {
  const f = fixture("I", "inverse");
  assert.notEqual(f.forwardPull.merge_commit_sha, forwardHead);
  assert.notEqual(f.forwardPull.merge_commit_sha, base);
  assert.equal((await f.run()).status, "exact_candidate_verified");
});
for (const [label, mutate, pattern] of [
  ["unrelated merged commit", (f) => { f.forwardPull.merge_commit_sha = "f".repeat(40); },
    /merged installation tree differs|installed forward new/u],
  ["merged commit without forward ancestry", (f) => { const compare = f.api.compare;
    f.api.compare = async (from, to) => from === forwardBase && to === installed
      ? { status: "diverged" } : compare(from, to); }, /ancestor of installed commit/u],
  ["merged commit absent from inverse ancestry", (f) => { const compare = f.api.compare;
    f.api.compare = async (from, to) => from === installed && to === base
      ? { status: "diverged" } : compare(from, to); }, /ancestor of inverse base/u],
  ["merged bytes diverge from forward manifest", (f) => { const get = f.api.getTree;
    f.api.getTree = async (revision) => revision === installed ? gitTree(new Map([
      ...f.before, [f.accepted.manifest[0].path, id(Buffer.from("divergent installed bytes"))]]), revision)
      : get(revision); }, /merged installation tree differs|installed forward new/u],
]) {
  test(`inverse rejects ${label}`, async () => {
    const f = fixture("I", "inverse"); mutate(f);
    await assert.rejects(f.run(), pattern);
  });
}
test("inverse rejects revoked retained forward authorization at final checkpoint", async () => {
  const f = fixture("I", "inverse");
  const get = f.api.getDecisionComment;
  let reads = 0;
  f.api.getDecisionComment = async (commentId) => {
    const comment = await get(commentId);
    if (commentId === 9317 && ++reads === 2) { return { ...comment, body: "revoked" }; }
    return comment;
  };
  await assert.rejects(f.run(), /retained forward authorization/u);
  assert.equal(reads, 2);
});
test("inverse rejects changed merged PR provenance at final checkpoint", async () => {
  const f = fixture("I", "inverse");
  const get = f.api.getPull;
  let reads = 0;
  f.api.getPull = async (number) => {
    const pull = await get(number);
    if (number === 316 && ++reads === 2) { return { ...pull, merge_commit_sha: "f".repeat(40) }; }
    return pull;
  };
  await assert.rejects(f.run(), /merged provenance changed/u);
});
test("I forward rejects authority expiry while hosted proof is verified", async () => {
  const f = fixture("I", "forward");
  f.accepted.deadline = "2026-09-25T01:00:00Z";
  const verify = f.api.verifyHostedProof;
  f.api.verifyHostedProof = async (...args) => {
    await verify(...args);
    f.clock.now = Date.parse("2026-09-25T00:00:00Z");
  };
  await assert.rejects(f.run(), /I authority remains unbound/u);
});
test("owner digest cannot authorize a missing or weakened Protect main contract", async () => {
  const changes = [
    (p) => { p.rulesets = []; },
    (p) => { p.rulesets[0].summary.enforcement = "disabled"; },
    (p) => { p.rulesets[0].detail.bypass_actors.push({ actor_id: 1 }); },
    (p) => { p.rulesets[0].detail.conditions.ref_name.include = []; },
    ...["deletion", "non_fast_forward", "required_linear_history", "pull_request"]
      .map((type) => (p) => { p.rulesets[0].detail.rules =
        p.rulesets[0].detail.rules.filter((r) => r.type !== type); }),
    (p) => { p.rulesets[0].detail.rules.find((r) => r.type === "required_status_checks")
      .parameters.strict_required_status_checks_policy = false; },
    ...requiredContexts.flatMap((context) => [
      (p) => { const checks = p.rulesets[0].detail.rules.find((r) => r.type === "required_status_checks")
        .parameters.required_status_checks;
        checks.splice(checks.findIndex((check) => check.context === context), 1); },
      (p) => { p.rulesets[0].detail.rules.find((r) => r.type === "required_status_checks")
        .parameters.required_status_checks.find((check) => check.context === context).integration_id = 0; },
    ]),
  ];
  for (const change of changes) {
    const f = fixture("I"); change(f.protections); f.rebindProtections();
    await assert.rejects(f.run(), /required Protect main|protection is missing|strict required|duplicate or invalid|required check/u);
  }
});
test("minimum protection permits a future additional required check and unordered contexts", async () => {
  const f = fixture("I");
  const checks = f.protections.rulesets[0].detail.rules.find((r) => r.type === "required_status_checks")
    .parameters.required_status_checks;
  checks.reverse(); checks.push({ context: "future-stronger-check", integration_id: 15368 });
  f.rebindProtections();
  assert.equal((await f.run()).status, "exact_candidate_verified");
});
test("legacy V8 alone cannot authorize I after the successor cutover", async () => {
  const f = fixture("I");
  const checks = f.protections.rulesets[0].detail.rules.find((r) => r.type === "required_status_checks")
    .parameters.required_status_checks;
  checks.splice(checks.findIndex((check) => check.context === "trusted-platform-recovery-installation-r317"), 1);
  checks.push({ context: "trusted-cohort-authority-evolution-v8", integration_id: 15368 });
  f.rebindProtections();
  await assert.rejects(f.run(), /required check trusted-platform-recovery-installation-r317/u);
});
test("legacy strict field cannot mask a disabled live ruleset policy", async () => {
  const f = fixture("I");
  const parameters = f.protections.rulesets[0].detail.rules.find((rule) =>
    rule.type === "required_status_checks").parameters;
  parameters.strict_required_status_checks_policy = false;
  parameters.strict_required_status_checks = true;
  f.rebindProtections();
  await assert.rejects(f.run(), /strict required status checks are missing/u);
});
test("E cannot pass with unbound decision and proof templates", async () => {
  const f = fixture("E", "forward");
  await assert.rejects(f.run(), /E decision is not independently accepted/u);
});
for (const [label, change, pattern] of [
  ["wrong repository", (f) => { f.event.repository.id = 0; }, /wrong event repository/u],
  ["wrong PR", (f) => { f.pull.number = 318; }, /wrong, forked/u],
  ["fork", (f) => { f.pull.head.repo = { ...repo, id: 0 }; }, /wrong, forked/u],
  ["stale head", (f) => { f.pull.head.sha = "c".repeat(40); }, /wrong, forked/u],
  ["stale base", (f) => { f.event.execution_base = "c".repeat(40); }, /execution did not/u],
  ["replayed attempt", (f) => { f.event.run_attempt = 3; }, /run attempt replayed/u],
  ["changed decision", (f) => { f.api.getDecisionComment = async () => ({ id: 0 }); }, /accepted decision/u],
  ["wrong ancestry", (f) => { f.api.compare = async () => ({ status: "diverged" }); }, /same-base descendant/u],
  ["changed protection", (f) => { f.protections.classic_branch_protection = { changed: true }; }, /protection snapshot/u],
  ["revoked admin", (f) => { f.api.getCollaboratorPermission = async () => ({ permission: "read" }); }, /admin authority/u],
  ["incomplete file page", (f) => { f.api.getPullFiles = async () => [[]]; }, /incomplete, duplicate/u],
  ["duplicate file page", (f) => { f.api.getPullFiles = async () => [[...f.accepted.manifest.map((row) =>
    ({ filename: row.path, status: row.status, sha: row.new?.blob })),
    { filename: f.accepted.manifest[0].path }]]; }, /incomplete, duplicate/u],
  ["rename", (f) => { f.api.getPullFiles = async () => [f.accepted.manifest.map((row, index) =>
    ({ filename: row.path, status: row.status, sha: row.new?.blob,
      ...(index === 0 ? { previous_filename: "README.md" } : {}) }))]; }, /PR file differs/u],
  ["extra tree path", (f) => { const get = f.api.getTree; f.api.getTree = async (revision) => {
    const tree = await get(revision); if (revision === head) tree.tree.tree.push({ path: "scripts/extra.mjs",
    type: "blob", mode: "100644", sha: "c".repeat(40), size: 1 }); return tree; }; }, /immutable-tree metadata/u],
  ["truncated tree", (f) => { const get = f.api.getTree; f.api.getTree = async (revision) =>
    ({ ...await get(revision), tree: { ...(await get(revision)).tree, truncated: true } }); }, /incomplete/u],
  ["symlink", (f) => { const get = f.api.getTree; f.api.getTree = async (revision) => {
    const tree = await get(revision); if (revision === head) tree.tree.tree.find((e) => e.path === f.accepted.manifest[0].path).mode = "120000";
    return tree; }; }, /immutable-tree entry|mode/u],
  ["wrong content", (f) => { f.api.getBlob = async () => Buffer.from("wrong"); }, /content digest/u],
  ["wrong guard blob", (f) => { f.accepted.guard_blob = "c".repeat(40); }, /base guard/u],
  ["wrong verifier blob", (f) => { f.accepted.verifier_blob = "c".repeat(40); }, /base guard/u],
  ["expired", (f) => { f.accepted.deadline = "2020-01-01T00:00:00Z"; }, /deadline/u],
  ["wrong manifest digest", (f) => { f.accepted.manifest_digest = `sha256:${"f".repeat(64)}`; }, /manifest digest/u],
  ["partial inverse", (f) => { f.accepted.manifest.pop(); f.rebind(); }, /manifest path set/u],
  ["mixed inverse", (f) => { f.accepted.manifest[0].status = "added"; f.rebind(); }, /addition\/modification|authority transition/u],
]) {
  test(`guard rejects ${label}`, async () => {
    const f = fixture(label.includes("inverse") || label.includes("guard blob") ||
      label.includes("verifier blob") ? "I" : "E", label.includes("inverse") ? "inverse" : "forward");
    change(f); await assert.rejects(f.run(), pattern);
  });
}
test("guard workflow checks out only protected base and has no PR-head execution", async () => {
  const workflow = await readFile(".github/workflows/docs-platform-recovery-installation-r317.yml", "utf8");
  assert.match(workflow, /pull_request_target:/u);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/u);
  assert.match(workflow, /node scripts\/verify-docs-platform-recovery-installation-r317\.mjs/u);
  assert.doesNotMatch(workflow, /pull_request\.head\.sha/u);
  assert.match(workflow, /DOCS_R317_ACCEPTED_TUPLE_COMMENT_ID/u);
});
test("unbound accepted tuple is rejected without creating authority", () => {
  assert.throws(() => validateAcceptedInstallation(null, fixtureNow), /accepted tuple/u);
  assert.throws(() => parseIncidentJson(Buffer.from('{"a":1,"a":2}'), "proof"), /duplicate key/u);
  assert.throws(() => validateStagedIRecord(Buffer.from('{"schema_version":1,"state":"unbound"}')),
    /I authority record fields differ/u);
  const f = fixture("I");
  const authority = f.accepted.manifest.find((row) => row.path === "governance/docs-platform-admission-recovery.json");
  const active = JSON.parse(f.bodies.get(authority.new.blob));
  active.central_base = base;
  assert.throws(() => validateStagedIRecord(Buffer.from(JSON.stringify(active))), /fields differ/u);
});
test("effective protections bind every page, ruleset detail and classic protection independently", async () => {
  const summary = Array.from({ length: 100 }, (_, index) => ({ id: index + 1,
    name: `synthetic-${index + 1}`, enforcement: "active" }));
  const state = { conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
    rules: [{ type: "required_status_checks", parameters: { required_status_checks: [{ context: "docs" }] } }],
    bypass_actors: [{ actor_id: 1, actor_type: "OrganizationAdmin", bypass_mode: "always" }],
    classic: { required_status_checks: { contexts: ["docs"] } } };
  const read = async (path) => {
    if (path.includes("/rulesets?")) return path.endsWith("page=1") ? summary : [{ id: 101,
      name: "synthetic-101", enforcement: "active" }];
    const id = /\/rulesets\/(\d+)\?/u.exec(path)?.[1];
    if (id) return { id: Number(id), conditions: state.conditions, rules: state.rules,
      bypass_actors: state.bypass_actors };
    if (path.endsWith("/branches/main/protection")) return state.classic;
    throw new Error(path);
  };
  const snapshot = await readEffectiveProtections(read);
  assert.equal(snapshot.rulesets.length, 101);
  for (const [field, change] of [
    ["conditions", { ref_name: { include: ["refs/heads/other"], exclude: [] } }],
    ["rules", [{ type: "pull_request", parameters: { required_approving_review_count: 1 } }]],
    ["bypass_actors", []], ["classic", { required_status_checks: { contexts: ["changed"] } }],
  ]) {
    const original = state[field]; state[field] = change;
    assert.notEqual(digest(Buffer.from(JSON.stringify(await readEffectiveProtections(read)))),
      digest(Buffer.from(JSON.stringify(snapshot))), field);
    state[field] = original;
  }
  const absent = await readEffectiveProtections(async (path) => {
    if (path.endsWith("/branches/main/protection")) throw Object.assign(new Error("not found"), { status: 404 });
    return read(path);
  });
  assert.equal(absent.classic_branch_protection, null);
  await assert.rejects(readEffectiveProtections(async (path) => {
    if (path.includes("/rulesets/1?")) return { id: 1, rules: [], bypass_actors: [] };
    return read(path);
  }), /incomplete effective ruleset detail/u);
});
test("immutable trees reject omitted directory and mismatched commit identity", async () => {
  const f = fixture("I");
  const get = f.api.getTree;
  f.api.getTree = async (revision) => {
    const result = await get(revision);
    if (revision === head) result.tree.tree.pop();
    return result;
  };
  await assert.rejects(f.run(), /missing immutable-tree parent|immutable-tree metadata hash mismatch/u);
  const g = fixture("I");
  const original = g.api.getTree;
  g.api.getTree = async (revision) => ({ ...await original(revision), commit: {
    sha: "c".repeat(40), tree: (await original(revision)).commit.tree } });
  await assert.rejects(g.run(), /mismatched immutable commit\/tree identity/u);
});
test("inverse restores only the retained forward manifest", async () => {
  const f = fixture("I", "inverse");
  const original = f.api.getDecisionComment;
  f.api.getDecisionComment = async (commentId) => {
    const comment = await original(commentId);
    if (commentId === 9317) {
      const forward = JSON.parse(comment.body);
      const row = forward.manifest.find((entry) => entry.status === "modified");
      row.old = id(Buffer.from("arbitrary owner-rebound destination"));
      forward.manifest_digest = digest(Buffer.from(JSON.stringify(forward.manifest)));
      comment.body = JSON.stringify(forward);
    }
    return comment;
  };
  await assert.rejects(f.run(), /inverse does not restore retained trusted forward bytes/u);
});
test("owner-rebound inverse destination fails against immutable forward base bytes", async () => {
  const f = fixture("I", "inverse");
  const bytes = Buffer.from("arbitrary owner-rebound destination");
  const replacement = id(bytes);
  f.bodies.set(replacement.blob, bytes);
  const row = f.accepted.manifest.find((entry) => entry.status === "modified");
  row.new = replacement;
  f.after.set(row.path, replacement);
  f.rebind();
  const original = f.api.getDecisionComment;
  f.api.getDecisionComment = async (commentId) => {
    const comment = await original(commentId);
    if (commentId === 9317) {
      const forward = JSON.parse(comment.body);
      forward.manifest.find((entry) => entry.path === row.path).old = replacement;
      forward.manifest_digest = digest(Buffer.from(JSON.stringify(forward.manifest)));
      comment.body = JSON.stringify(forward);
    }
    return comment;
  };
  await assert.rejects(f.run(), /retained forward old Git type\/mode\/blob\/size differs/u);
});
