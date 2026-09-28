import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');

function command(executable, args, options) {
  return new Promise((resolve, reject) => {
    const { input, ...spawnOptions } = options;
    const child = spawn(executable, args, { stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], windowsHide: true, timeout: 180000, ...spawnOptions });
    if (input !== undefined) child.stdin.end(input);
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

for (const version of ['V1', 'V2']) {
  const executable = process.env[`STS_OPENCODE_${version}_BIN`];
  test(`packed OpenCode ${version}: review denial, continued read, restart and explicit change`, { skip: !executable, timeout: 300000 }, async (t) => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), `sts-${version.toLowerCase()}-`));
    if (!process.env.STS_OPENCODE_KEEP_SMOKE) t.after(() => fs.rmSync(work, { recursive: true, force: true }));
    else t.diagnostic(`Evidence directory: ${work}`);
    const workspace = path.join(work, 'workspace');
    fs.mkdirSync(workspace);
    fs.writeFileSync(path.join(workspace, 'read.txt'), 'STS_READ_SUCCEEDED');
    const dataDir = path.join(work, 'sts-data');
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(OPENCODE_|ANTHROPIC_|OPENAI_|GOOGLE_|GEMINI_|AWS_|AZURE_)/i.test(key)));
    for (const [key, folder] of Object.entries({ XDG_CONFIG_HOME: 'config', XDG_DATA_HOME: 'data', XDG_CACHE_HOME: 'cache', XDG_STATE_HOME: 'state', HOME: 'home', USERPROFILE: 'home' })) {
      env[key] = path.join(work, folder);
      fs.mkdirSync(env[key], { recursive: true });
    }
    env.OPENCODE_TEST_HOME = env.HOME;
    env.OPENCODE_DISABLE_SHARE = '1';
    if (version === 'V1') env.OPENCODE_DISABLE_DEFAULT_PLUGINS = '1';
    env.STS_SMOKE_KEY = 'local-synthetic-key';
    env.NO_COLOR = '1';
    const hostVersion = await command(executable, ['--version'], { env, cwd: workspace });
    assert.equal(hostVersion.status, 0, hostVersion.stderr);
    t.diagnostic(hostVersion.stdout.trim());
    const pack = await command(process.execPath, [npmCli, 'pack', '--ignore-scripts', '--json', '--pack-destination', work], { cwd: root });
    assert.equal(pack.status, 0, pack.stderr);
    const tarball = path.join(work, JSON.parse(pack.stdout)[0].filename);
    const installRoot = path.join(work, 'installed');
    const install = await command(process.execPath, [npmCli, 'install', '--prefix', installRoot, '--ignore-scripts', '--no-audit', '--no-fund', tarball], { cwd: work });
    assert.equal(install.status, 0, install.stderr);

    let phase = 'review', next = 0;
    const requests = [];
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => { raw += chunk; });
      req.on('end', () => {
        if (!req.url.endsWith('/chat/completions')) { res.writeHead(404); res.end(); return; }
        const body = JSON.parse(raw);
        requests.push({ phase, body });
        const hasTools = body.tools?.some((tool) => tool.function?.name === 'write');
        let call;
        if (hasTools && next < (phase === 'review' ? 2 : 1)) {
          const tool = phase === 'review' && next === 1 ? 'read' : 'write';
          const file = tool === 'read' ? 'read.txt' : phase === 'review' ? 'blocked.txt' : 'allowed.txt';
          const args = { [version === 'V1' ? 'filePath' : 'path']: path.join(workspace, file) };
          if (tool === 'write') args.content = 'STS_CHANGE_SUCCEEDED';
          call = { index: 0, id: `smoke_${phase}_${++next}`, type: 'function', function: { name: tool, arguments: JSON.stringify(args) } };
        }
        const message = call ? { role: 'assistant', tool_calls: [call] } : { role: 'assistant', content: 'STS_SMOKE_COMPLETE' };
        const finish_reason = call ? 'tool_calls' : 'stop';
        const base = { id: `chatcmpl-${requests.length}`, created: 0, model: 'smoke' };
        if (body.stream) {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          for (const [delta, finish] of [[message, null], [{}, finish_reason]]) {
            res.write(`data: ${JSON.stringify({ ...base, object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);
          }
          res.end('data: [DONE]\n\n');
        } else {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ...base, object: 'chat.completion', choices: [{ index: 0, message, finish_reason }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
        }
      });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
    const baseURL = `http://127.0.0.1:${server.address().port}/v1`;
    const packageRoot = path.join(installRoot, 'node_modules/stop-that-shit');
    const config = version === 'V1' ? {
      model: 'smoke/smoke', small_model: 'smoke/smoke', share: 'disabled', permission: { edit: 'allow' },
      plugin: [[pathToFileURL(path.join(packageRoot, 'opencode/stop-that-shit.mjs')).href, { dataDir }]],
      provider: { smoke: { npm: '@ai-sdk/openai-compatible', name: 'Local smoke', options: { baseURL, apiKey: env.STS_SMOKE_KEY }, models: { smoke: { name: 'Smoke' } } } },
    } : {
      model: 'smoke/smoke',
      plugins: [{ package: pathToFileURL(packageRoot).href, options: { dataDir } }],
      providers: { smoke: { name: 'Local smoke', env: ['STS_SMOKE_KEY'], package: '@opencode/ai/providers/openai-compatible', settings: { baseURL }, models: { smoke: { name: 'Smoke' } } } },
    };
    fs.mkdirSync(path.join(env.XDG_CONFIG_HOME, 'opencode'), { recursive: true });
    fs.writeFileSync(path.join(env.XDG_CONFIG_HOME, 'opencode/opencode.json'), JSON.stringify(config, null, 2));
    const run = async (prompt, sessionID) => {
      const args = ['run', '--model', 'smoke/smoke', '--format', 'json', '--print-logs'];
      if (version === 'V2') args.push('--standalone', '--auto');
      if (sessionID) args.push('--session', sessionID);
      // OpenCode quotes positional arguments containing spaces; stdin preserves directives verbatim.
      const result = await command(executable, args, { cwd: workspace, env, input: prompt });
      fs.writeFileSync(path.join(work, `${phase}.stdout`), result.stdout);
      fs.writeFileSync(path.join(work, `${phase}.stderr`), result.stderr);
      fs.writeFileSync(path.join(work, 'model-requests.json'), JSON.stringify(requests, null, 2));
      assert.equal(result.status, 0, result.stderr);
      return result;
    };
    const review = await run('$stop-that-shit review -- Try blocked.txt, then read read.txt.');
    assert.ok(!fs.existsSync(path.join(workspace, 'blocked.txt')), review.stdout);
    const reviewBodies = requests.filter((entry) => entry.phase === 'review').map(({ body }) => JSON.stringify(body.messages));
    assert.ok(reviewBodies.some((body) => body.includes('MODE_FORBIDS_MUTATION')), 'Model must receive the Guard denial');
    assert.ok(reviewBodies.some((body) => body.includes('STS_READ_SUCCEEDED')), 'Allowed read must finish after denial');
    assert.match(review.stdout, /STS_SMOKE_COMPLETE/);
    const sessionID = review.stdout.split(/\r?\n/).filter(Boolean).map((line) => {
      try { return JSON.parse(line).sessionID; } catch { return undefined; }
    }).find(Boolean);
    assert.ok(sessionID, 'CLI must expose the session ID for restart acceptance');
    phase = 'change'; next = 0;
    const changed = await run('$stop-that-shit change -- Write allowed.txt.', sessionID);
    assert.equal(fs.readFileSync(path.join(workspace, 'allowed.txt'), 'utf8'), 'STS_CHANGE_SUCCEEDED');
    assert.match(changed.stdout, /STS_SMOKE_COMPLETE/);
    const states = fs.readdirSync(path.join(dataDir, 'sessions')).filter((file) => file.endsWith('.json'));
    assert.ok(states.some((file) => JSON.parse(fs.readFileSync(path.join(dataDir, 'sessions', file))).contract.mode === 'change'));
  });
}
