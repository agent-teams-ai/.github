import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  copyFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseDocument } from "yaml";

interface ReleasePackage {
  name: string;
  version: string;
  file: string;
  sha256: string;
  integrity: string;
}
interface Release {
  schemaVersion: number;
  repository: string;
  source: string;
  packages: ReleasePackage[];
}
const workflow = readFileSync(
  new URL("../.github/workflows/npm-publish.yml", import.meta.url),
  "utf8",
);
const marker = "        run: |\n          set -euo pipefail\n          fail()";
const block = workflow
  .slice(workflow.indexOf(marker) + "        run: |\n".length)
  .split("\n      - name: Preserve")[0];
assert.ok(block, "production shell block must be selected");
assert.ok(
  block.includes("verify_archive()"),
  "production shell block must contain archive validation",
);
const applyMarker = "      - name: Apply reconciled registry effects";
const applyBlock = workflow
  .slice(workflow.indexOf(applyMarker))
  .split("        run: |\n")[1]
  ?.split("\n      - name: Preserve")[0];
assert.ok(applyBlock, "production apply block must be selected");
const preflightShell = block
  .split("\n")
  .map((line) => line.slice(10))
  .join("\n");
const applyShell = applyBlock
  .split("\n")
  .map((line) => line.slice(10))
  .join("\n");
// This local adapter stands in for the successful immutable artifact upload.
const persistIntent =
  "export CURRENT_INTENT_ID=''; if test -f intent/intent.json; then cp intent/intent.json state/durable-intent.json; export CURRENT_INTENT_ID=777; fi";
const cleanupBlock = workflow
  .slice(workflow.indexOf("      - name: Retire only resolved upload intents"))
  .split("        run: |\n")[1];
assert.ok(cleanupBlock, "production cleanup must be selected");
const cleanupShell = cleanupBlock
  .split("\n")
  .map((line) => line.slice(10))
  .join("\n");
