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

/** The same, with a core/ of a given release in the project and a releases page that names the latest one. */
function updateRun(installed: string, latest: string) {
  const p = project('backdrop');
  fs.mkdirSync(path.join(p.dir, 'core', 'includes'), { recursive: true });
  fs.writeFileSync(path.join(p.dir, 'core', 'includes', 'bootstrap.inc'), `<?php\ndefine('BACKDROP_VERSION', '${installed}');\n`);
  const log = path.join(p.root, 'ddev.log');
  const fake = `ddev() { echo "ddev $*" >> "$DDEV_LOG" ; case "$*" in describe*) echo '"status":"running"' ;; *url_effective*) echo "https://github.com/backdrop/backdrop/releases/tag/${latest}" ;; esac ; return 0 ; }`;
  const r = spawnSync('bash', ['-c', `source ${FUNCTIONS}\n${fake}\nPROJECT_NAME=site1 ; RUN=_none_ ; UPDATE=yes ; trim_project_name() { :; } ; backdrop_cli_tool`],
    { encoding: 'utf8', env: { ...process.env, WORKSPACE_ROOT: p.root, doc_name: 'dev', DDEV_LOG: log } });
  return { r, calls: fs.readFileSync(log, 'utf8').split('\n') };
}

test('--update never asks Bee for an update command it does not have: the core, then the database updates, then the caches', () => {
  const { r, calls } = updateRun('1.35.1', '1.35.2');
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.ok(!calls.some((l) => / update --yes$/.test(l)), 'Bee has no update command');
  const core = calls.findIndex((l) => /releases\/download\/1\.35\.2\/backdrop\.zip/.test(l));
  const db = calls.findIndex((l) => / update-db --yes$/.test(l));
  const cache = calls.findIndex((l) => / cache-clear all$/.test(l));
  assert.ok(core >= 0 && db > core && cache > db, 'the core of the latest release, then update-db, then the caches');
  const put = calls[core] + calls.slice(core + 1, db).join('\n');
  assert.match(put, /mv \/var\/www\/html\/core \/var\/www\/html\/core\.previous/, 'the old core stays until the new one is in place');
  assert.match(put, /cp -a \/tmp\/backdrop-package\/backdrop\/core \/var\/www\/html\/core/, 'only core/ is replaced');
  assert.doesNotMatch(put, /settings\.php|\/files|cp -a \/tmp\/backdrop-package\/backdrop\/\. /, 'the settings and the files of the site are not touched');
  assert.match(r.stdout, /Updating Backdrop CMS 1\.35\.1 to 1\.35\.2\./);
  assert.match(r.stdout, /index\.php, \.htaccess and settings\.php were not replaced/);
  assert.match(r.stdout, /modules, themes and layouts this site added are not updated/);
});

test('--update on the latest release downloads nothing, and still runs the database updates', () => {
  const { r, calls } = updateRun('1.35.2', '1.35.2');
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Backdrop CMS 1\.35\.2 is the latest release\./);
  assert.ok(!calls.some((l) => /backdrop\.zip/.test(l)));
  assert.ok(calls.some((l) => / update-db --yes$/.test(l)));
});

test('--update stops, with exit 1, when the latest release cannot be read', () => {
  const { r, calls } = updateRun('1.35.1', 'not-a-version');
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /could not be read/);
  assert.ok(!calls.some((l) => /backdrop\.zip| update-db /.test(l)));
});

// ---- The runtimes: DDEV as before, and Docker Compose, Podman, Kubernetes, Lando and Docksal through the core's layer ----

const ADDRESSES: Record<string, string> = {
  docker: 'http://127.0.0.1:41234', podman: 'http://127.0.0.1:41234', lando: 'http://127.0.0.1:41234',
  kubernetes: 'http://172.18.0.2:30080', docksal: 'http://site1.docksal.site',
};
// Where each runtime keeps the project in its container: what `ddev exec pwd` answers from the project folder.
const ROOTS: Record<string, string> = { docker: '/var/www/html', podman: '/var/www/html', kubernetes: '/var/www/html', lando: '/app', docksal: '/var/www' };

/**
 * Run the builder in a throwaway workspace with `ddev` replaced by a recorder, and the core's layer by stand-ins:
 * `layer` is the runtime it answers with (runtime_of, rt_url), or '' for a core that has no layer yet. The recorder
 * answers `ddev exec pwd` with the runtime's root in the container.
 */
