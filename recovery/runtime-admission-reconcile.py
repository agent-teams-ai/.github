#!/usr/bin/env python3
"""One-off recovery recipe. Not installed in the candidate or an authority source."""
import json
import re
import subprocess
import sys
from pathlib import Path

MAIN = 'c8f3e7ba220241f79292c84c72712653019aa1df'
HEAD = 'ec790f9e12c29c32c7dad1ad683a7d56476cacd3'
EXTRA = ['scripts/compiler-floor.ts', 'scripts/compiler-floor.test.ts',
         'scripts/check-repository-admission.ts', 'scripts/check-repository-admission.test.ts',
         'scripts/governance-schema.ts', 'scripts/repository-registration.ts',
         'scripts/repository-registration.test.ts', 'scripts/repository-bootstrap-observation.ts',
         'scripts/repository-bootstrap-observation.test.ts', 'scripts/validate-renovate.ts',
         'scripts/validate-renovate.test.ts', 'scripts/validate-renovate-abi.probe.ts']
FROZEN = ['scripts/check-docs-source-successor-v1.mts', 'scripts/check-docs-source-successor-v1.test.mts',
          'scripts/check-docs-verifier-authority.mts', 'scripts/check-docs-verifier-authority.test.mts',
          'scripts/quality-process.ts', 'scripts/quality-process.test.ts',
          'scripts/run-governance-tests.ts', 'scripts/run-governance-tests.test.ts',
          'scripts/verify-docs-admission-change.mjs']
ROOT = Path(sys.argv[2]).resolve()

def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], text=True)

def source(ref, name):
    return git('show', ref + ':' + name)

def read(name):
    return (ROOT / name).read_text()

def put(name, content):
    (ROOT / name).write_text(content)

def document(name, value):
    put(name, json.dumps(value, indent=2, ensure_ascii=False) + '\n')

def replace(text, old, new, count=1):
    assert text.count(old) == count, (old, text.count(old), count)
    return text.replace(old, new)

def contract(text, argument, value, message):
    start = text.index('  assert.deepEqual(\n    ' + argument + ',\n')
    end = text.index('\n  );', start) + len('\n  );')
    assert message in text[start:end], (argument, text[start:end])
    return text[:start] + '  assert.deepEqual(' + argument + ', ' + json.dumps(value, indent=2) + ', ' + json.dumps(message) + ');' + text[end:]

