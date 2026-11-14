/**
 * Backdrop CMS for Webship Workspace: a platform plugin.
 *
 * What the package carries is placed by the installer from the manifest: the builder and the
 * Bee tool in the sites folders, their functions and argparse under core/scripts/plugins/backdrop-cms/,
 * the agents in the AI Agents folder. The dashboard needs nothing drawn for it: the builder is in the
 * Build list because it is a cmd-*-project.sh, the row menus are the core's, the agents are listed
 * like any other. What register() adds is what the assistant is told.
 *
 * Everything the dashboard is asked for goes through `api`; this package requires nothing from the
 * dashboard's own files, so it can be installed from npm and removed without a trace.
 */

import type { PluginApi } from '@webship.co/workspace-plugin-api';

/** The plugin's name: what --activate and --install take, and the folder under core/scripts/plugins/. */
export const PLATFORM = 'backdrop-cms';

/** The DDEV project type of a Backdrop CMS project, which the functions and the user list are named after. */
export const PROJECT_TYPE = 'backdrop';

/** The commands the installer places in every sites folder. */
export const COMMANDS = ['cmd-backdrop-cms-project.sh', 'cmd-tools-backdrop-cms-cli.sh'];

/** The agents the installer places in the AI Agents folder. */
export const AGENTS = ['backdrop-cms-site-builder', 'backdrop-cms-tester'];

/** What the assistant is told about Backdrop CMS in this workspace. */
export function assistantContext(): string {
  return [
    'Backdrop CMS (a plugin, @webship.co/workspace-backdrop-cms): a Backdrop CMS site is built with',
    '`bash cmd-backdrop-cms-project.sh <name> --install --add-users` from a sites folder (dev, test, sandboxes, demos),',
    'in a container like every other project, at https://<name>.ddev.site (log in at /user/login), from the standard profile.',
    '`bash cmd-tools-backdrop-cms-cli.sh <name>` says what the site is; `--run "<command>"` runs Bee (the command line tool of Backdrop CMS) in it,',
    '`--update` updates the core and the modules, `--flush` flushes the caches, `--cron` runs cron, `--add-users` adds the default accounts (one per role).',
    '`bash cmd-tools-add-users.sh <name> backdrop` adds the same accounts: the list is named after the DDEV project type.',
    '`bash cmd-tools-testing.sh <name>` sets up webship-js with the Backdrop CMS step pack; `--run` runs the suite.',
    `For Backdrop CMS work, hand over to the agents ${AGENTS.map((a) => `\`${a}\``).join(' and ')}.`,
    'Never run php, bee, npm or mysql on the host for a project.',
  ].join(' ');
}

export function register(api: PluginApi): void {
  api.addAssistantContext(assistantContext);
}
