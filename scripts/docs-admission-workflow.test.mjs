import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  recoveryBlob,
  prepareAdmissionRecovery,
  POLICY_PATH,
  EXCEPTIONS_PATH,
  RECOVERY_AUTHORITY_PATH,
} from "./docs-legacy-admission-recovery.mjs";
import { PLATFORM_RECOVERY_AUTHORITY_PATH } from "./docs-platform-admission-recovery.mjs";
import {
  legacyRecoveryExecution,
  verifyAdmissionController,
} from "./verify-docs-admission-change.mjs";

const INVENTORY_PATH = "governance/organization-repository-inventory.json";
const B304_AUTHORITY_PATH = "governance/docs-b304-registry-recovery.json";
const B304_PROOF_PATH = "governance/evidence/docs-b304-registry-recovery/runtime-20261126.json";
const MANAGED_RUNTIME_PATH = "scripts/docs-managed-runtime-policy.ts";

const workflow = await readFile(
  new URL("../.github/workflows/docs-admission-evidence.yml", import.meta.url),
  "utf8",
);
const block = workflow
  .split("          script: |\n")[1]
  .split("      - uses: actions/checkout@")[0];
const source = block
  .split("\n")
  .map((line) => line.slice(12))
  .join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", "require", "process", source);

function gitTree(files) {
  const root = new Map();
  const entries = [];
  for (const [filePath, content] of Object.entries(files)) {
    const parts = filePath.split("/");
    let parent = root;
    for (const name of parts.slice(0, -1)) {
      if (!parent.has(name)) parent.set(name, new Map());
      parent = parent.get(name);
    }
    parent.set(parts.at(-1), Buffer.from(content));
  }
  function directory(node, prefix) {
    const children = [];
    for (const [name, value] of node) {
      const filePath = prefix ? `${prefix}/${name}` : name;
      const entry =
        value instanceof Map
          ? { path: filePath, type: "tree", mode: "040000", sha: directory(value, filePath) }
          : {
              path: filePath,
              type: "blob",
              mode: "100644",
              sha: recoveryBlob(value),
              size: value.length,
            };
      entries.push(entry);
      children.push({ ...entry, name });
    }
    children.sort((a, b) =>
      Buffer.compare(
        Buffer.from(a.name + (a.type === "tree" ? "/" : "")),
        Buffer.from(b.name + (b.type === "tree" ? "/" : "")),
      ),
    );
    const bytes = Buffer.concat(
      children.flatMap((entry) => [
        Buffer.from(`${entry.mode.replace(/^0/u, "")} ${entry.name}\0`),
        Buffer.from(entry.sha, "hex"),
      ]),
    );
    return createHash("sha1").update(`tree ${bytes.length}\0`).update(bytes).digest("hex");
  }
  return { sha: directory(root, ""), tree: entries, truncated: false };
}