def compose():
    assert git('rev-parse', 'HEAD').strip() == HEAD
    assert git('rev-parse', 'MERGE_HEAD').strip() == MAIN
    expected = {'docs/engineering-quality-profile.json', 'docs/engineering-quality.md', 'package.json',
                'pnpm-lock.yaml', 'scripts/check-quality-scope.mjs', 'scripts/check-quality-scope.test.mjs',
                'scripts/governance-policy.mjs', 'scripts/observe-org-repository-inventory.mjs',
                'scripts/quality-process.test.ts', 'scripts/read-docs-portable-authority-r322.test.mjs'}
    conflicts = set(git('diff', '--name-only', '--diff-filter=U').splitlines())
    assert conflicts == expected, conflicts
    for name in sorted(conflicts - {'scripts/governance-policy.mjs', 'scripts/observe-org-repository-inventory.mjs'}):
        put(name, source(MAIN, name))
    for name in ['scripts/governance-policy.mjs', 'scripts/observe-org-repository-inventory.mjs']:
        text, count = re.subn(r'^<<<<<<< [^\n]*\n(.*?)^=======\n.*?^>>>>>>> [^\n]*\n', r'\1', read(name), flags=re.M | re.S)
        assert count > 0 and '<<<<<<<' not in text, name
        put(name, text)
    for name in FROZEN:
        put(name, source(MAIN, name))
    manifest = json.loads(source(MAIN, 'package.json'))
    assert manifest['devDependencies']['@agent-teams/engineering-foundation'] == '3.0.0'
    assert manifest['devDependencies']['stack-toolchain'] == '0.1.1'
    assert manifest['devDependencies'].pop('renovate') == '44.24.2'
    for name in ['precheck', 'quality:boundaries', 'test:critical']:
        manifest['scripts'][name] = 'node scripts/compiler-floor.ts && ' + manifest['scripts'][name]
    manifest['scripts']['renovate:validate'] = 'pnpm --dir tools/renovate-validation run validate'
    document('package.json', manifest)
    profile = json.loads(source(MAIN, 'docs/engineering-quality-profile.json'))
    entries = profile['typedTooling']['entryFiles']
    assert len(entries) == 9 and not set(entries) & set(EXTRA)
    entries.extend(EXTRA)
    document('docs/engineering-quality-profile.json', profile)
    tsconfig = json.loads(source(MAIN, 'tsconfig.tooling.json'))
    assert len(tsconfig['include']) == 9
    tsconfig['include'].extend(EXTRA)
    document('tsconfig.tooling.json', tsconfig)
    tools = json.loads(source(MAIN, 'toolchain.config.json'))
    for field in ['lint', 'format']:
        tools[field]['paths'] = sorted(set(tools[field]['paths']) | set(EXTRA))
    assert len(tools['lint']['paths']) == 43
    document('toolchain.config.json', tools)

    text = read('scripts/compiler-floor.ts')
    text = replace(text, '  compiler(repository, "repository.compiler");', '''  const stack = readPackage(repository, "stack-toolchain", "stack");
  const stackRequire = createRequire(stack.manifestPath);
  const stackCompiler = compiler(stackRequire, "stack.compiler");
  exactDependency(stack, "typescript", stackCompiler.version);''')
    put('scripts/compiler-floor.ts', text)
    name = 'scripts/compiler-floor.test.ts'
    text = read(name)
    text = replace(text, 'const foundationPath =', 'const stackPath = "node_modules/stack-toolchain";\nconst foundationPath =')
    text = replace(text, '  await put("node_modules/typescript", { name: "typescript", version: "7.0.2" });', '''  await put("node_modules/typescript", { name: "typescript", version: "7.0.2" });
  await put(stackPath, { name: "stack-toolchain", version: "0.1.1", dependencies: { typescript: "7.0.2" } });
  await put(`${stackPath}/node_modules/typescript`, { name: "typescript", version: "7.0.2" });''')
    text = text.replace('rejects workspace TypeScript', 'rejects Stack-owned TypeScript').replace('"repository.compiler"', '"stack.compiler"')
    text = text.replace('await put("node_modules/typescript", { name: "typescript", version });', 'await put(`${stackPath}/node_modules/typescript`, { name: "typescript", version });')
    text = text.replace('await put("node_modules/typescript", { name: "different-package", version: "7.0.2" });', 'await put(`${stackPath}/node_modules/typescript`, { name: "different-package", version: "7.0.2" });')
    text = replace(text, '''    await nativeFixture(root, put);
    await put(`${stackPath}/node_modules/typescript`, { name: "typescript", version });
    assert.doesNotThrow''', '''    await nativeFixture(root, put);
    await put(`${stackPath}/node_modules/typescript`, { name: "typescript", version });
    await put(stackPath, { name: "stack-toolchain", version: "0.1.1", dependencies: { typescript: version } });
    assert.doesNotThrow''')
    text += '''

test("compiler preflight follows Stack ownership instead of a valid root substitute", async t => {
  const { root, put } = await fixture(t);
  await nativeFixture(root, put);
  await put(`${stackPath}/node_modules/typescript`, { name: "typescript", version: "7.0.1" });
  rejects(root, "stack.compiler", "compiler-below-floor", "7.0.1");
});
test("compiler preflight binds the exact Stack compiler declaration", async t => {
  const { root, put } = await fixture(t);
  await nativeFixture(root, put);
  await put(stackPath, { name: "stack-toolchain", version: "0.1.1", dependencies: { typescript: "^7.0.2" } });
  rejects(root, "stack", "dependency-pin-mismatch", "7.0.2");
});
'''
    put(name, text)

    name = 'scripts/check-repository-admission.ts'
    text = read(name)
    text = replace(text, 'const data = (value: unknown): Data => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Data : {};', 'const isData = (value: unknown): value is Data => typeof value === "object" && value !== null && !Array.isArray(value);\nconst data = (value: unknown): Data => isData(value) ? value : {};')
    text = replace(text, 'const profilePath = coverage.featureProfilePath;', 'const profilePath = nonempty(coverage.featureProfilePath) ? coverage.featureProfilePath : undefined;')
    text = text.replace('String(profilePath ?? "foundation.config.yaml")', 'profilePath ?? "foundation.config.yaml"').replace('String(profilePath),', 'profilePath ?? "foundation.config.yaml",')
    text = text.replace('governed.includes(String(module.sourceRoot))', 'governed.includes(module.sourceRoot)')
    text = replace(text, '    const features = records(module.features);', '    const features = records(module.features);\n    const moduleRoot = module.root;')
    text = text.replace('!nonempty(module.root)', '!nonempty(moduleRoot)').replace('module.root === "." || path.startsWith(`${String(module.root)}/`)', 'moduleRoot === "." || path.startsWith(`${moduleRoot}/`)')
    put(name, text)
    name = 'scripts/repository-bootstrap-observation.ts'
    text = replace(read(name), '''const object = (value: unknown): Data => {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), "Expected GitHub response mapping");
  return value as Data;''', '''const isData = (value: unknown): value is Data => value !== null && typeof value === "object" && !Array.isArray(value);
const object = (value: unknown): Data => {
  assert.ok(isData(value), "Expected GitHub response mapping");
  return value;''')
    text = replace(text, '      if (entry === undefined) { cache.set(path, undefined); return; }', '      let text: string | undefined;\n      if (entry !== undefined) {')
    text = replace(text, '      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);', '      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);\n      }')
    put(name, text)
    name = 'scripts/repository-registration.ts'
    text = read(name)
    start = text.index('const controlCodePoint =')
    end = text.index('\n\nexport function', start)
    text = text[:start] + '''const canonicalPath = (path: string): boolean => {
  for (const character of path) {
    const point = character.codePointAt(0);
    if (point !== undefined && (point <= 0x1F || point === 0x7F)) { return false; }
  }
  return path === path.normalize("NFC") && !path.includes("\\\\") && !path.includes(":") && !path.startsWith("/") &&
    path.split("/").every(part => part !== "" && part !== "." && part !== "..");
};''' + text[end:]
    put(name, text)
    name = 'scripts/governance-schema.ts'
    text = replace(read(name), 'export function validateSchema<T = unknown>', '// The caller owns the schema/type pair; Ajv performs the narrowing, not a cast.\n// oxlint-disable-next-line typescript/no-unnecessary-type-parameters\nexport function validateSchema<T = unknown>')
    put(name, text)
    name = 'scripts/check-repository-admission.test.ts'
    text = read(name)
    anchor = 'const json = (value: unknown): string => `${JSON.stringify(value)}\\n`;'
    text = replace(text, anchor, anchor + '''
const isData = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const data = (value: unknown): Record<string, unknown> => { assert.ok(isData(value)); return value; };
const records = (value: unknown): Record<string, unknown>[] => { assert.ok(Array.isArray(value)); return value.map(data); };
const manifestFrom = (files: Map<string, string>) => {
  const manifest = data(JSON.parse(files.get("package.json") ?? "{}"));
  const scripts = Object.fromEntries(Object.entries(data(manifest.scripts)).map(([name, value]) => {
    assert.ok(typeof value === "string"); return [name, value];
  }));
  return { ...manifest, scripts };
};''')
    start = text.index('  const workflow = parseDocument(')
    end = text.index('  assert.deepEqual(workflow.on', start)
    text = text[:start] + '  const workflow = data(parseDocument(await readFile(new URL("../.github/workflows/repository-admission-check.yml", import.meta.url), "utf8")).toJS({ maxAliasCount: 0 }));\n' + text[end:]
    text = text.replace('const steps = workflow.jobs.admission.steps;', 'const steps = records(data(data(workflow.jobs).admission).steps);')
    text = text.replace('step.uses?.startsWith("actions/checkout@")', 'typeof step.uses === "string" && step.uses.startsWith("actions/checkout@")')
    text = text.replace('assert.match(actionStep.uses ?? "",', 'assert.ok(typeof actionStep.uses === "string"); assert.match(actionStep.uses,')
    for shape in ['{ packageManager: string; scripts: Record<string, string> }', '{ scripts: Record<string, string> }']:
        text = text.replace('JSON.parse(files.get("package.json") ?? "{}") as ' + shape, 'manifestFrom(files)')
    text = text.replace('JSON.parse(newlineFixture.files.get("package.json") ?? "{}") as { scripts: Record<string, string> }', 'manifestFrom(newlineFixture.files)')
    text = text.replace('manifest.packageManager = "bun@1.0.0";', 'Object.assign(manifest, { packageManager: "bun@1.0.0" });')
    text = text.replace('JSON.parse(files.get("architecture/profile.json") ?? "{}") as { enforcementCommands: string[] }', 'data(JSON.parse(files.get("architecture/profile.json") ?? "{}"))')
    text = text.replace('profile.enforcementCommands = profile.enforcementCommands.map(command => command.replaceAll("pnpm ", "bun run "));', 'assert.ok(Array.isArray(profile.enforcementCommands));\n  profile.enforcementCommands = profile.enforcementCommands.map(command => { assert.ok(typeof command === "string"); return command.replaceAll("pnpm ", "bun run "); });')
    text = text.replace('JSON.parse(files.get("architecture/profile.json") ?? "{}") as { modules: { root: string }[] }', 'data(JSON.parse(files.get("architecture/profile.json") ?? "{}"))')
    text = text.replace('  assert.ok(profile.modules[0]);\n  profile.modules[0].root', '  const modules = records(profile.modules);\n  assert.ok(modules[0]);\n  modules[0].root')
    put(name, text)
    for name in EXTRA:
        if name.endswith('.test.ts'):
            text = re.sub(r'^(\s*)test\(', r'\1void test(', read(name), flags=re.M)
            put(name, text)
    git('add', '--all')
    assert not git('diff', '--name-only', '--diff-filter=U').strip()
    print('Resolved original conflicts; strict entries=21; lint entries=43; frozen authority/helper bytes retained.')

