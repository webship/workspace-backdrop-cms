#!/usr/bin/env bash

# workspace-name: Backdrop CMS (latest 1.x)

# Installed by the Backdrop CMS plugin (plugins.sh --install backdrop-cms); __WORKSPACE__ is the workspace it was installed into.
#
# Build a Backdrop CMS site in a container: the current stable release, or the one --version
# names, at https://<name>.ddev.site. With --install the site is installed from the standard
# profile with the workspace account as its administrator; with --add-users it also gets the
# default accounts, one per role.

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

# Set site version.
site_version="latest";

# Distribution: the name is the DDEV project type, which the user list is named after.
distribution_name="backdrop";
distribution_title="Backdrop CMS";
distribution_webroot="";

ARGPARSE_DESCRIPTION="Build a ${distribution_title} project in __WORKSPACE__"
# The args file comes with the plugin: core/scripts/plugins/backdrop-cms/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/backdrop-cms/args/arg-backdrop-cms.sh || exit 1 ;

shift $#;

backdrop_build ;