const shell = [
  preflightShell,
  persistIntent,
  applyShell,
  "test -f evidence/receipt.json",
  "if [[ $PHASE = publish ]]; then",
  cleanupShell,
  "fi",
].join("\n");
const source = "a".repeat(40);

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "TEST-npm-publisher-"));
  for (const directory of ["release", "bin", "state", "source/package", "temp"]) {
    mkdirSync(path.join(root, directory), { recursive: true });
  }
  writeFileSync(
    path.join(root, "source/package/package.json"),
    JSON.stringify({
      name: "@agent-teams/test-publisher",
      version: "1.2.3",
      repository: { url: "git+https://github.com/agent-teams-ai/TEST-publisher.git" },
      scripts: { prepublishOnly: "exit 97" },
    }),
  );
  execFileSync("tar", [
    "-czf",
    path.join(root, "release/test.tgz"),
    "-C",
    path.join(root, "source"),
    "package",
  ]);
  const archive = readFileSync(path.join(root, "release/test.tgz"));
  const entry: ReleasePackage = {
    name: "@agent-teams/test-publisher",
    version: "1.2.3",
    file: "test.tgz",
    sha256: createHash("sha256").update(archive).digest("hex"),
    integrity: `sha512-${createHash("sha512").update(archive).digest("base64")}`,
  };
  const manifest: Release = {
    schemaVersion: 1,
    repository: "agent-teams-ai/TEST-publisher",
    source,
    packages: [entry],
  };
  const save = () =>
    writeFileSync(path.join(root, "release/release.json"), JSON.stringify(manifest));
  save();
  writeFileSync(
    path.join(root, "bin/curl"),
    `#!/bin/bash
set -euo pipefail
output=''
url=''
method=''
for ((i=1;i<=$#;i++)); do
  if [[ "\${!i}" = -o ]]; then j=$((i+1)); output="\${!j}"; fi
  if [[ "\${!i}" = https://* ]]; then url="\${!i}"; fi
  if [[ "\${!i}" = -X ]]; then j=$((i+1)); method="\${!j}"; fi
done
if [[ "$url" = *'/actions/artifacts?name='* ]]; then
  if [[ -f state/intents.json ]]; then cp state/intents.json "$output"; else printf '{"total_count":0,"artifacts":[]}' > "$output"; fi
elif [[ "$url" = *'/actions/artifacts/'*'/zip' ]]; then
  cp state/prior-intent.zip "$output"
elif [[ "$url" = *'/actions/artifacts/'* ]]; then
  artifact_id="\${url##*/}"
  if [[ "$method" = DELETE ]]; then printf '%s\\n' "$artifact_id" >> state/deletes; printf 204
  else
    intent_run="\${FAKE_PRIOR_RUN:-99}"; [[ "$artifact_id" != 777 ]] || intent_run=123
    printf '{"id":%s,"name":"%s","expired":false,"workflow_run":{"id":%s,"head_sha":"%s"}}' "$artifact_id" "\${FAKE_RETIRE_NAME:-npm-upload-intent}" "$intent_run" "$RELEASE_SOURCE" > "$output"
  fi
elif [[ "$url" = *'/actions/runs/'* ]]; then
  printf '{"workflow_id":42,"event":"push","head_sha":"%s","head_branch":"main","head_repository":{"full_name":"%s"}}' "$RELEASE_SOURCE" "$RELEASE_REPOSITORY" > "$output"
elif [[ "$url" = https://api.github.com/* ]]; then
  printf '{"object":{"sha":"%s"}}' "\${FAKE_MAIN:-$RELEASE_SOURCE}" > "$output"; printf 200
elif [[ "$url" = *dist-tags ]]; then
  printf '{"latest":"%s"}' "$(cat state/latest 2>/dev/null || true)" > "$output"; printf 200
elif [[ "$url" = *.tgz ]]; then
  if [[ -f state/pending ]]; then rm state/pending; printf '{}' > "$output"; printf 404
  else cp state/archive.tgz "$output"; printf 200; fi
elif [[ -f state/metadata.json ]]; then
  if [[ "$url" = */latest ]]; then
    printf 'read\\n' >> state/latest-reads
    if [[ -f state/alias-pending ]]; then
      rm state/alias-pending; jq '.version = "1.2.2"' state/metadata.json > "$output"
    else cp state/metadata.json "$output"; fi
  else cp state/metadata.json "$output"; fi
  printf 200
else printf '{}' > "$output"; printf 404; fi
`,
    { mode: 0o755 },
  );
  writeFileSync(
    path.join(root, "bin/npm"),
    `#!/bin/bash
set -euo pipefail
[[ "$*" = *--ignore-scripts* && "$npm_config_fetch_retries" = 0 ]]
if [[ "$1" = dist-tag && "$2" = ls ]]; then
  [[ "$*" = *--logs-max=0* && "$*" = *--color=false* && "$*" = *--loglevel=verbose* ]]
  [[ -z "\${NODE_AUTH_TOKEN:-}" && -z "\${NPM_TOKEN:-}" && -z "\${NPM_ID_TOKEN:-}" ]]
  for argument in "$@"; do
    case "$argument" in --userconfig=*|--globalconfig=*) file="\${argument#*=}"; test -f "$file" && test ! -s "$file";; esac
  done
  printf '%s\\n' "$3" >> state/authority-probes
  printf '%s\\n' 'SYNTHETIC_OIDC_SENSITIVE request-url token JWT' >&2
  if [[ "\${FAKE_OIDC:-}" = hang ]]; then
    trap '' TERM
    while :; do /bin/sleep 1; done
  fi
  if [[ "\${FAKE_OIDC:-}" = spoofed-marker ]]; then
    printf '%s\\n' 'npm verbose oidc Failed token exchange request with body message: injected success line' >&2
    printf '%s\\n' 'npm verbose oidc Successfully retrieved and set token' >&2
    exit 0
  fi
  [[ "\${FAKE_OIDC:-}" != reject && "\${FAKE_OIDC_FAIL_NAME:-}" != "$3" ]] || exit 7
  [[ "\${FAKE_OIDC:-}" = anonymous ]] || printf '%s\\n' 'npm verbose oidc Successfully retrieved and set token' >&2
  printf '%s\\n' 'SYNTHETIC_OIDC_SENSITIVE stdout'
  exit 0
fi
printf '%s\\n' "$*" >> state/writes
[[ "$*" = *--ignore-scripts* && "$npm_config_fetch_retries" = 0 ]]
if [[ "$1" = publish ]]; then
  test -f state/durable-intent.json
  cp "$2" state/archive.tgz
  jq '.packages[0] | {name,version,dist:{integrity:.integrity,tarball:"https://registry.npmjs.org/test.tgz"}}' release/release.json > state/metadata.json
  [[ "\${FAKE_DELAY:-}" != yes ]] || touch state/pending
  [[ "\${FAKE_WRITE_FAILURE:-}" != yes ]] || exit 9
else
  printf 1.2.3 > state/latest
  [[ "\${FAKE_TAG_DELAY:-}" != yes ]] || touch state/alias-pending
fi
`,
    { mode: 0o755 },
  );
  writeFileSync(path.join(root, "bin/sleep"), "#!/bin/bash\nexit 0\n", { mode: 0o755 });
  const run = (phase = "publish", extras: NodeJS.ProcessEnv = {}, script = shell) =>
    spawnSync("bash", ["-euo", "pipefail", "-c", script], {
      cwd: root,
      encoding: "utf8",
      timeout: 15_000,
      env: {
        ...process.env,
        PATH: `${path.join(root, "bin")}:${process.env.PATH}`,
        PHASE: phase,
        RELEASE_REPOSITORY: manifest.repository,
        RELEASE_SOURCE: source,
        RELEASE_RUN_ID: "123",
        RELEASE_RUN_ATTEMPT: "1",
        RELEASE_REF: "refs/heads/main",
        RELEASE_EVENT: "push",
        RELEASE_OWNER: "agent-teams-ai",
        npm_config_fetch_retries: "0",
        GITHUB_ACTIONS: "true",
        ACTIONS_ID_TOKEN_REQUEST_URL: "https://test.invalid/oidc",
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "synthetic-test-authority",
        RUNNER_TEMP: path.join(root, "temp"),
        GH_TOKEN: "test-nonsecret",
        GITHUB_OUTPUT: path.join(root, "outputs"),
        ...extras,
      },
    });
  const seed = (different = false) => {
    writeFileSync(
      path.join(root, "state/metadata.json"),
      JSON.stringify({
        name: entry.name,
        version: entry.version,
        dist: { integrity: entry.integrity, tarball: "https://registry.npmjs.org/test.tgz" },
      }),
    );
    if (different) {
      writeFileSync(path.join(root, "state/archive.tgz"), "different immutable bytes");
    } else {
      copyFileSync(path.join(root, "release/test.tgz"), path.join(root, "state/archive.tgz"));
    }
  };
  const writes = () => {
    try {
      return readFileSync(path.join(root, "state/writes"), "utf8").trim().split("\n");
    } catch {
      return [];
    }
  };
  return {
    root,
    manifest,
    entry,
    save,
    run,
    seed,
    writes,
    close: () => rmSync(root, { recursive: true, force: true }),
  };
}

