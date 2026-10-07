import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { onboardIdentity } from "./onboard-commit-author-identity.mjs";

const repo = "agent-teams-ai/example", central = "agent-teams-ai/.github";
const head = "a".repeat(40), authority = "b".repeat(40), pin = "6d843f3a2c3f616aa2f4b902a866b1ff1a18f9c6";
const policyPath = "governance/commit-author-identity.json", templatePath = "scripts/fixtures/commit-author-identity-caller.yml";
const implementationPath = ".github/workflows/commit-author-identity-check.yml", callerPath = ".github/workflows/commit-author-identity.yml";
const files = Object.fromEntries(await Promise.all([policyPath, templatePath, implementationPath].map(async p => [p, await readFile(p)])));
const policy = JSON.parse(files[policyPath]);
const template = files[templatePath].toString();
const clone = value => structuredClone(value);
const blob = bytes => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
const canonical = (id = 20, inherited = false) => ({ ...clone(policy.ruleset), id,
  source_type: inherited ? "Organization" : "Repository", source: inherited ? "agent-teams-ai" : repo });
const otherRule = id => ({ id, name: `Other ${id}`, source_type: "Repository", source: repo,
  target: "branch", enforcement: "active", bypass_actors: [], conditions: { ref_name: { include: ["~ALL"], exclude: [] } },
  rules: [{ type: "required_status_checks", parameters: { required_status_checks: [{ context: "existing-check", integration_id: 1 }] } }] });
function fixture() {
  const metadata = name => ({ id: name === repo ? 10 : 11, full_name: name, owner: { login: "agent-teams-ai", type: "Organization" },
    default_branch: "main", archived: false, disabled: false });
  const f = { repository: metadata(repo), central: metadata(central), head, authority, actor: { type: "User", login: "777genius" },
    permissions: { default_workflow_permissions: "write", can_approve_pull_request_reviews: true, unrelated: "preserved" },
    organizationPermissions: { default_workflow_permissions: "read", can_approve_pull_request_reviews: false },
    rules: [otherRule(1)], caller: Buffer.from(template.replace("CENTRAL_REVISION", pin)),
    authorityFiles: { ...files }, target: files[implementationPath], calls: [], modes: {}, repoReads: 0 };
  f.gh = async (method, endpoint, options = {}) => {
    const call = { method, endpoint, ...options }; f.calls.push(clone(call));
    await f.before?.(call);
    const url = new URL(`https://api.github.com/${endpoint}`), route = url.pathname.slice(1);
    if (route === "user") { return clone(f.actor); }
    if (route === "orgs/agent-teams-ai/actions/permissions/workflow") { return clone(f.organizationPermissions); }
    const isCentral = route.startsWith(`repos/${central}/`) || route === `repos/${central}`;
    const root = `repos/${isCentral ? central : repo}`, metadata = isCentral ? f.central : f.repository;
    if (route === root) { if (!isCentral) { f.repoReads++; } return clone(metadata); }
    if (route.startsWith(`${root}/branches/`)) { return { name: metadata.default_branch, commit: { sha: isCentral ? f.authority : f.head } }; }
    const ref = url.searchParams.get("ref") ?? route.split("/git/trees/")[1];
    const content = isCentral ? (ref === f.authority ? f.authorityFiles : { [implementationPath]: f.target }) : { [callerPath]: f.caller };
    if (route.startsWith(`${root}/git/trees/`)) {
      return { truncated: f.truncated ?? false, tree: Object.entries(content).filter(([, bytes]) => bytes !== null).map(([p, bytes]) =>
        ({ path: p, type: f.types?.[p] ?? "blob", mode: f.refModes?.[`${ref}:${p}`] ?? f.modes[p] ?? "100644", sha: blob(bytes) })) };
    }
    if (route.startsWith(`${root}/contents/`)) {
      const p = route.slice(`${root}/contents/`.length), bytes = content[p];
      if (!bytes) { throw new Error("404 missing immutable file"); }
      return { type: "file", encoding: "base64", sha: blob(bytes), content: bytes.toString("base64") };
    }
    if (route === `${root}/actions/permissions/workflow`) {
      if (method === "PUT") {
        Object.assign(f.permissions, options.body);
        await f.afterWrite?.(call);
        if (f.uncertain === method) { throw new Error("Transport timed out after possible effect"); }
        return null;
      }
      return clone(f.permissions);
    }
    if (route === `${root}/rulesets`) {
      if (method === "POST") {
        const rule = { ...clone(options.body), id: 900, source_type: "Repository", source: repo };
        f.rules.push(rule); await f.afterWrite?.(call);
        if (f.uncertain === method) { throw new Error("Transport timed out after possible effect"); }
        return f.badResponse ? null : clone(rule);
      }
      assert.equal(options.paginate, true, "All visible ruleset pages must be requested");
      assert.equal(url.searchParams.get("includes_parents"), "true");
      return f.badPages ?? Array.from({ length: Math.max(1, Math.ceil(f.rules.length / 100)) }, (_, i) => clone(f.rules.slice(i * 100, (i + 1) * 100)));
    }
    if (route.startsWith(`${root}/rulesets/`)) {
      assert.equal(url.searchParams.get("includes_parents"), "true");
      return clone(f.rules.find(rule => rule.id === Number(route.split("/").at(-1))));
    }
    throw new Error(`Unexpected transport call: ${method} ${endpoint}`);
  };
  return f;
}
const mutations = f => f.calls.filter(call => call.method !== "GET");
const run = (f, apply = true) => onboardIdentity(["--repo", repo, "--expected-head", head, ...(apply ? ["--apply"] : [])], { gh: f.gh });
async function refused(f, pattern) {
  const result = await run(f);
  assert.equal(result.outcome, "refused"); assert.match(result.error, pattern); assert.deepEqual(mutations(f), []);
  return result;
}

