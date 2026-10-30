#!/usr/bin/env python3
"""One-time, pinned source reconstruction. Publishes nothing and changes no protections.
The generated static TypeScript is the review artifact; this helper stays outside it.
"""
from pathlib import Path
import subprocess, json, re, sys
ROOT=Path(sys.argv[1]).resolve()
OLD=Path(sys.argv[2]).resolve()
V3=Path(sys.argv[3]).resolve()
H='680192aed6f7c377bb639c637e0f29f09a2e20ec'
B='c8f3e7ba220241f79292c84c72712653019aa1df'
V3SHA='c364ab2b82ad6250500110345982c3f1fa82181f'
def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def put(p,s):
 p=ROOT/p;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s)
def rep(s,a,b):
 assert s.count(a)==1, (a[:120],s.count(a));return s.replace(a,b)
file='scripts/runtime-admission-source-successor-v2.ts'
s=(OLD/'scripts/runtime-admission-source-successor-v1.ts').read_text()
s=s.replace('runtime-admission-source-successor-v1','runtime-admission-source-successor-v2').replace('runtime-admission-source-canary.yml','runtime-admission-source-v2-canary.yml').replace('runtime-admission-positive-v1','runtime-admission-positive-v2').replace('runtime-admission-negative-v1','runtime-admission-negative-v2').replace('0015-bounded-runtime-admission-source-successor-v2','0016-bounded-runtime-admission-source-successor-v2')
s=s.replace('baseSHA: "e0f271740c13290b6bb729ffb79cb050253fc6b8", headSHA: "ec790f9e12c29c32c7dad1ad683a7d56476cacd3",',f'baseSHA: "{B}", headSHA: "{H}",')
s=s.replace('baseTreeSHA: "18731af97b2d4ac56952cae9e0a167e379a73344", headTreeSHA: "3d2e31d0c769f12d7132819192d4409143fe96f2",',f'baseTreeSHA: "{git("rev-parse",B+"^{tree}")}", headTreeSHA: "{git("rev-parse",H+"^{tree}")}",')
s=s.replace('commits: 39,','commits: 40,')
start=s.index('export const PREVIOUS_INSTALL_PATHS = ')
end=s.index('export const CANARY_WORKFLOW',start)
s=s[:start]+'''export const PREVIOUS_INSTALL_PATHS = Object.freeze([
  ".github/workflows/docs-quality-source-successor-v3-caller.yml",
  "docs/decisions/0013-bounded-quality-source-successor-v3.md",
  "governance/evidence/docs-source-successor/quality-source-successor-v3-installation.md",
  ".github/workflows/docs-quality-source-successor-v2-caller.yml",
  "docs/decisions/0012-bounded-quality-source-successor-v2.md",
  "governance/evidence/docs-source-successor/quality-source-successor-v2-installation.md",
]);
export const PREVIOUS_SOURCE_REF = "refs/heads/governance/quality-source-successor-v3";
export const PREVIOUS_SOURCE_SHA = "'''+V3SHA+'''";
export const PREVIOUS_SOURCE_INPUTS = Object.freeze([
  "scripts/docs-quality-source-successor-v3.ts", "scripts/docs-quality-source-successor-v3.test.ts",
  "scripts/docs-quality-source-successor-v3-target.ts",
  ".github/workflows/docs-quality-source-successor-v3.yml", "tsconfig.docs-quality-source-successor-v3.json",
  "scripts/docs-quality-source-successor-v2.ts", "scripts/docs-quality-source-successor-v2.test.ts",
  ".github/workflows/docs-quality-source-successor-v2.yml", "tsconfig.docs-quality-source-successor-v2.json",
]);
'''+s[end:]
s=rep(s,'export const QUALITY_INPUTS = Object.freeze([','export const QUALITY_INPUTS = Object.freeze([\n  "toolchain.config.json", "tsconfig.json",')
critical=["governance/repository-registration-supplements.schema.json", "scripts/governance-schema.ts", "scripts/repository-registration.ts", "scripts/repository-bootstrap-observation.ts", "scripts/check-repository-admission.ts", "scripts/observe-org-repository-inventory.mjs", ".github/workflows/organization-inventory-drift.yml", "scripts/fixtures/commit-author-identity-caller.yml", ".github/workflows/repository-admission-check.yml", "scripts/compiler-floor.ts", "scripts/validate-renovate.ts", "scripts/validate-renovate-abi.probe.ts", ".github/workflows/node24-compatibility.yml"]
s=rep(s,'const ownerId = 13103045;', 'export const ADMISSION_INPUTS = Object.freeze('+json.dumps(critical,indent=2)+');\nconst ownerId = 13103045;')
start=s.index('export const TARGET_TUPLE = Object.freeze(')
end=s.index('export interface SourceTarget',start)
tuples=[]
for line in git('diff','--raw','--no-abbrev','--no-renames',B,H).splitlines():
 meta,path=line.split('\t');_,_,before,after,status=meta.split(); assert status in ['M','A'];tuples.append([path,None if status=='A' else before,after])