void test("publishes once, waits through registry archive processing, and returns exact complete bytes", () => {
  const f = fixture();
  try {
    const result = f.run("publish", { FAKE_DELAY: "yes" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(f.writes().length, 1);
    assert.equal(readFileSync(path.join(f.root, "state/deletes"), "utf8").trim(), "777");
    assert.match(f.writes()[0] ?? "", /--tag candidate-run-123/);
    assert.deepEqual(
      readFileSync(path.join(f.root, "evidence/test.tgz")),
      readFileSync(path.join(f.root, "release/test.tgz")),
    );
    const receipt: unknown = JSON.parse(
      readFileSync(path.join(f.root, "evidence/receipt.json"), "utf8"),
    );
    assert.deepEqual(receipt, {
      ...f.manifest,
      complete: true,
      runId: "123",
      candidateTag: "candidate-run-123",
    });
  } finally {
    f.close();
  }
});

void test("existing identical versions reconcile without a write; changed immutable bytes reject", () => {
  for (const different of [false, true]) {
    const f = fixture();
    try {
      f.seed(different);
      const result = f.run();
      assert.equal(result.status, different ? 1 : 0, result.stderr);
      if (different) {
        assert.match(result.stderr, /SHA256 mismatch/);
      }
      assert.deepEqual(f.writes(), []);
    } finally {
      f.close();
    }
  }
});

void test("rejects traversal, source, name, version, hash and duplicate entries before any write", () => {
  const changes: Array<(release: Release) => void> = [
    (release) => {
      release.packages[0]!.file = "../escape.tgz";
    },
    (release) => {
      release.source = "b".repeat(40);
    },
    (release) => {
      release.packages[0]!.name = "@agent-teams/other";
    },
    (release) => {
      release.packages[0]!.version = "1.2.4";
    },
    (release) => {
      release.packages[0]!.sha256 = "0".repeat(64);
    },
    (release) => {
      release.packages.push({ ...release.packages[0]! });
    },
    (release) => {
      release.packages.push({
        ...release.packages[0]!,
        name: "@agent-teams/second",
        file: "missing.tgz",
      });
    },
  ];
  for (const change of changes) {
    const f = fixture();
    try {
      change(f.manifest);
      f.save();
      const result = f.run();
      assert.equal(result.status, 1, result.stderr);
      assert.match(
        result.stderr,
        /invalid manifest|identity mismatch|SHA256 mismatch|not a regular file/,
      );
      assert.deepEqual(f.writes(), []);
    } finally {
      f.close();
    }
  }
});

void test("an uncertain upload is not retried and its attempt evidence survives", () => {
  const f = fixture();
  try {
    const result = f.run("publish", { FAKE_WRITE_FAILURE: "yes" });
    assert.equal(result.status, 9, result.stderr);
    assert.equal(f.writes().length, 1);
    assert.throws(() => readFileSync(path.join(f.root, "state/deletes")));
    assert.match(readFileSync(path.join(f.root, "evidence/effects.tsv"), "utf8"), /upload-attempt/);
    const reconciliation = f.run();
    assert.equal(reconciliation.status, 0, reconciliation.stderr);
    assert.equal(f.writes().length, 1);
  } finally {
    f.close();
  }
});

void test("promotion requires matching complete same-run readback; repeated target is idempotent", () => {
  const f = fixture();
  try {
    f.seed();
    assert.equal(f.run().status, 0);
    mkdirSync(path.join(f.root, "registry"));
    for (const file of ["release.json", "receipt.json", "test.tgz"]) {
      copyFileSync(path.join(f.root, "evidence", file), path.join(f.root, "registry", file));
    }
    const receiptFile = path.join(f.root, "registry/receipt.json");
    const receipt: Record<string, unknown> = JSON.parse(readFileSync(receiptFile, "utf8"));
    writeFileSync(receiptFile, JSON.stringify({ ...receipt, runId: "999" }));
    assert.equal(f.run("promote").status, 1);
    assert.deepEqual(f.writes(), []);
    writeFileSync(receiptFile, JSON.stringify(receipt));
    const promoted = f.run("promote");
    assert.equal(promoted.status, 0, promoted.stderr);
    assert.deepEqual(f.writes(), [
      "dist-tag add @agent-teams/test-publisher@1.2.3 latest --ignore-scripts --registry=https://registry.npmjs.org",
    ]);
    assert.equal(f.run("promote").status, 0);
    assert.equal(f.writes().length, 1);
  } finally {
    f.close();
  }
});

void test("inadmissible events and refs cannot execute a registry mutation", () => {
  const f = fixture();
  try {
    for (const env of [
      { RELEASE_EVENT: "pull_request" },
      { RELEASE_REF: "refs/heads/feature" },
      { RELEASE_OWNER: "other" },
    ]) {
      const result = f.run("publish", env);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /inadmissible/);
      assert.deepEqual(f.writes(), []);
    }
  } finally {
    f.close();
  }
});

void test("source advancement stops an absent upload and latest promotion", () => {
  const f = fixture();
  try {
    const upload = f.run("publish", { FAKE_MAIN: "b".repeat(40) });
    assert.equal(upload.status, 1);
    assert.match(upload.stderr, /no longer current main/);
    assert.deepEqual(f.writes(), []);
    f.seed();
    assert.equal(f.run().status, 0);
    mkdirSync(path.join(f.root, "registry"));
    for (const file of ["release.json", "receipt.json", "test.tgz"]) {
      copyFileSync(path.join(f.root, "evidence", file), path.join(f.root, "registry", file));
    }
    const promotion = f.run("promote", { FAKE_MAIN: "b".repeat(40) });
    assert.equal(promotion.status, 1);
    assert.match(promotion.stderr, /no longer current main/);
    assert.deepEqual(f.writes(), []);
  } finally {
    f.close();
  }
});

void test("completed workflow admission binds success, push, source and repository", () => {
  const valid = {
    RELEASE_EVENT: "workflow_run",
    TRIGGER_CONCLUSION: "success",
    TRIGGER_EVENT: "push",
    TRIGGER_BRANCH: "main",
    TRIGGER_SOURCE: source,
    TRIGGER_REPOSITORY: "agent-teams-ai/TEST-publisher",
  };
  const overrides = [
    {},
    { TRIGGER_CONCLUSION: "failure" },
    { TRIGGER_EVENT: "pull_request" },
    { TRIGGER_BRANCH: "topic" },
    { TRIGGER_SOURCE: "b".repeat(40) },
    { TRIGGER_REPOSITORY: "other/repository" },
  ];
  for (const [index, override] of overrides.entries()) {
    const f = fixture();
    try {
      const result = f.run("publish", { ...valid, ...override });
      assert.equal(result.status, index === 0 ? 0 : 1, result.stderr);
      assert.equal(f.writes().length, index === 0 ? 1 : 0);
    } finally {
      f.close();
    }
  }
});

void test("an existing metadata record may precede blob visibility, and reruns only reconcile", () => {
  const f = fixture();
  try {
    const absent = f.run("publish", { RELEASE_RUN_ATTEMPT: "2" });
    assert.equal(absent.status, 1);
    assert.match(absent.stderr, /reruns cannot upload absent/);
    assert.deepEqual(f.writes(), []);
    f.seed();
    writeFileSync(path.join(f.root, "state/pending"), "");
    const present = f.run("publish", { RELEASE_RUN_ATTEMPT: "2" });
    assert.equal(present.status, 0, present.stderr);
    assert.deepEqual(f.writes(), []);
  } finally {
    f.close();
  }
});

void test("a prior durable intent blocks a fresh run from replaying a still-absent upload", () => {
  for (const priorVersion of ["1.2.3", "1.2.2"]) {
    const f = fixture();
    try {
      mkdirSync(path.join(f.root, "old-intent"));
      writeFileSync(
        path.join(f.root, "old-intent/intent.json"),
        JSON.stringify({
          ...f.manifest,
          runId: "99",
          runAttempt: "1",
          absent: [{ name: f.entry.name, version: priorVersion }],
        }),
      );
      execFileSync("zip", ["-q", path.join(f.root, "state/prior-intent.zip"), "intent.json"], {
        cwd: path.join(f.root, "old-intent"),
      });
      writeFileSync(
        path.join(f.root, "state/intents.json"),
        JSON.stringify({
          total_count: 1,
          artifacts: [{ id: 999, expired: false, workflow_run: { id: 99, head_sha: source } }],
        }),
      );
      const result = f.run();
      assert.equal(result.status, priorVersion === "1.2.3" ? 1 : 0, result.stderr);
      assert.equal(f.writes().length, priorVersion === "1.2.3" ? 0 : 1);
      if (priorVersion === "1.2.3") {
        assert.match(result.stderr, /prior upload intent for still-absent/);
      } else {
        const intent: unknown = JSON.parse(
          readFileSync(path.join(f.root, "intent/intent.json"), "utf8"),
        );
        assert.deepEqual(intent, {
          ...f.manifest,
          runId: "123",
          runAttempt: "1",
          absent: [{ name: f.entry.name, version: "1.2.3" }],
        });
      }
    } finally {
      f.close();
    }
  }
});

void test("expired or truncated durable intent history refuses fresh uploads", () => {
  for (const history of [
    { total_count: 101, artifacts: [] },
    { total_count: 1, artifacts: [] },
    {
      total_count: 1,
      artifacts: [{ id: 999, expired: true, workflow_run: { id: 99, head_sha: source } }],
    },
  ]) {
    const f = fixture();
    try {
      writeFileSync(path.join(f.root, "state/intents.json"), JSON.stringify(history));
      const result = f.run();
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /bounded audit|malformed intent history|prior intent expired/);
      assert.deepEqual(f.writes(), []);
    } finally {
      f.close();
    }
  }
});

