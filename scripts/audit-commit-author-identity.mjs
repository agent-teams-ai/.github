import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export function assertIdentityRuleset(actual, expected) {
  assert.ok(actual, "Missing identity ruleset");
  assert.deepEqual(Object.fromEntries(Object.keys(expected).map(key => [key, actual[key]])), expected,
    "Identity rule must be active, default-branch-only, without bypass, and require the exact app-bound status");
}
export function assertRegularGitFile(tree, path, file) {
  assert.equal(tree.truncated, false, "Incomplete immutable Git tree");
  const entries = tree.tree.filter(entry => entry.path === path);
  assert.ok(entries.length === 1 && entries[0].type === "blob" && ["100644", "100755"].includes(entries[0].mode) &&
    entries[0].sha === file.sha, "Caller/target must be a regular Git file with matching blob");
}
const api = endpoint => JSON.parse(execFileSync("gh", ["api", "--method", "GET", endpoint], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
const pages = endpoint => JSON.parse(execFileSync("gh", ["api", "--method", "GET", "--paginate", "--slurp", endpoint],
  { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })).flat();
export async function auditIdentity() {
  const policy = JSON.parse(await readFile(new URL("../governance/commit-author-identity.json", import.meta.url), "utf8"));
  const template = await readFile(new URL("fixtures/commit-author-identity-caller.yml", import.meta.url), "utf8");
  const implementation = await readFile(new URL("../.github/workflows/commit-author-identity-check.yml", import.meta.url), "utf8");
  const repositories = pages("orgs/agent-teams-ai/repos?type=all&per_page=100");
  assert.ok(repositories.length > 0 && new Set(repositories.map(repo => repo.id)).size === repositories.length, "Incomplete/duplicate inventory");
  const results = [];
  for (const repository of repositories.filter(repo => !repo.archived)) {
    try {
      assert.equal(repository.owner.login, "agent-teams-ai");
      const root = `repos/${repository.full_name}`;
      const rules = pages(`${root}/rulesets?includes_parents=true&per_page=100`);
      const candidates = rules.filter(rule => rule.name === policy.ruleset.name);
      assert.equal(candidates.length, 1, "Missing/ambiguous dedicated identity ruleset");
      assertIdentityRuleset(api(`${root}/rulesets/${candidates[0].id}`), policy.ruleset);
      const branch = api(`${root}/branches/${encodeURIComponent(repository.default_branch)}`);
      const caller = api(`${root}/contents/.github/workflows/commit-author-identity.yml?ref=${branch.commit.sha}`);
      assert.equal(caller.type, "file"); assert.equal(caller.encoding, "base64");
      assertRegularGitFile(api(`${root}/git/trees/${branch.commit.sha}?recursive=true`), ".github/workflows/commit-author-identity.yml", caller);
      const text = Buffer.from(caller.content, "base64").toString("utf8");
      const pin = /commit-author-identity-check\.yml@((?!0{40})[0-9a-f]{40})\s*$/u.exec(text)?.[1];
      assert.ok(pin || (repository.full_name === "agent-teams-ai/.github" && text.includes("uses: ./")), "Caller requires a nonzero immutable central revision");
      const expected = repository.full_name === "agent-teams-ai/.github" && text.includes("uses: ./")
        ? template.replace("agent-teams-ai/.github/.github/workflows/commit-author-identity-check.yml@CENTRAL_REVISION", "./.github/workflows/commit-author-identity-check.yml")
        : template.replace("CENTRAL_REVISION", pin ?? "INVALID");
      assert.equal(text, expected, "Missing/broken trusted caller");
      const target = api(`repos/agent-teams-ai/.github/contents/.github/workflows/commit-author-identity-check.yml?ref=${pin ?? branch.commit.sha}`);
      assertRegularGitFile(api(`repos/agent-teams-ai/.github/git/trees/${pin ?? branch.commit.sha}?recursive=true`), ".github/workflows/commit-author-identity-check.yml", target);
      assert.equal(target.type, "file"); assert.equal(target.encoding, "base64");
      assert.equal(Buffer.from(target.content, "base64").toString("utf8"), implementation, "Caller target differs from the implementation being audited");
      const current = api(root);
      assert.equal(current.id, repository.id); assert.equal(current.archived, false);
      assert.equal(current.default_branch, repository.default_branch, "Default branch identity moved during audit");
      assert.equal(api(`${root}/branches/${encodeURIComponent(repository.default_branch)}`).commit.sha, branch.commit.sha, "Default branch moved during audit");
      results.push({ repository: repository.full_name, head: branch.commit.sha, posture: "configured_not_live_qualification" });
    } catch (error) { results.push({ repository: repository.full_name, error: error.message }); }
  }
  process.stdout.write(`${JSON.stringify({ visible_active_repositories: results.length, results }, null, 2)}\n`);
  if (results.some(result => result.error)) { process.exitCode = 1; }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { await auditIdentity(); }