commits=git('rev-list',B+'..'+H).splitlines();assert len(commits)==40 and len(tuples)==47
s=s[:start]+'export const TARGET_TUPLE: readonly (readonly [string, string | null, string])[] = Object.freeze('+json.dumps(tuples,indent=2)+');\n\nexport const TARGET_COMMITS: readonly string[] = Object.freeze('+json.dumps(sorted(commits),indent=2)+');\n\n'+s[end:]
s=s.replace('25469495, "Frozen v2 source lock identity drift"','25832759, "Frozen v3 source lock identity drift"')
s=s.replace('"docs-quality-source-successor-v2"','"docs-quality-source-successor-v3"')
s=s.replace('Frozen v2 source ref/protection drift','Frozen v3 source ref/protection drift')
a='''    // Only this exact tuple may change the reviewed quality-process test blob.
    // Ordinary/reusable paths below preserve every QUALITY_INPUTS member.
    assertPreserved(base, head, [...LEGACY_INPUTS,
      ...QUALITY_INPUTS.filter(path => path !== "scripts/quality-process.test.ts"), ...PREVIOUS_INSTALL_PATHS]);'''
b='''    // Only this exact tuple may expand adoption/admission inputs. All four runtime
    // helpers and both legacy verifier files are unchanged, including their tests.
    assertPreserved(base, head, [...LEGACY_INPUTS,
      ...QUALITY_INPUTS.filter(path => path !== "toolchain.config.json"),
      "scripts/check-docs-verifier-authority.mts", "scripts/check-docs-verifier-authority.test.mts",
      ...PREVIOUS_INSTALL_PATHS]);'''