async function fixture(mutate = () => {}) {
  const identity = { id: 1316243981, full_name: "agent-teams-ai/.github" };
  const pull = {
    id: 55,
    number: 88,
    state: "open",
    merged: false,
    changed_files: 1,
    commits: 1,
    updated_at: "2026-09-08T12:00:00Z",
    base: { repo: identity, sha: "a".repeat(40), ref: "main" },
    head: { repo: identity, sha: "b".repeat(40), ref: "synthetic-selection" },
  };
  const context = {
    eventName: "pull_request_target",
    sha: pull.base.sha,
    ref: "refs/heads/main",
    runId: 3117,
    repo: { owner: "agent-teams-ai", repo: ".github" },
    payload: { pull_request: pull },
  };
  const state = {
    context,
    files: [
      {
        filename: POLICY_PATH,
        status: "modified",
        sha: recoveryBlob(Buffer.from(`synthetic:${POLICY_PATH}`)),
      },
    ],
    live: structuredClone(pull),
    branch: pull.base.sha,
    contentShaWrong: false,
    contentCalls: 0,
    headFiles: {
      [POLICY_PATH]: `synthetic:${POLICY_PATH}`,
      [EXCEPTIONS_PATH]: `synthetic:${EXCEPTIONS_PATH}`,
      [INVENTORY_PATH]: `synthetic:${INVENTORY_PATH}`,
      [B304_AUTHORITY_PATH]: '{"schema_version":1,"authorization":null}',
      "README.md": "unchanged",
    },
    mutateTree: () => {},
    comparisonStatus: "ahead",
    afterMaterialize: () => {},
    controller: { ...identity, default_branch: "main", archived: false, disabled: false },
  };
  const oldTree = gitTree({ ...state.headFiles, [POLICY_PATH]: "prior-policy" });
  mutate(state);
  const newTree = gitTree(state.headFiles);
  state.mutateTree(newTree);
  const writes = new Map();
  const outputs = new Map();
  const failures = [];
  const github = {
    paginate: async () => state.files,
    rest: {
      pulls: { listFiles: () => {}, get: async () => ({ data: state.live }) },
      git: {
        getCommit: async ({ commit_sha }) => ({
          data: {
            sha: commit_sha,
            tree: { sha: commit_sha === pull.base.sha ? oldTree.sha : newTree.sha },
          },
        }),
        getTree: async ({ tree_sha }) => ({ data: tree_sha === oldTree.sha ? oldTree : newTree }),
      },
      repos: {
        compareCommits: async () => ({
          data: {
            status: state.comparisonStatus,
            base_commit: { sha: pull.base.sha },
            merge_base_commit: { sha: pull.base.sha },
            behind_by: 0,
            ahead_by: 1,
            total_commits: 1,
          },
        }),
        get: async () => ({ data: state.controller }),
        getBranch: async () => ({ data: { commit: { sha: state.branch } } }),
        getContent: async ({ path: filePath, ref }) => {
          assert.equal(ref, pull.head.sha);
          assert.ok(
            [
              POLICY_PATH,
              EXCEPTIONS_PATH,
              INVENTORY_PATH,
              B304_AUTHORITY_PATH,
              B304_PROOF_PATH,
            ].includes(filePath),
          );
          state.contentCalls++;
          const content = Buffer.from(state.headFiles[filePath]);
          if (state.contentCalls === 2) state.afterMaterialize();
          return {
            data: {
              type: "file",
              encoding: "base64",
              content: content.toString("base64"),
              sha: state.contentShaWrong ? "f".repeat(40) : recoveryBlob(content),
            },
          };
        },
      },
    },
  };
  const requireMock = (name) => {
    if (name === "node:path") return path;
    if (name === "node:crypto") return { createHash };
    assert.equal(name, "node:fs/promises");
    return {
      writeFile: async (filename, content, options) => {
        assert.equal(options.flag, "wx");
        assert.equal(writes.has(filename), false);
        writes.set(filename, content);
      },
    };
  };
  try {
    await execute(
      context,
      github,
      {
        setFailed: (message) => failures.push(message),
        setOutput: (key, value) => outputs.set(key, value),
      },
      requireMock,
      { env: { RUNNER_TEMP: "/synthetic-runner", GITHUB_RUN_ATTEMPT: state.runAttempt ?? "1" } },
    );
  } catch (error) {
    failures.push(error.message);
  }
  return { ...state, writes, outputs, failures };
}

