# @webship.co/workspace-backdrop-cms

Backdrop CMS for the [Webship Workspace](https://github.com/webship/workspace) dashboard: a builder
that makes a real Backdrop CMS site in a container, a Bee tool for the sites it built (Bee is the command line tool of Backdrop CMS), the default
accounts, the [Backdrop CMS step pack](https://github.com/webship/backdrop-cms-steps) wired into the
workspace's testing setup, and its AI items — two agents, a skill, a command and a prompt —
each listed in the workspace folder of its kind.

The workspace is container-based (DDEV by default): a Backdrop CMS project is a row like any other, so
the row menus the core draws (start, stop, launch, backup, clone, remove, tests) work on it unchanged.

It is made from the reference platform plugin,
[`@webship.co/workspace-wordpress`](https://github.com/webship/workspace-wordpress).

## Use it

```bash
cd ~/workspace
bash core/scripts/plugins.sh --require github:webship/workspace-backdrop-cms   # npm install into the dashboard
bash core/scripts/plugins.sh --activate backdrop-cms                            # plugins.backdrop-cms in settings.yml
bash core/scripts/plugins.sh --install backdrop-cms                             # commands, functions, args, AI items
bash core/scripts/plugins.sh --configure backdrop-cms                           # nothing to configure: it has no settings file
```

The same four steps are buttons on the dashboard's **Settings → Plugins** page. `--install` is
idempotent. `--uninstall` removes what it placed; an AI item you edited stays.

Everything the plugin carries lands in the folder it belongs to, when that folder is an active
workspace folder:

| What | Lands in |
| --- | --- |
| `cmd-backdrop-cms-project.sh`, `cmd-tools-backdrop-cms-cli.sh` | every active sites folder: `dev/`, `test/`, `sandboxes/`, `demos/` |
| The agents `backdrop-cms-site-builder`, `backdrop-cms-tester` | `ai-agents/` |
| The skill `backdrop-cms-scenarios` | `ai-skills/` |
| The command `/backdrop-cms-test` | `ai-commands/` |
| The prompt `backdrop-cms-build-and-test` | `ai-prompts/` |

There they are listed like any other item of the folder, and installed into Claude Code from there.

It needs a Webship Workspace 1.0.7 or later.

## What it needs

A workspace starts empty, so the manifest says what else this plugin needs (`needs`):

- one sites folder, for the builder and the tool: `dev`, `test`, `sandboxes`, `demos` (`dev` is the one added when none is there). The folder also carries `cmd-tools-testing.sh` and the Users tools this plugin's hooks answer to.
- `ai-agents`, `ai-skills`, `ai-commands` and `ai-prompts`: the AI folders its agents, its skill, its command and its prompt are placed in.

`--require` says so, `--activate` and `--install` stop until the workspace has them, and `--with-needs` adds what is missing first:

```bash
bash core/scripts/plugins.sh --activate backdrop-cms --with-needs   # dev and the four AI folders are required, activated and installed first
bash core/scripts/plugins.sh --install backdrop-cms
```

Everything the builder runs for a site runs in the site's own container, through the container tool the workspace already needs; the plugin asks for no command of its own on the machine.

A workspace that knows none of this (Webship Workspace 1.0.8 and older) ignores the keys: add a sites folder and the AI folders yourself, then `--install backdrop-cms` again. A kind whose folder is not there is skipped, and the install says so.

## What the package holds

| Path | What it is |
| --- | --- |
| `commands/cmd-backdrop-cms-project.sh` | The builder, in the Build list as **Backdrop CMS (latest 1.x)**, installed into every sites folder |
| `commands/cmd-tools-backdrop-cms-cli.sh` | Bee for one project: what the site is, a command, updates, caches, cron, the default accounts |
| `scripts/functions/fun-backdrop-cms.sh` | The bash functions behind both, sourced by bootstrap once installed; the names the core's tools look for (`set_backdrop_users`, `add_backdrop_users`, `cancel_backdrop_users`, `testing_configure_backdrop`, named after the DDEV project type `backdrop`) |
| `scripts/args/arg-backdrop-cms.sh`, `arg-backdrop-cms-cli.sh` | Their argparse; the Build form draws the builder's flags from the first |
| `testing/site.feature` | The first feature a Backdrop CMS project gets when testing is set up |
| `ai/agents/backdrop-cms-site-builder.md` | The agent that builds and maintains Backdrop CMS sites with these commands |
| `ai/agents/backdrop-cms-tester.md` | The agent that writes and runs scenarios with the Backdrop CMS step pack |
| `ai/skills/backdrop-cms-scenarios/` | The skill: the step pack's phrases by area, the traps found on a real site, three example features |
| `ai/commands/backdrop-cms-test.md` | The slash command `/backdrop-cms-test <site>`: set up, match every step, run, report |
| `ai/prompts/backdrop-cms-build-and-test.md` | The prompt: a whole launch command for a new session |
| `docs/plugin-items-pattern.md` | How a plugin carries its own commands and AI items, and how to prove it |
| `src/index.ts` | `register(api)`: what the assistant is told about Backdrop CMS here |
| `features/backdrop-cms.feature` | Scenarios for the dashboard's own browser suite |

The `workspacePlugin` block in `package.json` is the manifest the installer reads.

## The commands

Run them from a sites folder. `--help` is safe on both.

### Build a site

```bash
cd ~/workspace/dev
bash cmd-backdrop-cms-project.sh mysite --install --add-users
```

| Flag | What it does |
| --- | --- |
| `--version <x>` | The release to download: `latest` (the default: the current stable release), or a number such as `1.32.0` |
| `--install` | Install the site, with the workspace account as its administrator |
| `--add-users` | With `--install`: add the default accounts, one per role |
| `--profile <name>` | The install profile: `standard` (the default) or `minimal` |
| `--php-version <x>` | The PHP of the project container (`8.3`) |
| `--launch` | Open the site when it is ready |

The site answers at `https://mysite.ddev.site`; log in at `/user/login`. The build runs
`ddev config --project-type=backdrop` with the Node.js of the workspace (24), adds Bee to the
container with its add-on (`backdrop-ops/ddev-backdrop-bee`), downloads the release with Bee and
installs the site with `bee site-install`. The container tool writes `settings.ddev.php` for the
database, and the installer is given the same container values (`db` / `db` / `db`): nothing
personal is written. Cron runs once at the end, so the search has an index. A project of the same
name is deleted first.

Bee asks for the current release with a question that has an hourly limit for an address. When it
is refused, the build fetches the package of the latest release instead and goes on.

### Work on a site

```bash
bash cmd-tools-backdrop-cms-cli.sh mysite                                    # version, address, status, accounts
bash cmd-tools-backdrop-cms-cli.sh mysite --run "projects --type=module"
bash cmd-tools-backdrop-cms-cli.sh mysite --run "help"                       # every command of Bee
bash cmd-tools-backdrop-cms-cli.sh mysite --flush                            # flush every cache
bash cmd-tools-backdrop-cms-cli.sh mysite --cron                             # run cron once
bash cmd-tools-backdrop-cms-cli.sh mysite --update                           # core and modules, database updates, caches
bash cmd-tools-backdrop-cms-cli.sh mysite --add-users                        # the default accounts
bash cmd-tools-backdrop-cms-cli.sh mysite --cancel-users                     # delete them
```

### The default accounts

| Account | Role | Handle in the tests |
| --- | --- | --- |
| `administrator` | Administrator | `admin` |
| `editor` | Editor | `editor` |
| `member` | none beyond Authenticated | `member` |

Each has the address `<account>@example.com` and the password of the workspace's other default
lists. They are for local sites and for tests; the site's own administrator is the workspace
account and is never written into a test. The row's Users menu (**Add the test users**),
`bash cmd-tools-add-users.sh mysite backdrop` and `bash cmd-tools-cancel-users.sh mysite backdrop`
add and remove the same list: it is named `backdrop`, after the DDEV project type.

### Test a site

```bash
bash cmd-tools-testing.sh mysite                 # webship-js, the step pack, the users registry, a first feature
bash cmd-tools-testing.sh mysite --run           # run the suite in the container
bash cmd-tools-testing.sh mysite --run --path tests/features/site.feature
```

`cmd-tools-testing.sh` is the workspace's own. For a Backdrop CMS project it also adds
`@webship-js/backdrop-cms-steps` to `package.json`, lists its step definitions in `cucumber.js` after
webship-js's own, writes the users registry (the handles above, overridable with
`SITE_<HANDLE>_USER` and `SITE_<HANDLE>_PASSWORD`), places `tests/features/site.feature` when the
project has none, and makes sure the default accounts are on the site. Run it again and it adds what
is missing and keeps what you changed.

## The AI items

`ai/` in the package holds one folder per kind, the manifest's `ai` block names each item, and
`--install` places it in the workspace folder of that kind.

| Kind | Item | Use it to |
| --- | --- | --- |
| Agent | `backdrop-cms-site-builder` | Build, update, maintain or remove a Backdrop CMS site with the commands above, in containers only |
| Agent | `backdrop-cms-tester` | Set the testing stack up, look at the site in the Playwright MCP browser first, write scenarios from the pack's steps and run them; it never creates an account in a suite and never writes a platform name into a step phrase |
| Skill | `backdrop-cms-scenarios` | Write a scenario from phrases that exist: the pack's steps by area (sessions and access, the administration, content, terms and menu links, the public site), the handles of the users registry, the traps found on a real site, and three features that pass on a fresh site |
| Command | `/backdrop-cms-test <site> [feature or @tag]` | Run the suite of a site from inside a session: set up when missing, match every step, run, report what failed and why |
| Prompt | `backdrop-cms-build-and-test` | Start a session that builds a site, says what it is, sets the testing stack up and runs the first feature |

After `--install` each is in its folder on the dashboard. **Install** there puts an agent, a skill
or a command into Claude Code (`~/.claude/agents`, `~/.claude/skills`, `~/.claude/commands`), or
from the command line:

```bash
cd ~/workspace/ai-agents   && bash cmd-tools-ai-items.sh backdrop-cms-tester --install
cd ~/workspace/ai-skills   && bash cmd-tools-ai-items.sh backdrop-cms-scenarios --install
cd ~/workspace/ai-commands && bash cmd-tools-ai-items.sh backdrop-cms-test --install
```

A prompt is not installed: it is the whole `claude …` launch command of a new session, and the
dashboard's **New screen** form lists it as a template. By hand, fill the placeholders in and run
the command of the file from the folder it names.

The items are written for any AI CLI, with Claude Code as the default shape: the frontmatter and
the file layout are Claude Code's, the body of each item is plain Markdown that names no tool or
feature of one CLI, a command says in words what its arguments are, and the text between the
triple quotes of a prompt can be given to another AI CLI as it is.

Every step phrase the items show is checked against the definitions of the step pack and of
webship-js (`tests/fixtures/step-definitions.txt`), and every command and flag against the
plugin's own. The shape is the reference's: [`docs/plugin-items-pattern.md`](docs/plugin-items-pattern.md).

## Develop it

```bash
npm install     # builds dist/ (TypeScript)
npm run lint
npm test        # the manifest, the commands, the AI items, the functions against a scaffolded project
```
