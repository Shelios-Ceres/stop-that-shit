# Architecture

Stop That Shit has a host-independent control decision, thin host adapters, and
a metadata-only runtime evidence sidecar.

```text
Codex Hook JSON ----> Codex Adapter -----\
                                          -> ControlEvent v1
OpenCode hooks -----> OpenCode Adapter --/
    -> decision(contract, action)
    -> host response + RuntimeEvent v1
```

- `src/decision.cjs` contains host-independent decisions.
- `src/contracts.cjs` parses the small prompt contract.
- `src/controller.cjs` stores the current contract and applies decisions.
- `src/adapters/codex-*.cjs` classify Codex events and render Hook responses.
- `src/adapters/opencode-*.cjs` classify OpenCode messages and tool calls.
- `opencode/stop-that-shit.mjs` bridges the in-process OpenCode plugin hooks.
- `src/state.cjs` stores only per-session contract state.
- `src/runtime-audit.cjs` appends and reads metadata-only decision events.
- `src/runtime-annotations.cjs` appends independent human labels.

The packaged Codex manifest keeps its two-event surface. The OpenCode plugin can
load from a local file or GitHub package and uses only documented hooks:
`message.part.updated` and session events through `event`, plus
`tool.execute.before` and `tool.execute.after`. It recovers user messages with
the SDK `client.session.message` call, injects contract context with
`client.session.prompt({ noReply: true })`, and maps child sessions to the root
contract so a subagent cannot silently replace user authority.

Control state and observed response are deliberately separate:

```text
OFF        no checks and no normal-action events
OBSERVING  check and record; never return permission deny
ARMED      explicit task contract; may return permission deny

response: none | context_returned | permission_deny_returned | execution_denial_returned
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
