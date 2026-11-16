---
name: backdrop-cms-scenarios
description: Write and run webship-js scenarios for a Backdrop CMS site of the Webship Workspace with the Backdrop CMS step pack (`@webship-js/backdrop-cms-steps`) — the phrases of the pack by area (sessions and access, the administration bar and pages, roles and accounts, content, terms and menu links, the public site), the handles of the users registry, and the workspace command that runs them in the site's container. Use when asked to "write a scenario for this Backdrop site", "test the editor role", "which step is there for a menu link", "add a feature for writing a post", or when a `.feature` file of a Backdrop CMS project is being written or fixed.
argument-hint: '<site> [what to cover]'
---

# backdrop-cms-scenarios

Scenarios for a Backdrop CMS site of a Webship Workspace (`~/workspace`, container-based, DDEV by
default), written from the steps of [`@webship-js/backdrop-cms-steps`](https://github.com/webship/backdrop-cms-steps)
and of [webship-js](https://github.com/webship/webship-js) itself, and run in the site's container
by the workspace's own command. It comes with the Backdrop CMS plugin
(`@webship.co/workspace-backdrop-cms`), like the builder (`cmd-backdrop-cms-project.sh`), the Bee
tool (`cmd-tools-backdrop-cms-cli.sh`) and the agents `backdrop-cms-site-builder` and
`backdrop-cms-tester`.

## Where everything is

| What | Where |
| --- | --- |
| The site | `~/workspace/<folder>/<site>`, at `https://<site>.ddev.site` (`<folder>` is a sites folder: `dev`, `test`, `sandboxes`, `demos`) |
| The suite's configuration | `<site>/cucumber.js`: the step definitions it loads and the users registry (`worldParameters.users`) |
| The features | `<site>/tests/features/*.feature` (`site.feature` is the first one the setup wrote) |
| The pack's steps | `<site>/node_modules/@webship-js/backdrop-cms-steps/tests/step-definitions/*.steps.js` |
| webship-js's steps | `<site>/node_modules/webship-js/tests/step-definitions/*.js` |
| The reports | `<site>/tests/reports/` |

## The order of work

1. **Make sure the testing stack is there.** From the sites folder:
   ```bash
   cd ~/workspace/<folder>
   bash cmd-tools-testing.sh <site>
   ```
   It adds webship-js, the step pack, the users registry and `tests/features/site.feature`, and
   makes sure the default accounts are on the site. It is safe to run again: it adds what is
   missing and keeps what was changed.
2. **Read the installed steps before writing a phrase.** They are the source of truth: the pack
   moves, and a phrase from memory is a guess.
   ```bash
   cd ~/workspace/<folder>/<site>
   grep -hE "^(Given|When|Then)\(" node_modules/@webship-js/backdrop-cms-steps/tests/step-definitions/*.steps.js
   ```
   Every step carries a comment block with examples above it; open the file when a phrase is not
   obvious.
3. **Look at the page first** (the Playwright MCP browser, a tab of your own) when the scenario
   is about a page you have not seen. A scenario written without having seen the page asserts
   what you imagine.
4. **Write the feature** in `<site>/tests/features/`, from phrases that exist (the lists below).
5. **Match every step without a browser**, then run the feature, then the suite:
   ```bash
   cd ~/workspace/<folder>
   bash cmd-tools-testing.sh <site> --dry-run --path tests/features/<name>.feature
   bash cmd-tools-testing.sh <site> --run --path tests/features/<name>.feature
   bash cmd-tools-testing.sh <site> --run --tags "@critical"
   bash cmd-tools-testing.sh <site> --run
   ```
   A dry run says `Undefined` for a phrase no definition matches: fix the phrase, do not write a
   step for it.

## Accounts: a handle, never a password

A scenario logs in by a handle of the users registry. The default accounts are on the site
already (`bash cmd-tools-backdrop-cms-cli.sh <site> --add-users` adds them again if they were
removed):

| Handle | Account | Role |
| --- | --- | --- |
| `admin` | `administrator` | Administrator |
| `editor` | `editor` | Editor |
| `member` | `member` | none beyond Authenticated |

```gherkin
Given I am logged in as "editor"
Then I should be logged in as "editor"
And I should have access to "admin/content"
```

## The phrases, by area

Each line is a phrase the pack defines, and each one passed on a site built with
`bash cmd-backdrop-cms-project.sh <site> --install --add-users` (the Standard profile; the names
in quotes are that site's). Most `should` steps also take the negative: `should not see`,
`should not have`, `should not list`.

### Sessions and access

```gherkin
Given I am logged in as "editor"
Then I should be logged in as "editor"
Then I should be logged out
Then I should have access to "admin/content"
Then I should not have access to "admin/structure/layouts"
Then the page should be an access denied page
```

### The administration: the bar, the pages, roles and accounts

```gherkin
When I go to the "content" administration page
Then I should see the administration bar
Then the administration bar should show the account "editor"
Then the administration bar should list "Content"
Then the site should have the role "Editor"
Then the account "editor" should have the "Editor" role
Then the account "member" should be active
Then the status report should not show errors
```

### Content

```gherkin
Given the content "A post written by a scenario" does not exist
When I start a new "Post"
When I enter "A post written by a scenario" in the "Title" field
When I write "<p>Written by the suite.</p>" in the "Body" editor
When I set the content to be a draft
When I set the content to be published
When I save the content form
When I open the "Edit" page tab
When I edit the content "A post written by a scenario"
When I delete the content "A post written by a scenario"
Then the status message should be "Post A post written by a scenario has been created."
Then the status message should contain "has been updated."
Then the page heading should be "A post written by a scenario"
Then the content on the page should be published
Then the content "A post written by a scenario" should have the status "Not published"
Then the content "A post written by a scenario" should not exist
```

### Terms and menu links

```gherkin
Given the term "A term written by a scenario" does not exist in the "Tags" vocabulary
When I add the term "A term written by a scenario" to the "Tags" vocabulary
When I delete the term "A term written by a scenario" from the "Tags" vocabulary
Then the "Tags" vocabulary should have the term "A term written by a scenario"
Given the link "A link written by a scenario" does not exist in the "Primary navigation" menu
When I add the link "A link written by a scenario" to "<front>" in the "Primary navigation" menu
When I delete the link "A link written by a scenario" from the "Primary navigation" menu
Then the "Primary navigation" menu should have the link "A link written by a scenario"
```

### The public site

```gherkin
Then the primary navigation should list "About"
When I click "About" in the primary navigation
Then I should see the teaser "Your first post!"
When I open the teaser "Your first post!"
Then the breadcrumb trail should be "Home"
```

`I am an anonymous user`, `I am on the homepage`, `I go to "<path>"`, `I should see "<text>"`,
`the page should have a title` and `the response status code should be 200` are webship-js's own
steps; its status codes, classes, landmarks and accessibility audits are used as they are and
never redefined for this platform.

## Traps found on a real site

- **An account on a list is named by its username, a login by its handle.**
  `Given I am logged in as "admin"` is the handle; `the account "administrator" should have the
  "Administrator" role` is the account.
- **A permission is named as the Permissions page shows it.**
  `the "Editor" role should have the permission "<name>"` failed on a name written from memory:
  read the name on the page before asserting it.
- **A title is the identity of what a scenario makes.** Start with
  `Given the content "<title>" does not exist` (and the same for a term and a menu link), so a
  run that failed half way does not break the next one, and use a title nobody else uses.
- **A fresh site has little content**: one post (`Your first post!`), one page (`About`), the
  links `Home` and `About` in the primary navigation, and an empty `Tags` vocabulary. The features
  that come inside the pack (`node_modules/@webship-js/backdrop-cms-steps/tests/features/`) are
  written for the pack's own seeded site: their links and terms are not on a site the builder
  makes.
- **The body editor takes markup**: `I write "<p>…</p>" in the "Body" editor`, and the text is
  then asserted without it.
- A scenario that failed after it created something left it behind: the `does not exist` lines
  clear it at the next run.

## Rules

- **No account is created in a suite.** No `user-create` in a hook, no registration scenario that
  leaves an account behind. A role the registry does not have is asked for, not made.
- **Never the workspace account.** The site's own administrator is not in the registry; `admin`
  is the `administrator` default account.
- **No password in a feature file**, except where a wrong password is the subject.
- **No platform name in a step phrase**: `I should see the administration bar`, never a phrase
  that names the platform. The same holds for a custom step.
- **No selector when a step says it**: `the "content" administration page`, `the "Title" field`,
  not their classes.
- **What a scenario creates, it removes** in the same scenario, under a title nobody else uses.
- **A custom step is the last resort**: look in the pack and in webship-js first, write it in
  `<site>/tests/step-definitions/` with a comment block and examples, and say it may belong in
  the pack.
- **Everything runs in the container**, through `cmd-tools-testing.sh`. Never `npx cucumber-js`
  or `npx playwright` on the host.
- **A failing scenario is a result.** No `@wip`, no longer timeout, no looser assertion to turn a
  run green: say what the site did.

## Examples that run

`examples/` holds three features that pass on a site built with
`bash cmd-backdrop-cms-project.sh <site> --install --add-users`. Copy one into the suite and run
it:

```bash
cp ~/workspace/ai-skills/backdrop-cms-scenarios/examples/roles-and-access.feature ~/workspace/<folder>/<site>/tests/features/
cd ~/workspace/<folder>
bash cmd-tools-testing.sh <site> --run --path tests/features/roles-and-access.feature
```

| Feature | What it shows |
| --- | --- |
| `examples/roles-and-access.feature` | Each default account reaching, or being refused, a path; the administration bar of a role; the roles of the accounts |
| `examples/post-lifecycle.feature` | An editor writing, changing and deleting a post; a draft that is then published |
| `examples/terms-and-menu-links.feature` | A term and a menu link added and deleted; the primary navigation of a fresh site |

## The book

For any automated functional testing in this work (a Gherkin feature, a step definition, choosing a
step, a test run and its failures), read the book *Automated Functional Testing Recipes* first.

- **Where.** Use the first that exists: `.claude/automated-functional-testing-recipes/` in the project,
  `~/.claude/automated-functional-testing-recipes/` (installed by webship/webship-js-ai-agent,
  webship/webship-js-skills or webship/ai-agents), or
  https://github.com/webship/webship-js-ai-agent/tree/2.0.x/automated-functional-testing-recipes
- **How.** Its `README.md` first, then the chapter that matches the task (one file per chapter,
  named by its subject), not the single complete file.
- **Which wins.** The installed webship-js package and the step pack are the source of truth for
  step phrasing. When they differ from the book, follow them and say so.
- **For Backdrop CMS.** Start with `ch26-testing-cms-applications.md` (content, publishing, media
  and taxonomy), `ch10-authentication-authorization.md` (logins, sessions and access by role),
  `ch33-complete-step-definition-reference.md` (every built-in step) and `ch21-when-tests-go-bad.md`
  (flaky, brittle and slow scenarios).
