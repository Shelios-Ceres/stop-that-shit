# Architecture

Stop That Shit has a host-independent control core and two thin host adapters:
Codex and Claude Code.

```text
Codex Hook JSON  ----> Codex Adapter  ---\
                                      +--> ControlEvent v1
Claude Hook JSON ----> Claude Adapter ---/        |
                                                 v
                                      decision(contract, action)
                                                 |
                         +-----------------------+----------------------+
                         v                                              v
                 host Hook response                            RuntimeEvent v1
```

- `src/decision.cjs` contains host-independent decisions.
- `src/contracts.cjs` parses the small prompt contract.
- `src/controller.cjs` stores the current contract and applies decisions.
- `src/adapters/codex-*.cjs` classify Codex events and render Codex responses.
- `src/adapters/claude-*.cjs` classify Claude Code events and render Claude Hook
  responses.
- `src/state.cjs` stores per-session contract state and serializes delegation
  reservations so concurrent Hook processes cannot oversubscribe `agents=N`.
- `src/runtime-audit.cjs` appends and reads metadata-only decision events.
- `src/runtime-annotations.cjs` appends independent human labels.

Codex keeps the original two packaged events: `UserPromptSubmit` and
`PreToolUse`. Claude Code packages `SessionStart`, `UserPromptSubmit`,
`PreToolUse`, and `SubagentStart`. Only `PreToolUse` is used for hard action
denial; lifecycle events inject or update the shared contract. Direct Skill
invocation arrives through `UserPromptSubmit`, which also keeps arming working
on hosts that do not expose the optional `UserPromptExpansion` event; the
adapter retains its `UserPromptExpansion` handler for hosts that register it.

Control state and observed response remain deliberately separate:

```text
OFF        no checks and no normal-action events
OBSERVING  check and record; never return permission deny
ARMED      explicit task contract; may return permission deny

response: none | context_returned | permission_deny_returned
host effect: unobserved
```

Installation defaults to `OBSERVING / unconfirmed`. An explicit task mode arms
the Guard; `watch` stays observing and `off` stops normal-action recording.

Hard decisions are limited to observable facts:

- writes in a confirmed non-mutating mode;
- writes outside an optional explicit `files=` list;
- covered dependency additions without authority;
- subagent launches beyond `agents=N`;
- high-confidence hashing without `hash=allow`.

Every observing or armed check is recorded even when the policy allows it, so
runtime totals retain a real checked-action denominator. Audit write failures
fail open and never change the control decision. The Skill handles broader
semantic judgment through the Stop Ladder. Specialized tool paths may bypass
Hooks, so this remains a guardrail, not a security sandbox.
