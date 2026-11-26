import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";
import { parseDocument } from "yaml";
import {
  B304_RECOVERY_AUTHORITY_PATH,
  B304_RECOVERY_PROOF_PATH,
  verifyB304IncidentArchive,
  verifyB304RecoveryStaging,
} from "./docs-b304-registry-incident.ts";
import type { B304IncidentAdapters } from "./docs-b304-registry-incident.ts";

type Mapping = Record<string, unknown>;
type Mode = "archive" | "stage";
type ReadBaseFile = (path: string, revision: string) => Promise<Buffer | null>;
interface Execution {
  controller: { repository: string; repository_id: number };
  pull_number: number;
  pull_id: number;
  head_ref: string;
  run_id: number;
  run_attempt: number;
  base: string;
  head: string;
  execution_base: string;
  changed_files: string[];
}
export interface B304StagingPorts {
  readBaseFile: ReadBaseFile;
  readTree(this: void, revision: string): Promise<Buffer>;
  isAncestor(this: void, base: string, head: string): Promise<boolean>;
  readApi(this: void, path: string): Promise<unknown>;
  verifyController(this: void, execution: unknown): Promise<void>;
  incident: B304IncidentAdapters;
  archive: typeof verifyB304IncidentArchive;
  stage: typeof verifyB304RecoveryStaging;
}