// Break caught: preparation must never contact gh, normalize bytes, or write a destination.
test("render emits exactly the existing caller bytes through the CLI, without IO effects", async () => {
  const f = fixture();
  assert.deepEqual(await onboardIdentity(["render", "--revision", pin], { gh: f.gh }), Buffer.from(template.replace("CENTRAL_REVISION", pin)));
  assert.deepEqual(f.calls, []);
  const cli = spawnSync(process.execPath, ["scripts/onboard-commit-author-identity.mjs", "render", "--revision", pin]);
  assert.equal(cli.status, 0); assert.equal(cli.stderr.length, 0);
  assert.deepEqual(cli.stdout, Buffer.from(template.replace("CENTRAL_REVISION", pin)));
});

// Break caught: malformed flags or names must not reach the remote transport, especially apply without binding.
test("invalid CLI contracts fail before remote reads or writes", async () => {
  for (const args of [[], ["--unknown"], ["--repo"], ["--repo", repo, "--apply"], ["--repo", repo, "--repo", repo],
    ["--repo", "other/example"], ["--repo", central], ["--repo", "agent-teams-ai/.."], ["--repo", "agent-teams-ai/a?b"],
    ["--repo", repo, "--expected-head", "main"], ["--repo", repo, "--expected-head", "0".repeat(40)],
    ["render", "--revision", pin.toUpperCase()], ["render", "--revision", "0".repeat(40)], ["render", "--revision"],
    ["render", "--revision", pin, "--apply"], ["--repo", repo, "--expected-head", head, "--apply", "--apply"]]) {
    const f = fixture(), result = await onboardIdentity(args, { gh: f.gh });
    assert.equal(result.outcome, "refused", args.join(" ")); assert.deepEqual(f.calls, []);
  }
  const cli = spawnSync(process.execPath, ["scripts/onboard-commit-author-identity.mjs", "--apply"]);
  assert.equal(cli.status, 1); assert.equal(JSON.parse(cli.stdout).outcome, "refused");
});

