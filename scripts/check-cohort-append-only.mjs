import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { loadJson } from "./governance-policy.mjs";
import {
  assertDocsCohortAppendOnly,
  validateDocsQualifiedCohorts,
} from "./docs-cohort-policy.mjs";
import { parseJsonStrict } from "./verify-docs-consumer-gate.mjs";

const execFileAsync = promisify(execFile);
const path = "governance/docs-qualified-cohorts.json";
const base = process.env["GITHUB_BASE_REF"];
const currentPath = process.env["DOCS_COHORT_CURRENT_PATH"] ?? path;
const previousPath = process.env["DOCS_COHORT_BASE_PATH"];
const schemaPath = process.env["DOCS_COHORT_SCHEMA_PATH"] ??
  "governance/docs-qualified-cohorts.schema.json";
const REGISTRY_LIMIT = 8 * 1024 * 1024;

async function loadRegistry(pathname) {
  return parseJsonStrict(
    await readFile(pathname, "utf8"),
    pathname,
    REGISTRY_LIMIT,
  );
}

async function loadPrevious(reference, current) {
  try {
    const { stdout } = await execFileAsync("git", ["show", `${reference}:${path}`], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      timeout: 30_000,
    });
    return JSON.parse(stdout);
  } catch (error) {
    if (error?.code !== 128) {
      throw error;
    }
    await execFileAsync("git", ["cat-file", "-e", `${reference}^{commit}`], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      timeout: 30_000,
    });
    try {
      await execFileAsync("git", ["cat-file", "-e", `${reference}:${path}`], {
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        timeout: 30_000,
      });
    } catch (pathError) {
      if ([1, 128].includes(pathError?.code)) {
        return { ...current, cohorts: [], events: [] };
      }
      throw pathError;
    }
    throw error;
  }
}

const event = process.env["GITHUB_EVENT_NAME"];
if (previousPath !== undefined) {
  const [previous, current, schema] = await Promise.all([
    loadRegistry(previousPath),
    loadRegistry(currentPath),
    loadJson(schemaPath),
  ]);
  validateDocsQualifiedCohorts(current, schema);
  assertDocsCohortAppendOnly(previous, current);
  console.log("Qualified Docs Cohort head is schema-valid, lifecycle-valid, digest-bound, and append-only against the trusted base.");
} else if (["pull_request", "merge_group"].includes(event) && base !== undefined) {
  const current = await loadRegistry(currentPath);
  validateDocsQualifiedCohorts(current, await loadJson(schemaPath));
  assertDocsCohortAppendOnly(await loadPrevious(`origin/${base}`, current), current);
  console.log("Qualified Docs Cohort registry is append-only against the reviewed base.");
} else if (event === "push") {
  const current = await loadRegistry(currentPath);
  assertDocsCohortAppendOnly(await loadPrevious("HEAD^", current), current);
  console.log("Qualified Docs Cohort registry is append-only against the pushed parent.");
} else {
  console.log("Qualified Docs Cohort append-only comparison is pull-request scoped.");
}