s=rep(s,a,b)
s=s.replace('assertPreserved(base, head, [...QUALITY_INPUTS, ...PREVIOUS_INSTALL_PATHS, ...PREVIOUS_SOURCE_INPUTS], true);','assertPreserved(base, head, [...QUALITY_INPUTS, ...ADMISSION_INPUTS, ...PREVIOUS_INSTALL_PATHS, ...PREVIOUS_SOURCE_INPUTS], true);')
s=s.replace('assertPreserved(baseTree, headTree, [...INSTALL_PATHS, ...QUALITY_INPUTS, ...PREVIOUS_INSTALL_PATHS]);','assertPreserved(baseTree, headTree, [...INSTALL_PATHS, ...QUALITY_INPUTS, ...ADMISSION_INPUTS, ...PREVIOUS_INSTALL_PATHS]);')
s=rep(s,'const { checkDocsSourceSuccessor } = await import("./check-docs-source-successor-v1.mts");\n  return checkDocsSourceSuccessor(evidence, baseManifest, baseLock);','const { checkSourceSuccessor: checkFrozenV3 } = await import("./docs-quality-source-successor-v3.ts");\n  return checkFrozenV3(evidence, baseManifest, baseLock, sourceSHA);')
s=rep(s,'      commits.at(-1)!.sha === TARGET.headSHA, "Incomplete finite source commits");','      commits.at(-1)!.sha === TARGET.headSHA, "Incomplete finite source commits");\n    assert.deepEqual(commits.map(value => sha(value.sha)).toSorted(), TARGET_COMMITS, "Finite source commit identities changed");')
s=s.replace('Protected runtime/admission successor v1:', 'Protected runtime/admission successor v2:')
put(file,s)
frozen=['scripts/docs-quality-source-successor-v2.ts','scripts/docs-quality-source-successor-v3.ts','scripts/docs-quality-source-successor-v3-target.ts']
for p in frozen: put(p,(V3/p).read_text())
t=(OLD/'scripts/runtime-admission-source-successor-v1.test.ts').read_text()
t=t.replace('runtime-admission-source-successor-v1','runtime-admission-source-successor-v2').replace('runtime-admission-source-canary.yml','runtime-admission-source-v2-canary.yml')
t=t.replace('"docs-quality-source-successor-v2"','"docs-quality-source-successor-v3"').replace('id: 25469495','id: 25832759').replace('49-file delta','47-file delta')
t=t.replace('finite quality-test exception admits only the complete exact integration, never a partial or altered quality edit','finite toolchain expansion admits only the complete exact integration, never an altered helper')
t=t.replace('path === "scripts/quality-process.test.ts"','path === "toolchain.config.json"').replace('file.filename !== "scripts/quality-process.test.ts"','file.filename !== "toolchain.config.json"')
t=t.replace('const qualityHelpers = [','const qualityHelpers = ["toolchain.config.json", "tsconfig.json", ')
t=t.replace('"scripts/validate-renovate.ts", ".github/workflows/node24-compatibility.yml",','"scripts/validate-renovate.ts", "scripts/validate-renovate-abi.probe.ts", ".github/workflows/node24-compatibility.yml",')
t=t.replace('import { join } from "node:path";', 'import { join, dirname } from "node:path";\nimport { createRequire } from "node:module";')
t=t.replace('const args = ["node_modules/typescript/bin/tsc", "--project", "tsconfig.runtime-admission-source-successor-v2.json"];','const owner = createRequire(createRequire(new URL("../package.json", import.meta.url)).resolve("stack-toolchain/package.json"));\n  const args = [join(dirname(owner.resolve("typescript/package.json")), "bin/tsc"), "--project", "tsconfig.runtime-admission-source-successor-v2.json"];')
t=t.replace('step.run === "pnpm exec tsc --project tsconfig.runtime-admission-source-successor-v2.json"','step.run === "pnpm quality:typecheck"')
t+='''\n\ntest("successor retains actual installed v3 and v2 code bytes rather than reimplementing their semantics", async () => {
  for (const name of ["docs-quality-source-successor-v2.ts", "docs-quality-source-successor-v3.ts", "docs-quality-source-successor-v3-target.ts"]) {
    const path = `scripts/${name}`;
    assert.deepEqual(await readFile(new URL(`../${path}`, import.meta.url)), git("show", `${PREVIOUS_SOURCE_SHA}:${path}`));
  }
});

test("ordinary and dependency decisions agree with actual installed v3", async () => {
  const { checkSourceSuccessor: previous } = await import("./docs-quality-source-successor-v3.ts");
  for (const fixture of [ordinaryFixture(), dependencyFixture()]) {
    assert.equal(await checkSourceSuccessor(fixture.envelope, fixture.baseManifest, fixture.baseLock, sourceSHA),
      await previous(fixture.envelope, fixture.baseManifest, fixture.baseLock, sourceSHA));
  }
});

test("current v3 predecessor lock and context reject the historical v2 activation basis", () => {
  const current = protection();
  const status = current.main.rules.find(rule => rule.type === "required_status_checks");
  assert.ok(status && "parameters" in status && status.parameters && "required_status_checks" in status.parameters);
  const checks = status.parameters.required_status_checks;
  assert.ok(Array.isArray(checks));
  const old = checks.find(check => check.context === "docs-quality-source-successor-v3");
  assert.ok(old); old.context = "docs-quality-source-successor-v2";
  assert.throws(() => assertMainProtection(current.main, current.identity), /transition/u);
});
'''
put('scripts/runtime-admission-source-successor-v2.test.ts',t)
w=(OLD/'.github/workflows/runtime-admission-source-successor-v1.yml').read_text().replace('runtime-admission-source-successor-v1','runtime-admission-source-successor-v2').replace('Successor V1','Successor V2')
w=w.replace('pnpm exec tsc --project tsconfig.runtime-admission-source-successor-v2.json','pnpm quality:typecheck')
w=re.sub(r'        run: >-\n          pnpm exec oxlint[^\n]*\n          scripts/runtime-admission-source-successor-v2.ts scripts/runtime-admission-source-successor-v2.test.ts','        run: pnpm quality:lint',w)
put('.github/workflows/runtime-admission-source-successor-v2.yml',w)
newfiles=[file,'scripts/runtime-admission-source-successor-v2.test.ts']
put('tsconfig.runtime-admission-source-successor-v2.json',json.dumps({'extends':'./tsconfig.tooling.json','include':newfiles},indent=2)+'\n')
prof=json.loads((ROOT/'docs/engineering-quality-profile.json').read_text());cfg=json.loads((ROOT/'tsconfig.tooling.json').read_text())
cfg['include']+=newfiles+frozen
prof['typedTooling']['entryFiles']+=newfiles+frozen
retained=[{'path':p,'gitBlob':git('rev-parse',V3SHA+':'+p)} for p in frozen]
prof['retainedAuthoritySources']+=retained
put('tsconfig.tooling.json',json.dumps(cfg,indent=2)+'\n');put('docs/engineering-quality-profile.json',json.dumps(prof,indent=2)+'\n')
q=(ROOT/'scripts/check-quality-scope.mjs').read_text()
start=q.index('const RETAINED_AUTHORITY_SOURCES = [');end=q.index('\n];',start)
q=q[:end]+''.join('\n  '+json.dumps(v)+',' for v in retained)+q[end:]
q=q.replace('"scripts/validate-renovate-abi.probe.ts",\n', '"scripts/validate-renovate-abi.probe.ts",\n'+''.join('        '+json.dumps(p)+',\n' for p in newfiles+frozen))
put('scripts/check-quality-scope.mjs',q)
q=(ROOT/'scripts/check-quality-scope.test.mjs').read_text();q=rep(q,'assert.equal(paths.length, 43);','assert.equal(paths.length, 45);');put('scripts/check-quality-scope.test.mjs',q)
q=(ROOT/'scripts/read-docs-portable-authority-r322.test.mjs').read_text();q,n=re.subn(r'(assert\.equal\([^\n]*?\.length, )43(\))',r'\g<1>45\2',q);assert n==1;put('scripts/read-docs-portable-authority-r322.test.mjs',q)
print('created source, predecessor bytes, tests, workflow and strict scope')
p=ROOT/'scripts/runtime-admission-source-successor-v2.test.ts'
t=p.read_text().replace('/rulesets/25469495','/rulesets/25832759').replace('old immutable v2 branch and lock','installed immutable v3 branch and lock')
p.write_text(re.sub(r'^(\s*)test\(',r'\1void test(',t,flags=re.M))
def node(source):
    subprocess.run(['node','--input-type=module','-e',source],cwd=ROOT,check=True)
