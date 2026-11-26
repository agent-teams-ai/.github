import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  B304_RECOVERY_AUTHORITY_PATH as AUTHORITY,
  B304_RECOVERY_PROOF_PATH as PROOF,
  verifyB304RecoveryStaging,
} from "./docs-b304-registry-incident.ts";
import type { B304InertVerification } from "./docs-b304-registry-incident.ts";
import { verifyB304StagingChange } from "./docs-b304-recovery-staging.ts";
import type { B304StagingPorts } from "./docs-b304-recovery-staging.ts";

type Mapping = Record<string, unknown>;
const BASE = "a".repeat(40),
  HEAD = "b".repeat(40),
  OPERATION = "c".repeat(40);
const CENTRAL = "agent-teams-ai/.github";
const POLICY = "governance/docs-protocol-policy-v2.json";
const REGISTRY = "governance/docs-qualified-cohorts.json";
const EXCEPTIONS = "governance/docs-protocol-exceptions.json";
const encode = (value: unknown): Buffer => Buffer.from(JSON.stringify(value));
const hash = (bytes: Buffer): string =>
  createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
function isMapping(value: unknown): value is Mapping {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function object(value: unknown): Mapping {
  assert.ok(isMapping(value));
  return value;
}
function leaves(files: Map<string, Buffer>): Buffer {
  const directories = new Set<string>();
  for (const path of files.keys()) {
    const parts = path.split("/");
    for (let size = 1; size < parts.length; size++) {
      directories.add(parts.slice(0, size).join("/"));
    }
  }
  return Buffer.from(
    [
      ...[...directories]
        .toSorted()
        .map((path) => `040000 tree ${hash(Buffer.from(path))}\t${path}\0`),
      ...[...files]
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([path, bytes]) => `100644 blob ${hash(bytes)}\t${path}\0`),
    ].join(""),
  );
}
async function forbidden(): Promise<never> {
  throw new Error("Unexpected native proof read in controlled orchestration fixture");
}

const legacy = object(
  await import(new URL("./verify-docs-admission-change.mjs", import.meta.url).href),
);
async function controller(
  execution: unknown,
  read: (path: string) => Promise<unknown>,
): Promise<void> {
  const callable = legacy["verifyAdmissionController"];
  assert.ok(typeof callable === "function");
  await Reflect.apply(callable, undefined, [execution, read]);
}