test("materializes only exact data and binds live central/base/head execution", async () => {
  const result = await fixture();
  assert.deepEqual(result.failures, []);
  assert.equal(result.outputs.get("mode"), "admission");
  assert.equal(result.writes.size, 4);
  assert.ok(result.outputs.get("inventory-path"));
  const execution = JSON.parse(result.writes.get(result.outputs.get("execution-path")));
  assert.deepEqual(execution.changed_files, [POLICY_PATH]);
  assert.equal(execution.execution_base, "a".repeat(40));
  assert.equal(execution.head, "b".repeat(40));
  assert.equal(execution.pull_number, 88);
  assert.equal(execution.pull_id, 55);
  assert.equal(execution.head_ref, "synthetic-selection");
  assert.equal(execution.run_id, 3117);
  assert.equal(execution.run_attempt, 1);
});
test("real materialized execution reaches the closed legacy consumer through the admission projection", async () => {
  const result = await fixture();
  assert.deepEqual(result.failures, []);
  const execution = JSON.parse(result.writes.get(result.outputs.get("execution-path")));
  const repo = execution.controller.repository;
  await verifyAdmissionController(execution, async (endpoint) =>
    endpoint === `repos/${repo}`
      ? result.controller
      : endpoint === `repos/${repo}/pulls/${execution.pull_number}`
        ? result.live
        : { commit: { sha: execution.base } },
  );
  const legacy = legacyRecoveryExecution(execution);
  let authorityReads = 0;
  assert.equal(
    await prepareAdmissionRecovery({
      execution: legacy,
      readBaseFile: async (filePath, revision) => {
        assert.equal(filePath, RECOVERY_AUTHORITY_PATH);
        assert.equal(revision, execution.base);
        authorityReads++;
        return null;
      },
    }),
    null,
  );
  assert.equal(authorityReads, 1);
  assert.deepEqual(
    Object.keys(legacy).toSorted(),
    "controller pull_number base head execution_base changed_files".split(" ").toSorted(),
  );
});
for (const runAttempt of ["", "0", "1.5", "1e0", " 1", "NaN", "9007199254740992"]) {
  test(`materializer rejects invalid GITHUB_RUN_ATTEMPT ${JSON.stringify(runAttempt)}`, async () => {
    const result = await fixture((state) => {
      state.runAttempt = runAttempt;
    });
    assert.match(result.failures.join("\n"), /Invalid trusted GITHUB_RUN_ATTEMPT/u);
    assert.equal(result.writes.size, 0);
  });
}

for (const mutation of [
  (s) => {
    s.files[0] = { filename: RECOVERY_AUTHORITY_PATH, status: "added" };
  },
  (s) => {
    s.files[0] = { filename: RECOVERY_AUTHORITY_PATH, status: "modified" };
  },
  (s) => {
    s.files[0] = {
      filename: "README.md",
      previous_filename: RECOVERY_AUTHORITY_PATH,
      status: "renamed",
    };
  },
  (s) => {
    s.files[0] = { filename: PLATFORM_RECOVERY_AUTHORITY_PATH, status: "added" };
  },
  (s) => {
    s.files[0] = { filename: PLATFORM_RECOVERY_AUTHORITY_PATH, status: "modified" };
  },
  (s) => {
    s.files[0] = { filename: PLATFORM_RECOVERY_AUTHORITY_PATH, status: "removed" };
  },
  (s) => {
    s.files[0] = {
      filename: "README.md",
      previous_filename: PLATFORM_RECOVERY_AUTHORITY_PATH,
      status: "renamed",
    };
  },
  (s) => {
    s.files[0] = {
      filename: "governance/evidence/docs-admission-recovery/incident.json",
      status: "added",
    };
  },
]) {
  test("operative incident authority/proof changes never take the code-only no-op route", async () => {
    const result = await fixture(mutation);
    assert.match(result.failures.join("\n"), /separately trusted exact staging/u);
    assert.equal(result.outputs.has("mode"), false);
    assert.equal(result.contentCalls, 0);
  });
}

