import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const FUNCTIONS = path.join(PKG, 'scripts', 'functions', 'fun-backdrop-cms.sh');

// The cucumber.js webship-js scaffolds, as far as the testing hook reads it.
const SCAFFOLD = `module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',          // Webship-js core step definitions.
      'tests/step-definitions/**/*.js',                                  // Your custom step definitions.
    ],
    paths: ['tests/features/**/*.feature'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'http://localhost:8080',
    },
  },
};
`;

/** A project folder with the testing stack scaffolded, and the tooling folder the installer would have filled. */
function project(type: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'backdrop-plugin-'));
  const dir = path.join(root, 'dev', 'site1');
  fs.mkdirSync(path.join(dir, '.ddev'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.ddev', 'config.yaml'), `name: site1\ntype: ${type}\ndocroot: ""\n`);
  // An installed site has its active configuration.
  fs.mkdirSync(path.join(dir, 'files', 'config_abc123', 'active'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'files', 'config_abc123', 'active', 'system.core.json'), '{}\n');
  fs.writeFileSync(path.join(dir, 'cucumber.js'), SCAFFOLD);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'site1', devDependencies: { 'webship-js': '^2.0.6' } }, null, 2));
  const scripts = path.join(root, 'core', 'scripts');
  fs.mkdirSync(path.join(scripts, 'plugins', 'backdrop-cms'), { recursive: true });
  fs.copyFileSync(path.join(PKG, 'testing', 'site.feature'), path.join(scripts, 'plugins', 'backdrop-cms', 'site.feature'));
  return { root, dir, scripts };
}

/** Run bash with the plugin's functions sourced and `ddev` replaced by a recorder; `bee users` answers with DDEV_USERS. */
function bash(script: string, env: Record<string, string> = {}) {
  const fake = `ddev() { echo "ddev $*" >> "\${DDEV_LOG:-/dev/null}" ; case "$*" in *" users") printf '%b' "\${DDEV_USERS:-}" ;; esac ; return 0 ; }`;
  const r = spawnSync('bash', ['-c', `${fake}\nsource ${FUNCTIONS}\n${script}`],
    { encoding: 'utf8', env: { ...process.env, ...env } });
  return r;
}

test('the default accounts are one per role, with example addresses', () => {
  const r = bash('set_backdrop_users ; for u in "${users[@]}" ; do n="user_${u}_name" ; m="user_${u}_mail" ; p="user_${u}_password" ; l="user_${u}_role" ; echo "${!n}|${!m}|${!p}|${!l}" ; done');
  assert.strictEqual(r.status, 0, r.stderr);
  const rows = r.stdout.trim().split('\n').map((l) => l.split('|'));
  assert.deepStrictEqual(rows.map((x) => x[0]), ['administrator', 'editor', 'member']);
  assert.deepStrictEqual(rows.map((x) => x[3]), ['administrator', 'editor', '_none_']);
  for (const [name, mail, password] of rows) {
    assert.strictEqual(mail, `${name}@example.com`);
    assert.ok(password.length >= 8);
  }
});