node(r"""
import {createRequire} from 'node:module'; import {dirname,resolve} from 'node:path'; import {spawnSync} from 'node:child_process';
const owner=createRequire(createRequire(import.meta.url).resolve('stack-toolchain/package.json'));
const p=owner.resolve('oxlint/package.json'), bin=owner('oxlint/package.json').bin.oxlint;
const result=spawnSync(process.execPath,[resolve(dirname(p),bin),'--type-aware','--config','oxlint.json','--no-ignore','--disable-nested-config','--deny-warnings','--fix','scripts/runtime-admission-source-successor-v2.ts','scripts/runtime-admission-source-successor-v2.test.ts'],{stdio:'pipe',encoding:'utf8'});
if (result.error || result.signal || ![0,1].includes(result.status)) throw new Error('Pinned corrective lint invocation failed');
""")
R=ROOT/'scripts'
p=R/'runtime-admission-source-successor-v2.ts';s=p.read_text()
s=s.replace('const object = (value: unknown): Record<string, unknown> => {\n  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), "Expected a mapping");\n  return value as Record<string, unknown>;\n};','const isMapping = (value: unknown): value is Record<string, unknown> =>\n  value !== null && typeof value === "object" && !Array.isArray(value);\nconst object = (value: unknown): Record<string, unknown> => {\n  assert.ok(isMapping(value), "Expected a mapping");\n  return value;\n};')
s=s.replace('[...value].every(character => character.codePointAt(0)! > 31 && character.codePointAt(0) !== 127)', '!/[\\u0000-\\u001f\\u007f]/u.test(value)')
s=s.replace('type: String(entry.type)', 'type: entry.type')
line='    const name = (entry: GitEntry): string => entry.path.split("/").at(-1)!;\n';assert s.count(line)==1;s=s.replace(line,'');s=s.replace('/** Rehash every directory', 'const name = (entry: GitEntry): string => entry.path.split("/").at(-1)!;\n\n/** Rehash every directory')
s=s.replace('.map(rule => rule.type).toSorted()', '.map(rule => rule.type).toSorted((left, right) => String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0)')
s=s.replace('/^[^\\s@]+@[^\\s@]+$/u.test(String(person.email))', '/^[^\\s@]+@[^\\s@]+$/u.test(person.email)')
s=s.replace('github\\.com)$/iu.test(String(person.email))','github\\.com)$/iu.test(person.email)')
s=s.replace('pull.id === TARGET.pullId && pull.draft === false', 'pull.id === TARGET.pullId && !pull.draft')
s=s.replace('return input as Omit<ProtectedExecutor, "sourceTreeSHA">;', 'return input;')
s=s.replace('phase: "add" | "retire"): object {','phase: "add" | "retire") {')
p.write_text(s)
p=R/'runtime-admission-source-successor-v2.test.ts';t=p.read_text()
helper='''const isMapping = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const mapping = (value: unknown): Record<string, unknown> => { assert.ok(isMapping(value)); return value; };
const values = (value: unknown): unknown[] => { assert.ok(Array.isArray(value)); return value; };
const records = (value: unknown): Record<string, unknown>[] => values(value).map(mapping);
const name = (entry: Entry): string => entry.path.split("/").at(-1)!;
'''
t=t.replace('const sourceSHA =',helper+'\nconst sourceSHA =',1)
t=t.replace('    const name = (entry: Entry): string => entry.path.split("/").at(-1)!;\n','')
a=t.index('  const manifest = JSON.parse(f.baseManifest.toString()) as');b=t.index('  change(f, "package.json"',a)
t=t[:a]+'''  const manifest = mapping(JSON.parse(f.baseManifest.toString()));
  const lock = mapping(parse(f.baseLock.toString()));
  mapping(manifest.devDependencies)["source-v2-test-only"] = "1.2.3";
  mapping(mapping(mapping(lock.importers)["."]).devDependencies)["source-v2-test-only"] = { specifier: "1.2.3", version: "1.2.3" };
  mapping(lock.packages)["source-v2-test-only@1.2.3"] = { resolution: { integrity: `sha512-${Buffer.alloc(64, 7).toString("base64")}` } };
  mapping(lock.snapshots)["source-v2-test-only@1.2.3"] = {};
'''+t[b:]
for v in ['pullRequest','pullId','commits']:t=t.replace('Number(TARGET.'+v+')','TARGET.'+v+' as number')
for v in ['baseSHA','headSHA']:t=t.replace('String(TARGET.'+v+')','TARGET.'+v+' as string')
t=t.replace('String(PREVIOUS_SOURCE_SHA)','PREVIOUS_SOURCE_SHA as string')
t=t.replace('const next = JSON.parse(Buffer.from(f.envelope.headData["package.json"]!.content, "base64").toString()) as { devDependencies: Record<string, string> };','const next = mapping(JSON.parse(Buffer.from(f.envelope.headData["package.json"]!.content, "base64").toString()));')
t=t.replace('next.devDependencies.ajv =','mapping(next.devDependencies).ajv =')
t=t.replace('(rule as { type: string }).type','mapping(rule).type')
t=t.replace(' as { main: typeof f.main; identity: typeof f.identity }','')
t=t.replace('withoutStatuses(retired.main.rules)','withoutStatuses(values(retired.main.rules))')
t=t.replace('delete (hidden.main as { bypass_actors?: unknown }).bypass_actors;', 'Reflect.deleteProperty(hidden.main, "bypass_actors");')
a=t.index('  const workflow = parse(await readFile(');b=t.index('\n  assert.deepEqual(workflow.on',a)
t=t[:a]+'''  const workflow = mapping(parse(await readFile(new URL(`../${SOURCE_WORKFLOW}`, import.meta.url), "utf8")));
  const jobs = mapping(workflow.jobs);
  const publish = mapping(jobs.publish), qualifySteps = records(mapping(jobs.qualify).steps);
'''+t[b:]
t=t.replace('Object.keys(workflow.jobs)', 'Object.keys(jobs)')
t=t.replace('for (const [name, job] of Object.entries(workflow.jobs)) {','for (const [jobName, rawJob] of Object.entries(jobs)) {\n    const job = mapping(rawJob), steps = records(job.steps);')
t=t.replace('job.steps','steps')
nt='const job = mapping(rawJob), steps = records(steps);';t=t.replace(nt,'const job = mapping(rawJob), steps = records(job.steps);')
t=t.replace('if (name !== "publish") {', 'if (jobName !== "publish") {').replace('(name === "qualify"','(jobName === "qualify"')
t=t.replace('step.uses?.startsWith(', 'typeof step.uses === "string" && step.uses.startsWith(')
t=t.replace('step.run?.includes(', 'typeof step.run === "string" && step.run.includes(')
t=t.replace('.test(step.uses!)', '.test(String(step.uses))')
t=t.replace('setup.with?.cache', 'mapping(setup.with).cache').replace('setup.with?.["package-manager-cache"]', 'mapping(setup.with)["package-manager-cache"]')
t=t.replace('setup.with?.run_install', 'mapping(setup.with).run_install')
t=t.replace('step.run ?? ""', 'typeof step.run === "string" ? step.run : ""')
t=t.replace('workflow.jobs.publish!', 'publish').replace('workflow.jobs.qualify!.steps', 'qualifySteps')
a=t.index('  const effective = JSON.parse(execFileSync(');b=t.index('\n  assert.deepEqual(effective.files',a)
t=t[:a]+'''  const effective = mapping(JSON.parse(execFileSync(process.execPath, [...args, "--showConfig"], options)));
  const compilerOptions = mapping(effective.compilerOptions);
'''+t[b:]
t=t.replace('effective.compilerOptions[option]', 'compilerOptions[option]').replace('effective.compilerOptions.noCheck','compilerOptions.noCheck')
p.write_text(t)
PATH_VALID='const pathValid = (value: unknown): value is string => {\n  if (\n    typeof value !== "string" ||\n    value.length === 0 ||\n    value.length > 4096 ||\n    value.includes("\\\\")\n  ) {\n    return false;\n  }\n  for (const character of value) {\n    const code = character.codePointAt(0)!;\n    if (code <= 31 || code === 127) {\n      return false;\n    }\n  }\n  return (\n    Buffer.from(value).toString("utf8") === value &&\n    value.split("/").every((part) => part !== "" && part !== "." && part !== "..")\n  );\n};\n'
EXTRA_TESTS='void test("finite collection rejects a substituted commit even with complete count and valid owner metadata", async () => {\n  const fixture = collectorFixture();\n  Object.assign(mapping(fixture.state.commits[0]), { sha: "f".repeat(40) });\n  await assert.rejects(\n    collectSourceEvidence(fixture.api, executorFromEnvironment(fixture.env)),\n    /commit identities changed/u,\n  );\n});\n\nvoid test("unchanged symlinked admission inputs cannot hide in an ordinary baseline", async () => {\n  for (const path of laterCriticalInputs) {\n    const fixture = ordinaryFixture();\n    for (const tree of [fixture.envelope.baseTree, fixture.envelope.headTree]) {\n      const entry = tree.tree.find((value) => value.path === path);\n      assert.ok(entry);\n      entry.mode = "120000";\n      rehashTree(tree);\n    }\n    await assert.rejects(\n      checkSourceSuccessor(fixture.envelope, fixture.baseManifest, fixture.baseLock, sourceSHA),\n      /Protected|regular/u,\n    );\n  }\n});\n'
EXPECTED_BLOBS={'docs/engineering-quality-profile.json': 'ac98dde50ff3d3b2c69157af45983344669b8932', 'scripts/check-quality-scope.mjs': '5da027cb3ecb59ce4c3497cb0ccaf09dff51e17c', 'scripts/check-quality-scope.test.mjs': '6f28723b666b322ea555d2e4e8a5f0674e2df227', 'scripts/read-docs-portable-authority-r322.test.mjs': '339cd056bea7a623a1189b6ab127aafd36be0816', 'toolchain.config.json': 'f67cb2da28b9c9d24d1b9055be23f1f400d0ae8c', 'tsconfig.tooling.json': '2719e9058e60faeaa5743345f6c37ebbbb150793', '.github/workflows/runtime-admission-source-successor-v2.yml': 'b2654f77458cd1d0cbeb308baed6a4bb2aae4898', 'scripts/docs-quality-source-successor-v2.ts': '767e4c4b530fdfad8356e299709be08f3237fdb0', 'scripts/docs-quality-source-successor-v3-target.ts': 'f0b15b0ec460171a7b9a7b39d005cd897888634e', 'scripts/docs-quality-source-successor-v3.ts': 'bd0072b49306a78069be10bbe34bacff5ac457cc', 'scripts/runtime-admission-source-successor-v2.test.ts': 'f01ef4c5e88b5213637a1c2cf835f3c99ecac73d', 'scripts/runtime-admission-source-successor-v2.ts': '989db73819975b12d672fe9da994748dcba6c8be', 'tsconfig.runtime-admission-source-successor-v2.json': '43a64e9d461a5b260dd42f38ebc6d961c6d526bc'}
for p,new in [(ROOT/'scripts/runtime-admission-source-successor-v2.ts','gitEntryName'),(ROOT/'scripts/runtime-admission-source-successor-v2.test.ts','fixtureLeafName')]:
    s=p.read_text().replace('const name = (entry:',f'const {new} = (entry:')
    s=re.sub(r'\bname\((entry|left|right)\)',new+r'(\1)',s)
    if p.name.endswith('.test.ts'):
        s=s.replace('const values = (value:', 'const arrayValues = (value:').replace('=> values(value).map(mapping)', '=> arrayValues(value).map(mapping)').replace('withoutStatuses(values(retired.main.rules))','withoutStatuses(arrayValues(retired.main.rules))')
    else:
        a=s.index('const pathValid = ');z=s.index('const gitHash =',a)
        s=s[:a]+PATH_VALID+s[z:]
    p.write_text(s)
