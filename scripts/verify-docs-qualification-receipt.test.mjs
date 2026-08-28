import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, opendir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { verifyQualificationReceipt } from "./verify-docs-qualification-receipt.mjs";

const execute = promisify(execFile);
const sha = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` :
  value !== null && typeof value === "object" ? `{${Object.entries(value).sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b))).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}` : JSON.stringify(value);
const portable = (root, path) => relative(root, path).split(sep).join("/");
const INTEGRITY = `sha512-${"A".repeat(86)}==`;
const envelope = (receipt) => ({
  schemaVersion: 2, protocol: { id: "agent-teams.docs-protocol", version: 1 }, command: "docs.qualify",
  outcome: "success", diagnostics: [], result: receipt,
});

async function sourceDigest(root, governedRoots = []) {
  const rootExcluded = new Set([".agent-teams-local", ".cache", ".git", "target"]);
  const entries = [];
  async function visit(directory) {
    const handle = await opendir(directory);
    for await (const entry of handle) {
      const path = join(directory, entry.name); const repositoryPath = portable(root, path);
      const segments = repositoryPath.split("/");
      if (segments.some((segment) => segment === ".git" || segment === "node_modules")) continue;
      const governed = governedRoots.some((rootPath) => repositoryPath === rootPath || repositoryPath.startsWith(`${rootPath}/`) || rootPath.startsWith(`${repositoryPath}/`));
      if (!governed && rootExcluded.has(segments[0])) continue;
      if (!governed && ["target", ".cache"].includes(segments.at(-1))) {
        try {
          const tag = await readFile(join(path, "CACHEDIR.TAG"), "utf8");
          if (tag.split("\n", 1)[0] === "Signature: 8a477f597d28d172789f06886806bc55") continue;
        } catch {}
      }
      if (entry.isDirectory()) { entries.push(["directory", repositoryPath, path]); await visit(path); }
      else entries.push(["file", repositoryPath, path]);
    }
  }
  await visit(root);
  entries.sort(([leftKind, left], [rightKind, right]) => Buffer.compare(Buffer.from(`${leftKind}\0${left}`), Buffer.from(`${rightKind}\0${right}`)));
  const hash = createHash("sha256");
  for (const [kind, path, absolute] of entries) {
    hash.update(kind).update("\0").update(path).update("\0");
    if (kind === "file") hash.update(await readFile(absolute)).update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

function length(hash, value) { const bytes = Buffer.allocUnsafe(8); bytes.writeBigUInt64BE(BigInt(value)); hash.update(bytes); }
async function foundationIdentity(root) {
  const files = [];
  async function visit(directory, include) {
    const handle = await opendir(directory); const entries = [];
    for await (const entry of handle) entries.push(entry);
    entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path, include); else if (include(path)) files.push(path);
    }
  }
  await visit(join(root, "dist"), (path) => path.endsWith(".js"));
  await visit(join(root, "schemas"), () => true); await visit(join(root, "presets"), () => true);
  files.push(join(root, "package.json"));
  files.sort((left, right) => portable(root, left) < portable(root, right) ? -1 : 1);
  const hash = createHash("sha256");
  for (const path of files) {
    const pathBytes = Buffer.from(portable(root, path)); const bytes = await readFile(path);
    length(hash, pathBytes.length); hash.update(pathBytes); length(hash, bytes.length); hash.update(bytes);
  }
  return `sha256:${hash.digest("hex")}`;
}

async function treeDigest(root) {
  const entries = [];
  async function visit(directory) {
    const handle = await opendir(directory);
    for await (const entry of handle) {
      const path = join(directory, entry.name); const repositoryPath = portable(root, path);
      if (entry.isDirectory()) { entries.push(["directory", repositoryPath, path]); await visit(path); }
      else entries.push(["file", repositoryPath, path]);
    }
  }
  await visit(root); entries.sort(([leftKind, left], [rightKind, right]) => Buffer.compare(Buffer.from(`${leftKind}\0${left}`), Buffer.from(`${rightKind}\0${right}`)));
  const hash = createHash("sha256");
  for (const [kind, path, absolute] of entries) { hash.update(kind).update("\0").update(path).update("\0"); if (kind === "file") hash.update(await readFile(absolute)).update("\0"); }
  return `sha256:${hash.digest("hex")}`;
}

async function fixture(governedDocsRoots = []) {
  const temporary = await mkdtemp(join(tmpdir(), "docs-receipt-"));
  const root = join(temporary, "consumer");
  const installRoot = join(temporary, "install");
  const authorizationPath = join(temporary, "authorization.json");
  const installEvidencePath = join(temporary, "install-evidence.json");
  const receiptPath = join(temporary, "receipt.json");
  const paths = {
    integration: "architecture/foundation/docs-consumer-integration.json",
    contract: "architecture/foundation/docs-protocol-qualification.json",
    profile: "architecture/foundation/docs-protocol.yaml",
    skill: ".agents/skills/docs-authoring/SKILL.md",
  };
  const docsRoot = join(installRoot, "node_modules/@agent-teams/docs-protocol");
  const foundationRoot = join(installRoot, "node_modules/@agent-teams/engineering-foundation");
  await Promise.all([
    mkdir(join(root, "architecture/foundation"), { recursive: true }), mkdir(join(root, ".agents/skills/docs-authoring"), { recursive: true }),
    mkdir(join(root, "packages/app"), { recursive: true }),
    mkdir(join(docsRoot, "dist/qualification"), { recursive: true }), mkdir(join(foundationRoot, "dist"), { recursive: true }),
    mkdir(join(foundationRoot, "schemas"), { recursive: true }), mkdir(join(foundationRoot, "presets"), { recursive: true }),
  ]);
  const cohort = { cohortId: "docs-v2", packages: { docsProtocol: { version: "0.2.0", integrity: INTEGRITY }, engineeringFoundation: { version: "0.20.0", integrity: INTEGRITY } } };
  const integration = { schemaVersion: 2, profilePath: paths.profile, skillPath: paths.skill, governedDocsRoots,
    qualification: { contractPath: paths.contract, gateCommand: "pnpm docs:protocol:check" }, cohort };
  const outputDigest = sha("generated document");
  const contract = { schemaVersion: 2, scenarios: [{ id: "adr", type: "adr", intent: {}, expected: { documentPath: "docs/0001.md", goldenDigest: outputDigest } }] };
  const sources = {
    [paths.integration]: `${JSON.stringify(integration)}\n`, [paths.contract]: `${JSON.stringify(contract)}\n`,
    [paths.profile]: "schemaVersion: 2\n", [paths.skill]: "# Skill\n", "package.json": "{}\n", "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
  };
  await Promise.all(Object.entries(sources).map(async ([path, source]) => { await mkdir(join(root, path, ".."), { recursive: true }); await writeFile(join(root, path), source); }));
  const docsFacade = 'export { runDocsProtocolQualificationV2 } from "./qualification-v2-runner.js";\n';
  const docsRunner = "export const runDocsProtocolQualificationV2 = async () => true;\n";
  await Promise.all([
    writeFile(join(docsRoot, "package.json"), `${JSON.stringify({ name: "@agent-teams/docs-protocol", version: "0.2.0" })}\n`),
    writeFile(join(docsRoot, "dist/qualification/index.js"), docsFacade),
    writeFile(join(docsRoot, "dist/qualification/qualification-v2-runner.js"), docsRunner),
    writeFile(join(foundationRoot, "package.json"), `${JSON.stringify({ name: "@agent-teams/engineering-foundation", version: "0.20.0" })}\n`),
    writeFile(join(foundationRoot, "dist/index.js"), "export {};\n"), writeFile(join(foundationRoot, "schemas/model.json"), "{}\n"),
    writeFile(join(foundationRoot, "presets/base.json"), "{}\n"),
    writeFile(join(installRoot, "pnpm-lock.yaml"), `lockfileVersion: '9.0'\npackages:\n  '@agent-teams/docs-protocol@0.2.0':\n    resolution:\n      integrity: ${INTEGRITY}\n  '@agent-teams/engineering-foundation@0.20.0':\n    resolution:\n      integrity: ${INTEGRITY}\n`),
  ]);
  await execute("git", ["init", "-q", root]);
  await execute("git", ["-C", root, "add", "."]);
  await execute("git", ["-C", root, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-qm", "fixture"]);
  const { stdout } = await execute("git", ["-C", root, "rev-parse", "HEAD"]); const callerSha = stdout.trim();
  const body = {
    schemaVersion: 2, cohortAdmissible: true, evidenceClass: "released-cohort", projectId: "fixture",
    scenarios: [{ id: "adr", type: "adr", documentPath: "docs/0001.md", outputDigest }],
    checks: ["info", "find", "check", "doctor", "recover", "preview", "apply", "path", "reachability", "golden", "source-unchanged"],
    derived: { contractPath: paths.contract, gateCommand: "pnpm docs:protocol:check", packageVersions: { docsProtocol: "0.2.0", engineeringFoundation: "0.20.0" }, profilePath: paths.profile },
    evidence: {
      sourceDigest: await sourceDigest(root, governedDocsRoots), integration: { path: paths.integration, digest: sha(sources[paths.integration]) },
      contract: { path: paths.contract, digest: sha(sources[paths.contract]) }, profile: { path: paths.profile, digest: sha(sources[paths.profile]) },
      skill: { path: paths.skill, digest: sha(sources[paths.skill]) }, packageManifestDigest: sha(sources["package.json"]), lockfileDigest: sha(sources["pnpm-lock.yaml"]),
      executingDocsProtocol: { version: "0.2.0", buildDigest: sha(docsRunner) },
      executingFoundation: { version: "0.20.0", buildIdentity: await foundationIdentity(foundationRoot) }, cohort,
    },
  };
  const receipt = { ...body, receiptDigest: sha(canonical(body)) };
  const authorization = { callerSha, expectedPackages: [
    { name: "@agent-teams/engineering-foundation", version: "0.20.0", integrity: INTEGRITY },
    { name: "@agent-teams/docs-protocol", version: "0.2.0", integrity: INTEGRITY },
  ] };
  const authorizationDigest = sha(canonical({ domain: "agent-teams.docs-consumer-gate-authorization/v1", body: authorization }));
  await writeFile(authorizationPath, `${canonical({ authorization, authorizationDigest })}\n`);
  await writeFile(installEvidencePath, `${canonical({ schemaVersion: 1, authorizationDigest, packages: [
    { ...authorization.expectedPackages[0], treeDigest: await treeDigest(foundationRoot) },
    { ...authorization.expectedPackages[1], treeDigest: await treeDigest(docsRoot) },
  ] })}\n`);
  await writeFile(receiptPath, `${JSON.stringify(envelope(receipt))}\n`);
  return { temporary, root, installRoot, authorizationPath, installEvidencePath, receiptPath, receipt, callerSha };
}

function verify(value, overrides = {}) {
  return verifyQualificationReceipt({ consumerRoot: value.root, installRoot: value.installRoot,
    authorizationPath: value.authorizationPath, installEvidencePath: value.installEvidencePath,
    receiptPath: value.receiptPath, callerSha: value.callerSha, ...overrides });
}

async function rewriteReceipt(value, mutate) {
  const changed = structuredClone(value.receipt); mutate(changed);
  const { receiptDigest: _old, ...body } = changed; changed.receiptDigest = sha(canonical(body));
  await writeFile(value.receiptPath, `${JSON.stringify(envelope(changed))}\n`);
}

test("binds a released-cohort receipt to the exact executing runner rather than its export facade", async () => {
  const value = await fixture();
  try {
    const qualificationRoot = join(value.installRoot, "node_modules/@agent-teams/docs-protocol/dist/qualification");
    assert.notEqual(sha(await readFile(join(qualificationRoot, "index.js"))), sha(await readFile(join(qualificationRoot, "qualification-v2-runner.js"))));
    const verified = await verify(value);
    assert.equal(verified.receiptDigest, value.receipt.receiptDigest);
  } finally { await rm(value.temporary, { recursive: true, force: true }); }
});

test("rejects a receipt bound to the qualification export facade", async () => {
  const value = await fixture();
  try {
    const facade = await readFile(join(value.installRoot, "node_modules/@agent-teams/docs-protocol/dist/qualification/index.js"));
    await rewriteReceipt(value, (receipt) => { receipt.evidence.executingDocsProtocol.buildDigest = sha(facade); });
    await assert.rejects(verify(value), /execution identity/u);
  } finally { await rm(value.temporary, { recursive: true, force: true }); }
});

test("rejects forged checkout, source, build, scenario, checks, and open receipt shape", async () => {
  for (const [mutate, pattern] of [
    [(receipt) => { receipt.evidence.sourceDigest = sha("fake source"); }, /source digest/u],
    [(receipt) => { receipt.evidence.executingDocsProtocol.buildDigest = sha("fake docs build"); }, /execution identity/u],
    [(receipt) => { receipt.evidence.executingFoundation.buildIdentity = sha("fake foundation build"); }, /execution identity/u],
    [(receipt) => { receipt.scenarios[0].id = "fake"; }, /scenarios differ/u],
    [(receipt) => { receipt.scenarios[0].outputDigest = sha("fake output"); }, /scenarios differ/u],
    [(receipt) => { receipt.checks.push("fake"); }, /checks differ/u],
    [(receipt) => { receipt.untrusted = true; }, /shape is not closed/u],
  ]) {
    const value = await fixture();
    try {
      await rewriteReceipt(value, mutate);
      await assert.rejects(verify(value), pattern);
    } finally { await rm(value.temporary, { recursive: true, force: true }); }
  }
  const head = await fixture();
  try {
    await assert.rejects(verify(head, { callerSha: "a".repeat(40) }), /package authority|checkout HEAD/u);
  } finally { await rm(head.temporary, { recursive: true, force: true }); }
});

test("requires receipt evidence outside the consumer source tree", async () => {
  const value = await fixture();
  try {
    const inside = join(value.root, "receipt.json"); await writeFile(inside, `${JSON.stringify(envelope(value.receipt))}\n`);
    await assert.rejects(verify(value, { receiptPath: inside }), /outside the consumer root/u);
  } finally { await rm(value.temporary, { recursive: true, force: true }); }
});

test("rejects non-successful or open qualification command envelopes", async () => {
  for (const mutate of [
    (value) => { value.command = "docs.check"; },
    (value) => { value.outcome = "violation"; value.result = {}; },
    (value) => { value.diagnostics = [{ ruleId: "fake" }]; },
    (value) => { value.extra = true; },
  ]) {
    const value = await fixture();
    try {
      const commandEnvelope = envelope(value.receipt); mutate(commandEnvelope);
      await writeFile(value.receiptPath, `${JSON.stringify(commandEnvelope)}\n`);
      await assert.rejects(verify(value), /command envelope/u);
    } finally { await rm(value.temporary, { recursive: true, force: true }); }
  }
});

test("matches the package source exclusion contract exactly", async () => {
  for (const path of ["target", ".cache", "packages/app/target", "packages/app/.cache"]) {
    const regular = await fixture();
    try {
      await mkdir(join(regular.root, path, ".."), { recursive: true });
      await writeFile(join(regular.root, path), "regular source evidence\n");
      await assert.rejects(verify(regular), /source digest/u);
    } finally { await rm(regular.temporary, { recursive: true, force: true }); }
  }

  const nested = await fixture();
  try {
    await mkdir(join(nested.root, "packages/app/target"), { recursive: true });
    await writeFile(join(nested.root, "packages/app/target/evidence.txt"), "must remain source evidence\n");
    await assert.rejects(verify(nested), /source digest/u);
  } finally { await rm(nested.temporary, { recursive: true, force: true }); }

  const rootCache = await fixture();
  try {
    await mkdir(join(rootCache.root, "target"), { recursive: true });
    await writeFile(join(rootCache.root, "target/cache.txt"), "root build cache\n");
    await assert.doesNotReject(verify(rootCache));
  } finally { await rm(rootCache.temporary, { recursive: true, force: true }); }

  const tagged = await fixture();
  try {
    await mkdir(join(tagged.root, "packages/app/target"), { recursive: true });
    await writeFile(join(tagged.root, "packages/app/target/CACHEDIR.TAG"), "Signature: 8a477f597d28d172789f06886806bc55\n");
    await writeFile(join(tagged.root, "packages/app/target/cache.bin"), "ignored cache\n");
    await assert.doesNotReject(verify(tagged));
  } finally { await rm(tagged.temporary, { recursive: true, force: true }); }

  const governed = await fixture(["packages/app/target"]);
  try {
    await mkdir(join(governed.root, "packages/app/target"), { recursive: true });
    await writeFile(join(governed.root, "packages/app/target/CACHEDIR.TAG"), "Signature: 8a477f597d28d172789f06886806bc55\n");
    await writeFile(join(governed.root, "packages/app/target/governed.md"), "must remain evidence\n");
    await assert.rejects(verify(governed), /source digest/u);
  } finally { await rm(governed.temporary, { recursive: true, force: true }); }
});

test("rejects tampered installed bytes even with a forged self-declared build digest", async () => {
  const value = await fixture();
  try {
    const modulePath = join(value.installRoot, "node_modules/@agent-teams/docs-protocol/dist/qualification/qualification-v2-runner.js");
    const tampered = "export const qualification = 'tampered';\n";
    await writeFile(modulePath, tampered);
    await rewriteReceipt(value, (receipt) => { receipt.evidence.executingDocsProtocol.buildDigest = sha(tampered); });
    await assert.rejects(verify(value), /package bytes changed/u);
  } finally { await rm(value.temporary, { recursive: true, force: true }); }
});

test("rejects a wrong central expectedPackages SRI even when local evidence is re-signed", async () => {
  const value = await fixture();
  try {
    const wrongIntegrity = `sha512-${"B".repeat(86)}==`;
    const authorizationEnvelope = JSON.parse(await readFile(value.authorizationPath, "utf8"));
    authorizationEnvelope.authorization.expectedPackages[1].integrity = wrongIntegrity;
    authorizationEnvelope.authorizationDigest = sha(canonical({ domain: "agent-teams.docs-consumer-gate-authorization/v1", body: authorizationEnvelope.authorization }));
    await writeFile(value.authorizationPath, `${canonical(authorizationEnvelope)}\n`);
    const evidence = JSON.parse(await readFile(value.installEvidencePath, "utf8"));
    evidence.authorizationDigest = authorizationEnvelope.authorizationDigest;
    evidence.packages[1].integrity = wrongIntegrity;
    await writeFile(value.installEvidencePath, `${canonical(evidence)}\n`);
    await assert.rejects(verify(value), /central expectedPackages SRI/u);
  } finally { await rm(value.temporary, { recursive: true, force: true }); }
});
