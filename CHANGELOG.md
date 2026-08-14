# Changelog

## 0.0.3 — 2026-08-14 (Claude Code adaptation)

- Added a Claude Code plugin manifest, local marketplace, shared Skill discovery,
  and native Hook configuration without replacing the existing Codex package.
- Added a thin Claude Code Adapter for `SessionStart`, `UserPromptSubmit`,
  `PreToolUse`, and `SubagentStart`, all normalized into the existing
  `ControlEvent v1`. Direct `/stop-that-shit:stop-that-shit ...` invocation is
  handled in `UserPromptSubmit` so it stays armed on hosts without the
  `UserPromptExpansion` event; the adapter retains its optional
  `UserPromptExpansion` handler, but the packaged `hooks/hooks.json` registers
  only events every supported host accepts.
- Added Claude-native tool classification for `Write`, `Edit`, `NotebookEdit`,
  `EnterWorktree`, `Bash`, `PowerShell`, `Monitor`, `Agent`, current read tools,
  task/control tools, and conservative MCP/plugin fallbacks. `Workflow` is
  treated as unbounded delegation instead of bypassing `agents=N`.
- Added POSIX/Windows absolute-path normalization, manifest dependency detection,
  and process-safe delegation reservations so parallel agent launches respect
  `agents=N`.
- Preserved the original Codex two-Hook surface in `hooks/codex-hooks.json` and
  kept the controller, policy, runtime evidence, cases, and Skill shared.
- Added Claude adapter, plugin-structure, entrypoint, file-lock, dependency,
  subagent, lifecycle, and parallel-budget regression tests.

## 0.0.2 — 2026-08-14 (Technical Preview 2)

- Added `OFF`, `OBSERVING`, and `ARMED` control states with distinct context and
  permission-deny response outcomes; host effect is never inferred.
- Added local metadata-only `RuntimeEvent v1` logs, append-only annotations, and
  `doctor`, `runtime`, `explain`, and `label` inspection commands.
- Migrated paired fixtures to validated `CaseBundle v1` directories and added
  isolated runtime counts, infrastructure exclusions, paired outcome summaries,
  external case directories, and offline rescore.
- Added live-eval preflight for exact installed runtime-tree parity, pinned model
  and reasoning metadata, explicit infrastructure exclusions, and a required
  `--max-cells` paid-session cap after a stale-cache diagnostic run.
- Added JSON Schema validation with a generated standalone validator; Ajv remains
  a development dependency and is not loaded by the plugin runtime.

## 0.0.1 — pre-release

- Added the four-question Stop Ladder.
- Added Codex guards for non-mutating modes, optional file locks, dependency
  approval, subagent budgets, and high-confidence hash authority.
- Reduced the default Guard to `UserPromptSubmit` and `PreToolUse`; the shared
  Skill remains usable when Hooks are disabled.
- Added a public three-arm Codex evaluation harness with synthetic Good/Bad
  fixtures. Live run artifacts remain local and ignored.
- Added a small `ControlEvent v1` seam with Codex as the only Adapter.
- Added paired Bad/Good cases and local release validation.
- Removed experimental scope discovery, new-file and compatibility guessing,
  repeat fingerprints, action ledgers, and compaction checkpoints after live
  testing showed that the product was becoming more complex than its promise.
