import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

export const BOOTSTRAP_GUIDE = "https://github.com/agent-teams-ai/.github/blob/main/docs/repository-admission.md#new-repository-bootstrap";
export const BOOTSTRAP_START = "2026-10-22T00:00:00Z";
export const IDENTITY_REVISION = "1f8dc7a2ee33e3cc3810f0c4c2d5e9f3f20241d0";
const revisionPattern = /^(?!0{40}$)[a-f0-9]{40}$/u;
export const ADMISSION_CALLER = ".github/workflows/repository-admission.yml";
export const MAX_FILE_BYTES = 256 * 1024;
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
export const MAX_FILES = 256;

type Data = Record<string, unknown>;
export interface AdmissionIssue { path: string; message: string }
export interface AdmissionSource {
  read: (path: string) => Promise<string | undefined>;
  workflows: () => Promise<string[]>;
  defaultBranch?: string;
}
export interface AdmissionResult {
  status: "configured_not_qualified" | "incomplete" | "unsupported_stack_pending";
  guide: string;
  issues: AdmissionIssue[];
  inspected_paths: string[];
}
const data = (value: unknown): Data => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Data : {};
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
const records = (value: unknown): Data[] => Array.isArray(value) ? value.map(data) : [];
const nonempty = (value: unknown): value is string => typeof value === "string" && value.length > 0;

export function safeAdmissionPath(path: string): boolean {
  return path.length > 0 && path.length <= 240 && !path.includes("\\") && !path.includes("\0") &&
    !path.startsWith("/") && path.split("/").every(part => part !== "" && part !== "." && part !== "..");
}

export function renderRepositoryAdmissionCaller(revision: string): string {
  if (!revisionPattern.test(revision)) { throw new Error("A nonzero immutable central revision is required."); }
  return `name: Repository admission\non:\n  pull_request:\n  push:\n    branches: [main]\npermissions:\n  contents: read\njobs:\n  admission:\n    uses: agent-teams-ai/.github/.github/workflows/repository-admission-check.yml@${revision}\n`;
}

// The local adapter opens bounded regular UTF-8 files only, including every
// ancestor. Consumer code, package scripts and commands are never executed.
export async function localAdmissionSource(root: string): Promise<AdmissionSource> {
  const base = await realpath(root);
  let bytes = 0;
  let files = 0;
  const read = async (path: string): Promise<string | undefined> => {
    if (!safeAdmissionPath(path)) { throw new Error("Unsafe repository-relative path."); }
    let current = base;
    for (const part of path.split("/").slice(0, -1)) {
      current = join(current, part);
      const stat = await lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) { throw new Error("File ancestors must be regular directories."); }
    }
    let handle;
    try { handle = await open(join(base, path), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
    catch (error) { if (data(error).code === "ENOENT") { return undefined; } throw error; }
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_FILE_BYTES || ++files > MAX_FILES) { throw new Error("Regular-file read limit exceeded."); }
      const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
      let length = 0;
      while (length < buffer.length) {
        const result = await handle.read(buffer, length, buffer.length - length, null);
        if (result.bytesRead === 0) { break; }
        length += result.bytesRead;
      }
      bytes += length;
      if (length > MAX_FILE_BYTES || bytes > MAX_TOTAL_BYTES) { throw new Error("Repository read budget exceeded."); }
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, length));
    } finally { await handle.close(); }
  };
  return { read, workflows: async () => {
    const directory = join(base, ".github/workflows");
    try {
      for (const path of [join(base, ".github"), directory]) {
        const stat = await lstat(path);
        if (!stat.isDirectory() || stat.isSymbolicLink()) { throw new Error("Workflow ancestors must be regular directories."); }
      }
      const entries = await readdir(directory, { withFileTypes: true });
      if (entries.length > MAX_FILES) { throw new Error("Workflow census exceeds the bounded limit."); }
      return entries.filter(entry => /\.ya?ml$/u.test(entry.name)).map(entry => `.github/workflows/${entry.name}`).toSorted();
    } catch (error) { if (data(error).code === "ENOENT") { return []; } throw error; }
  } };
}

function parseStructured(text: string, path: string): unknown {
  if (path.endsWith(".json")) { return JSON.parse(text) as unknown; }
  const document = parseDocument(text, { uniqueKeys: true });
  if (document.errors.length > 0) { throw new Error("Invalid YAML document."); }
  return document.toJS({ maxAliasCount: 0 }) as unknown;
}