const mutations = {
  "head without live-base ancestry": (s) => {
    s.comparisonStatus = "diverged";
  },
  "truncated recursive tree": (s) => {
    s.mutateTree = (tree) => {
      tree.truncated = true;
    };
  },
  "omitted recursive tree entry": (s) => {
    s.mutateTree = (tree) => {
      tree.tree.pop();
    };
  },
  "symlink policy": (s) => {
    s.mutateTree = (tree) => {
      tree.tree.find((e) => e.path === POLICY_PATH).mode = "120000";
    };
  },
  "mode-changed data": (s) => {
    s.mutateTree = (tree) => {
      tree.tree.find((e) => e.path === POLICY_PATH).mode = "100755";
    };
  },
  "extra change hidden from file pages": (s) => {
    s.headFiles["README.md"] = "unreported";
  },
  "extra new file hidden from file pages": (s) => {
    s.headFiles["unrelated/new.txt"] = "unreported";
  },
  "file page lying about blob": (s) => {
    s.files[0].sha = "c".repeat(40);
  },

  "mixed executable authority": (s) => {
    s.files.push({ filename: "scripts/docs-legacy-admission-recovery.mjs", status: "modified" });
    s.context.payload.pull_request.changed_files++;
  },
  "mixed B304 executable authority": (s) => {
    s.files.push({ filename: "scripts/docs-b304-registry-incident.ts", status: "modified" });
    s.context.payload.pull_request.changed_files++;
  },
  "B304 executable-only source change before noop": (s) => {
    s.files = [{ filename: "scripts/docs-b304-recovery-staging.ts", status: "modified" }];
  },
  "B304 executable rename away before noop": (s) => {
    s.files = [
      {
        filename: "scripts/other.ts",
        previous_filename: "scripts/docs-b304-registry-incident.ts",
        status: "renamed",
      },
    ];
  },
  "B304 authority addition without admission data": (s) => {
    s.files = [{ filename: "governance/docs-b304-registry-recovery.json", status: "added" }];
  },
  "B304 proof page without the immutable addition": (s) => {
    s.files = [
      {
        filename: "governance/evidence/docs-b304-registry-recovery/runtime-20261126.json",
        status: "added",
      },
    ];
  },
  "B304 authority rename away without admission data": (s) => {
    s.files = [
      {
        filename: "docs/inert.json",
        previous_filename: "governance/docs-b304-registry-recovery.json",
        status: "renamed",
      },
    ];
  },
  fork: (s) => {
    s.context.payload.pull_request.head.repo = { id: 99, full_name: "fork/central" };
  },
  "stale event head": (s) => {
    s.live.head.sha = "c".repeat(40);
  },
  "wrong central identity": (s) => {
    s.controller.id = 99;
  },
  "wrong execution base": (s) => {
    s.context.sha = s.context.payload.pull_request.head.sha;
  },
  "wrong event": (s) => {
    s.context.eventName = "pull_request";
  },
  "moving default branch": (s) => {
    s.afterMaterialize = () => {
      s.branch = "c".repeat(40);
    };
  },
  "moving PR head": (s) => {
    s.afterMaterialize = () => {
      s.live.head.sha = "c".repeat(40);
    };
  },
  "wrong materialized blob": (s) => {
    s.contentShaWrong = true;
  },
  "incomplete file page": (s) => {
    s.context.payload.pull_request.changed_files = 2;
  },
  "duplicate filenames": (s) => {
    s.files.push(s.files[0]);
    s.context.payload.pull_request.changed_files = 2;
  },
  "renamed policy": (s) => {
    s.files[0].previous_filename = "README.md";
  },
  "deleted policy": (s) => {
    s.files[0].status = "removed";
  },
  "unrelated collateral file": (s) => {
    s.files.push({ filename: "README.md", status: "modified" });
    s.context.payload.pull_request.changed_files = 2;
  },
};
for (const [label, mutate] of Object.entries(mutations)) {
  test(`materializer rejects ${label}`, async () => {
    const result = await fixture(mutate);
    assert.ok(result.failures.length, label);
    assert.equal(result.outputs.has("mode"), false);
    assert.equal(result.writes.size, 0);
  });
}

for (const [label, files] of [
  ["modification", [{ filename: MANAGED_RUNTIME_PATH, status: "modified" }]],
  ["addition", [{ filename: MANAGED_RUNTIME_PATH, status: "added" }]],
  ["deletion", [{ filename: MANAGED_RUNTIME_PATH, status: "removed" }]],
  [
    "rename away",
    [{ filename: "scripts/other.ts", previous_filename: MANAGED_RUNTIME_PATH, status: "renamed" }],
  ],
  [
    "rename into",
    [{ filename: MANAGED_RUNTIME_PATH, previous_filename: "scripts/other.ts", status: "renamed" }],
  ],
  [
    "mixed admission data",
    [
      { filename: POLICY_PATH, status: "modified" },
      { filename: MANAGED_RUNTIME_PATH, status: "modified" },
    ],
  ],
]) {
  test(`materializer rejects managed runtime ${label} before no-op or data modes`, async () => {
    const result = await fixture((state) => {
      state.files = files;
      state.context.payload.pull_request.changed_files = files.length;
    });
    assert.deepEqual(result.failures, [
      "Protected Docs executable source changes require a separately qualified source transition before any no-op or data mode.",
    ]);
    assert.equal(result.outputs.has("mode"), false);
    assert.equal(result.writes.size, 0);
    assert.equal(result.contentCalls, 0);
  });
}