void test("workflow persists intent successfully before its unconditional effect step", () => {
  const parsed = parseDocument(workflow);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.getIn(["jobs", "registry", "permissions", "actions"]), "write");
  const cleanupStep = workflow.slice(
    workflow.indexOf("      - name: Retire only resolved upload intents"),
  );
  assert.match(
    cleanupStep,
    /steps\.effects\.outcome == 'success' && steps\.evidence\.outcome == 'success'/,
  );
  const intentIndex = workflow.indexOf(
    "      - name: Preserve durable intent before the first upload",
  );
  const applyIndex = workflow.indexOf(applyMarker);
  assert.ok(intentIndex > workflow.indexOf("        id: preflight") && intentIndex < applyIndex);
  const intentStep = workflow.slice(intentIndex, applyIndex);
  assert.match(intentStep, /uses: actions\/upload-artifact@[a-f0-9]{40}/);
  assert.match(intentStep, /name: npm-upload-intent/);
  assert.match(intentStep, /if-no-files-found: error/);
  assert.doesNotMatch(
    workflow.slice(intentIndex, workflow.indexOf("        run: |", applyIndex)),
    /continue-on-error|always\(\)/,
  );
});

void test("cleanup refuses an unrelated artifact and resumes only the exact reconciled prior intent", () => {
  const rejected = fixture();
  try {
    const result = rejected.run("publish", { FAKE_RETIRE_NAME: "unrelated" });
    assert.equal(result.status, 1);
    assert.equal(rejected.writes().length, 1);
    assert.throws(() => readFileSync(path.join(rejected.root, "state/deletes")));
  } finally {
    rejected.close();
  }
  const recovered = fixture();
  try {
    recovered.seed();
    mkdirSync(path.join(recovered.root, "old-intent"));
    writeFileSync(
      path.join(recovered.root, "old-intent/intent.json"),
      JSON.stringify({
        ...recovered.manifest,
        runId: "99",
        runAttempt: "1",
        absent: [{ name: recovered.entry.name, version: recovered.entry.version }],
      }),
    );
    execFileSync(
      "zip",
      ["-q", path.join(recovered.root, "state/prior-intent.zip"), "intent.json"],
      { cwd: path.join(recovered.root, "old-intent") },
    );
    writeFileSync(
      path.join(recovered.root, "state/intents.json"),
      JSON.stringify({
        total_count: 1,
        artifacts: [{ id: 999, expired: false, workflow_run: { id: 99, head_sha: source } }],
      }),
    );
    const result = recovered.run("publish", { RELEASE_RUN_ATTEMPT: "2" });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(recovered.writes(), []);
    assert.equal(readFileSync(path.join(recovered.root, "state/deletes"), "utf8").trim(), "999");
    assert.deepEqual(
      readFileSync(path.join(recovered.root, "evidence/intents/999.json")),
      readFileSync(path.join(recovered.root, "old-intent/intent.json")),
    );
  } finally {
    recovered.close();
  }
});