// These fixtures test the real tree/materialization/controller orchestration.
// The live incident kernels have their own full public-evidence tests; the two
// explicitly controlled ports below confer no authority or qualification.
function fixture(mode: "archive" | "stage" = "stage") {
  const identity = { id: 1316243981, full_name: CENTRAL };
  const owner = { id: 13103045, login: "777genius", type: "User" };
  const file = mode === "archive" ? PROOF : AUTHORITY;
  const candidate =
    mode === "archive"
      ? encode({ inert: true })
      : encode({
          schema_version: 1,
          authorization: { id: "controlled-boundary-fixture", state: "active", pull_number: 9 },
        });
  const base = new Map<string, Buffer>([
    [POLICY, Buffer.from("complete base policy")],
    [REGISTRY, Buffer.from("complete base registry")],
    [EXCEPTIONS, Buffer.from("complete base exceptions")],
    [AUTHORITY, encode({ schema_version: 1, authorization: null })],
    ["scripts/unchanged.ts", Buffer.from("export const retained = true;\n")],
  ]);
  const head = new Map(base);
  head.set(file, candidate);
  const operation = new Map(base);
  operation.set(POLICY, Buffer.from("complete operation policy"));
  const pull = {
    id: 81,
    number: 8,
    state: "open",
    merged: false,
    commits: 1,
    changed_files: 1,
    updated_at: "2026-11-26T23:00:00Z",
    user: owner,
    base: { repo: identity, ref: "main", sha: BASE },
    head: { repo: identity, ref: "stage-b304", sha: HEAD },
  };
  const operationPull = {
    ...structuredClone(pull),
    id: 91,
    number: 9,
    head: { repo: identity, ref: "retire-canary", sha: OPERATION },
  };
  const envelope = {
    controller: { repository: CENTRAL, repository_id: 1316243981 },
    pull_number: pull.number,
    pull_id: pull.id,
    head_ref: pull.head.ref,
    run_id: 1001,
    run_attempt: 1,
    base: BASE,
    head: HEAD,
    execution_base: BASE,
    changed_files: [file],
  };
  const state = {
    candidate,
    base,
    head,
    operation,
    pull,
    operationPull,
    envelope,
    defaultHead: BASE,
    ancestor: true,
    permission: "admin",
    owner,
    kernelCalls: 0,
    controllerCalls: 0,
    permissionCalls: 0,
    operationReads: 0,
    events: [] as string[],
    duringEvidence: () => {},
    mutateTree: (_revision: string, bytes: Buffer): Buffer => bytes,
  };

  const inert = (): B304InertVerification => ({
    classification: "inert-b304-registry-incident",
    proof_blob: hash(candidate),
    source_head: "cae4d350c947cd9f74bc04130531527c9a36baeb",
    semantics: "unverified",
    qualification: "unverified",
    capability_created: false,
  });
  const ports: B304StagingPorts = {
    readBaseFile: async (path, revision) => {
      assert.ok(
        [BASE, OPERATION].includes(revision),
        "only actual immutable fixture images are read",
      );
      return (revision === BASE ? state.base : state.operation).get(path) ?? null;
    },
    readTree: async (revision) => {
      const files =
        revision === BASE ? state.base : revision === HEAD ? state.head : state.operation;
      assert.ok([BASE, HEAD, OPERATION].includes(revision));
      return state.mutateTree(revision, leaves(files));
    },
    isAncestor: async (ancestor, descendant) => {
      assert.equal(ancestor, BASE);
      assert.ok([HEAD, OPERATION].includes(descendant));
      return state.ancestor;
    },
    readApi: async (path) => {
      if (path === "repos/" + CENTRAL) {
        return { ...identity, default_branch: "main", archived: false, disabled: false };
      }
      if (path === "repos/" + CENTRAL + "/branches/main") {
        return { commit: { sha: state.defaultHead } };
      }
      if (path === "repos/" + CENTRAL + "/pulls/8") {
        return structuredClone(state.pull);
      }
      if (path === "repos/" + CENTRAL + "/pulls/9") {
        state.operationReads++;
        return structuredClone(state.operationPull);
      }
      throw new Error("Unexpected API path: " + path);
    },
    verifyController: async (value) => {
      state.controllerCalls++;
      state.events.push("controller");
      await controller(value, ports.readApi);
    },
    incident: {
      currentTime: () => "2026-11-26T23:00:00Z",
      getRepository: forbidden,
      getDefaultBranchHead: forbidden,
      isCommitAncestor: forbidden,
      getCheckRuns: forbidden,
      getWorkflowRun: forbidden,
      getWorkflowRunAttempt: forbidden,
      getWorkflowJobs: forbidden,
      getJobLog: forbidden,
      readGitFile: forbidden,
      getDecisionComment: forbidden,
      getCollaboratorPermission: async (repo, login) => {
        state.permissionCalls++;
        assert.equal(repo, CENTRAL);
        assert.equal(login, owner.login);
        return {
          permission: state.permission,
          user: { id: state.owner.id, login: state.owner.login },
        };
      },
    },
    archive: async (input) => {
      state.kernelCalls++;
      assert.deepEqual(input.proofBytes, state.candidate);
      assert.deepEqual(input.basePolicyBytes, state.base.get(POLICY));
      state.events.push("archive evidence");
      state.duringEvidence();
      await input.afterEvidence();
      state.events.push("archive final clock");
      return inert();
    },
    stage: async (input) => {
      state.kernelCalls++;
      assert.deepEqual(input.operation, { pull_number: 9, pull_id: 91, head_ref: "retire-canary" });
      assert.equal(input.controllerBase, BASE);
      assert.equal(input.asOf, "2026-11-26T23:00:00Z");
      assert.deepEqual(input.recordBytes, state.candidate);
      assert.deepEqual(input.proposedPolicyBytes, state.operation.get(POLICY));
      assert.deepEqual(input.basePolicyBytes, state.base.get(POLICY));
      assert.deepEqual(input.registryBytes, state.base.get(REGISTRY));
      assert.deepEqual(input.exceptionsBytes, state.base.get(EXCEPTIONS));
      state.events.push("stage evidence");
      state.duringEvidence();
      await input.afterEvidence();
      state.events.push("stage final owner/clock");
      return { ...inert(), authorization_id: "controlled-boundary-fixture" };
    },
  };
  const run = () => verifyB304StagingChange(mode, state.envelope, state.candidate, ports);
  return {
    state,
    ports,
    run,
    setCandidate: (value: unknown) => {
      state.candidate = encode(value);
      state.head.set(file, state.candidate);
    },
  };
}