test("ordinary code-only no-op is not reported as trusted recovery", async () => {
  const result = await fixture((s) => {
    s.files = [{ filename: "scripts/docs-legacy-admission-recovery.mjs", status: "added" }];
  });
  assert.deepEqual(result.failures, []);
  assert.equal(result.outputs.get("mode"), "noop");
  assert.equal(result.writes.size, 0);
  assert.equal(result.contentCalls, 0);
  assert.match(workflow, /ref: \$\{\{ github.event.pull_request.base.sha \}\}/u);
  assert.match(
    workflow,
    /ref: \$\{\{ github.event.pull_request.base.sha \}\}\n\s+fetch-depth: 0\n\s+persist-credentials: false/u,
  );
  assert.match(workflow, /DOCS_ADMISSION_EXECUTION_PATH:/u);
  assert.match(workflow, /DOCS_ADMISSION_INVENTORY_PATH:/u);
  assert.match(
    workflow,
    /const inventoryPath = "governance\/organization-repository-inventory\.json"/u,
  );
  assert.match(workflow, /allowedData = new Set\(\[policyPath, exceptionsPath, inventoryPath\]\)/u);
});

test("pending source evidence in a policy PR cannot become head-owned authority", async () => {
  const receiptPath = "governance/evidence/docs-admission/platform-stable31-pending-source.json";
  for (const path of [
    receiptPath,
    "scripts/fixtures/platform-stable31-pending-source/packet.json",
  ]) {
    const result = await fixture((state) => {
      state.headFiles[path] = '{"platformPendingSelection":"head callback"}\n';
      state.files.push({
        filename: path,
        status: "added",
        sha: recoveryBlob(Buffer.from(state.headFiles[path])),
      });
      state.context.payload.pull_request.changed_files++;
    });
    assert.ok(result.failures.length);
    assert.equal(result.writes.size, 0);
    assert.equal(result.contentCalls, 0);
  }
});
test("inert pending receipt by itself supplies neither an admission tuple nor executable callback", async () => {
  const result = await fixture((state) => {
    state.files = [
      {
        filename: "governance/evidence/docs-admission/platform-stable31-pending-source.json",
        status: "added",
      },
    ];
  });
  assert.deepEqual(result.failures, []);
  assert.equal(result.outputs.get("mode"), "noop");
  assert.equal(result.writes.size, 0);
  assert.equal(result.contentCalls, 0);
});

for (const [mode, filePath, status, content] of [
  ["archive", B304_PROOF_PATH, "added", '{"inert":"unverified"}'],
  [
    "stage",
    B304_AUTHORITY_PATH,
    "modified",
    '{"schema_version":1,"authorization":{"state":"active"}}',
  ],
]) {
  test(`materializer routes only the exact B304 ${mode} bytes to base-owned typed verification`, async () => {
    const result = await fixture((state) => {
      state.headFiles[POLICY_PATH] = "prior-policy";
      state.headFiles[filePath] = content;
      state.files = [{ filename: filePath, status, sha: recoveryBlob(Buffer.from(content)) }];
    });
    assert.deepEqual(result.failures, []);
    assert.equal(result.outputs.get("mode"), mode);
    assert.equal(result.writes.size, 2);
    assert.equal(result.outputs.has("policy-path"), false);
    assert.equal(result.writes.get(result.outputs.get("candidate-path")).toString(), content);
    const execution = JSON.parse(result.writes.get(result.outputs.get("execution-path")));
    assert.deepEqual(execution.changed_files, [filePath]);
    assert.equal(execution.base, result.context.payload.pull_request.base.sha);
    assert.match(workflow, /run: node scripts\/docs-b304-recovery-staging.ts/u);
    assert.match(workflow, /fetch-depth: 0/u);
  });
}