// Deliberately bounded shell subset. Only direct commands joined by && or
// newlines count. Comments, echo/exit/true, pipelines, substitutions, conditions,
// wrappers and expressions cannot masquerade as a native gate.
export function directCommands(command: string, allowFailFastLines = false): string[] {
  if (command.length > 32_768) { return []; }
  const lines = command.split(/\r?\n/u).map(line => line.trim()).filter(line => line && !line.startsWith("#"));
  // A package manager's ordinary script shell does not fail on earlier lines.
  if (!allowFailFastLines && lines.length > 1) { return []; }
  const atoms = lines.flatMap(line => line.split(/\s*&&\s*/u));
  if (atoms.length === 0 || atoms.length > 256 || atoms.some(atom => !/^[A-Za-z0-9_./:@*=-]+(?:\s+[A-Za-z0-9_./:@*=-]+)*$/u.test(atom))) { return []; }
  if (atoms.some(atom => /^(?:exit|true|false|echo|printf|eval|exec|sh|bash|if|test|:)(?:\s|$)/u.test(atom))) { return []; }
  return atoms.map(atom => atom.replace(/\s+/gu, " "));
}

function scriptName(command: string, manager: string): string | undefined {
  // Bun built-ins take precedence over package scripts. Only `bun run NAME`
  // denotes an unambiguous script reference; `bun test` is a native test leaf.
  if (manager === "bun") { return /^bun run ([A-Za-z0-9_:@-]+)$/u.exec(command)?.[1]; }
  return new RegExp(`^${manager} (?:run )?([A-Za-z0-9_:@-]+)$`, "u").exec(command)?.[1];
}

export function expandAdmissionScript(name: string, scripts: Data, manager: string): Set<string> {
  const memo = new Map<string, Set<string>>();
  let nodes = 0;
  let edges = 0;
  const visit = (current: string, ancestors: string[]): Set<string> => {
    if (ancestors.includes(current) || ancestors.length > 32 || typeof scripts[current] !== "string") { throw new Error(`Missing or cyclic native script: ${current}`); }
    const completed = memo.get(current);
    if (completed) { return completed; }
    if (++nodes > 256) { throw new Error("Native script graph exceeds the bounded node budget."); }
    const atoms = directCommands(scripts[current]);
    edges += atoms.length;
    if (edges > 4096 || atoms.length === 0) { throw new Error(`Native script ${current} is not a supported bounded direct command route.`); }
    const result = new Set<string>();
    for (const atom of atoms) {
      const child = scriptName(atom, manager);
      if (child !== undefined) {
        for (const leaf of visit(child, [...ancestors, current])) { result.add(leaf); }
      } else { result.add(atom); }
      if (result.size > 4096) { throw new Error("Native gate leaf budget exceeded."); }
    }
    memo.set(current, result);
    return result;
  };
  return visit(name, []);
}

function unconditionalPrWorkflow(workflow: Data): boolean {
  const events = workflow.on;
  if (events === "pull_request") { return true; }
  if (Array.isArray(events)) { return events.includes("pull_request"); }
  const mapping = data(events);
  return Object.hasOwn(mapping, "pull_request") && (mapping.pull_request === null ||
    typeof mapping.pull_request === "object" && !Array.isArray(mapping.pull_request) && Object.keys(data(mapping.pull_request)).length === 0);
}

function safeJob(id: string, jobs: Data, ancestors: string[] = [], memo = new Map<string, boolean>()): boolean {
  if (ancestors.includes(id) || ancestors.length > 64 || !Object.hasOwn(jobs, id)) { return false; }
  const job = data(jobs[id]);
  const completed = memo.get(id);
  if (completed !== undefined) { return completed; }
  if (job.if !== undefined || job["continue-on-error"] !== undefined || job.uses !== undefined) { return false; }
  const needs = typeof job.needs === "string" ? [job.needs] : strings(job.needs);
  if (job.needs !== undefined && typeof job.needs !== "string" && (!Array.isArray(job.needs) || job.needs.some(value => typeof value !== "string"))) { return false; }
  if (needs.length > 256) { return false; }
  const valid = needs.every(parent => safeJob(parent, jobs, [...ancestors, id], memo));
  memo.set(id, valid);
  return valid;
}

