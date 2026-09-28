# Domain documentation

This repository uses one project context. Read the relevant sections of:

- `ARCHITECTURE.md` for the Skill, Guard, shared control core, adapters, state,
  and runtime evidence responsibilities.
- `HOST-ADAPTER-CONTRACT.md` for normalized events, host capabilities, and
  delegation lifecycle guarantees.
- `INSTALL.md` and `INSTALL_FOR_AGENTS.md` when the task concerns installation
  or user-facing directives.

If `CONTEXT.md` or relevant documents under `docs/adr/` exist, read them as well.
Their absence does not block work or require creating them. Extend an existing
source when it already owns the concept; add a document only when the task needs
one, following `AGENTS.md`.

Use the vocabulary defined by these documents. Surface conflicts with recorded
decisions before changing the behavior they describe.
