import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertActionsWorkflowPermissions, assertIdentityCaller, assertIdentityRuleset, assertRegularGitFile } from "./audit-commit-author-identity.mjs";

const checkoutRoot = fileURLToPath(new URL("../", import.meta.url));
const central = "agent-teams-ai/.github";
const policyPath = "governance/commit-author-identity.json";
const templatePath = "scripts/fixtures/commit-author-identity-caller.yml";
const implementationPath = ".github/workflows/commit-author-identity-check.yml";
const callerPath = ".github/workflows/commit-author-identity.yml";
const isSha = value => typeof value === "string" && /^(?!0{40}$)[0-9a-f]{40}$/u.test(value);
const isId = value => Number.isSafeInteger(value) && value > 0;
const usage = "render --revision SHA | --repo agent-teams-ai/REPO [--expected-head SHA] [--apply]";

function inputs(argv) {
  const render = argv[0] === "render", values = {};
  for (let i = render ? 1 : 0; i < argv.length; i++) {
    const flag = argv[i];
    assert.ok(!Object.hasOwn(values, flag), `Repeated flag: ${flag}`);
    if (!render && flag === "--apply") { values[flag] = true; continue; }
    assert.ok((render ? ["--revision"] : ["--repo", "--expected-head"]).includes(flag), `Unknown flag; ${usage}`);
    const value = argv[++i];
    assert.ok(typeof value === "string" && value.length > 0 && !value.startsWith("--"), `Missing value for ${flag}`);
    values[flag] = value;
  }
  if (render) {
    assert.ok(isSha(values["--revision"]), "Revision must be a nonzero lowercase 40-hex SHA");
    return { render: values["--revision"] };
  }
  const repo = values["--repo"], head = values["--expected-head"], apply = values["--apply"] === true;
  assert.ok(typeof repo === "string" && /^agent-teams-ai\/[a-zA-Z0-9_.-]{1,100}$/u.test(repo) &&
    ![".", ".."].includes(repo.split("/")[1]), "Repository must be agent-teams-ai/REPO");
  assert.notEqual(repo.toLowerCase(), central, "Central is bootstrapped separately");
  assert.ok(head === undefined || isSha(head), "Expected head must be a nonzero lowercase 40-hex SHA");
  assert.ok(!apply || head, "--apply requires --expected-head from a reviewed dry-run");
  return { repo, head, apply };
}

async function localFile(checkout, revision, relativePath) {
  // Read only immutable Git objects; reject changed working bytes and symlinks too.
  let directory = checkout;
  for (const segment of relativePath.split("/").slice(0, -1)) {
    directory = path.join(directory, segment);
    assert.ok((await lstat(directory)).isDirectory(), `Not a regular checkout directory: ${directory}`);
  }
  assert.ok((await lstat(path.join(checkout, relativePath))).isFile(), `Not a regular checkout file: ${relativePath}`);
  const git = args => execFileSync("git", args, { cwd: checkout, maxBuffer: 16 * 1024 * 1024 });
  const entry = git(["ls-tree", revision, "--", relativePath]).toString().trim();
  const match = /^(\d{6}) (\w+) ([0-9a-f]{40})\t(.+)$/u.exec(entry);
  assert.ok(match, `Missing immutable checkout file: ${relativePath}`);
  assertRegularGitFile({ truncated: false, tree: [{ mode: match[1], type: match[2], sha: match[3], path: match[4] }] }, relativePath, { sha: match[3] });
  const bytes = git(["show", `${revision}:${relativePath}`]);
  assert.deepEqual(await readFile(path.join(checkout, relativePath)), bytes, `Checkout differs from immutable Git file: ${relativePath}`);
  return bytes;
}

function permissions(actual) {
  assert.ok(actual && ["read", "write"].includes(actual.default_workflow_permissions) &&
    typeof actual.can_approve_pull_request_reviews === "boolean", "Unknown Actions workflow permissions");
  return actual;
}

// One injectable gh boundary; neither this adapter nor the use case retries writes.
function ghApi(method, endpoint, { body, paginate = false } = {}) {
  const args = ["api", "--hostname", "github.com", "--method", method, endpoint];
  if (paginate) { args.push("--paginate", "--slurp"); }
  if (body !== undefined) { args.push("--input", "-"); }
  const stdout = execFileSync("gh", args, { encoding: "utf8", input: body === undefined ? undefined : JSON.stringify(body),
    timeout: 30_000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GH_HOST: "github.com" } });
  return stdout.trim() ? JSON.parse(stdout) : null;
}