const CENTRAL = "agent-teams-ai/.github";
const CENTRAL_ID = 1316243981;
const POLICY = "governance/docs-protocol-policy-v2.json";
const REGISTRY = "governance/docs-qualified-cohorts.json";
const EXCEPTIONS = "governance/docs-protocol-exceptions.json";
const SHA = /^(?!0{40}$)[0-9a-f]{40}$/u;
const MAX_BYTES = 1024 * 1024;
const execute = promisify(execFile);
function need(value: unknown, message: string): asserts value {
  assert.ok(value, "B304 staging: " + message);
}
function isMapping(value: unknown): value is Mapping {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function object(value: unknown): Mapping {
  need(isMapping(value), "object required");
  return value;
}
function text(value: unknown): string {
  need(typeof value === "string" && value.length > 0, "nonempty string required");
  return value;
}
function positive(value: unknown): number {
  need(
    typeof value === "number" && Number.isSafeInteger(value) && value > 0,
    "positive ID required",
  );
  return value;
}
function sha(value: unknown): string {
  need(typeof value === "string" && SHA.test(value), "immutable Git SHA required");
  return value;
}
function blob(bytes: Buffer): string {
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}
function json(bytes: Buffer): unknown {
  need(bytes.length > 0 && bytes.length <= MAX_BYTES, "bounded nonempty JSON required");
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const document = parseDocument(source, { uniqueKeys: true });
  need(document.errors.length === 0, "duplicate or malformed JSON keys");
  const result: unknown = JSON.parse(source);
  return result;
}
function execution(value: unknown, file: string): Execution {
  const input = object(value);
  need(
    isDeepStrictEqual(
      Object.keys(input).toSorted(),
      "controller pull_number pull_id head_ref run_id run_attempt base head execution_base changed_files"
        .split(" ")
        .toSorted(),
    ),
    "closed ten-field execution required",
  );
  need(
    isDeepStrictEqual(input["controller"], { repository: CENTRAL, repository_id: CENTRAL_ID }),
    "central identity",
  );
  need(isDeepStrictEqual(input["changed_files"], [file]), "exact single-file staging execution");
  const base = sha(input["base"]),
    head = sha(input["head"]);
  need(base !== head && input["execution_base"] === base, "base-owned execution required");
  return {
    controller: { repository: CENTRAL, repository_id: CENTRAL_ID },
    pull_number: positive(input["pull_number"]),
    pull_id: positive(input["pull_id"]),
    head_ref: text(input["head_ref"]),
    run_id: positive(input["run_id"]),
    run_attempt: positive(input["run_attempt"]),
    base,
    head,
    execution_base: base,
    changed_files: [file],
  };
}
interface Leaf {
  type: "blob" | "tree";
  mode: string;
  sha: string;
}
function tree(bytes: Buffer): Map<string, Leaf> {
  need(
    bytes.length > 0 && bytes.length <= 16 * MAX_BYTES && bytes.at(-1) === 0,
    "complete Git leaf inventory",
  );
  const rows = new TextDecoder("utf-8", { fatal: true }).decode(bytes).split("\0").slice(0, -1);
  need(rows.length > 0 && rows.length <= 20000, "bounded Git leaf census");
  const result = new Map<string, Leaf>();
  for (const row of rows) {
    const match = /^(040000|100644|100755) (blob|tree) ([0-9a-f]{40})\t(.+)$/u.exec(row);
    need(match && match[1] && match[2] && match[3] && match[4], "regular complete Git inventory");
    const kind = match[2],
      path = match[4];
    need(kind === "blob" || kind === "tree", "Git entry kind");
    need((kind === "tree") === (match[1] === "040000"), "Git entry mode/type");
    need(
      path.split("/").every((part) => part && part !== "." && part !== "..") &&
        !/\p{Cc}/u.test(path) &&
        !result.has(path),
      "unique canonical Git path",
    );
    result.set(path, { type: kind, mode: match[1], sha: sha(match[3]) });
  }
  for (const path of result.keys()) {
    const separator = path.lastIndexOf("/");
    need(
      separator === -1 || result.get(path.slice(0, separator))?.type === "tree",
      "complete directory ancestry",
    );
  }
  return result;
}
async function singleChange(
  ports: B304StagingPorts,
  base: string,
  head: string,
  file: string,
  added: boolean,
): Promise<Leaf> {
  need(await ports.isAncestor(base, head), "head must contain the exact live base");
  const [before, after] = await Promise.all([
    ports.readTree(base).then(tree),
    ports.readTree(head).then(tree),
  ]);
  const changed: string[] = [];
  for (const path of new Set([...before.keys(), ...after.keys()])) {
    const old = before.get(path),
      next = after.get(path);
    if (old?.type === "tree" || next?.type === "tree") {
      need(
        next?.type === "tree" && (old === undefined || old.type === "tree"),
        "retained directory removed or changed type",
      );
      need(
        old !== undefined || (added && file.startsWith(path + "/")),
        "unrelated or empty directory addition",
      );
    } else if (!isDeepStrictEqual(old, next)) {
      changed.push(path);
    }
  }
  need(
    isDeepStrictEqual(changed.toSorted(), [file]),
    "complete tree diff must contain only the declared data file",
  );
  const old = before.get(file),
    next = after.get(file);
  need(
    next?.mode === "100644" && (added ? old === undefined : old?.mode === "100644"),
    "exact added/modified regular file required",
  );
  return next;
}
function identity(value: unknown): void {
  const repository = object(value);
  need(
    repository["id"] === CENTRAL_ID && repository["full_name"] === CENTRAL,
    "same central repository required",
  );
}
async function operationPull(
  ports: B304StagingPorts,
  number: number,
  base: string,
): Promise<Mapping> {
  const [repository, result] = await Promise.all([
    ports.readApi("repos/" + CENTRAL),
    ports.readApi("repos/" + CENTRAL + "/pulls/" + number),
  ]);
  const current = object(repository),
    pull = object(result),
    before = object(pull["base"]),
    after = object(pull["head"]);
  identity(current);
  identity(before["repo"]);
  identity(after["repo"]);
  need(
    current["archived"] === false &&
      current["disabled"] === false &&
      pull["number"] === number &&
      pull["state"] === "open" &&
      pull["merged"] === false &&
      before["sha"] === base &&
      before["ref"] === text(current["default_branch"]) &&
      pull["changed_files"] === 1,
    "live policy operation identity/base must match staging base",
  );
  positive(pull["id"]);
  positive(pull["commits"]);
  text(pull["updated_at"]);
  text(after["ref"]);
  need(sha(after["sha"]) !== base, "distinct operation head required");
  return pull;
}
function snapshot(pull: Mapping): unknown[] {
  const base = object(pull["base"]),
    head = object(pull["head"]);
  return [
    pull["id"],
    pull["number"],
    pull["state"],
    pull["merged"],
    base["sha"],
    base["ref"],
    head["sha"],
    head["ref"],
    pull["commits"],
    pull["changed_files"],
    pull["updated_at"],
  ];
}
async function currentOwner(ports: B304StagingPorts, envelope: Execution): Promise<unknown> {
  const pull = object(await ports.readApi("repos/" + CENTRAL + "/pulls/" + envelope.pull_number));
  need(
    pull["id"] === envelope.pull_id &&
      pull["number"] === envelope.pull_number &&
      object(pull["base"])["sha"] === envelope.base &&
      object(pull["head"])["sha"] === envelope.head &&
      pull["state"] === "open" &&
      pull["merged"] === false,
    "current revocation PR required",
  );
  const actor = object(pull["user"]),
    id = positive(actor["id"]),
    login = text(actor["login"]);
  need(actor["type"] === "User" && /^[A-Za-z0-9-]+$/u.test(login), "current human owner required");
  const permission = object(await ports.incident.getCollaboratorPermission(CENTRAL, login));
  need(
    permission["permission"] === "admin" &&
      object(permission["user"])["id"] === id &&
      object(permission["user"])["login"] === login,
    "current owner permission required",
  );
  return { actor: { id, login, type: "User" }, permission };
}
async function revoke(
  document: Mapping,
  envelope: Execution,
  ports: B304StagingPorts,
): Promise<Mapping> {
  const priorBytes = await ports.readBaseFile(B304_RECOVERY_AUTHORITY_PATH, envelope.base);
  need(Buffer.isBuffer(priorBytes), "installed authority required for revocation");
  const before = object(json(priorBytes)),
    prior = object(before["authorization"]),
    next = object(document["authorization"]);
  need(
    before["schema_version"] === 1 &&
      document["schema_version"] === 1 &&
      isDeepStrictEqual(Object.keys(before).toSorted(), ["authorization", "schema_version"]) &&
      isDeepStrictEqual(Object.keys(document).toSorted(), ["authorization", "schema_version"]) &&
      prior["state"] === "active" &&
      next["state"] === "revoked" &&
      isDeepStrictEqual({ ...prior, state: "revoked" }, next),
    "revocation may change only active state to revoked",
  );
  const owner = await currentOwner(ports, envelope);
  await ports.verifyController(envelope);
  need(
    isDeepStrictEqual(await currentOwner(ports, envelope), owner),
    "revocation owner authority changed",
  );
  return {
    classification: "authorization_revoked",
    authorization_id: text(next["id"]),
    semantics: "unverified",
    qualification: "unverified",
    capability_created: false,
  };
}

// This is a separate data-preparation route. It never calls prepare/verify/finish
// of the policy-operation capability, nor the consumer admission verifier.
export async function verifyB304StagingChange(
  mode: Mode,
  value: unknown,
  candidate: Buffer,
  ports: B304StagingPorts,
): Promise<Mapping> {
  need(mode === "archive" || mode === "stage", "unknown staging mode");
  const file = mode === "archive" ? B304_RECOVERY_PROOF_PATH : B304_RECOVERY_AUTHORITY_PATH;
  const envelope = execution(value, file);
  const bytes = Buffer.from(candidate);
  const document = object(json(bytes));
  await ports.verifyController(envelope);
  const leaf = await singleChange(ports, envelope.base, envelope.head, file, mode === "archive");
  need(blob(bytes) === leaf.sha, "materialized candidate differs from actual head blob");
  if (mode === "stage" && object(document["authorization"])["state"] === "revoked") {
    return {
      mode,
      execution: envelope,
      candidate_blob: leaf.sha,
      admission_evaluated: false,
      semantics: "unverified",
      qualification: "unverified",
      capability_created: false,
      verification: await revoke(document, envelope, ports),
    };
  }
  if (mode === "stage") {
    const baseAuthority = await ports.readBaseFile(B304_RECOVERY_AUTHORITY_PATH, envelope.base);
    need(
      Buffer.isBuffer(baseAuthority) &&
        isDeepStrictEqual(json(baseAuthority), { schema_version: 1, authorization: null }) &&
        object(document["authorization"])["state"] === "active",
      "only null-to-active installation or restrictive revocation is permitted",
    );
  }
  const read = async (path: string): Promise<Buffer> => {
    const result = await ports.readBaseFile(path, envelope.base);
    need(Buffer.isBuffer(result), "missing base-owned " + path);
    return result;
  };
  const [basePolicyBytes, registryBytes, exceptionsBytes] = await Promise.all([
    read(POLICY),
    read(REGISTRY),
    read(EXCEPTIONS),
  ]);
  const input = {
    controllerBase: envelope.base,
    readBaseFile: ports.readBaseFile,
    asOf: await ports.incident.currentTime(),
    basePolicyBytes,
    registryBytes,
    exceptionsBytes,
  };
  let verification: unknown;
  if (mode === "archive") {
    verification = await ports.archive(
      { ...input, proofBytes: bytes, afterEvidence: () => ports.verifyController(envelope) },
      ports.incident,
    );
  } else {
    const record = object(document["authorization"]),
      number = positive(record["pull_number"]);
    need(number !== envelope.pull_number, "installation PR cannot authorize itself");
    const pull = await operationPull(ports, number, envelope.base),
      head = object(pull["head"]);
    const policyLeaf = await singleChange(ports, envelope.base, sha(head["sha"]), POLICY, false);
    const proposedPolicyBytes = await ports.readBaseFile(POLICY, sha(head["sha"]));
    need(
      Buffer.isBuffer(proposedPolicyBytes) && blob(proposedPolicyBytes) === policyLeaf.sha,
      "real operation policy bytes required",
    );
    verification = await ports.stage(
      {
        ...input,
        recordBytes: bytes,
        operation: {
          pull_number: number,
          pull_id: positive(pull["id"]),
          head_ref: text(head["ref"]),
        },
        proposedPolicyBytes,
        afterEvidence: async () => {
          await ports.verifyController(envelope);
          need(
            isDeepStrictEqual(
              snapshot(await operationPull(ports, number, envelope.base)),
              snapshot(pull),
            ),
            "operation changed during staged verification",
          );
          // The target reread can await network work; bind the controller again
          // before the kernel's final owner/admin and actual clock checks.
          await ports.verifyController(envelope);
        },
      },
      ports.incident,
    );
  }
  return {
    mode,
    execution: envelope,
    candidate_blob: leaf.sha,
    admission_evaluated: false,
    semantics: "unverified",
    qualification: "unverified",
    capability_created: false,
    verification,
  };
}

async function command(file: string, args: string[]): Promise<Buffer> {
  const { stdout } = await execute(file, args, {
    encoding: "buffer",
    timeout: 60000,
    maxBuffer: 16 * MAX_BYTES,
  });
  return stdout;
}
function repositoryPath(value: string): string {
  need([CENTRAL, "agent-teams-ai/agent-runtime"].includes(value), "fixed public repositories only");
  return "repos/" + value;
}
async function api(path: string): Promise<unknown> {
  const result: unknown = JSON.parse((await command("gh", ["api", path])).toString("utf8"));
  return result;
}
async function collection(path: string, key: string): Promise<unknown[]> {
  const result: unknown[] = [];
  let total = -1;
  for (let page = 1; page <= 32; page++) {
    const document = object(await api(path + "&page=" + page)),
      entries = document[key];
    need(
      Array.isArray(entries) &&
        entries.length <= 100 &&
        Number.isSafeInteger(document["total_count"]),
      "bounded provider census",
    );
    if (total === -1) {
      total = Number(document["total_count"]);
    }
    need(
      total > 0 && total <= 3200 && document["total_count"] === total,
      "stable complete census count",
    );
    result.push(...entries);
    need(result.length <= total, "extra census entries");
    if (result.length === total) {
      need(
        new Set(result.map((row) => positive(object(row)["id"]))).size === result.length,
        "duplicate census IDs",
      );
      return result;
    }
    need(entries.length === 100, "incomplete provider page");
  }
  throw new Error("B304 staging: provider census exceeds finite page bound");
}
async function runtimeFile(repo: string, path: string, revision: string): Promise<Buffer | null> {
  const prefix = repositoryPath(repo),
    commit = object(await api(prefix + "/git/commits/" + sha(revision)));
  need(commit["sha"] === revision, "immutable Runtime commit");
  const treeSha = sha(object(commit["tree"])["sha"]);
  const inventory = object(await api(prefix + "/git/trees/" + treeSha + "?recursive=1"));
  const entries = inventory["tree"];
  need(
    inventory["sha"] === treeSha &&
      inventory["truncated"] === false &&
      Array.isArray(entries) &&
      entries.length <= 20000,
    "complete Runtime tree",
  );
  const matches = entries.map(object).filter((entry) => entry["path"] === path);
  need(
    matches.length === 1 && matches[0]?.["mode"] === "100644" && matches[0]["type"] === "blob",
    "regular Runtime source file",
  );
  const expected = sha(matches[0]["sha"]),
    data = object(await api(prefix + "/git/blobs/" + expected));
  need(data["encoding"] === "base64" && data["sha"] === expected, "exact Runtime blob metadata");
  const bytes = Buffer.from(text(data["content"]).replace(/\s/gu, ""), "base64");
  need(
    bytes.length <= MAX_BYTES && data["size"] === bytes.length && blob(bytes) === expected,
    "exact Runtime source bytes",
  );
  return bytes;
}
function incidentAdapters(): B304IncidentAdapters {
  return {
    currentTime: () => new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"),
    getRepository: (repo) => api(repositoryPath(repo)),
    getDefaultBranchHead: async (repo, branch) =>
      sha(
        object(
          object(await api(repositoryPath(repo) + "/branches/" + encodeURIComponent(branch)))[
            "commit"
          ],
        )["sha"],
      ),
    isCommitAncestor: async (repo, base, head) => {
      const data = object(
        await api(
          repositoryPath(repo) + "/compare/" + sha(base) + "..." + sha(head) + "?per_page=1",
        ),
      );
      return (
        ["ahead", "identical"].includes(text(data["status"])) &&
        object(data["merge_base_commit"])["sha"] === base
      );
    },
    getCheckRuns: (repo, head) =>
      collection(
        repositoryPath(repo) + "/commits/" + sha(head) + "/check-runs?per_page=100&filter=all",
        "check_runs",
      ),
    getWorkflowRun: (repo, id) => api(repositoryPath(repo) + "/actions/runs/" + positive(id)),
    getWorkflowRunAttempt: (repo, id, attempt) =>
      api(
        repositoryPath(repo) + "/actions/runs/" + positive(id) + "/attempts/" + positive(attempt),
      ),
    getWorkflowJobs: (repo, id, attempt) =>
      collection(
        repositoryPath(repo) +
          "/actions/runs/" +
          positive(id) +
          "/attempts/" +
          positive(attempt) +
          "/jobs?per_page=100",
        "jobs",
      ),
    getJobLog: (repo, id) =>
      command("gh", [
        "api",
        "--allow-escape-sequences",
        repositoryPath(repo) + "/actions/jobs/" + positive(id) + "/logs",
      ]),
    readGitFile: runtimeFile,
    getDecisionComment: (repo, id) =>
      api(repositoryPath(repo) + "/issues/comments/" + positive(id)),
    getCollaboratorPermission: (repo, login) =>
      api(repositoryPath(repo) + "/collaborators/" + encodeURIComponent(login) + "/permission"),
  };
}
async function productionPorts(): Promise<B304StagingPorts> {
  // Reuse the existing owner reader/controller without inventing declarations
  // for the retained JavaScript boundary.
  const module = object(
    await import(new URL("./verify-docs-admission-change.mjs", import.meta.url).href),
  );
  const invoke = async (name: string, ...args: unknown[]): Promise<unknown> => {
    const callable = module[name];
    need(typeof callable === "function", "missing owner " + name);
    const result: unknown = await Reflect.apply(callable, undefined, args);
    return result;
  };
  return {
    readBaseFile: async (path, revision) => {
      const result = await invoke("readAdmissionBaseFile", path, revision);
      need(result === null || Buffer.isBuffer(result), "owner reader bytes required");
      return result;
    },
    readTree: (revision) =>
      command("git", ["ls-tree", "--full-tree", "-r", "-t", "-z", sha(revision)]),
    isAncestor: async (base, head) => {
      try {
        await command("git", ["merge-base", "--is-ancestor", sha(base), sha(head)]);
        return true;
      } catch (error) {
        if (object(error)["code"] === 1) {
          return false;
        }
        throw error;
      }
    },
    readApi: api,
    verifyController: async (value) => {
      await invoke("verifyAdmissionController", value, api);
    },
    incident: incidentAdapters(),
    archive: verifyB304IncidentArchive,
    stage: verifyB304RecoveryStaging,
  };
}
async function inputFile(path: string): Promise<Buffer> {
  const info = await lstat(path);
  need(
    info.isFile() && info.size > 0 && info.size <= MAX_BYTES,
    "bounded regular materialized input",
  );
  return readFile(path);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.env["DOCS_B304_STAGING_MODE"];
  need(mode === "archive" || mode === "stage", "fixed workflow staging mode required");
  const [candidate, envelope] = await Promise.all([
    inputFile(text(process.env["DOCS_B304_CANDIDATE_PATH"])),
    inputFile(text(process.env["DOCS_ADMISSION_EXECUTION_PATH"])),
  ]);
  console.log(
    JSON.stringify(
      await verifyB304StagingChange(mode, json(envelope), candidate, await productionPorts()),
    ),
  );
}
