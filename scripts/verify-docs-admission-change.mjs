#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { isDeepStrictEqual } from "node:util";
import { loadJson, validateDocsProtocolPolicy } from "./governance-policy.mjs";
import { validateDocsGovernanceReferences, validateDocsProtocolExceptions } from "./docs-cohort-policy.mjs";
import { verifyDocsAdmissionEvidence } from "./verify-docs-cohort-evidence.mjs";
import { POLICY_PATH, REGISTRY_PATH,
  recoveryBlob, prepareAdmissionRecovery, finishAdmissionRecovery } from "./docs-legacy-admission-recovery.mjs";

const execute = promisify(execFile);
const need = (condition, message) => { if (!condition) throw new Error(message); };
const now = () => new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");
async function api(path) {
  const { stdout } = await execute("gh", ["api", path], { encoding: "utf8", timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(stdout);
}
export async function readAdmissionBaseFile(path, revision) {
  need(/^(?!0{40}$)[0-9a-f]{40}$/u.test(revision) && /^[a-zA-Z0-9_./-]+$/u.test(path) &&
    path.split("/").every((part) => part && part !== "." && part !== ".."), "Invalid base Git coordinate.");
  const { stdout: entry } = await execute("git", ["ls-tree", revision, "--", path], { encoding: "utf8" });
  if (entry === "") return null;
  const match = /^100644 blob ([0-9a-f]{40})\t([^\n]+)\n$/u.exec(entry);
  need(match && match[2] === path, "Admission authority must be one regular base-owned file.");
  const { stdout } = await execute("git", ["cat-file", "blob", match[1]], { encoding: "buffer", maxBuffer: 8 * 1024 * 1024 });
  need(recoveryBlob(stdout) === match[1], "Base Git blob content mismatch.");
  return stdout;
}

export async function verifyAdmissionController(execution, read = api) {
  need(execution?.controller?.repository === "agent-teams-ai/.github" &&
    execution.controller.repository_id === 1316243981 &&
    Number.isSafeInteger(execution.pull_number) && execution.pull_number > 0 &&
    execution.execution_base === execution.base && execution.head !== execution.base &&
    [execution.base, execution.head].every((sha) => /^(?!0{40}$)[0-9a-f]{40}$/u.test(sha)),
  "Admission execution must bind the central repository/PR/base/head.");
  const repo = execution.controller.repository;
  const [controller, pull] = await Promise.all([read(`repos/${repo}`), read(`repos/${repo}/pulls/${execution.pull_number}`)]);
  const identity = (value) => value?.id === execution.controller.repository_id && value.full_name === repo;
  need(identity(controller) && controller.archived === false && controller.disabled === false &&
    identity(pull.base?.repo) && identity(pull.head?.repo) && pull.number === execution.pull_number &&
    pull.state === "open" && pull.merged === false && pull.base.sha === execution.base && pull.head.sha === execution.head &&
    pull.base.ref === controller.default_branch && pull.changed_files === execution.changed_files.length,
  "Live admission controller/PR identity or exact tuple changed.");
  const branch = await read(`repos/${repo}/branches/${controller.default_branch}`);
  need(branch.commit?.sha === execution.base, "Live central default head changed during admission verification.");
  return execution;
}

export async function verifyDocsAdmissionChange(paths, overrides = {}) {
  const [policyBytes, basePolicyBytes, exceptionsBytes, registryBytes, policySchema, exceptionsSchema, registrySchema, security] =
    await Promise.all([
      readFile(paths.policy), readFile(POLICY_PATH), readFile(paths.exceptions), readFile(REGISTRY_PATH),
      loadJson("governance/docs-protocol-policy-v2.schema.json"),
      loadJson("governance/docs-protocol-exceptions.schema.json"),
      loadJson("governance/docs-qualified-cohorts.schema.json"), loadJson("governance/code-security-defaults.json"),
    ]);
  const policy = JSON.parse(policyBytes);
  const basePolicy = JSON.parse(basePolicyBytes);
  const exceptions = JSON.parse(exceptionsBytes);
  const registry = JSON.parse(registryBytes);
  // Neither document is projected or relaxed. Existing reference/lifecycle,
  // migration-edge, single-canary and repository-eligibility rules run first.
  validateDocsProtocolPolicy(policy, policySchema);
  validateDocsProtocolPolicy(basePolicy, policySchema);
  validateDocsProtocolExceptions(exceptions, exceptionsSchema);
  validateDocsGovernanceReferences(registry, exceptions, policy, security);
  const execution = paths.execution ? await loadJson(paths.execution) : overrides.execution;
  need(execution, "Trusted admission requires materialized execution coordinates.");
  const verifyController = overrides.verifyController ?? verifyAdmissionController;
  const readBaseFile = overrides.readBaseFile ?? readAdmissionBaseFile;
  const clock = overrides.clock ?? now;
  await verifyController(execution);
  need(isDeepStrictEqual(await readBaseFile(POLICY_PATH, execution.base), basePolicyBytes) &&
    isDeepStrictEqual(await readBaseFile(REGISTRY_PATH, execution.base), registryBytes), "Checkout authority is not the exact base.");
  // Lazy consumption preserves normal successful admissions even when another
  // PR has separately staged incident authority. No failed row can skip proof.
  let capability;
  const getCapability = async () => {
    capability ??= await prepareAdmissionRecovery({ execution, readBaseFile, asOf: clock(),
      basePolicyBytes, proposedPolicyBytes: policyBytes, registryBytes, exceptionsBytes });
    need(capability, "Current source failed without trusted base incident authorization.");
    return capability;
  };
  const report = await verifyDocsAdmissionEvidence(policy, registry, registrySchema, {
    ...overrides, basePolicy, requireCredential: true, recovery: { getCapability, execution },
  });
  // Controller and authority are re-read after the whole fleet, including
  // unrelated rows; a moving base never reuses an earlier result.
  await verifyController(execution);
  if (capability) {
    report.recovery = finishAdmissionRecovery(capability, execution, clock());
    need(isDeepStrictEqual(report.recovery.recovery_pending, report.recovery_pending.map((row) =>
      ({ repository_id: row.repository_id, source_head: row.source_head }))), "Pending source changed during retry.");
  }
  report.execution = execution;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const policy = process.env.DOCS_ADMISSION_POLICY_PATH;
  const exceptions = process.env.DOCS_ADMISSION_EXCEPTIONS_PATH;
  const execution = process.env.DOCS_ADMISSION_EXECUTION_PATH;
  need(policy && exceptions && execution, "Trusted admission verification requires materialized policy, exceptions and execution paths.");
  console.log(JSON.stringify(await verifyDocsAdmissionChange({ policy, exceptions, execution })));
}
