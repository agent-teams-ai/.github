import { readFile } from "node:fs/promises";

import { parse } from "yaml";

const reusablePath = ".github/workflows/reviewrouter-reusable.yml";
const callerPath = ".github/workflows/reviewrouter.yml";
const fullSha = /^[0-9a-f]{40}$/u;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadYaml(path) {
  return parse(await readFile(path, "utf8"));
}

const reusable = await loadYaml(reusablePath);
const caller = await loadYaml(callerPath);

assert(reusable.on?.workflow_call, `${reusablePath} must expose workflow_call.`);
assert(
  JSON.stringify(reusable.permissions) === JSON.stringify({ contents: "read" }),
  `${reusablePath} must default to contents: read.`
);

const review = reusable.jobs?.review;
assert(review, `${reusablePath} must define the review job.`);
assert(review.permissions?.contents === "read", "Review job must keep contents read-only.");
for (const permission of ["issues", "pull-requests", "statuses"]) {
  assert(review.permissions?.[permission] === "write", `Review job must grant ${permission}: write.`);
}

const externalUses = review.steps
  .map((step) => step.uses)
  .filter((value) => typeof value === "string" && !value.startsWith("./"));
for (const value of externalUses) {
  const [, reference = ""] = value.split("@");
  assert(fullSha.test(reference), `External action is not pinned to a full SHA: ${value}`);
}
assert(
  externalUses.includes("777genius/review-router@0924fc20a0e22a7d43928eb19418c1f2a2a2ab81"),
  "Shared workflow must use the reviewed ReviewRouter v1.0.76 commit."
);

assert(caller.on?.pull_request, `${callerPath} must run for pull requests.`);
assert(caller.on?.workflow_dispatch, `${callerPath} must support manual recovery dispatch.`);
assert(
  JSON.stringify(caller.permissions) === JSON.stringify({ contents: "read" }),
  `${callerPath} must default to contents: read.`
);
assert(
  caller.jobs?.review?.uses === "./.github/workflows/reviewrouter-reusable.yml",
  `${callerPath} must contain only the local reusable-workflow call.`
);
assert(caller.jobs.review.secrets === "inherit", `${callerPath} must pass repository secrets explicitly.`);

console.log("ReviewRouter workflow verified: one reusable implementation and one minimal caller.");