p=ROOT/'scripts/check-quality-scope.mjs'
s=p.read_text();a=s.index('      retainedAuthoritySources: [');z=s.index('      formatRetainedAuthoritySources:',a)
p.write_text(s[:a]+'      retainedAuthoritySources: RETAINED_AUTHORITY_SOURCES,\n'+s[z:])
p=ROOT/'scripts/runtime-admission-source-successor-v2.test.ts'
p.write_text(p.read_text()+'\n'+EXTRA_TESTS)
node(r"""
import {readFileSync,writeFileSync} from 'node:fs';
import {deriveFormatPaths,deriveLintPaths,classifyTrackedPaths} from './scripts/check-quality-scope.mjs';
import {execFileSync} from 'node:child_process';
const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const cfg=JSON.parse(readFileSync('toolchain.config.json','utf8'));
cfg.format.paths=deriveFormatPaths(paths);
cfg.lint.paths=deriveLintPaths(classifyTrackedPaths(paths),JSON.parse(readFileSync('docs/engineering-quality-profile.json','utf8')));
if (cfg.format.paths.length !== 111 || cfg.lint.paths.length !== 45) throw new Error('Unexpected source census');
writeFileSync('toolchain.config.json',JSON.stringify(cfg,null,2)+'\n');
""")
node(r"""
import {createRequire} from 'node:module';import {dirname,resolve} from 'node:path';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
const owner=createRequire(createRequire(import.meta.url).resolve('stack-toolchain/package.json'));
const p=owner.resolve('oxfmt/package.json'),manifest=owner('oxfmt/package.json');
if(manifest.version!=='0.74.0') throw new Error('Formatter pin drift');
execFileSync(process.execPath,[resolve(dirname(p),manifest.bin.oxfmt),'--write',...JSON.parse(readFileSync('toolchain.config.json','utf8')).format.paths],{stdio:'inherit'});
""")
TRANSITION_FUNCTION='/** Pure proposals. Installation restores the predecessor before retiring the\n * temporary successor requirement; no route creates an unprotected interval. */\nexport function planProtectionTransition(\n  mainRaw: unknown,\n  identityRaw: unknown,\n  phase: "add" | "retire" | "restore" | "install",\n) {\n  assert.ok(["add", "retire", "restore", "install"].includes(phase), "Unknown cutover phase");\n  assertMainProtection(mainRaw, identityRaw, "owner_full");\n  const main = structuredClone(object(mainRaw)), identity = structuredClone(object(identityRaw));\n  const predecessor = "docs-quality-source-successor-v3";\n  const status = array(main.rules).map(object).find(rule => rule.type === "required_status_checks")!;\n  const parameters = object(status.parameters), checks = array(parameters.required_status_checks).map(object);\n  const hasPredecessor = checks.some(check => check.context === predecessor);\n  const hasSuccessor = checks.some(check => check.context === SOURCE_CONTEXT);\n  if (phase === "add") {\n    assert.ok(hasPredecessor, "Predecessor must remain during additive cutover");\n    assert.ok(!hasSuccessor, "Successor is already required; read back current protections");\n    checks.push({ context: SOURCE_CONTEXT, integration_id: 15368 });\n  } else if (phase === "restore") {\n    assert.ok(hasSuccessor && !hasPredecessor, "Restore requires the successor-only state");\n    checks.push({ context: predecessor, integration_id: 15368 });\n  } else {\n    assert.ok(hasPredecessor && hasSuccessor,\n      "Retirement requires the already-installed predecessor AND successor bridge");\n  }\n  parameters.required_status_checks = checks.filter(check =>\n    phase === "retire" ? check.context !== predecessor : phase === "install" ? check.context !== SOURCE_CONTEXT : true);\n  assertMainProtection(main, identity, "owner_full");\n  return { phase, installation: "proposal-only-not-hosted-proof", main, identity };\n}\n'
TRANSITION_TEST='\nvoid test("permanent caller installation restores v3 before retiring the temporary successor requirement", () => {\n  const baseline = protection();\n  let state = { main: mapping(baseline.main), identity: mapping(baseline.identity) };\n  for (const phase of ["add", "retire", "restore", "install", "add", "retire"] as const) {\n    const before = structuredClone(state);\n    const next = planProtectionTransition(state.main, state.identity, phase);\n    assert.deepEqual(state, before, "Planning cannot mutate live readback");\n    assert.deepEqual(next.identity, baseline.identity);\n    assert.deepEqual(withoutStatuses(arrayValues(next.main.rules)), withoutStatuses(baseline.main.rules));\n    assert.deepEqual(next.main.conditions, baseline.main.conditions);\n    assert.deepEqual(next.main.bypass_actors, baseline.main.bypass_actors);\n    const status = records(next.main.rules).find(rule => rule.type === "required_status_checks");\n    assert.ok(status);\n    const stageContexts = records(mapping(status.parameters).required_status_checks).map(check => check.context);\n    assert.ok(stageContexts.includes(SOURCE_CONTEXT) || stageContexts.includes("docs-quality-source-successor-v3"));\n    if (phase === "install") {\n      assert.ok(stageContexts.includes("docs-quality-source-successor-v3") && !stageContexts.includes(SOURCE_CONTEXT));\n    }\n    state = next;\n  }\n  assert.throws(() => planProtectionTransition(baseline.main, baseline.identity, "install"), /bridge/u);\n  assert.throws(() => planProtectionTransition(baseline.main, baseline.identity, "restore"), /successor-only/u);\n});\n'
p=ROOT/'scripts/runtime-admission-source-successor-v2.ts'
s=p.read_text();a=s.index('/** Pure proposal generator.');z=s.index('/** Check actual checkout bytes',a)
p.write_text(s[:a]+TRANSITION_FUNCTION+'\n'+s[z:])
p=ROOT/'scripts/runtime-admission-source-successor-v2.test.ts';p.write_text(p.read_text()+'\n'+TRANSITION_TEST)
node(r"""
import {createRequire} from 'node:module';import {dirname,resolve} from 'node:path';import {execFileSync} from 'node:child_process';
const owner=createRequire(createRequire(import.meta.url).resolve('stack-toolchain/package.json')),p=owner.resolve('oxfmt/package.json');
execFileSync(process.execPath,[resolve(dirname(p),owner('oxfmt/package.json').bin.oxfmt),'--write','scripts/runtime-admission-source-successor-v2.ts','scripts/runtime-admission-source-successor-v2.test.ts'],{stdio:'inherit'});
""")
for path, expected in EXPECTED_BLOBS.items():
    assert git('hash-object',path)==expected, 'Generated source differs from reviewed bytes: '+path
for path in ['scripts/check-docs-source-successor-v1.mts','scripts/check-docs-source-successor-v1.test.mts','scripts/check-docs-verifier-authority.mts','scripts/check-docs-verifier-authority.test.mts','scripts/quality-process.ts','scripts/quality-process.test.ts','scripts/run-governance-tests.ts','scripts/run-governance-tests.test.ts','scripts/verify-docs-admission-change.mjs']:
    assert git('hash-object',path)==git('rev-parse',B+':'+path), 'Frozen source changed: '+path
print('All generated source blobs match the reviewed local candidate. No activation or publication was performed.')
