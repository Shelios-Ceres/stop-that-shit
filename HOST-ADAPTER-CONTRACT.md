# Host Adapter Contract

Stop That Shit has three implemented host adapters: Codex, Claude Code, and
OpenCode. They normalize host inputs into the same `ControlEvent v1` and reuse
the same contract parser, controller, decisions, state, and runtime evidence.

An Adapter may reuse the decision module only if its host exposes:

1. a stable session identifier;
2. user prompts or explicit mode changes;
3. a before-action event that can actually deny an action;
4. tool name, input, and enough information to classify mutability.

Lifecycle context injection is optional. Codex deliberately keeps its original
two-event surface (`UserPromptSubmit` and `PreToolUse`); it does not require or
register a subagent-start Hook. Claude Code additionally uses `SessionStart` and
`SubagentStart` because those host events provide useful context without changing
the core policy. Direct Skill invocation is armed from `UserPromptSubmit`, so it
works even on hosts that do not expose the `UserPromptExpansion` event; the
adapter keeps its `UserPromptExpansion` handler for hosts that register it.

The normalized event is versioned as `ControlEvent v1`:

```json
{
  "protocolVersion": 1,
  "kind": "action.before",
  "sessionId": "opaque",
  "action": {
    "name": "Edit",
    "mutability": "write",
    "affectedPaths": ["src/config.cjs"],
    "dependencyIntent": false,
    "hashIntent": false
  }
}
```

## Codex mapping

`src/adapters/codex-hooks.cjs` maps the existing Codex Hook JSON to
`ControlEvent v1`. The preserved Codex manifest points at
`hooks/codex-hooks.json`, so Claude support does not broaden the original Codex
Hook trust surface.

## Claude Code mapping

`src/adapters/claude-hooks.cjs` maps:

```text
SessionStart         -> session.start
UserPromptSubmit     -> prompt.submit (also the /stop-that-shit:stop-that-shit slash form)
PreToolUse            -> action.before
SubagentStart         -> subagent.start
UserPromptExpansion  -> prompt.submit (Stop That Shit Skill only; optional on hosts that expose it)
```

The Claude adapter returns a `PreToolUse` `permissionDecision: "deny"` when the
shared controller denies an action. `SubagentStart` is context-only; `agents=N`
is enforced before a Claude `Agent` tool runs, then the started subagent receives
the active contract as additional context.

The classifier covers Claude-native `Write`, `Edit`, `NotebookEdit`,
`EnterWorktree`, `Bash`, `PowerShell`, `Monitor`, `Agent`, current read tools,
and control/task tools. `Monitor` command sources reuse shell dependency/hash
classification; WebSocket monitors are read-only. `Workflow` is treated as
unbounded delegation and is denied by an armed Guard because its internal
subagent fan-out cannot be proven to satisfy `agents=N`. MCP/plugin tool names
fall back to the existing conservative name classifier. Explicit file locks
normalize POSIX and Windows absolute paths relative to Hook `cwd` when possible.

Host-specific event names, tool classification, paths, and response JSON belong
inside the Adapter. Model identity is evaluation metadata, not a new Adapter.
The Adapter may report that it returned context or a host-specific denial, but
it must not claim the host prevented execution through every other path.
`RuntimeEvent v1` therefore records host effect as `unobserved`.

## OpenCode mapping

The OpenCode plugin uses the documented plugin surface only: the `event` hook
(`message.part.updated` plus `session.created`/`session.updated`/
`session.deleted`), `tool.execute.before`, and `tool.execute.after`. It does not
use the undocumented `chat.message` hook.

User text is recovered from a `message.part.updated` trigger through the
documented SDK call `client.session.message`, mapped to `prompt.submit`, and
`tool.execute.before` is mapped to `action.before`. A denied action throws
before the tool runs and records `execution_denial_returned`; Codex continues to
record `permission_deny_returned`. Watch-only context is appended to a
successful tool result through `tool.execute.after`.

Contract context is injected with the documented SDK call
`client.session.prompt({ noReply: true })` carrying a synthetic text part.
Synthetic and ignored parts never arm or change the contract, so injected
messages cannot feed back into contract parsing. Per-session processing is
serialized, and `tool.execute.before` waits for in-flight message processing
before it evaluates the contract.

An explicit host mode switch is treated as authorization. When a root-session
user message that is not a `$stop-that-shit` directive arrives under an
edit-capable agent (resolved through `client.app.agents()`; unknown agents fail
open) while the contract is `review`, the plugin advances the contract to
`change` with `source: host`, preserving file, dependency, and hash settings.
Explicit directives always win, read-only agents never advance, subagent
messages never advance the root contract, and the host permission layer
continues to apply independently.

OpenCode creates a new session identifier for each `task` subagent. The plugin
maps child sessions to the root session contract, does not parse child prompts
as new user authority, and treats a `task_id` continuation as control rather
than a new delegation. If ancestry cannot be resolved, it fails open without
treating the uncertain child prompt as user authority.