export async function onboardIdentity(argv, { gh = ghApi, checkout = checkoutRoot } = {}) {
  const writes = [];
  const result = { writes };
  try {
    const options = inputs(argv);
    const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: checkout, encoding: "utf8" }).trim();
    assert.ok(isSha(revision), "Unknown checkout revision");
    const template = await localFile(checkout, revision, templatePath);
    if (options.render) { return Buffer.from(template.toString().replace("CENTRAL_REVISION", options.render)); }
    Object.assign(result, { mode: options.apply ? "apply" : "dry_run", repository: options.repo });
    const files = { [templatePath]: template, [policyPath]: await localFile(checkout, revision, policyPath),
      [implementationPath]: await localFile(checkout, revision, implementationPath) };
    const policy = JSON.parse(files[policyPath]);
    assert.equal(policy.owner?.login, "777genius", "Canonical owner must be 777genius");
    assertActionsWorkflowPermissions(policy.actions_workflow_permissions, policy.actions_workflow_permissions);
    const root = `repos/${options.repo}`, centralRoot = `repos/${central}`;
    const get = endpoint => gh("GET", endpoint);

    async function repository(fullName) {
      const repo = await get(`repos/${fullName}`);
      assert.ok(isId(repo?.id) && repo.full_name === fullName && repo.owner?.login === "agent-teams-ai" &&
        repo.owner.type === "Organization" && repo.archived === false && repo.disabled === false &&
        typeof repo.default_branch === "string" && repo.default_branch.length > 0 && !repo.default_branch.includes("\0"),
      "Unknown, foreign, archived or disabled repository");
      const branch = await get(`repos/${fullName}/branches/${encodeURIComponent(repo.default_branch)}`);
      assert.ok(branch?.name === repo.default_branch && isSha(branch.commit?.sha), "Unknown default branch/head");
      return { id: repo.id, full_name: fullName, default_branch: repo.default_branch, head: branch.commit.sha };
    }
    async function bound(state, afterWrite = false) {
      if (afterWrite) { assert.deepEqual(await repository(options.repo), state.repository, "Repository ID/default branch/head moved after write"); }
      assert.deepEqual(await repository(central), state.authority, "Central authority moved");
      // These are the last reads before each write, and the first binding check after it.
      assert.deepEqual(await repository(options.repo), state.repository, "Repository ID/default branch/head moved");
    }
    async function gitFiles(repoRoot, ref, paths) {
      const tree = await get(`${repoRoot}/git/trees/${ref}?recursive=true`);
      const bytes = {};
      for (const filePath of paths) {
        const file = await get(`${repoRoot}/contents/${filePath}?ref=${ref}`);
        assert.ok(file?.type === "file" && file.encoding === "base64" && typeof file.content === "string" && isSha(file.sha), "Unknown Git file content");
        assertRegularGitFile(tree, filePath, file);
        bytes[filePath] = Buffer.from(file.content, "base64");
      }
      return bytes;
    }
    async function rulesets() {
      const pages = await gh("GET", `${root}/rulesets?includes_parents=true&per_page=100`, { paginate: true });
      assert.ok(Array.isArray(pages) && pages.length > 0 && pages.every(Array.isArray), "Unknown/incomplete ruleset pages");
      const listed = pages.flat();
      assert.ok(listed.every(rule => isId(rule?.id) && typeof rule.name === "string" &&
        ["Repository", "Organization"].includes(rule.source_type) && typeof rule.source === "string") &&
        new Set(listed.map(rule => rule.id)).size === listed.length, "Unknown/duplicate rulesets");
      const detailed = [];
      for (const rule of listed) {
        const detail = await get(`${root}/rulesets/${rule.id}?includes_parents=true`);
        assert.ok(detail?.id === rule.id && detail.name === rule.name && detail.source === rule.source &&
          detail.source_type === rule.source_type, "Ruleset identity changed");
        detailed.push(detail);
      }
      const candidates = detailed.filter(rule => rule.name === policy.ruleset.name);
      assert.ok(candidates.length <= 1, "Ambiguous dedicated identity rulesets");
      if (candidates.length) { assertIdentityRuleset(candidates[0], policy.ruleset); }
      return detailed.toSorted((a, b) => a.id - b.id);
    }
    async function inspect() {
      const authority = await repository(central);
      const observed = await gitFiles(centralRoot, authority.head, Object.keys(files));
      for (const filePath of Object.keys(files)) {
        assert.deepEqual(observed[filePath], files[filePath], `Checkout differs from current central authority: ${filePath}`);
      }
      const repo = await repository(options.repo);
      assert.ok(!options.head || options.head === repo.head, "Stale expected head; review a fresh dry-run");
      const caller = (await gitFiles(root, repo.head, [callerPath]))[callerPath];
      const pin = assertIdentityCaller(caller, template);
      const target = (await gitFiles(centralRoot, pin, [implementationPath]))[implementationPath];
      assert.deepEqual(target, files[implementationPath], "Caller target differs from current trusted implementation");
      const organizationPermissions = permissions(await get("orgs/agent-teams-ai/actions/permissions/workflow"));
      assertActionsWorkflowPermissions(organizationPermissions, policy.actions_workflow_permissions);
      const state = { authority, repository: repo, pin, organization_permissions: organizationPermissions,
        permissions: permissions(await get(`${root}/actions/permissions/workflow`)), rulesets: await rulesets() };
      await bound(state);
      return state;
    }
    async function owner() {
      const actor = await get("user");
      assert.ok(actor?.type === "User" && actor.login === policy.owner.login, "Authenticated owner must be User/777genius");
    }
    let state = await inspect();
    const existing = state.rulesets.find(rule => rule.name === policy.ruleset.name);
    const changes = [];
    if (state.permissions.can_approve_pull_request_reviews) {
      changes.push({ method: "PUT", endpoint: `${root}/actions/permissions/workflow`, payload: { can_approve_pull_request_reviews: false } });
    }
    if (!existing) { changes.push({ method: "POST", endpoint: `${root}/rulesets`, payload: policy.ruleset }); }
    Object.assign(result, { repository_id: state.repository.id, default_branch: state.repository.default_branch, head: state.repository.head,
      central_authority_head: state.authority.head, caller_revision: state.pin, changes, existing_identity_ruleset_id: existing?.id ?? null,
      preserved_ruleset_ids: state.rulesets.map(rule => rule.id), target_posture: "configured_not_live_qualification" });
    if (!options.apply) { return { ...result, outcome: "dry_run" }; }
    await owner();
    for (const change of changes) {
      const ready = await inspect();
      assert.deepEqual(ready, state, "Remote state changed before mutation; inspect a fresh plan");
      await owner();
      await bound(state);
      const write = { ...change, state: "attempted_uncertain" };
      writes.push(write);
      let response;
      try {
        response = await gh(change.method, change.endpoint, { body: change.payload });
        write.state = "response_received_unverified";
      } catch (error) {
        // Observe identity after an uncertain effect, but never retry or roll back it.
        try { await bound(state, true); } catch (bindingError) { write.post_write_binding_error = bindingError.message; }
        throw error;
      }
      await bound(state, true);
      if (change.method === "POST") {
        assert.ok(isId(response?.id) && !state.rulesets.some(rule => rule.id === response.id) &&
          response.source_type === "Repository" && response.source === options.repo, "Unknown created ruleset ID/source");
        assertIdentityRuleset(response, policy.ruleset);
        write.ruleset_id = response.id;
      }
      const after = await inspect();
      const expectedPermissions = change.method === "PUT" ? { ...state.permissions, can_approve_pull_request_reviews: false } : state.permissions;
      assert.deepEqual(after.permissions, expectedPermissions, "Permissions postcondition/unrelated fields changed");
      assert.deepEqual(after.repository, state.repository, "Repository moved after write");
      assert.deepEqual(after.authority, state.authority, "Central authority moved after write");
      assert.deepEqual(after.organization_permissions, state.organization_permissions, "Organization permissions changed");
      assert.equal(after.pin, state.pin, "Caller pin changed");
      const oldRules = after.rulesets.filter(rule => state.rulesets.some(old => old.id === rule.id));
      assert.deepEqual(oldRules, state.rulesets, "Existing protections changed");
      if (change.method === "POST") {
        assert.equal(after.rulesets.length, state.rulesets.length + 1, "Unexpected ruleset changes");
        const created = after.rulesets.find(rule => rule.id === response.id);
        assert.ok(created?.source_type === "Repository" && created.source === options.repo, "Created rule ID/source not observed");
        assertIdentityRuleset(created, policy.ruleset);
      } else { assert.deepEqual(after.rulesets, state.rulesets, "Rulesets changed during permission update"); }
      write.state = "verified";
      state = after;
    }
    const final = await inspect();
    assert.deepEqual(final, state, "Remote state changed during final verification");
    assertActionsWorkflowPermissions(final.permissions, policy.actions_workflow_permissions);
    const rule = final.rulesets.find(value => value.name === policy.ruleset.name);
    assertIdentityRuleset(rule, policy.ruleset);
    return { ...result, outcome: "configured_not_live_qualification", identity_ruleset_id: rule.id, final_permissions: final.permissions };
  } catch (error) {
    return { ...result, outcome: writes.length ? "partial_application" : "refused", error: error.message,
      recovery: "Inspect current remote state and a fresh dry-run before another explicit apply; no automatic retry or rollback was attempted." };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await onboardIdentity(process.argv.slice(2));
  process.stdout.write(Buffer.isBuffer(result) ? result : `${JSON.stringify(result, null, 2)}\n`);
  if (result.error) { process.exitCode = 1; }
}