void test("B304 archive verifies only the complete added proof and rereads controller before final kernel clock", async () => {
  const { state, run } = fixture("archive");
  const result = await run();
  assert.deepEqual(state.events, [
    "controller",
    "archive evidence",
    "controller",
    "archive final clock",
  ]);
  assert.equal(state.operationReads, 0);
  assert.equal(state.permissionCalls, 0);
  assert.equal(result["admission_evaluated"], false);
  assert.equal(result["capability_created"], false);
  assert.equal(result["qualification"], "unverified");
});
void test("B304 stage binds the real separate policy PR, whole images and final outer reads before final owner proof", async () => {
  const { state, run } = fixture();
  const result = await run();
  assert.deepEqual(state.events, [
    "controller",
    "stage evidence",
    "controller",
    "controller",
    "stage final owner/clock",
  ]);
  assert.equal(state.operationReads, 2);
  assert.equal(state.kernelCalls, 1);
  assert.equal(result["mode"], "stage");
  assert.equal(result["semantics"], "unverified");
});

const mutations: Record<string, (value: ReturnType<typeof fixture>) => void> = {
  "extra policy change in staging": ({ state }) => {
    state.head.set(POLICY, Buffer.from("mixed policy"));
  },
  "extra executable change": ({ state }) => {
    state.head.set("scripts/hidden.ts", Buffer.from("throw Error()"));
  },
  "removed retained source": ({ state }) => {
    state.head.delete("scripts/unchanged.ts");
  },
  "nonregular candidate mode": ({ state }) => {
    state.mutateTree = (revision, bytes) =>
      revision === HEAD
        ? Buffer.from(
            bytes
              .toString()
              .replace(
                "100644 blob " + hash(state.candidate),
                "100755 blob " + hash(state.candidate),
              ),
          )
        : bytes;
  },
  "missing leaf terminator": ({ state }) => {
    state.mutateTree = (_revision, bytes) => bytes.subarray(0, -1);
  },
  "duplicate complete leaf": ({ state }) => {
    state.mutateTree = (_revision, bytes) =>
      Buffer.concat([bytes, bytes.subarray(0, bytes.indexOf(0) + 1)]);
  },
  "unrelated empty Git directory": ({ state }) => {
    state.mutateTree = (revision, bytes) =>
      revision === HEAD
        ? Buffer.concat([bytes, Buffer.from(`040000 tree ${"d".repeat(40)}\tempty\0`)])
        : bytes;
  },
  "omitted parent directory": ({ state }) => {
    state.mutateTree = (_revision, bytes) =>
      Buffer.from(
        bytes
          .toString()
          .split("\0")
          .filter((row) => !row.endsWith("\tgovernance"))
          .join("\0"),
      );
  },
  "diverged head": ({ state }) => {
    state.ancestor = false;
  },
  "materialized bytes not head blob": ({ state }) => {
    state.candidate = Buffer.from("{}");
  },
  "incomplete execution path census": ({ state }) => {
    state.envelope.changed_files = [AUTHORITY, POLICY];
  },
  "stale default head": ({ state }) => {
    state.defaultHead = "d".repeat(40);
  },
  "target fork": ({ state }) => {
    state.operationPull.head.repo = { id: 99, full_name: "fork/repository" };
  },
  "target policy/source mixture": ({ state }) => {
    state.operation.set("scripts/extra.ts", Buffer.from("extra"));
  },
  "target wrong base": ({ state }) => {
    state.operationPull.base.sha = "d".repeat(40);
  },
  "target wrong path": ({ state }) => {
    state.operation.set(POLICY, Buffer.from("complete base policy"));
    state.operation.set(EXCEPTIONS, Buffer.from("changed"));
  },
  "self-authorizing installation PR": (value) => {
    value.setCandidate({ schema_version: 1, authorization: { pull_number: 8, state: "active" } });
  },
};
for (const [name, mutate] of Object.entries(mutations)) {
  void test("B304 staging rejects " + name + " before native incident evaluation", async () => {
    const value = fixture();
    mutate(value);
    await assert.rejects(value.run);
    assert.equal(value.state.kernelCalls, 0);
  });
}
for (const mode of ["archive", "stage"] as const) {
  void test(
    "B304 " + mode + " rejects malformed duplicate-key JSON before any controller read",
    async () => {
      const value = fixture(mode);
      value.state.candidate = Buffer.from('{"authorization":null,"authorization":{}}');
      await assert.rejects(value.run, /duplicate/u);
      assert.equal(value.state.controllerCalls, 0);
    },
  );
  void test("B304 " + mode + " rejects default-head movement during native evidence", async () => {
    const value = fixture(mode);
    value.state.duringEvidence = () => {
      value.state.defaultHead = "d".repeat(40);
    };
    await assert.rejects(value.run, /default head changed/u);
    assert.equal(value.state.kernelCalls, 1);
  });
}
void test("B304 archive cannot replace an existing proof", async () => {
  const value = fixture("archive");
  value.state.base.set(PROOF, Buffer.from("existing proof"));
  await assert.rejects(value.run, /added\/modified regular/u);
  assert.equal(value.state.kernelCalls, 0);
});
void test("B304 stage rejects operation rotation learned after the native kernel", async () => {
  const value = fixture();
  value.state.duringEvidence = () => {
    value.state.operationPull.head.sha = "d".repeat(40);
  };
  await assert.rejects(value.run, /operation changed/u);
});
void test("B304 stage reaches the actual shared kernel without fabricating an operation capability", async () => {
  const value = fixture();
  value.ports.stage = verifyB304RecoveryStaging;
  // These are intentionally noncanonical controlled base bytes. The real
  // kernel must refuse them rather than accept the orchestration fixture.
  await assert.rejects(
    value.run,
    /exact complete governance\/docs-protocol-policy-v2.json differs/u,
  );
});