function workflowCommands(workflow: Data, scripts: Data, manager: string): Set<string> {
  const commands = new Set<string>();
  if (!unconditionalPrWorkflow(workflow)) { return commands; }
  const jobs = data(workflow.jobs);
  if (Object.keys(jobs).length > 256) { return commands; }
  const jobMemo = new Map<string, boolean>();
  for (const [id, rawJob] of Object.entries(jobs)) {
    if (!safeJob(id, jobs, [], jobMemo)) { continue; }
    const job = data(rawJob);
    if (typeof job["runs-on"] !== "string" || !/^ubuntu-(?:latest|\d+\.\d+)$/u.test(job["runs-on"])) { continue; }
    if (data(job.defaults).run !== undefined || data(workflow.defaults).run !== undefined) { continue; }
    for (const step of records(job.steps)) {
      if (step.if !== undefined || step["continue-on-error"] !== undefined || step["working-directory"] !== undefined || typeof step.run !== "string" ||
          step.shell !== undefined && step.shell !== "bash" && step.shell !== "sh") { continue; }
      const controls = /^(?:BASH_ENV|ENV|SHELLOPTS|NODE_OPTIONS|PATH|SHELL|PNPM_HOME|BUN_OPTIONS|NPM_CONFIG_SCRIPT_SHELL|PNPM_SCRIPT_SHELL)$/u;
      if ([workflow.env, job.env, step.env].some(env => Object.keys(data(env)).some(key => controls.test(key.toUpperCase())))) { continue; }
      for (const atom of directCommands(step.run, true)) {
        const script = scriptName(atom, manager);
        try {
          if (script !== undefined && Object.hasOwn(scripts, script)) {
            for (const leaf of expandAdmissionScript(script, scripts, manager)) { commands.add(leaf); }
          } else { commands.add(atom); }
        } catch { /* An unsupported route never provides coverage. */ }
      }
    }
  }
  return commands;
}