void test("promotion refuses newer or unexpected latest and waits for a lagging alias without repeating the write", () => {
  for (const latest of ["1.2.4", "2.0.0", "1.2.4-rc.0", "unknown", "1.2.2"]) {
    const f = fixture();
    try {
      f.seed();
      assert.equal(f.run().status, 0);
      mkdirSync(path.join(f.root, "registry"));
      for (const file of ["release.json", "receipt.json", "test.tgz"]) {
        copyFileSync(path.join(f.root, "evidence", file), path.join(f.root, "registry", file));
      }
      writeFileSync(path.join(f.root, "state/latest"), latest);
      const result = f.run("promote", { FAKE_TAG_DELAY: "yes" });
      const admitted = latest === "1.2.2";
      assert.equal(result.status, admitted ? 0 : 1, result.stderr);
      assert.equal(f.writes().length, admitted ? 1 : 0);
      if (admitted) {
        assert.equal(
          readFileSync(path.join(f.root, "state/latest-reads"), "utf8").trim().split("\n").length,
          2,
        );
      } else {
        assert.match(result.stderr, /unexpected or newer latest/);
      }
    } finally {
      f.close();
    }
  }
});

void test("a same-run retry retires its prior-attempt intent only after exact registry reconciliation", () => {
  const f = fixture();
  try {
    f.seed();
    mkdirSync(path.join(f.root, "old-intent"));
    const intent = {
      ...f.manifest,
      runId: "123",
      runAttempt: "1",
      absent: [{ name: f.entry.name, version: f.entry.version }],
    };
    writeFileSync(path.join(f.root, "old-intent/intent.json"), JSON.stringify(intent));
    execFileSync("zip", ["-q", path.join(f.root, "state/prior-intent.zip"), "intent.json"], {
      cwd: path.join(f.root, "old-intent"),
    });
    writeFileSync(
      path.join(f.root, "state/intents.json"),
      JSON.stringify({
        total_count: 1,
        artifacts: [{ id: 999, expired: false, workflow_run: { id: 123, head_sha: source } }],
      }),
    );
    const result = f.run("publish", { RELEASE_RUN_ATTEMPT: "2", FAKE_PRIOR_RUN: "123" });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(f.writes(), []);
    assert.equal(readFileSync(path.join(f.root, "state/deletes"), "utf8").trim(), "999");
    assert.deepEqual(
      JSON.parse(readFileSync(path.join(f.root, "evidence/intents/999.json"), "utf8")),
      intent,
    );
  } finally {
    f.close();
  }
});