// Break caught: a default invocation must remain a useful JSON plan with zero settings mutations.
test("dry-run plans only two scoped changes and leaves unrelated state intact", async () => {
  const f = fixture(), before = clone(f.permissions), rules = clone(f.rules);
  const result = await onboardIdentity(["--repo", repo], { gh: f.gh });
  assert.equal(result.outcome, "dry_run"); assert.equal(result.head, head); assert.equal(result.repository_id, 10);
  assert.deepEqual(result.changes.map(c => c.method), ["PUT", "POST"]);
  assert.deepEqual(result.changes[0].payload, { can_approve_pull_request_reviews: false });
  assert.deepEqual(f.permissions, before); assert.deepEqual(f.rules, rules); assert.deepEqual(mutations(f), []);
});

// Break caught: apply must preserve existing protections/default permissions and independently observe the new ID.
test("canonical owner apply changes only approval and creates the additive exact rule", async () => {
  const f = fixture(), old = clone(f.rules);
  const result = await run(f);
  assert.equal(result.outcome, "configured_not_live_qualification"); assert.equal(result.identity_ruleset_id, 900);
  assert.deepEqual(f.rules[0], old[0]); assert.deepEqual(f.rules[1], canonical(900));
  assert.deepEqual(f.permissions, { default_workflow_permissions: "write", can_approve_pull_request_reviews: false, unrelated: "preserved" });
  assert.deepEqual(mutations(f).map(c => [c.method, c.body]), [["PUT", { can_approve_pull_request_reviews: false }], ["POST", policy.ruleset]]);
  assert.ok(result.writes.every(write => write.state === "verified"));
  f.calls = [];
  const repeat = await run(f);
  assert.equal(repeat.identity_ruleset_id, 900); assert.deepEqual(mutations(f), []);
});

// Break caught: inherited rules on later pages must prevent creation of a duplicate repo rule.
test("one exact inherited rule beyond page one is an idempotent no-op", async () => {
  const f = fixture(); f.permissions.can_approve_pull_request_reviews = false;
  f.rules = [...Array.from({ length: 101 }, (_, i) => otherRule(i + 1)), canonical(200, true)];
  const result = await run(f);
  assert.equal(result.outcome, "configured_not_live_qualification"); assert.equal(result.identity_ruleset_id, 200);
  assert.deepEqual(mutations(f), []); assert.equal(result.preserved_ruleset_ids.length, 102);
});

// Break caught: only the actual human owner may activate settings, including an otherwise idempotent apply.
test("wrong or unknown authenticated actor is refused", async () => {
  for (const actor of [{ type: "Bot", login: "777genius" }, { type: "User", login: "alice" }, {}, null]) {
    const f = fixture(); f.actor = actor; await refused(f, /Authenticated owner/u);
  }
});

// Break caught: a renamed/transferred, archived, disabled, or incompletely observed repo must not be administered.
test("repository identity and explicit enabled state fail closed", async () => {
  for (const change of [{ id: null }, { archived: true }, { disabled: true }, { disabled: undefined }, { archived: undefined },
    { owner: { login: "other", type: "Organization" } }, { full_name: "agent-teams-ai/renamed" }, { default_branch: null }]) {
    const f = fixture(); Object.assign(f.repository, change); await refused(f, /repository/u);
  }
  const f = fixture(); f.head = "main"; await refused(f, /default branch\/head/u);
});

// Break caught: an old review cannot authorize a new immutable default head.
test("stale expected head is refused", async () => {
  const f = fixture(); f.head = "c".repeat(40); await refused(f, /Stale expected head/u);
});

