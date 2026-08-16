# Install Stop That Shit 0.0.3 Technical Preview 3

The current immutable preview is
[`0.0.3`](https://github.com/lennney/stop-that-shit/releases/tag/0.0.3).

The default installation is the Guard: one Skill plus two Hook events. Install
Skill only when you prefer advisory guidance without runtime enforcement.

If a Codex agent is doing the installation for you, give it
[`INSTALL_FOR_AGENTS.md`](INSTALL_FOR_AGENTS.md). That guide separates commands
the agent can run from the Hook review that you must complete yourself.

## Default: Skill + Guard

The Guard requires Node.js 18 or newer. Add the repository as a Codex
marketplace, then install the plugin:

```powershell
codex plugin marketplace add lennney/stop-that-shit
codex plugin add stop-that-shit@stop-that-shit
```

Restart Codex after installation.

### Verify the source

Inspect these executable surfaces before trusting them:

- `hooks/hooks.json`
- `hooks/stop-that-shit.cjs`
- `src/`

From a local checkout, run:

```powershell
npm test
npm run eval
npm run release:check
```

### Review two Hooks

Start a fresh Codex CLI TUI and enter `/hooks`. Inspect each Stop That Shit
command and trust it only if it matches the source you reviewed.

Only two events are required:

- `UserPromptSubmit` reads the task mode and explicit boundaries;
- `PreToolUse` checks a supported action before it runs.

After review, both rows show `Installed 1 / Active 1 / Review 0`. `Stop 0` is
expected; the plugin does not install a Stop handler.

Some Codex Desktop builds send `/hooks` as an ordinary message. In that case,
complete the review in the CLI TUI and restart Desktop. Codex records trust
against the Hook definition hash, so an update may require another review. Do
not bypass Hook trust for ordinary installation.

### Run a smoke test

In a disposable repository, start a review task:

```text
$stop-that-shit review -- Review this repository. Report findings; do not edit.
```

A covered write must be denied. Then explicitly switch the contract:

```text
$stop-that-shit change -- Create scratch/sts-smoke.txt containing the word pass.
```

The narrow write should proceed. This checks installation and contract
switching. It does not prove a general improvement in model behavior.

For the three-arm baseline/instruction/plugin test, read
[`evals/codex-paired/README.md`](evals/codex-paired/README.md). It starts no paid
sessions unless you pass `--run`.

## OpenCode: install from GitHub

OpenCode 1.18.18 or newer can install this repository directly from GitHub
without a checkout or npm publication:

```bash
opencode plugin github:lennney/stop-that-shit -g
```

The command installs the package into OpenCode's cache and adds the GitHub spec
to the global OpenCode configuration. Package lifecycle scripts are not run.
Restart OpenCode, then set a contract with the host-neutral form:

```text
$stop-that-shit review -- Review this diff; do not edit.
```

The GitHub package installs the executable Guard. It does not automatically
register the bundled Skill or an `/sts` alias. To add only the optional alias,
put this entry in your OpenCode configuration:

```json
{
  "command": {
    "sts": {
      "description": "Set the Stop That Shit task contract",
      "template": "$stop-that-shit $ARGUMENTS"
    }
  }
}
```

OpenCode denies covered actions by throwing before tool execution. `deps=ask`
and `hash=ask` therefore stop the action and ask you to submit a new explicit
`allow` contract; they do not open a second interactive permission prompt.

Contract state and runtime metadata are stored below OpenCode's state directory
in `stop-that-shit/`. OpenCode currently has no external-plugin uninstall
subcommand; remove `github:lennney/stop-that-shit` from the global
configuration's `plugin` list, then restart OpenCode.

## Optional: Skill only

If you do not want command Hooks, ask the built-in Skill Installer to install
only the shared Skill folder:

```text
$skill-installer Install stop-that-shit from https://github.com/lennney/stop-that-shit/tree/0.0.3/skills/stop-that-shit
```

Start a new task so Codex discovers it. Skill only needs no Hook trust and has
no runtime enforcement. It is advisory, model behavior can vary, and your
existing Codex sandbox and approval settings still apply.

## Local Guard development

The repository includes `.agents/plugins/marketplace.json`. Install a local
checkout with:

```powershell
codex plugin marketplace add <local-checkout-root>
codex plugin add stop-that-shit@stop-that-shit
```

## Disable or uninstall

Use `/hooks` to disable the Guard immediately, then remove the plugin and
marketplace when no longer needed. Skill only can be removed separately from
the Codex Skills directory.

```powershell
codex plugin remove stop-that-shit@stop-that-shit
codex plugin marketplace remove stop-that-shit
```

For a Skill-only installation, remove its exact installed directory, then start
a new Codex task:

```powershell
Remove-Item -LiteralPath "$env:CODEX_HOME\skills\stop-that-shit" -Recurse -Force
```

If `CODEX_HOME` is unset, the default Skills directory is
`$HOME\.codex\skills\stop-that-shit`. Check the resolved path before removing
it.

The Guard stores only the active per-session contract in the host-provided
`PLUGIN_DATA` directory. Review that directory separately if you uninstall.