void test("read-only reconciliation requires actual OIDC exchange and never retains private npm logs", () => {
  for (const mode of ["success", "reject", "anonymous", "missing-authority", "spoofed-marker"]) {
    const f = fixture();
    try {
      f.seed();
      const result = f.run(
        "publish",
        mode === "missing-authority" ? { ACTIONS_ID_TOKEN_REQUEST_TOKEN: "" } : { FAKE_OIDC: mode },
      );
      assert.equal(result.status, mode === "success" ? 0 : 1, result.stderr);
      assert.deepEqual(f.writes(), []);
      assert.doesNotMatch(result.stdout + result.stderr, /SYNTHETIC_OIDC_SENSITIVE/);
      assert.deepEqual(readdirSync(path.join(f.root, "temp")), []);
      if (mode === "success") {
        assert.equal(
          readFileSync(path.join(f.root, "evidence/authority.tsv"), "utf8"),
          "oidc-exchange-verified\t@agent-teams/test-publisher\t1.2.3\n",
        );
      } else {
        assert.match(
          result.stderr,
          /OIDC exchange preflight failed|OIDC exchange reported failure|OIDC exchange was not established|OIDC request authority is unavailable/,
        );
      }
      for (const file of readdirSync(path.join(f.root, "evidence"), {
        recursive: true,
        withFileTypes: true,
      })) {
        if (file.isFile()) {
          assert.doesNotMatch(
            readFileSync(path.join(file.parentPath, file.name), "utf8"),
            /SYNTHETIC_OIDC_SENSITIVE/,
          );
        }
      }
    } finally {
      f.close();
    }
  }
});

