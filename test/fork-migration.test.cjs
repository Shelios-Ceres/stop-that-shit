'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseContractPrompt } = require('../src/contracts.cjs');
const { readState, writeState } = require('../src/state.cjs');
const { inspectDelegation } = require('../src/delegation-state.cjs');
const { decide } = require('../src/decision.cjs');

test('legacy fork allow migrates without becoming agents=0 or inventing a clean history', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sts-fork-migration-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeState('legacy', {
    schemaVersion: 1,
    contract: { mode: 'change', level: 'guard', agentPolicy: 'allow', agentBudget: 0, agentsUsed: 0 }
  }, directory);
  const state = readState('legacy', directory);
  assert.equal(state.schemaVersion, 4);
  assert.equal(state.contract.agentBudget, Number.MAX_SAFE_INTEGER);
  assert.equal('agentPolicy' in state.contract, false);
  assert.deepEqual(inspectDelegation(state.delegation).unresolvedReasons, ['legacy_history_unverified']);
  state.contract = parseContractPrompt('$stop-that-shit change -- continue', state.contract).contract;
  writeState('legacy', state, directory);
  const persisted = readState('legacy', directory);
  assert.equal(persisted.contract.agentBudget, Number.MAX_SAFE_INTEGER);
  assert.deepEqual(persisted.delegation.unresolved, state.delegation.unresolved);
  const finite = parseContractPrompt('$stop-that-shit change agents=2 -- continue', persisted.contract).contract;
  assert.equal(decide({ contract: finite, state: persisted, action: { mutability: 'delegate', delegationCount: 1 } }).reasonCode,
    'DELEGATION_STATE_UNPROVEN');
});

test('legacy finite budgets survive omitted parameters and allow is rejected atomically', () => {
  for (const agentBudget of [0, 2]) {
    const previous = { mode: 'change', level: 'guard', agentPolicy: 'finite', agentBudget, agentsUsed: 1 };
    const result = parseContractPrompt('$stop-that-shit review -- inspect', previous);
    assert.equal(result.contract.agentBudget, agentBudget);
    assert.equal('agentPolicy' in result.contract, false);
    const rejected = parseContractPrompt('$stop-that-shit change agents=allow -- inspect', result.contract);
    assert.equal(rejected.error.code, 'INVALID_AGENT_LIMIT');
    assert.deepEqual(rejected.contract, result.contract);
  }
  const migrated = parseContractPrompt('$stop-that-shit change -- continue', {
    mode: 'change', level: 'guard', agentPolicy: 'allow', agentBudget: 0
  });
  assert.equal(migrated.contract.agentBudget, Number.MAX_SAFE_INTEGER);
  assert.equal('agentPolicy' in migrated.contract, false);
});
