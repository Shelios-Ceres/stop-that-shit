# Changelog

## Unreleased

- Added an OpenCode adapter and GitHub-installable plugin entrypoint using only
  documented OpenCode hooks (`message.part.updated` and session events through
  `event`, plus `tool.execute.before`/`tool.execute.after`) and the documented
  SDK (`client.session.message`, `client.session.prompt({ noReply: true })`).
- Added package metadata for
  `opencode plugin github:lennney/stop-that-shit -g` while keeping npm
  publication disabled.
- Added OpenCode-native tool classification, execution-denial audit outcomes,
  deterministic adapter/plugin regression tests, and an installed-host smoke
  test that packs the package, installs it into a real OpenCode 1.18.18, and
  verifies a review contract denies a write without changing Codex Hook
  behavior.
- OpenCode: a non-directive root message under an edit-capable agent now
  advances a `review` contract to `change` (`source: host`), so switching the
  host to build mode no longer deadlocks implementation work behind a stale
  review contract.

## 0.0.3 — 2026-08-14 (Technical Preview 3)

- Fixed CI setup so every matrix job installs the declared development
  dependencies before running verification.
- Fixed paired-eval path handling for simulated Windows fixtures and made the
  generated-schema check stable across LF and CRLF worktrees.
- Sharpened the public description around small-task overengineering and added
  repository status badges.
- Documented the maintainer's SHA-256 observation as anecdotal evidence, kept
  the live null result public, and retained `hostEffect: unobserved` in Runtime
  claims.
- No enforcement families were added in this patch preview.

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