function revocation() {
  const value = fixture();
  const authorization = {
    id: "expired-installed-fixture",
    state: "active",
    expires_at: "2026-01-01T00:00:00Z",
    owner_decision: { comment_id: 99 },
    retained: { source: "original" },
  };
  value.state.base.set(AUTHORITY, encode({ schema_version: 1, authorization }));
  value.setCandidate({ schema_version: 1, authorization: { ...authorization, state: "revoked" } });
  return value;
}
void test("B304 restrictive revocation remains possible after expiry and without the original owner comment", async () => {
  const value = revocation();
  const result = await value.run();
  assert.equal(object(result["verification"])["classification"], "authorization_revoked");
  assert.equal(value.state.kernelCalls, 0);
  assert.equal(value.state.operationReads, 0);
  assert.equal(value.state.permissionCalls, 2);
  assert.equal(value.state.controllerCalls, 2);
  assert.equal(result["capability_created"], false);
});
for (const field of ["expires_at", "id", "retained", "owner_decision"]) {
  void test("B304 revocation rejects changed " + field, async () => {
    const value = revocation(),
      document = object(JSON.parse(value.state.candidate.toString()));
    object(document["authorization"])[field] = "replacement";
    value.setCandidate(document);
    await assert.rejects(value.run, /may change only active state/u);
    assert.equal(value.state.permissionCalls, 0);
  });
}
void test("B304 revocation requires the actual current PR owner to remain admin", async () => {
  const value = revocation();
  value.state.permission = "write";
  await assert.rejects(value.run, /current owner permission/u);
});
void test("B304 revocation refuses final owner authority loss", async () => {
  const value = revocation(),
    verify = value.ports.verifyController;
  value.ports.verifyController = async (execution) => {
    await verify(execution);
    if (value.state.controllerCalls === 2) {
      value.state.permission = "read";
    }
  };
  await assert.rejects(value.run, /current owner permission/u);
});
void test("B304 stage cannot reactivate a revoked grant or reach a native proof kernel", async () => {
  const value = revocation(),
    document = object(JSON.parse(value.state.candidate.toString()));
  value.state.base.set(AUTHORITY, value.state.candidate);
  object(document["authorization"])["state"] = "active";
  value.setCandidate(document);
  value.ports.stage = async (input, adapters) => verifyB304RecoveryStaging(input, adapters);
  await assert.rejects(value.run, /only null-to-active/u);
  assert.equal(value.state.permissionCalls, 0);
  assert.equal(value.state.kernelCalls, 0);
});
