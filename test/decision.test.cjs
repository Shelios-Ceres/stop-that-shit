'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const { decide } = require('../src/decision.cjs');

const casesRoot = path.join(__dirname, '..', 'cases', '0.0.1');

test('double-slash paths follow the host platform without weakening POSIX file locks', () => {
  for (const platform of ['linux', 'win32']) {
    const source = [
      `Object.defineProperty(process, 'platform', { value: ${JSON.stringify(platform)} });`,
      `const { decide } = require(${JSON.stringify(path.resolve(__dirname, '../src/decision.cjs'))});`,
      `const contract = { mode: 'change', level: 'lock', allowedPaths: ['//server/share/repo/src/allowed.cjs'] };`,
      `const action = { mutability: 'write', cwd: '//server/share/repo', affectedPaths: ['//server/share/repo/src/Allowed.cjs'] };`,
      `console.log(JSON.stringify([decide({ contract, action }).outcome,`,
      `decide({ contract, action: { ...action, affectedPaths: ['//server/share/repo/src/../README.md'] } }).outcome]));`
    ].join('\n');
    const result = spawnSync(process.execPath, ['-e', source], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), [platform === 'win32' ? 'allow' : 'deny_and_explain', 'deny_and_explain']);
  }
});

for (const file of fs.readdirSync(casesRoot).filter((name) => name.endsWith('.json')).sort()) {
  const testCase = JSON.parse(fs.readFileSync(path.join(casesRoot, file), 'utf8'));
  test(`${testCase.id}: ${testCase.title}`, () => {
    const actual = decide(testCase.input);
    for (const [key, value] of Object.entries(testCase.expected)) {
      assert.deepEqual(actual[key], value, `${key} mismatch`);
    }
  });
}

test('classification precedence chooses I before H and S', () => {
  const actual = decide({
    contract: { mode: 'review', level: 'guard', agentBudget: 0, agentsUsed: 0 },
    action: {
      mutability: 'write',
      duplicate: true,
      sameTurn: true,
      reachability: 'unreachable',
      authorization: 'unapproved_expansion'
    }
  });
  assert.equal(actual.family, 'I');
});

test('classification precedence chooses H before file-scope S', () => {
  const actual = decide({
    contract: {
      mode: 'change', level: 'guard', hashPolicy: 'deny',
      dependencyPolicy: 'ask', allowedPaths: ['src/config.cjs']
    },
    action: {
      mutability: 'write', duplicate: false, hashIntent: true,
      affectedPaths: ['src/legacy.cjs']
    }
  });
  assert.equal(actual.family, 'H');
  assert.equal(actual.reasonCode, 'HASH_NOT_AUTHORIZED');
});

test('absolute allowlists compare against cwd-relative affected paths', () => {
  const cwd = process.platform === 'win32' ? 'D:\\Workspace\\project' : '/Workspace/project';
  const allowed = process.platform === 'win32'
    ? 'D:/Workspace/Config.toml'
    : '/Workspace/Config.toml';

  const inside = decide({
    contract: { mode: 'change', level: 'lock', allowedPaths: [allowed] },
    action: { mutability: 'write', affectedPaths: ['../Config.toml'], cwd }
  });
  const outside = decide({
    contract: { mode: 'change', level: 'lock', allowedPaths: [allowed] },
    action: { mutability: 'write', affectedPaths: ['../Other.toml'], cwd }
  });

  assert.equal(inside.outcome, 'allow');
  assert.equal(outside.reasonCode, 'PATH_OUTSIDE_CONTRACT');
});

test('file boundary requires approval when an unknown action omits affected paths', () => {
  const actual = decide({
    contract: { mode: 'change', level: 'lock', allowedPaths: ['src/**'] },
    action: { mutability: 'unknown' }
  });

  assert.equal(actual.outcome, 'require_user_approval');
  assert.equal(actual.reasonCode, 'WRITE_PATH_UNPROVEN');
});

test('delegation budget checks the complete requested child count', () => {
  const allowed = decide({
    contract: { mode: 'change', level: 'guard', agentBudget: 3, agentsUsed: 1 },
    action: { mutability: 'delegate', delegationCount: 2 }
  });
  const denied = decide({
    contract: { mode: 'change', level: 'guard', agentBudget: 2, agentsUsed: 1 },
    action: { mutability: 'delegate', delegationCount: 2 }
  });
  const legacy = decide({
    contract: { mode: 'change', level: 'guard', agentBudget: 2, agentsUsed: 1 },
    action: { mutability: 'delegate' }
  });

  assert.equal(allowed.outcome, 'allow');
  assert.equal(denied.reasonCode, 'AGENT_BUDGET_EXHAUSTED');
  assert.match(denied.explanation, /requires 2/);
  assert.equal(legacy.outcome, 'allow');
});

test('unbounded delegation takes precedence over a finite requested count', () => {
  const actual = decide({
    contract: { mode: 'change', level: 'guard', agentBudget: 1, agentsUsed: 1 },
    action: { mutability: 'delegate', delegationCount: 1, unboundedDelegation: true }
  });
  assert.equal(actual.reasonCode, 'UNBOUNDED_DELEGATION');
});

test('agents=allow permits observed delegation but still rejects opaque fan-out', () => {
  const contract = { mode: 'change', level: 'guard', agentPolicy: 'allow', agentBudget: 0, agentsUsed: 0 };
  assert.equal(decide({ contract, action: { mutability: 'delegate', delegationCount: 20 } }).outcome, 'allow');
  assert.equal(decide({ contract, action: { mutability: 'delegate', unboundedDelegation: true } }).reasonCode, 'UNBOUNDED_DELEGATION');
});