test('the testing hook adds the step pack, the users registry and a first feature to a Backdrop CMS project, once', () => {
  const p = project('backdrop');
  const log = path.join(p.root, 'ddev.log');
  const run = () => bash(`cd ${p.dir} && testing_configure_backdrop ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1', DDEV_LOG: log });
  const r = run();
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const pkg = JSON.parse(fs.readFileSync(path.join(p.dir, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.devDependencies['@webship-js/backdrop-cms-steps'], '^2.0.0');
  assert.strictEqual(pkg.devDependencies['webship-js'], '^2.0.6', 'what was there stays');
  const cucumber = fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8');
  const lines = cucumber.split('\n');
  const core = lines.findIndex((l) => l.includes('node_modules/webship-js/tests/step-definitions'));
  assert.strictEqual(lines[core + 1], "      'node_modules/@webship-js/backdrop-cms-steps/tests/step-definitions/**/*.js',", 'the pack is listed right after webship-js');
  assert.match(cucumber, /admin: \{ username: process\.env\.SITE_ADMIN_USER \|\| 'administrator', password: process\.env\.SITE_ADMIN_PASSWORD \|\| '[^']+' \},/);
  assert.match(cucumber, /member: \{ username: process\.env\.SITE_MEMBER_USER \|\| 'member', password: process\.env\.SITE_MEMBER_PASSWORD \|\| /);
  // Still a module node can load, with the registry where webship-js reads it.
  const loaded = spawnSync(process.execPath, ['-e', `const c = require(${JSON.stringify(path.join(p.dir, 'cucumber.js'))}).default; console.log(JSON.stringify([c.require, Object.keys(c.worldParameters.users)]))`], { encoding: 'utf8' });
  assert.strictEqual(loaded.status, 0, loaded.stderr);
  const [requires, handles] = JSON.parse(loaded.stdout);
  assert.strictEqual(requires.length, 3);
  assert.deepStrictEqual(handles, ['admin', 'editor', 'member']);
  assert.ok(fs.existsSync(path.join(p.dir, 'tests', 'features', 'site.feature')));
  const calls = fs.readFileSync(log, 'utf8');
  assert.match(calls, /ddev exec \S+bee\.php --root=\S+ --uri=\S+ user-create editor --mail=editor@example\.com --password=\S+\nddev exec \S+ --root=\S+ --uri=\S+ user-add-role editor editor\n/, 'an installed site gets the editor, with its role');
  assert.match(calls, / user-create member --mail=member@example\.com --password=\S+\n(?!.* user-add-role \S+ member)/, 'and the member, with no role of its own');
  // Again, after a person changed the feature: nothing is doubled, nothing is reset.
  fs.writeFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'Feature: mine\n');
  assert.strictEqual(run().status, 0);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), cucumber);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'utf8'), 'Feature: mine\n');
});

test('the testing hook leaves a project of another platform alone', () => {
  const p = project('drupal11');
  const r = bash(`cd ${p.dir} && testing_configure_backdrop ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1' });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), SCAFFOLD);
  assert.ok(!fs.existsSync(path.join(p.dir, 'tests')));
});

test('the CLI tool refuses a project that is not Backdrop CMS', () => {
  const p = project('drupal11');
  const r = bash('PROJECT_NAME=site1 ; RUN="status" ; trim_project_name() { :; } ; backdrop_cli_tool', { WORKSPACE_ROOT: p.root, doc_name: 'dev' });
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /is not a Backdrop CMS project/);
});

test('an account that is already on the site is left as it is', () => {
  const p = project('backdrop');
  const log = path.join(p.root, 'ddev.log');
  const r = bash('PROJECT_NAME=site1 ; set_backdrop_users ; add_backdrop_users', { WORKSPACE_ROOT: p.root, doc_name: 'dev', DDEV_LOG: log, DDEV_USERS: '| User ID | Username  | Email | Roles | Last Login | Status |\\n| 1 | webmaster | webmaster@example.com | administrator | Never | Active |\\n| 3 | editor | editor@example.com | editor | Never | Active |\\n' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /editor is already there/);
  const calls = fs.readFileSync(log, 'utf8');
  assert.doesNotMatch(calls, /user-create editor /);
  assert.match(calls, /user-create administrator /, 'a role of the same name on another account is not an account');
  assert.match(calls, /user-add-role administrator administrator/);
});

test('the default accounts are cancelled with Bee, and only the ones that are there', () => {
  const p = project('backdrop');
  const log = path.join(p.root, 'ddev.log');
  const r = bash('PROJECT_NAME=site1 ; set_backdrop_users ; cancel_backdrop_users', { WORKSPACE_ROOT: p.root, doc_name: 'dev', DDEV_LOG: log, DDEV_USERS: '| 1 | webmaster | webmaster@example.com | administrator | Never | Active |\\n| 3 | editor | editor@example.com | editor | Never | Active |\\n' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /administrator is not there/);
  const cancels = fs.readFileSync(log, 'utf8').split('\n').filter((l) => /user-cancel/.test(l));
  assert.strictEqual(cancels.length, 1);
  assert.match(cancels[0], / user-cancel editor --yes$/);
});

test('the first feature names no platform in a step, and no password', () => {
  const feature = fs.readFileSync(path.join(PKG, 'testing', 'site.feature'), 'utf8');
  const steps = feature.split('\n').filter((l) => /^\s*(Given|When|Then|And|But) /.test(l));
  assert.ok(steps.length >= 10);
  for (const s of steps) assert.doesNotMatch(s, /backdrop-cms/i, s);
  assert.doesNotMatch(feature, /password "/);
  assert.doesNotMatch(feature, /user create|I register/i, 'a suite never creates an account');
});