void test("a second package's failed OIDC exchange prevents the first absent package upload", () => {
  const f = fixture();
  try {
    const secondName = "@agent-teams/second-publisher";
    const packageJson = path.join(f.root, "source/package/package.json");
    const metadata: Record<string, unknown> = JSON.parse(readFileSync(packageJson, "utf8"));
    writeFileSync(packageJson, JSON.stringify({ ...metadata, name: secondName }));
    const archive = path.join(f.root, "release/second.tgz");
    execFileSync("tar", ["-czf", archive, "-C", path.join(f.root, "source"), "package"]);
    const bytes = readFileSync(archive);
    f.manifest.packages.push({
      name: secondName,
      version: "1.2.3",
      file: "second.tgz",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
    });
    f.save();
    const result = f.run("publish", { FAKE_OIDC_FAIL_NAME: secondName });
    assert.equal(result.status, 1, result.stderr);
    assert.match(
      result.stderr,
      /OIDC exchange preflight failed for @agent-teams\/second-publisher/,
    );
    assert.deepEqual(f.writes(), []);
    assert.deepEqual(
      readFileSync(path.join(f.root, "state/authority-probes"), "utf8").trim().split("\n"),
      [f.entry.name, secondName],
    );
    assert.deepEqual(readdirSync(path.join(f.root, "temp")), []);
    assert.doesNotMatch(result.stdout + result.stderr, /SYNTHETIC_OIDC_SENSITIVE/);
  } finally {
    f.close();
  }
});

void test("the whole OIDC probe process is bounded and a TERM-resistant child is killed", () => {
  const f = fixture();
  try {
    // Execute the actual production timeout command with a compressed test deadline.
    const productionDeadline = "timeout --signal=TERM --kill-after=5s 90s npm dist-tag ls";
    assert.ok(shell.includes(productionDeadline));
    const bounded = shell.replace(
      productionDeadline,
      "timeout --signal=TERM --kill-after=0.1s 0.1s npm dist-tag ls",
    );
    const started = performance.now();
    const result = f.run("publish", { FAKE_OIDC: "hang" }, bounded);
    assert.equal(result.status, 1, result.stderr);
    assert.ok(performance.now() - started < 5_000, "probe exceeded its whole-process test budget");
    assert.match(result.stderr, /OIDC exchange preflight failed/);
    assert.deepEqual(f.writes(), []);
    assert.deepEqual(readdirSync(path.join(f.root, "temp")), []);
    assert.doesNotMatch(result.stdout + result.stderr, /SYNTHETIC_OIDC_SENSITIVE/);
  } finally {
    f.close();
  }
});
