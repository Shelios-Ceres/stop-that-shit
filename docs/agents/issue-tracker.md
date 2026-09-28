# Issue tracker: GitHub

Public issues live in `lennney/stop-that-shit` on GitHub. Use the `gh` CLI.
Private research and drafts remain outside this repository, as required by
`AGENTS.md`.

- Read: `gh issue view <number> --repo lennney/stop-that-shit --comments`.
- Inspect metadata: add `--json number,title,body,comments,labels,state,url`.
- List: `gh issue list --repo lennney/stop-that-shit --state open`.
- A request to fetch a ticket means reading the corresponding GitHub issue.
- A request to publish an issue or spec targets GitHub Issues. Publishing,
  commenting, changing labels, and closing issues follow session authorization;
  a local draft is not a posted issue.
- For authorized multiline issue bodies and comments, write the exact text to
  a temporary file and pass `--body-file`.

**PRs as a request surface: no.** Explicitly named PRs may still be reviewed.
GitHub issues and PRs share a number space; resolve the object type when unclear.