export async function checkRepositoryAdmission(source: AdmissionSource): Promise<AdmissionResult> {
  const issues: AdmissionIssue[] = [];
  const cache = new Map<string, string | undefined>();
  const issue = (path: string, message: string) => { issues.push({ path, message }); };
  const read = async (path: string, required = true): Promise<string | undefined> => {
    if (!safeAdmissionPath(path)) { issue(path, "Use a bounded repository-relative regular-file path."); return undefined; }
    if (!cache.has(path)) {
      try { cache.set(path, await source.read(path)); }
      catch { cache.set(path, undefined); issue(path, "Required file is unsafe, unreadable or exceeds the bounded UTF-8 read limits."); }
    }
    const text = cache.get(path);
    if (required && text === undefined) { issue(path, "Required regular file is missing; follow the new-repository bootstrap guide."); }
    return text;
  };
  const document = async (path: string): Promise<Data> => {
    const text = await read(path);
    if (text === undefined) { return {}; }
    try { return data(parseStructured(text, path)); }
    catch { issue(path, "Expected valid JSON or unique-key YAML without aliases."); return {}; }
  };
  const manifest = await document("package.json");
  const npmrc = await read(".npmrc", false);
  if (npmrc !== undefined && /^\s*(?:script[-_]shell|shell[-_]emulator)\s*=/imu.test(npmrc)) {
    issue(".npmrc", "Custom package-script shells are outside the supported fail-fast native gate contract.");
  }
  const workspaceText = await read("pnpm-workspace.yaml", false);
  if (workspaceText !== undefined) {
    try {
      const workspace = data(parseStructured(workspaceText, "pnpm-workspace.yaml"));
      if (workspace.scriptShell !== undefined || workspace.shellEmulator !== undefined) { issue("pnpm-workspace.yaml", "Custom package-script shell controls need a reviewed adapter."); }
    } catch { issue("pnpm-workspace.yaml", "Expected valid unique-key YAML without aliases."); }
  }
  if (data(manifest.pnpm).scriptShell !== undefined || data(manifest.pnpm).shellEmulator !== undefined) { issue("package.json", "Custom package-script shell controls need a reviewed adapter."); }
  const manager = typeof manifest.packageManager === "string" ? /^(pnpm|bun)@\d+\.\d+\.\d+(?:\+[A-Za-z0-9.]+)?$/u.exec(manifest.packageManager)?.[1] : undefined;
  const result = (status: AdmissionResult["status"]): AdmissionResult => ({ status, guide: BOOTSTRAP_GUIDE, issues, inspected_paths: [...cache.keys()].toSorted() });
  if (manager === undefined) {
    issue("package.json", "Unsupported stack pending: v1 supports explicitly pinned JavaScript/TypeScript pnpm or Bun projects only; request an owned adapter before admission.");
  }
  const unsupportedBranch = source.defaultBranch !== undefined && source.defaultBranch !== "main";
  if (unsupportedBranch) { issue(ADMISSION_CALLER, "Unsupported branch layout pending: v1's canonical caller requires a main default branch."); }

  const caller = await read(ADMISSION_CALLER);
  const callerRevision = caller?.match(/repository-admission-check\.yml@([a-f0-9]{40})\n$/u)?.[1];
  if (!callerRevision || !revisionPattern.test(callerRevision) || caller !== renderRepositoryAdmissionCaller(callerRevision)) {
    issue(ADMISSION_CALLER, "Use the exact inputless central caller with a nonzero immutable central workflow revision; no inputs, secrets, conditions or permission changes.");
  }
  const identityPath = ".github/workflows/commit-author-identity.yml";
  const identity = await read(identityPath);
  const trustedIdentity = await (await localAdmissionSource(dirname(fileURLToPath(new URL("../package.json", import.meta.url))))).read("scripts/fixtures/commit-author-identity-caller.yml");
  if (identity !== trustedIdentity?.replaceAll("CENTRAL_REVISION", IDENTITY_REVISION)) {
    issue(identityPath, "Install the exact centrally owned identity caller at its retained trusted implementation pin; use the identity onboarding guide.");
  }
  const texts: string[] = [];
  for (const path of ["AGENTS.md", "CLAUDE.md", "README.md"]) { texts.push(await read(path) ?? ""); }
  if (!texts[0]?.includes(BOOTSTRAP_GUIDE) || !(texts[1]?.includes("AGENTS.md") || texts[1]?.includes(BOOTSTRAP_GUIDE))) {
    issue("AGENTS.md", "Route agents to the central new-repository bootstrap guide; CLAUDE.md must route through AGENTS.md or that guide.");
  }
  const foundation = await document("foundation.config.yaml");
  const capabilities = data(foundation.capabilities);
  const configPath = (capability: string): string | undefined => {
    const path = data(capabilities[capability]).configPath;
    if (!nonempty(path)) { issue("foundation.config.yaml", `Declare ${capability} with its consumer-owned configPath.`); return undefined; }
    return path;
  };
  const sourcePath = configPath("architecture.source-dependencies");
  const coveragePath = configPath("quality.source-coverage");
  const suppressionPath = configPath("quality.suppression-governance");
  const sourcePolicy = sourcePath ? await document(sourcePath) : {};
  const coverage = coveragePath ? await document(coveragePath) : {};
  if (suppressionPath) { await document(suppressionPath); }
  if (coverage.sourcePolicyPath !== sourcePath || coverage.suppressionPolicyPath !== suppressionPath) {
    issue(coveragePath ?? "foundation.config.yaml", "Bind source coverage to the same owned source policy and suppression governance paths.");
  }
  const lintPath = coverage.lintConfigPath;
  const lint = nonempty(lintPath) ? await document(lintPath) : {};
  if (!strings(lint.extends).some(path => path.includes("@agent-teams/engineering-foundation/presets/oxlint/type-aware"))) {
    issue(typeof lintPath === "string" ? lintPath : "foundation.config.yaml", "Use the adopted Foundation type-aware quality preset and governed suppressions.");
  }
  const devDependencies = data(manifest.devDependencies);
  for (const name of ["@agent-teams/engineering-foundation", "@agent-teams/feature-module-standard"]) {
    if (typeof devDependencies[name] !== "string" || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/u.test(devDependencies[name])) {
      issue("package.json", `Declare the exact ${name} development-only package pin.`);
    }
    if (data(manifest.dependencies)[name] !== undefined) { issue("package.json", `${name} must remain development-only.`); }
  }
  if (manager !== undefined) { await read(manager === "pnpm" ? "pnpm-lock.yaml" : "bun.lock"); }

  const profilePath = coverage.featureProfilePath;
  const profile = nonempty(profilePath) ? await document(profilePath) : {};
  const standard = data(profile.standard);
  if (standard.id !== "agent-teams.feature-module-standard" || standard.version !== "v1.1" || standard.repository !== "agent-teams-ai/.github" ||
      standard.path !== "docs/architecture/feature-module-standard/v1.1.md" || standard.digest !== "sha256:cfa088ef7396139554fe5e3bcc839271b23299c6b60c569a3a7f1cd7c9f0bc6c" ||
      typeof standard.commit !== "string" || !revisionPattern.test(standard.commit) || profile.status !== "adopted") {
    issue(typeof profilePath === "string" ? profilePath : "foundation.config.yaml", "Explicitly adopt complete immutable FMS v1.1 identity, path, digest and nonzero source commit in one owned profile.");
  }
  for (const field of ["productionRoots", "applicationRoots", "excludedRoots", "extensions", "deviations"]) {
    if (!Array.isArray(profile[field])) { issue(String(profilePath ?? "foundation.config.yaml"), `Declare ${field} explicitly, including an empty array when applicable.`); }
  }
  const architecture = profile.architectureDocument;
  if (nonempty(architecture)) { await read(architecture.split("#")[0] ?? ""); }
  else { issue(String(profilePath ?? "foundation.config.yaml"), "Name the local architectureDocument."); }
  const decisions = strings(profile.decisionRecords);
  if (decisions.length === 0) { issue(String(profilePath ?? "foundation.config.yaml"), "Name owner-approved adoption decisionRecords."); }
  for (const path of decisions) { await read(path.split("#")[0] ?? ""); }
  if (nonempty(profilePath) && !texts[2]?.includes(profilePath)) { issue("README.md", "Link the one owned FMS adoption profile from the repository entry point."); }
  const modules = records(profile.modules);
  if (modules.length === 0) { issue(String(profilePath ?? "foundation.config.yaml"), "Map every production module and its real feature ownership; SDKs are in scope."); }
  const governed = strings(sourcePolicy.governedRoots);
  const compilerProjects = strings(coverage.compilerProjects);
  for (const module of modules) {
    const features = records(module.features);
    if (!nonempty(module.id) || !nonempty(module.role) || !nonempty(module.root) || !nonempty(module.sourceRoot) ||
        features.length === 0 || features.some(feature => !nonempty(feature.id) || !nonempty(feature.root) || records(feature.layers).length === 0) ||
        !governed.includes(String(module.sourceRoot)) || !compilerProjects.some(path => module.root === "." || path.startsWith(`${String(module.root)}/`))) {
      issue(String(profilePath), "Each real production module needs an explicit role, source root, feature/layer ownership, governed coverage and a compiler project.");
    }
  }
  if (compilerProjects.length === 0) { issue(coveragePath ?? "foundation.config.yaml", "Declare real production compilerProjects; an empty solution is not coverage."); }
  const compilerOptions = async (path: string, chain: string[] = []): Promise<Data> => {
    if (chain.includes(path) || chain.length > 16) { issue(path, "Compiler inheritance must be bounded and acyclic."); return {}; }
    const config = await document(path);
    let parent: Data = {};
    if (typeof config.extends === "string") {
      const absolute = resolve("/consumer", dirname(path), config.extends);
      const target = absolute.slice("/consumer/".length);
      if (/^@agent-teams\/engineering-foundation\/presets\/typescript\/(?:base|node|bun)\.json$/u.test(config.extends)) {
        // Recognize the published Foundation strict preset contract. This is a
        // configuration binding, never installed-package integrity evidence.
        parent = { strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true };
      } else if (!config.extends.startsWith(".")) { issue(path, "v1 supports only local inheritance and the named Foundation strict presets."); }
      else if (!absolute.startsWith("/consumer/")) { issue(path, "Compiler inheritance must stay inside the repository."); }
      else { parent = await compilerOptions(target.endsWith(".json") ? target : `${target}.json`, [...chain, path]); }
    }
    return { ...parent, ...data(config.compilerOptions) };
  };
  for (const path of compilerProjects) {
    const options = await compilerOptions(path);
    const strictFlags = ["alwaysStrict", "strictBindCallApply", "strictBuiltinIteratorReturn", "strictFunctionTypes", "strictNullChecks", "strictPropertyInitialization", "useUnknownInCatchVariables", "noImplicitAny", "noImplicitThis"];
    if (options.strict !== true || options.noUncheckedIndexedAccess !== true || options.exactOptionalPropertyTypes !== true || options.noEmitOnError === false ||
        options.noCheck === true || strictFlags.some(flag => options[flag] === false)) {
      issue(path, "Production compiler projects require strict, noUncheckedIndexedAccess and exactOptionalPropertyTypes without disabled semantic checking or weakening overrides.");
    }
  }
  if (manager !== undefined) {
    const scripts = data(manifest.scripts);
    let full = new Set<string>();
    try { full = expandAdmissionScript("check", scripts, manager); }
    catch (error) { issue("package.json", error instanceof Error ? error.message : "Invalid full native gate."); }
    const routes = data(coverage.scripts);
    if (routes.full !== "check") { issue(coveragePath ?? "foundation.config.yaml", "The full coverage route must bind the root check script."); }
    for (const field of ["scope", "typed"]) {
      try {
        const name = routes[field];
        if (!nonempty(name)) { throw new Error(`Missing quality ${field} route.`); }
        const route = expandAdmissionScript(name, scripts, manager);
        if ([...route].some(command => !full.has(command))) { throw new Error(`The quality ${field} route must run in the full check route.`); }
        const expected = field === "scope" ? " --scope-only" : "";
        if (![...route].some(command => command === `agent-teams-foundation quality check --consumer .${expected}`)) { throw new Error(`The quality ${field} route must invoke the actual Foundation quality gate.`); }
      } catch (error) { issue("package.json", error instanceof Error ? error.message : "Invalid quality gate."); }
    }
    for (const command of ["agent-teams-foundation check", "agent-teams-foundation assert-dev-only", "agent-teams-foundation assert-registry"]) {
      if (!full.has(command)) { issue("package.json", `The complete native check route must execute ${command}.`); }
    }
    if (![...full].some(command => /^(?:tsc(?: |$)|tsrs(?: |$)|node (?:tools|scripts)\/[^ ]*build[^ ]*\.(?:ts|mts|mjs|js)(?: |$))/u.test(command) &&
        !/(?:^| )(?:--version|-v|--help|-h|--showConfig|--listFilesOnly|--noCheck|--dry|--clean)(?: |$)/u.test(command) &&
        !/(?:^| )--(?:strict\w*|noUncheckedIndexedAccess|exactOptionalPropertyTypes|noImplicit\w*) false(?: |$)/u.test(command))) {
      issue("package.json", "The full native gate must reach an actual strict compiler/build command; declaring compiler projects alone does not run them.");
    }
    if (![...full].some(command => /^(?:node --test |agent-teams-node-test |vitest(?: |$)|bun test(?: |$)|node (?:tools|scripts)\/[^ ]*tests?[^ ]*\.(?:ts|mts|mjs|js)(?: |$))/u.test(command) &&
        !/(?:^| )(?:--version|-v|--help|-h|--dry-run|--listTests)(?: |$)/u.test(command))) {
      issue("package.json", "The full native gate must reach actual native tests.");
    }
    const enforcement = strings(profile.enforcementCommands);
    if (enforcement.length === 0) { issue(String(profilePath), "Declare the exact deterministic FMS enforcementCommands."); }
    for (const command of enforcement) {
      try {
        const name = scriptName(command, manager);
        if (!name || [...expandAdmissionScript(name, scripts, manager)].some(leaf => !full.has(leaf))) { throw new Error("Unreached enforcement command."); }
      } catch { issue(String(profilePath), `FMS enforcement must be a real native script reached by check: ${command}`); }
    }
    if (![...full].some(command => /^(?:feature-module-standard check(?: |$)|node (?:tools|scripts)\/[^ ]*feature[^ ]*\.(?:ts|mts|mjs|js)(?: |$))/u.test(command) &&
        !/(?:^| )(?:--version|-v|--help|-h|--dry-run)(?: |$)/u.test(command))) {
      issue("package.json", "Run the actual deterministic FMS feature gate from the complete native route.");
    }
    const native = new Set<string>();
    try {
      for (const path of await source.workflows()) {
        const workflow = await document(path);
        for (const command of workflowCommands(workflow, scripts, manager)) { native.add(command); }
      }
    } catch { issue(".github/workflows", "Cannot inspect the bounded regular-file workflow census."); }
    for (const command of full) {
      if (!native.has(command)) { issue(".github/workflows", "Unconditional pull_request jobs with unconditional needs closures must execute every command in the full native gate route."); }
    }
  }
  return result(manager === undefined || unsupportedBranch ? "unsupported_stack_pending" : issues.length > 0 ? "incomplete" : "configured_not_qualified");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "render" && process.argv.length === 4) {
    process.stdout.write(renderRepositoryAdmissionCaller(process.argv[3] ?? ""));
  } else if (process.argv[2] === "--root" && process.argv.length === 4) {
    const result = await checkRepositoryAdmission(await localAdmissionSource(resolve(process.argv[3] ?? "")));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.status === "configured_not_qualified" ? 0 : 1;
  } else { throw new Error("Usage: node scripts/check-repository-admission.ts --root REPOSITORY | render IMMUTABLE_CENTRAL_SHA"); }
}
