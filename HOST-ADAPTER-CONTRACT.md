# Host Adapter Contract

Codex and OpenCode have implemented Adapters. Both normalize host inputs into
the same `ControlEvent v1` and reuse the same contract, decision, state, and
runtime modules.

An Adapter may reuse the decision module only if its host exposes:

1. a stable session identifier;
2. user prompts or explicit mode changes;
3. a before-action event that can actually deny an action;
4. tool name, input, and enough information to classify mutability.

Lifecycle context injection is optional. The Codex package deliberately
uses only user-prompt and before-action Hooks; it does not require or register a
subagent-start Hook.

The normalized event is versioned as `ControlEvent v1` and currently needs only:

```json
{
  "protocolVersion": 1,
  "kind": "action.before",
  "sessionId": "opaque",
  "action": {
    "name": "apply_patch",
    "mutability": "write",
    "affectedPaths": ["src/config.cjs"],
    "dependencyIntent": false,
    "hashIntent": false
  }
}
```

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