// Break caught: a workflow with extra code/filters, wrong pin or absent caller cannot activate enforcement.
test("missing and noncanonical callers or target bytes fail closed", async () => {
  for (const caller of [null, template.replace("CENTRAL_REVISION", "main"), template.replace("CENTRAL_REVISION", "0".repeat(40)),
    template.replace("CENTRAL_REVISION", pin) + "# extra code\n", template.replace("CENTRAL_REVISION", pin).replace("synchronize, ", ""),
    template.replace("CENTRAL_REVISION", pin).replace("statuses: write", "statuses: read")]) {
    const f = fixture(); f.caller = caller === null ? null : Buffer.from(caller);
    await refused(f, /missing|Caller|trusted caller/u);
  }
  const f = fixture(); f.target = Buffer.from("untrusted workflow\n"); await refused(f, /trusted implementation/u);
});

// Break caught: Contents resolution alone can hide symlink/submodule files or incomplete trees.
test("regular immutable files are mandatory for callers, target and central authority", async () => {
  for (const p of [callerPath, implementationPath, policyPath, templatePath]) for (const mode of ["120000", "160000"]) {
    const f = fixture(); f.modes[p] = mode; await refused(f, /regular Git file/u);
  }
  for (const mode of ["120000", "160000"]) {
    const f = fixture(); f.refModes = { [`${pin}:${implementationPath}`]: mode }; await refused(f, /regular Git file/u);
  }
  const f = fixture(); f.truncated = true; await refused(f, /Incomplete immutable/u);
});

// Break caught: a locally retained but obsolete policy/template/implementation cannot become a remote authority.
test("all current central authority bytes must match this checkout", async () => {
  for (const p of [policyPath, templatePath, implementationPath]) {
    const f = fixture(); f.authorityFiles[p] = Buffer.concat([files[p], Buffer.from("\n")]);
    await refused(f, /current central authority/u);
  }
});

// Break caught: changed local policy bytes or local symlinks must not supply settings, even if API bytes look canonical.
test("checkout authority must be unchanged regular immutable Git files", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "identity-checkout-"));
  try {
    const gitDir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], { encoding: "utf8" }).trim();
    await writeFile(path.join(temporary, ".git"), `gitdir: ${gitDir}\n`);
    for (const [p, bytes] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(temporary, p)), { recursive: true }); await writeFile(path.join(temporary, p), bytes);
    }
    for (const kind of ["changed", "symlink"]) {
      const p = path.join(temporary, policyPath);
      await rm(p);
      if (kind === "changed") { await writeFile(p, Buffer.concat([files[policyPath], Buffer.from("\n")])); }
      else { await symlink(path.resolve(policyPath), p); }
      const f = fixture(), result = await onboardIdentity(["--repo", repo], { gh: f.gh, checkout: temporary });
      assert.equal(result.outcome, "refused"); assert.match(result.error, /immutable Git file|regular checkout file/u); assert.deepEqual(f.calls, []);
    }
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

// Break caught: absent/unknown org or repo approval values must not be guessed or silently broadened.
test("organization false and known repository permissions are required", async () => {
  for (const scope of ["permissions", "organizationPermissions"]) for (const value of [undefined, null, "false", ...(scope === "organizationPermissions" ? [true] : [])]) {
    const f = fixture(); f[scope].can_approve_pull_request_reviews = value;
    await refused(f, /Unknown Actions|explicitly false/u);
  }
  const f = fixture(); delete f.permissions.default_workflow_permissions; await refused(f, /Unknown Actions/u);
});

// Break caught: additive administration must refuse competing/changed dedicated rules rather than overwrite them.
test("ambiguous or mismatched dedicated rules are never mutated", async () => {
  const f = fixture(); f.rules.push(canonical(20), canonical(21, true)); await refused(f, /Ambiguous/u);
  for (const mutate of [r => { r.enforcement = "disabled"; }, r => { r.bypass_actors = [{ actor_id: 1 }]; },
    r => { r.conditions.ref_name.include = ["~ALL"]; }, r => { r.rules[0].parameters.required_status_checks[0].integration_id = 1; },
    r => { r.rules.push({ type: "deletion" }); }]) {
    const g = fixture(), rule = canonical(); mutate(rule); g.rules.push(rule); await refused(g, /Identity rule/u);
  }
  const g = fixture(); g.badPages = {}; await refused(g, /ruleset pages/u);
});