def finish():
    profile = json.loads(read('docs/engineering-quality-profile.json'))
    tsconfig = json.loads(read('tsconfig.tooling.json'))
    manifest = json.loads(read('package.json'))
    policy = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        "import {readFileSync} from 'node:fs'; import YAML from 'yaml'; console.log(JSON.stringify(YAML.parse(readFileSync('docs/engineering-quality-source-policy.yaml','utf8'))));"], cwd=ROOT, text=True))
    assert policy['packageRoots'] == ['tools/renovate-validation']
    assert 'stack-toolchain' in policy['boundaries'][0]['allow']['packages']
    tool = json.loads(read('tools/renovate-validation/package.json'))
    text = read('scripts/check-quality-scope.mjs')
    keys = ['precheck', 'check', 'quality:scope', 'quality:lint', 'quality:check', 'quality:boundaries', 'test:critical', 'quality:typecheck', 'format:check', 'quality:doctor', 'test:input-proof', 'test', 'renovate:validate']
    start = text.index('const EXPECTED_SCRIPTS = {')
    end = text.index('\n};', start) + len('\n};')
    text = text[:start] + 'const EXPECTED_SCRIPTS = ' + json.dumps({key: manifest['scripts'][key] for key in keys}, indent=2) + ';' + text[end:]
    text = contract(text, 'profile', profile, 'quality profile changed')
    text = contract(text, 'toolingTsconfig', tsconfig, 'strict compiler scope and settings must stay exact')
    text = contract(text, 'sourcePolicy', policy, 'source boundaries must retain every declared tooling root')
    text = replace(text, '  formatRetainedAuthorityBlobs,\n}) {', '  formatRetainedAuthorityBlobs,\n  renovateTool,\n}) {')
    extra = '''  assert.equal(manifest.type, "module", "TypeScript tooling must keep the ESM package contract");
  assert.equal(manifest.devDependencies?.renovate, undefined, "Renovate must remain isolated");
  assert.deepEqual(workspacePolicy.packages, ["."], "Runtime-specific tools must remain separate workspaces");
  assert.equal(workspacePolicy.engineStrict, true, "Engine enforcement must be effective");
  assert.equal(workspacePolicy.strictPeerDependencies, true, "Peer enforcement must be effective");
  assert.equal(workspacePolicy.saveExact, true, "Dependency declarations must be exact");
  assert.equal(workspacePolicy.verifyDepsBeforeRun, "error", "Checks must not install missing dependencies");
  assert.deepEqual(renovateTool, ''' + json.dumps(tool, indent=2) + ''', "Isolated validator contract changed");
'''
    text = replace(text, '  assertStackBinding(manifest, stackInstallation, stackDoctor);', extra + '  assertStackBinding(manifest, stackInstallation, stackDoctor);')
    text = replace(text, '    manifest: await readJson("package.json"),', '    manifest: await readJson("package.json"),\n    renovateTool: await readJson("tools/renovate-validation/package.json"),')
    text = replace(text, '  const requiredSteps = steps.filter', '''  for (const run of ["pnpm --dir tools/renovate-validation install --frozen-lockfile --ignore-scripts", "pnpm --dir tools/renovate-validation run build:native"]) {
    const matches = steps.filter(step => step?.run === run);
    assert.deepEqual(matches, [{ run }], "CI must retain exact isolated validator bootstrap");
  }
  const requiredSteps = steps.filter''')
    text = replace(text, '  return census;', '''  for (const entry of census.classified.filter(entry => entry.path.endsWith(".ts"))) {
    assert.ok(toolingTsconfig.include.includes(entry.path), "Ordinary TypeScript must be in the strict project");
  }
  return census;''')
    put('scripts/check-quality-scope.mjs', text)
    name = 'scripts/check-quality-scope.test.mjs'
    text = read(name)
    text = text.replace('mkdtemp, realpath,', 'mkdtemp, readFile, realpath,')
    if 'readFile' not in text.split('from "node:fs/promises";')[0]:
        text = text.replace('  realpath,', '  readFile,\n  realpath,', 1)
    text = replace(text, 'import { selectOxlintFiles } from "./run-quality-lint.mjs";', 'import { selectOxlintFiles } from "./run-quality-lint.mjs";\nimport { assertCompilerFloor } from "./compiler-floor.ts";')
    text = replace(text, 'assert.equal(paths.length, 31)', 'assert.equal(paths.length, 43)')
    text = replace(text, '  assert.deepEqual(await selectOxlintFiles(paths), paths);', ''.join('  assert.ok(paths.includes(' + json.dumps(name) + '));\n' for name in EXTRA) + '  assert.deepEqual(await selectOxlintFiles(paths), paths);')
    additions = '''
  "a changed TypeScript ESM package contract": value => { value.manifest.type = "commonjs"; },
  "an absorbed runtime-specific tool": value => { value.workspacePolicy.packages.push("tools/renovate-validation"); },
  "ineffective engine policy": value => { value.workspacePolicy.engineStrict = false; },
  "ineffective peer policy": value => { delete value.workspacePolicy.strictPeerDependencies; },
  "implicit check-time installation": value => { value.workspacePolicy.verifyDepsBeforeRun = "install"; },
  "ranged isolated Renovate pin": value => { value.renovateTool.devDependencies.renovate = "^44.24.2"; },
  "wrong isolated validator runtime": value => { value.renovateTool.devEngines.runtime.version = "26.11.1"; },
  "unbounded native validator build": value => { value.renovateTool.scripts["build:native"] = "pnpm rebuild"; },
  "missing isolated validator bootstrap": value => { value.workflow = value.workflow.replace("pnpm --dir tools/renovate-validation install --frozen-lockfile --ignore-scripts", "true"); },
  "an ordinary TypeScript helper outside the strict project": value => { value.trackedPaths.push("scripts/unlisted-helper.ts"); },
  "an ordinary TypeScript test outside the strict project": value => { value.trackedPaths.push("scripts/unlisted.test.ts"); },
'''
    text = replace(text, 'const mutations = {', 'const mutations = {' + additions)
    text, count = re.subn(r'(const runInstalled =[^;]*?=>\s*)spawnSync\((.*?)\n  \}\);', r'\1{ assertCompilerFloor(); return spawnSync(\2\n  }); };', text, flags=re.S)
    if count != 1:
        # Current main already owns a block-bodied wrapper.
        assert 'const runInstalled' in text
        if 'assertCompilerFloor();' not in text:
            start = text.index('const runInstalled')
            pos = text.index('spawnSync(', start)
            text = text[:pos] + '(assertCompilerFloor(), spawnSync)' + text[pos + len('spawnSync'):]
    marker = '  const run = () => runInstalled('
    # Main formatter may split this expression onto a following line.
    location = text.index('test("installed source boundary rejects missing inputs and governed dist source"')
    pos = text.index('  const run =', location)
    text = text[:pos] + '''  for (const path of ["tools/renovate-validation/package.json", "tools/renovate-validation/pnpm-workspace.yaml", "tools/renovate-validation/pnpm-lock.yaml"]) {
    await put(path, await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
  }
''' + text[pos:]
    put(name, text)
    name = 'scripts/read-docs-portable-authority-r322.test.mjs'
    text = read(name)
    text, count = re.subn(r'(assert\.equal\([^\n]*?\.length, )31(\))', r'\g<1>43\2', text)
    assert count >= 1, name
    put(name, text)
    doc = read('docs/engineering-quality.md')
    doc += '''

## Runtime and admission integration recovery

This integration retains Foundation 3.0.0 and Stack 0.1.1 ownership. Its strict
program includes 21 entries and its maintained type-aware lint census includes
43 files. Historical authority sources and the four process/test helpers remain
byte-identical to the installed main basis.

The metadata-only compiler preflight follows the real Stack and Foundation
compiler owners before Foundation execution. It does not restore a root compiler,
legacy extractor or an older Foundation toolchain. Renovate 44.24.2 is isolated
in `tools/renovate-validation`, with managed Node 24.21.0 and a mandatory real
native RE2 load. Root checks cannot silently install dependency drift.

The old PR390 activation tuple is historical, not applicable to installed v3.
New protected compiler/admission/toolchain inputs require a separately reviewed
finite successor, fresh positive/negative qualification and an add-before-retire
transition. This functional candidate does not activate its own authority.
'''
    put('docs/engineering-quality.md', doc)
    git('add', '--all')
    for name in FROZEN:
        assert read(name) == source(MAIN, name), name
    print('Finished current Stack contracts, ownership preflight and retained mutation tests.')

if sys.argv[1] == 'compose':
    compose()
elif sys.argv[1] == 'finish':
    finish()
else:
    raise SystemExit('Expected compose or finish')
