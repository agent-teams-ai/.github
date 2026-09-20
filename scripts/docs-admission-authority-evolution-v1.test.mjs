import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/docs-admission-authority-evolution-v1.yml";
const workflow = await readFile(workflowPath, "utf8");

test("pins the exact admission verifier forward and rollback blobs", () => {
  assert.match(workflow, /e3f0f3d2e065b7c0ae324481a3056b7955a0702d/u);
  assert.match(workflow, /1bf455f2ca5bf97440e62b2ff4eaa6c36aa2212b/u);
  assert.match(workflow, /scripts\/verify-docs-admission-change\.mjs/u);
  assert.match(workflow, /pull\.base\.sha/u);
  assert.match(workflow, /pull_request_target:/u);
});

test("keeps the successor read-only and unable to authorize itself", () => {
  assert.match(workflow, /actions\/github-script@[0-9a-f]{40}/u);
  assert.match(workflow, /contents: read/u);
  assert.match(workflow, /pull-requests: read/u);
  assert.doesNotMatch(workflow, /actions\/checkout|\brun:/u);
  assert.match(workflow, /workflowPath/u);
  assert.match(workflow, /testPath/u);
  assert.match(workflow, /changed\.length !== 1/u);
});

test("rejects mixed, renamed, forked, or stale-base changes in source", () => {
  assert.match(workflow, /previous_filename !== undefined/u);
  assert.match(workflow, /head\.repo\?\.full_name/u);
  assert.match(workflow, /pull\.base\.ref !== controller\.data\.default_branch/u);
  assert.match(workflow, /branch\.data\.commit\.sha !== pull\.base\.sha/u);
  assert.match(workflow, /changed\.length !== 1/u);
});
