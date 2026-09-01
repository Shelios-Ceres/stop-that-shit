'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('Codex plugin manifest and its preserved hook discovery paths exist', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.codex-plugin', 'plugin.json'), 'utf8'));
  const hooks = JSON.parse(fs.readFileSync(path.join(root, 'hooks', 'codex-hooks.json'), 'utf8'));
  assert.equal(manifest.name, 'stop-that-shit');
  assert.equal(manifest.hooks, './hooks/codex-hooks.json');
  assert.ok(fs.existsSync(path.join(root, 'skills', 'stop-that-shit', 'SKILL.md')));
  assert.deepEqual(Object.keys(hooks.hooks).sort(), ['PreToolUse', 'UserPromptSubmit']);
});

test('Codex marketplace identity is distinct from the stable plugin identity', () => {
  const marketplace = JSON.parse(fs.readFileSync(
    path.join(root, '.agents', 'plugins', 'marketplace.json'),
    'utf8'
  ));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.codex-plugin', 'plugin.json'), 'utf8'));
  assert.equal(marketplace.name, 'shelios-plugins');
  assert.equal(manifest.name, 'stop-that-shit');
  assert.equal(marketplace.plugins[0].name, manifest.name);
  assert.equal(marketplace.plugins[0].source.path, './');
});

test('Codex presentation metadata uses valid local assets', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.codex-plugin', 'plugin.json'), 'utf8'));
  for (const field of ['composerIcon', 'logo']) {
    const asset = manifest.interface[field];
    assert.match(asset, /^\.\/assets\//);
    assert.ok(fs.existsSync(path.join(root, asset)), `${field} must point at a packaged asset`);
  }
  if (manifest.interface.screenshots !== undefined) {
    assert.ok(Array.isArray(manifest.interface.screenshots), 'screenshots must be an array');
    for (const screenshot of manifest.interface.screenshots) {
      assert.match(screenshot, /^\.\/assets\/.*\.png$/i);
      assert.ok(fs.existsSync(path.join(root, screenshot)), 'screenshot must point at a packaged PNG');
    }
  }
});

test('the packaged Skill remains useful without the Guard hooks', () => {
  const skill = fs.readFileSync(path.join(root, 'skills', 'stop-that-shit', 'SKILL.md'), 'utf8');
  assert.match(skill, /works without the Guard/i);
  assert.match(skill, /advisory/i);
  assert.match(skill, /Do the requested work\. Keep necessary consequences\. Stop everything else\./);
});

test('Codex install docs pin the release and forbid guessed plugin cache paths', () => {
  const expected = `codex plugin marketplace add Shelios-Ceres/stop-that-shit --ref ${packageJson.version}`;
  const expectedSelector = 'codex plugin add stop-that-shit@shelios-plugins';
  for (const relative of ['README.md', 'README_EN.md', 'INSTALL.md', 'INSTALL_FOR_AGENTS.md']) {
    const contents = fs.readFileSync(path.join(root, relative), 'utf8');
    const commands = (contents.match(/^\s*codex plugin marketplace add Shelios-Ceres\/stop-that-shit.*$/gm) || [])
      .map((line) => line.trim());
    assert.ok(commands.length > 0, `${relative} must include the remote Codex install command`);
    assert.deepEqual([...new Set(commands)], [expected], `${relative} must pin the package version`);
  }
  for (const relative of [
    'README.md',
    'README_EN.md',
    'INSTALL.md',
    'INSTALL_FOR_AGENTS.md',
    'evals/codex-paired/README.md'
  ]) {
    const contents = fs.readFileSync(path.join(root, relative), 'utf8');
    const selectors = (contents.match(/^\s*codex plugin add stop-that-shit@\S+\s*$/gm) || [])
      .map((line) => line.trim());
    assert.ok(selectors.length > 0, `${relative} must include the qualified Codex plugin selector`);
    assert.deepEqual([...new Set(selectors)], [expectedSelector], `${relative} must use the Codex marketplace identity`);
  }

  for (const relative of ['README.md', 'README_EN.md']) {
    const contents = fs.readFileSync(path.join(root, relative), 'utf8');
    const migrationLinks = contents.match(/INSTALL\.md#upgrade-from-010-shelios2/g) || [];
    assert.ok(migrationLinks.length >= 2, `${relative} must route both Codex install entries through migration guidance`);
  }

  const installGuide = fs.readFileSync(path.join(root, 'INSTALL.md'), 'utf8');
  assert.match(installGuide, /codex plugin remove stop-that-shit@shelios-plugins/);
  assert.match(installGuide, /codex plugin marketplace remove shelios-plugins/);

  const skill = fs.readFileSync(path.join(root, 'skills', 'stop-that-shit', 'SKILL.md'), 'utf8');
  const agentInstall = fs.readFileSync(path.join(root, 'INSTALL_FOR_AGENTS.md'), 'utf8');
  for (const contents of [skill, agentInstall]) {
    assert.match(contents, /Do not (?:reconstruct|construct) a path under[\s\S]{0,80}plugins\/cache/i);
    assert.match(contents, /codex plugin list/);
    assert.match(contents, /Marketplace,[\s\S]{0,40}Plugin,[\s\S]{0,40}Version/i);
  }
});

test('Codex hook commands keep resolving the plugin root inside Node and stay shell-agnostic', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'hooks', 'codex-hooks.json'), 'utf8'));
  const handlers = Object.values(config.hooks).flat().flatMap((group) => group.hooks);
  assert.ok(handlers.length > 0);
  for (const handler of handlers) {
    assert.match(handler.command, /^node\s+-e\s+/);
    assert.match(handler.command, /process\.env\.PLUGIN_ROOT/);
    assert.doesNotMatch(handler.command, /\$\{PLUGIN_ROOT\}|&&|\|\||\bexec\s/);
  }
});

test('the packaged Codex hook entrypoint still accepts a Codex event on stdin', (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sts-entrypoint-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const hook = JSON.parse(fs.readFileSync(path.join(root, 'hooks', 'codex-hooks.json'), 'utf8'))
    .hooks.UserPromptSubmit[0].hooks[0];
  const source = hook.command.match(/^node -e "([\s\S]+)"$/)[1];
  const input = JSON.stringify({
    session_id: 'entrypoint-session',
    turn_id: 'turn-1',
    hook_event_name: 'UserPromptSubmit',
    prompt: '$stop-that-shit review -- inspect only'
  });
  const result = spawnSync(process.execPath, ['-e', source], {
    cwd: root,
    env: { ...process.env, PLUGIN_ROOT: root, PLUGIN_DATA: dataDir },
    input,
    encoding: 'utf8',
    timeout: 5000
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(output.hookSpecificOutput.additionalContext, /mode=review/);
});
