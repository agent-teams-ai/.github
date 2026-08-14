import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import YAML from "yaml";

import { validateDocsProtocolWorkflow } from "./check-community-files.mjs";

const source = await readFile(".github/workflows/docs-protocol-check.yml", "utf8");
const workflow = YAML.parse(source);
const clone = (value) => structuredClone(value);

test("accepts the fixed documentation protocol reusable workflow", () => {
  assert.doesNotThrow(() => validateDocsProtocolWorkflow(clone(workflow), source));
});

test("rejects forbidden documentation protocol job capabilities", () => {
  for (const field of ["permissions", "env", "container", "defaults"]) {
    const changed = clone(workflow);
    changed.jobs["docs-protocol-check"][field] = {};
    assert.throws(
      () => validateDocsProtocolWorkflow(changed, YAML.stringify(changed)),
      /job shape, runner, and timeout/u,
    );
  }
});

test("rejects a documentation protocol workflow on the wrong runner or timeout", () => {
  for (const [field, value] of [["runs-on", "ubuntu-latest"], ["timeout-minutes", 30]]) {
    const changed = clone(workflow);
    changed.jobs["docs-protocol-check"][field] = value;
    assert.throws(
      () => validateDocsProtocolWorkflow(changed, YAML.stringify(changed)),
      /job shape, runner, and timeout/u,
    );
  }
});

test("rejects root defaults, environment, or a second documentation protocol job", () => {
  for (const mutate of [
    (changed) => { changed.env = {}; },
    (changed) => { changed.defaults = {}; },
    (changed) => { changed.jobs.extra = clone(changed.jobs["docs-protocol-check"]); },
  ]) {
    const changed = clone(workflow);
    mutate(changed);
    assert.throws(() => validateDocsProtocolWorkflow(changed, YAML.stringify(changed)));
  }
});