// Break caught: metadata may move after the initial plan but before settings mutation.
test("repository ID, branch or head movement before mutation stops with zero writes", async () => {
  for (const mutate of [f => { f.repository.id = 50; }, f => { f.repository.default_branch = "trunk"; }, f => { f.head = "c".repeat(40); }]) {
    const f = fixture(); f.before = call => { if (call.endpoint === `repos/${repo}` && f.repoReads === 4) { mutate(f); } };
    await refused(f, /changed|moved|Stale/u);
  }
  const f = fixture(); let reads = 0;
  f.before = call => { if (call.endpoint === "user" && ++reads === 2) { f.actor.login = "alice"; } };
  await refused(f, /Authenticated owner/u);
});

// Break caught: changed central authority between review and administration must stop activation.
test("central authority movement before mutation is refused", async () => {
  const f = fixture();
  f.before = call => { if (call.endpoint === "user") { f.authority = "d".repeat(40); } };
  await refused(f, /changed|moved/u);
});

// Break caught: concurrent rules/permission drift must not make an old plan silently overwrite unknown state.
test("settings movement before mutation requires a new plan", async () => {
  for (const mutate of [f => { f.permissions.default_workflow_permissions = "read"; }, f => { f.rules.push(otherRule(2)); }]) {
    const f = fixture(); let changed = false;
    f.before = call => { if (call.endpoint === "user" && !changed) { changed = true; mutate(f); } };
    await refused(f, /Remote state changed/u);
  }
});

// Break caught: timeout after a real effect cannot safely be retried or reported as a successful configuration.
test("uncertain permission or rule mutations stop once and report partial application", async () => {
  for (const method of ["PUT", "POST"]) {
    const f = fixture(); f.uncertain = method;
    if (method === "POST") { f.permissions.can_approve_pull_request_reviews = false; }
    const result = await run(f);
    assert.equal(result.outcome, "partial_application"); assert.match(result.error, /timed out/u);
    assert.equal(mutations(f).length, 1); assert.equal(result.writes[0].state, "attempted_uncertain");
    assert.match(result.recovery, /no automatic retry or rollback/u);
  }
});

// Break caught: later failure must retain verified earlier effects and stop before subsequent writes.
test("later creation failure explicitly reports the verified permission change", async () => {
  const f = fixture(); f.uncertain = "POST";
  const result = await run(f);
  assert.equal(result.outcome, "partial_application"); assert.deepEqual(result.writes.map(w => w.state), ["verified", "attempted_uncertain"]);
  assert.equal(f.permissions.can_approve_pull_request_reviews, false); assert.equal(mutations(f).length, 2);
});

// Break caught: response success without correct permissions/rule ID or a stable head is not verified success.
test("post-write metadata, permissions and created-ID failures stop without further writes", async () => {
  for (const mutate of [f => { f.head = "c".repeat(40); }, f => { f.repository.id = 99; },
    f => { f.permissions.default_workflow_permissions = "read"; }, f => { f.rules[0].rules = []; },
    f => { f.permissions.can_approve_pull_request_reviews = true; }]) {
    const f = fixture(); f.afterWrite = () => mutate(f);
    const result = await run(f);
    assert.equal(result.outcome, "partial_application"); assert.equal(mutations(f).length, 1);
    assert.equal(result.writes[0].state, "response_received_unverified");
  }
  const f = fixture(); f.permissions.can_approve_pull_request_reviews = false; f.badResponse = true;
  const result = await run(f); assert.equal(result.outcome, "partial_application"); assert.match(result.error, /created ruleset ID/u);
  assert.equal(mutations(f).length, 1);
});