function build(layer: string, env: Record<string, string> = {}) {
  const p = project('backdrop');
  fs.rmSync(p.dir, { recursive: true });
  const log = path.join(p.root, 'ddev.log');
  const address = ADDRESSES[layer] || '';
  const prelude = [
    `ddev() { echo "ddev $*" >> "${log}" ; [ "$*" == "exec pwd" ] && echo "${ROOTS[layer] || '/var/www/html'}" ; return 0 ; }`,
    'trim_project_name() { :; } ; drop_database() { :; } ; ddev_nodejs_version() { echo 24 ; } ; ddev_up() { ddev "$@" ; }',
    layer ? `runtime_of() { echo "\${RUNTIME_ANSWER}" ; } ; rt_url() { [ "\${RUNTIME_ANSWER}" == ddev ] && echo "https://\${PROJECT_NAME}.ddev.site" || echo "${address}" ; }` : '',
    `source ${FUNCTIONS}`,
    'backdrop_build',
  ].join('\n');
  const r = spawnSync('bash', ['-c', prelude], { encoding: 'utf8', input: '', env: { ...process.env, WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1',
    INSTALL: 'yes', ADD_USERS: 'no', LAUNCH: 'no', VERSION: '1.32.1', PHP_VERSION: '8.3', distribution_webroot: '', PROFILE: 'standard',
    RUNTIME: '_none_', RUNTIME_ANSWER: layer || 'ddev', account_name: 'webmaster', account_pass: 'Change_Me.123123', account_mail: 'webmaster@example.com', ...env } });
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter((c) => c.startsWith('ddev ')) : [];
  return { r, calls, dir: path.join(p.root, 'dev', 'site1') };
}

test('on DDEV the build is what it was: the same commands with the layer and without it, Bee from DDEV\'s add-on', () => {
  const without = build('');
  const withLayer = build('ddev');
  for (const b of [without, withLayer]) {
    assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
    assert.match(b.r.stdout, /Go to https:\/\/site1\.ddev\.site\/user\/login and log in as webmaster/);
  }
  assert.deepStrictEqual(withLayer.calls, without.calls);
  assert.ok(without.calls.includes('ddev add-on get backdrop-ops/ddev-backdrop-bee'));
  assert.ok(without.calls.some((c) => c.startsWith('ddev exec /usr/local/bin/bee/bee.php --root=/var/www/html/${DDEV_DOCROOT} --uri=${DDEV_PRIMARY_URL} site-install')));
  assert.ok(!without.calls.includes('ddev exec pwd'), 'DDEV is not asked where the project is');
});

test('on Docker Compose, Podman, Kubernetes, Lando and Docksal Bee is fetched into the project and run there, at the runtime\'s root and address', () => {
  for (const runtime of Object.keys(ADDRESSES)) {
    const address = ADDRESSES[runtime];
    const root = ROOTS[runtime];
    const b = build(runtime, { RUNTIME: runtime });
    assert.strictEqual(b.r.status, 0, runtime + ': ' + b.r.stderr + b.r.stdout);
    assert.ok(!b.calls.some((c) => c.startsWith('ddev add-on')), `${runtime}: no add-on`);
    const fetch = b.calls.findIndex((c) => c.includes('https://github.com/backdrop-contrib/bee/archive/1.x-1.x.zip'));
    assert.ok(fetch > b.calls.indexOf('ddev start -y'), `${runtime}: Bee is fetched once the project runs`);
    assert.match(b.calls[fetch], /mv \/tmp\/bee-package\/bee-1\.x-1\.x \.webship\/bee/, runtime);
    const install = b.calls.find((c) => c.includes(' site-install '));
    assert.ok(install && install.startsWith(`ddev exec php ${root}/.webship/bee/bee.php --root=${root} --uri=${address} site-install`), `${runtime}: ${install}`);
    assert.ok(install.includes('--db-name=db --db-user=db --db-pass=db --db-host=db'), runtime);
    assert.ok(b.calls.some((c) => c.includes(`cp -a /tmp/backdrop-package/backdrop/. ${root}/`)), `${runtime}: the code goes to the runtime's root`);
    assert.ok(!fs.existsSync(path.join(b.dir, '.ddev')), `${runtime}: nothing of DDEV's is written`);
    assert.match(b.r.stdout, new RegExp(`Go to ${address.replace(/[.]/g, '\\.')}/user/login and log in as webmaster`), runtime);
    assert.doesNotMatch(b.r.stdout, /ddev\.site/, runtime);
  }
});

