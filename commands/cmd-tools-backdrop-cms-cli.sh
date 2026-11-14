#!/usr/bin/env bash

# Installed by the Backdrop CMS plugin (plugins.sh --install backdrop-cms); __WORKSPACE__ is the workspace it was installed into.
#
# Bee, the command line tool of Backdrop CMS, for one Backdrop CMS project of this workspace, in
# its container: say what the site is, run a Bee command, update the core and the modules, flush
# the caches, run cron, add or remove the default accounts. Nothing here runs on the host.

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

# Distribution: the name is the DDEV project type, which the user list is named after.
distribution_name="backdrop";

ARGPARSE_DESCRIPTION="Run Bee on a Backdrop CMS project of __WORKSPACE__: status, a command, updates, caches, cron, the default accounts"
# The args file comes with the plugin: core/scripts/plugins/backdrop-cms/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/backdrop-cms/args/arg-backdrop-cms-cli.sh || exit 1 ;

shift $#;

backdrop_cli_tool ;