test('--runtime on a workspace without the runtime layer is refused, never built on DDEV in silence', () => {
  const b = build('', { RUNTIME: 'docker' });
  assert.strictEqual(b.r.status, 1);
  assert.match(b.r.stdout, /--runtime docker needs a Webship Workspace with the container runtimes/);
  assert.deepStrictEqual(b.calls, []);
  assert.ok(!fs.existsSync(b.dir), 'no folder was made');
  assert.strictEqual(build('', { RUNTIME: 'ddev' }).r.status, 0);
});

test('the builder takes --runtime, with the runtimes of the core\'s own builders', () => {
  const args = fs.readFileSync(path.join(PKG, 'scripts', 'args', 'arg-backdrop-cms.sh'), 'utf8');
  assert.match(args, /parser\.add_argument\('--runtime',\s+dest='RUNTIME',\s+default="_none_",\s+choices=\['ddev', 'docker', 'podman', 'kubernetes', 'lando', 'docksal'\],/);
});

/** A site of another runtime: compose.yaml with its type, no .ddev folder. */
function runtimeSite() {
  const p = project('backdrop');
  fs.rmSync(path.join(p.dir, '.ddev'), { recursive: true });
  fs.writeFileSync(path.join(p.dir, 'compose.yaml'), 'name: site1\nx-webship:\n  runtime: docker\n  type: backdrop\n  port: 41234\n');
  return p;
}
const LAYER = 'runtime_of() { echo docker ; } ; rt_is_platform() { grep -q "^  type: $2$" "$1/compose.yaml" 2>/dev/null ; } ; rt_url() { echo http://127.0.0.1:41234 ; } ; ';

test('a site is known on every runtime: the layer reads its type', () => {
  const rt = runtimeSite();
  assert.strictEqual(bash(`${LAYER} backdrop_is_project ${rt.dir}`).status, 0);
  assert.notStrictEqual(bash(`backdrop_is_project ${rt.dir}`).status, 0, 'an older core reads no compose.yaml');
  assert.strictEqual(bash(`backdrop_is_project ${project('backdrop').dir}`).status, 0, 'DDEV as before');
  assert.notStrictEqual(bash(`${LAYER} backdrop_is_project ${project('drupal11').dir}`).status, 0);
});

test('Bee\'s tool runs the project\'s own Bee on a site of a runtime, and says its address', () => {
  const rt = runtimeSite();
  const log = path.join(rt.root, 'ddev.log');
  const env = { WORKSPACE_ROOT: rt.root, doc_name: 'dev', PROJECT_NAME: 'site1', DDEV_LOG: log };
  const what = bash(`${LAYER} trim_project_name() { :; } ; RUN=_none_ ; UPDATE=no ; ADD_USERS=no ; CANCEL_USERS=no ; backdrop_cli_tool`, env);
  assert.strictEqual(what.status, 0, what.stdout + what.stderr);
  assert.match(what.stdout, /^dev\/site1: Backdrop CMS .* at http:\/\/127\.0\.0\.1:41234$/m);
  assert.doesNotMatch(what.stdout, /ddev\.site/);
  fs.writeFileSync(log, '');
  bash(`${LAYER} trim_project_name() { :; } ; RUN="status" ; backdrop_cli_tool`, env);
  assert.match(fs.readFileSync(log, 'utf8'), /^ddev exec php \S*\/\.webship\/bee\/bee\.php --root=\S* --uri=http:\/\/127\.0\.0\.1:41234 status$/m);
});

test('the feature of the runtimes drives a site of the platform, and names no platform in a step', () => {
  const feature = fs.readFileSync(path.join(PKG, 'features', 'backdrop-cms-runtimes.feature'), 'utf8');
  const scenarios = feature.split(/\n(?=  @needs-runtime-)/).slice(1);
  assert.strictEqual(scenarios.length, 6);
  for (const s of scenarios) assert.match(s, /^  @needs-runtime-(docker|kubernetes) @needs-platform-backdrop\n  Scenario: /);
  const steps = feature.split('\n').filter((l) => /^\s*(Given|When|Then|And|But) /.test(l));
  for (const s of steps) assert.doesNotMatch(s, /backdrop/i, s);
  assert.doesNotMatch(feature, /ddev\.site|127\.0\.0\.1/);
  const manifest = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8')).workspacePlugin;
  assert.ok(manifest.features.includes('features/backdrop-cms-runtimes.feature'));
  assert.match(manifest.featuresSite, /^cmd-backdrop-cms-project\.sh ci-backdrop-cms( [A-Za-z0-9._=-]+)* --runtime docker$/);
});
