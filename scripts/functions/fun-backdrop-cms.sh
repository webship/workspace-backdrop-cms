#!/usr/bin/env bash

# Backdrop CMS for the Webship Workspace: build a site, run Bee on it, add its default accounts,
# and wire its step pack into the testing setup.
#
# Placed by `plugins.sh --install backdrop-cms` in core/scripts/plugins/backdrop-cms/functions/,
# where bootstrap sources it after the core's own functions. Everything runs in the project's
# container (DDEV by default: Bee, Backdrop's command line tool, brought by its container add-on and run
# with `ddev exec`), never on the host. The container tool writes settings.ddev.php for the
# database; the installer is given the same container values (db / db / db) and nothing personal.
#
# The runtimes: a site is built on DDEV, or with --runtime on Docker Compose, Podman, Kubernetes, Lando
# or Docksal. The commands are the same on each: `ddev <verb>` is DDEV itself on a DDEV project, and on
# another runtime the core's layer (fun-runtime.sh) gives the verb its meaning there. What differs is
# behind backdrop_runtime: the address (backdrop_url), where the site is in the container (/var/www/html
# on DDEV; asked of the container elsewhere, backdrop_container_root), and Bee, which DDEV's add-on puts
# in its web image and which the plugin fetches into the project's .webship/bee on another runtime (the
# same 1.x branch the add-on fetches).
#
# Four names are the ones the core's tools look for, under the DDEV project type `backdrop`:
#   set_backdrop_users        the default accounts          (cmd-tools-add-users.sh <project> backdrop)
#   add_backdrop_users        create them with Bee          (the same tool, and --add-users of the builder)
#   cancel_backdrop_users     delete them                   (cmd-tools-cancel-users.sh <project> backdrop)
#   testing_configure_backdrop  the step pack in the testing stack (cmd-tools-testing.sh <project>)

# The step pack a Backdrop CMS project is tested with, and the release line it is required at.
readonly BACKDROP_STEPS_PACKAGE='@webship-js/backdrop-cms-steps';
readonly BACKDROP_STEPS_VERSION='^2.0.0';

# The container add-on that brings Bee into the project.
readonly BACKDROP_BEE_ADDON='backdrop-ops/ddev-backdrop-bee';

# Bee as the add-on installs it in the container, told where the site is and what its address is.
# The two variables are the container's own: they are read there, not here.
readonly BACKDROP_BEE='/usr/local/bin/bee/bee.php --root=/var/www/html/${DDEV_DOCROOT} --uri=${DDEV_PRIMARY_URL}';
# Bee on another runtime than DDEV: the archive of the branch DDEV's add-on fetches, into the project.
readonly BACKDROP_BEE_ARCHIVE='https://github.com/backdrop-contrib/bee/archive/1.x-1.x.zip';

# Where the releases of Backdrop CMS are published.
readonly BACKDROP_RELEASES='https://github.com/backdrop/backdrop/releases';

# The default accounts: one per role of the standard profile, the ones a scenario logs in as.
# Accounts are configuration, created once on the site; a test suite never creates or deletes
# one. The role is the machine name of a role, or _none_ for an account that is only authenticated.
function set_backdrop_users() {
  users=(administrator editor member);
  local roles=('administrator' 'editor' '_none_') i user ;
  for i in "${!users[@]}" ; do
    user="${users[$i]}" ;
    printf -v "user_${user}_name" '%s' "${user}" ;
    printf -v "user_${user}_mail" '%s' "${user}@example.com" ;
    printf -v "user_${user}_password" '%s' 'dD.123123ddd' ;
    printf -v "user_${user}_role" '%s' "${roles[$i]}" ;
  done
}

# The runtime of the project in this folder, or of a new build (--runtime, else the workspace's
# setting, else DDEV). A core without the runtime layer has DDEV only.
function backdrop_runtime() {
  if declare -f runtime_of > /dev/null ; then runtime_of ; else echo 'ddev' ; fi
}

# The address of the site in this folder: https://<name>.ddev.site on DDEV, http://127.0.0.1:<port> on
# Docker Compose, Podman and Lando, the node's address and a port on Kubernetes, http://<name>.docksal.site
# on Docksal. Asked after `ddev config`.
function backdrop_url() {
  if declare -f rt_url > /dev/null ; then rt_url ; else echo "https://${PROJECT_NAME}.ddev.site" ; fi
}

# Where the project is in its container: /var/www/html on DDEV; on another runtime the container is
# asked (/var/www/html on Docker Compose, Podman and Kubernetes, /app on Lando, /var/www on Docksal).
# Asked once per call of a tool, from the project folder.
function backdrop_container_root() {
  if [ "$(backdrop_runtime)" == 'ddev' ] ; then
    echo '/var/www/html' ;
    return 0 ;
  fi
  [ -n "${BACKDROP_CONTAINER_ROOT:-}" ] || BACKDROP_CONTAINER_ROOT="$(ddev exec pwd 2>/dev/null | tr -d '\r' | tail -1)" ;
  echo "${BACKDROP_CONTAINER_ROOT:-/var/www/html}" ;
}

# Bee, as the command line runs it in the container of the project the shell is in: the add-on's on
# DDEV; the project's own .webship/bee on another runtime, told the site's root and its address.
function backdrop_bee() {
  if [ "$(backdrop_runtime)" == 'ddev' ] ; then
    printf '%s' "${BACKDROP_BEE}" ;
    return 0 ;
  fi
  local root ; root="$(backdrop_container_root)" ;
  printf 'php %s/.webship/bee/bee.php --root=%s --uri=%s' "${root}" "${root}" "$(backdrop_url)" ;
}

# Bee on another runtime than DDEV, where no add-on brings it: the archive of the branch DDEV's add-on
# fetches, unpacked into the project's .webship/bee (the folder the runtime's files are in).
function backdrop_bee_install() {
  ddev exec "rm -rf /tmp/bee-package && mkdir -p /tmp/bee-package && curl -fsSL -o /tmp/bee.zip '${BACKDROP_BEE_ARCHIVE}' \
    && unzip -q -o /tmp/bee.zip -d /tmp/bee-package && mkdir -p .webship && rm -rf .webship/bee \
    && mv /tmp/bee-package/bee-1.x-1.x .webship/bee && rm -rf /tmp/bee.zip /tmp/bee-package && test -f .webship/bee/bee.php" ;
}

# Is this folder a Backdrop CMS project? Its project type says so: on DDEV in .ddev/config.yaml, on
# another runtime in the x-webship block, both read by the core's rt_is_platform.
function backdrop_is_project() {
  local project_path="$1";
  if declare -f rt_is_platform > /dev/null ; then
    rt_is_platform "${project_path}" backdrop ;
    return $? ;
  fi
  grep -qE '^type:[[:space:]]*"?backdrop"?[[:space:]]*$' "${project_path}/.ddev/config.yaml" 2>/dev/null ;
}

# Is the site installed? The installer writes the active configuration, and nothing else does.
function backdrop_is_installed() {
  compgen -G "$1/files/config_*/active/system.core.json" > /dev/null ;
}

# Go to the project a tool was asked about, or say why not.
function backdrop_enter_project() {
  local project_path="${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME}";
  if [ ! -d "${project_path}" ] ; then
    echo "No project ${PROJECT_NAME} in ${WORKSPACE_ROOT}/${doc_name}." ;
    return 1 ;
  fi
  if ! backdrop_is_project "${project_path}" ; then
    echo "${doc_name}/${PROJECT_NAME} is not a Backdrop CMS project (its project type is not backdrop)." ;
    return 1 ;
  fi
  cd "${project_path}" || return 1 ;
}

# Run Bee in the container of the project the shell is in. Every argument is quoted for the
# container's shell, so a site name of two words arrives as one argument.
function backdrop_cli() {
  local line arg ;
  line="$(backdrop_bee)" ;
  for arg in "$@" ; do
    line="${line} $(printf '%q' "${arg}")" ;
  done
  ddev exec "${line}" ;
}

# Is there an account of this username on the site? Bee lists the accounts as a table: the
# username is its second column.
function backdrop_user_exists() {
  backdrop_cli users 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' \
    | awk -F'|' -v name="$1" 'NF > 3 { gsub(/^[ \t]+|[ \t]+$/, "", $3) ; if ($3 == name) found = 1 } END { exit found ? 0 : 1 }' ;
}

# Get the code: the current stable release with Bee, or the release --version names from where
# the releases are published. When Bee cannot ask for the current release (its question has an
# hourly limit for an address), the package of the latest release is fetched the same way.
function backdrop_download() {
  local version="$1" package ;
  if [ "${version}" == 'latest' ] ; then
    backdrop_cli download-core && return 0 ;
    echo "Bee could not download the current release; fetching its package instead." ;
    package="${BACKDROP_RELEASES}/latest/download/backdrop.zip" ;
  else
    package="${BACKDROP_RELEASES}/download/${version}/backdrop.zip" ;
  fi
  # The package holds one folder, backdrop/: its content goes to the project root.
  local root ; root="$(backdrop_container_root)" ;
  ddev exec "rm -rf /tmp/backdrop-package && mkdir -p /tmp/backdrop-package && curl -fsSL -o /tmp/backdrop.zip '${package}' \
    && unzip -q -o /tmp/backdrop.zip -d /tmp/backdrop-package && cp -a /tmp/backdrop-package/backdrop/. ${root}/ \
    && rm -rf /tmp/backdrop.zip /tmp/backdrop-package" ;
}

# The number of the latest release of Backdrop CMS: where its releases page sends "latest".
function backdrop_latest_version() {
  ddev exec "curl -fsSLI -o /dev/null -w '%{url_effective}' '${BACKDROP_RELEASES}/latest'" 2>/dev/null \
    | tr -d '\r' | sed -nE 's|^.*/releases/tag/([0-9][0-9.]*)$|\1|p' | head -1 ;
}

# Update the code of Backdrop CMS itself, in the project the shell is in. Bee has no command for
# it, so the core/ folder of the latest release replaces the site's, the way Backdrop's own update
# instructions do it. settings.php, files/ and the site's own modules/, themes/ and layouts/ are not
# touched, and neither are index.php and .htaccess: the release notes say when one of them changed.
# The old core/ stays beside the new one until the new one is in place.
function backdrop_update_core() {
  local current latest ;
  current="$(backdrop_version)" ;
  latest="$(backdrop_latest_version)" ;
  if [ -z "${latest}" ] ; then
    echo "The latest release of Backdrop CMS could not be read from ${BACKDROP_RELEASES}/latest." ;
    return 1 ;
  fi
  if [ "${current}" == "${latest}" ] ; then
    echo "Backdrop CMS ${current} is the latest release." ;
    return 0 ;
  fi
  echo "Updating Backdrop CMS ${current:-(unknown)} to ${latest}." ;
  local root ; root="$(backdrop_container_root)" ;
  ddev exec "rm -rf /tmp/backdrop-package && mkdir -p /tmp/backdrop-package \
    && curl -fsSL -o /tmp/backdrop.zip '${BACKDROP_RELEASES}/download/${latest}/backdrop.zip' \
    && unzip -q -o /tmp/backdrop.zip -d /tmp/backdrop-package \
    && test -f /tmp/backdrop-package/backdrop/core/includes/bootstrap.inc \
    && rm -rf ${root}/core.previous && mv ${root}/core ${root}/core.previous \
    && cp -a /tmp/backdrop-package/backdrop/core ${root}/core \
    && rm -rf ${root}/core.previous /tmp/backdrop.zip /tmp/backdrop-package" \
    || { echo "Backdrop CMS ${latest} could not be put in place; the site's core/ is as it was, or in core.previous." ; return 1 ; } ;
  echo "Backdrop CMS is now $(backdrop_version)." ;
  echo "index.php, .htaccess and settings.php were not replaced: the notes of ${latest} say whether one of them changed." ;
}

# Build a Backdrop CMS site from nothing: the container, the code, and with --install the site itself.
function backdrop_build() {
  trim_project_name ;
  local base_url runtime ;
  runtime="$(backdrop_runtime)" ;
  if [ "${RUNTIME:-_none_}" != '_none_' ] && [ "${RUNTIME}" != "${runtime}" ] ; then
    echo "--runtime ${RUNTIME} needs a Webship Workspace with the container runtimes (webship/workspace#694): update the workspace, or build on DDEV." ;
    exit 1 ;
  fi
  local version="${VERSION:-${site_version:-latest}}" ;
  local php_version="${PHP_VERSION:-${site_php_version:-8.3}}" ;

  cd ${WORKSPACE_ROOT}/${doc_name} || exit 1 ;

  drop_database ;
  rm -rf "${PROJECT_NAME}" ;
  mkdir -p "${PROJECT_NAME}" ;
  cd ${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME} || exit 1 ;

  ddev config --project-type=backdrop --docroot="${distribution_webroot}" --project-name=${PROJECT_NAME} \
    --php-version=${php_version} --nodejs-version=$(ddev_nodejs_version) || exit 1 ;
  # The address is the runtime's to say, once the project is configured: never a written ddev.site.
  base_url="$(backdrop_url)" ;
  if [ "${runtime}" == 'ddev' ] ; then
    ddev add-on get ${BACKDROP_BEE_ADDON} || { echo "The Bee add-on (${BACKDROP_BEE_ADDON}) could not be added." ; exit 1 ; } ;
  fi
  ddev_up start -y || exit 1 ;
  if [ "${runtime}" != 'ddev' ] ; then
    # No add-on there: Bee from the branch the add-on fetches, into the project.
    backdrop_bee_install || { echo "Bee could not be fetched from ${BACKDROP_BEE_ARCHIVE}." ; exit 1 ; } ;
  fi

  backdrop_download "${version}" || { echo "Backdrop CMS ${version} could not be downloaded." ; exit 1 ; } ;

  if [ "${INSTALL}" == 'yes' ] ; then
    # The container's own database values, the same in every project: nothing personal is written.
    backdrop_cli site-install --auto --profile="${PROFILE:-standard}" \
      --username="${account_name}" --password="${account_pass}" --email="${account_mail}" \
      --site-name="${doc_name} ${PROJECT_NAME}" \
      --db-name=db --db-user=db --db-pass=db --db-host=db \
      || { echo "bee site-install failed." ; exit 1 ; } ;

    if [ "${ADD_USERS}" == 'yes' ] ; then
      set_backdrop_users ;
      add_backdrop_users ;
      cd ${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME} || exit 1 ;
    fi

    # The search index is filled by cron: without a first run every search answers "no results".
    backdrop_cli cron ;
    backdrop_cli cache-clear all ;

    echo "${doc_name} ${PROJECT_NAME} has been installed: Backdrop CMS $(backdrop_version).";
    echo "Go to ${base_url}/user/login and log in as ${account_name}";
  else
    [ "${ADD_USERS}" == 'yes' ] && echo "--add-users needs --install: there is no site to add accounts to yet." ;
    echo "${doc_name} ${PROJECT_NAME} is ready to install.";
    echo "Go to ${base_url}";
  fi

  if [ "${LAUNCH}" == 'yes' ] ; then
    ddev launch ;
  fi

  cd ${WORKSPACE_ROOT}/${doc_name};
}

# The release of the code in the project the shell is in: the core says it in its bootstrap file.
function backdrop_version() {
  sed -nE "s/^define\('BACKDROP_VERSION', '([^']+)'\);.*$/\1/p" core/includes/bootstrap.inc 2>/dev/null | head -1 ;
}

# Create the default accounts with Bee. An account that is already there is left as it is.
# The list is loaded by the caller (set_backdrop_users): the core's add_users, the builder, the CLI tool.
function add_backdrop_users() {
  backdrop_enter_project || return 1 ;
  local user user_name user_mail user_password user_role ;
  for user in "${users[@]}" ; do
    user_name="user_${user}_name"; user_mail="user_${user}_mail";
    user_password="user_${user}_password"; user_role="user_${user}_role";

    echo " ---------------------------------------------------------------- ";
    echo "      User name: ${!user_name}";
    echo "      User mail: ${!user_mail}";
    echo "  User password: ${!user_password}";
    echo "      User role: ${!user_role}";
    echo " ================================================================= ";

    if backdrop_user_exists "${!user_name}" ; then
      echo "   ${!user_name} is already there." ;
    else
      backdrop_cli user-create "${!user_name}" --mail="${!user_mail}" --password="${!user_password}" ;
      if [ "${!user_role}" == '_none_' ] ; then
        echo "   No user role for this user" ;
      else
        backdrop_cli user-add-role "${!user_role}" "${!user_name}" ;
      fi
    fi
  done
  cd ${WORKSPACE_ROOT}/${doc_name};
}

# Delete the default accounts.
function cancel_backdrop_users() {
  backdrop_enter_project || return 1 ;
  local user user_name ;
  for user in "${users[@]}" ; do
    user_name="user_${user}_name";
    echo " ---------------------------------------------------------------- ";
    echo "      User name: ${!user_name}";
    echo " ================================================================= ";
    if backdrop_user_exists "${!user_name}" ; then
      backdrop_cli user-cancel "${!user_name}" --yes ;
    else
      echo "   ${!user_name} is not there." ;
    fi
  done
  cd ${WORKSPACE_ROOT}/${doc_name};
}

# What cmd-tools-backdrop-cms-cli.sh does: the first of --run, --update, --flush, --cron,
# --add-users, --cancel-users that was asked for; with none of them, what the site is.
function backdrop_cli_tool() {
  trim_project_name ;
  backdrop_enter_project || exit 1 ;

  if ! ddev describe -j 2>/dev/null | grep -q '"status":"running"' ; then
    ddev start -y || exit 1 ;
  fi

  if [ ! "${RUN}" == '_none_' ] ; then
    # One string on purpose: --run "projects --type=module" is a command and its arguments.
    ddev exec "$(backdrop_bee) ${RUN}" ;
    exit $? ;
  fi

  if [ "${UPDATE}" == 'yes' ] ; then
    # Bee has no command that updates code: the core is updated here, then Bee does the rest.
    backdrop_update_core || exit 1 ;
    backdrop_cli update-db --yes || { echo "The database updates did not finish." ; exit 1 ; } ;
    backdrop_cli cache-clear all ;
    echo "The modules, themes and layouts this site added are not updated: Bee has no command for that." ;
  elif [ "${FLUSH}" == 'yes' ] ; then
    backdrop_cli cache-clear all ;
  elif [ "${CRON}" == 'yes' ] ; then
    backdrop_cli cron ;
  elif [ "${ADD_USERS}" == 'yes' ] ; then
    set_backdrop_users ;
    add_backdrop_users ;
  elif [ "${CANCEL_USERS}" == 'yes' ] ; then
    set_backdrop_users ;
    cancel_backdrop_users ;
  else
    echo "${doc_name}/${PROJECT_NAME}: Backdrop CMS $(backdrop_version) at $(backdrop_url)" ;
    if backdrop_is_installed "$(pwd)" ; then
      echo "" ; backdrop_cli status ;
      echo "" ; echo "Accounts:" ; backdrop_cli users ;
    else
      echo "The site is not installed yet: open its address, or build it again with --install." ;
    fi
  fi
  cd ${WORKSPACE_ROOT}/${doc_name};
}

# The step pack in the testing stack of a Backdrop CMS project. The core's testing_configure
# calls this in the project folder once webship-js is scaffolded and before the dependencies are
# installed; for a project that is not Backdrop CMS it changes nothing.
#
# It adds the pack to package.json, lists its step definitions in cucumber.js after webship-js's
# own, gives cucumber.js the users registry of the default accounts (a handle a scenario reads,
# mapped to an account; never the workspace account), and writes a first feature when the project
# has none of its own. Every part is skipped when it is already there, so a second run adds what
# the first missed and never resets a suite.
function testing_configure_backdrop() {
  local project_path="$1";
  backdrop_is_project "${project_path}" || return 0 ;
  if [ ! -f "${project_path}/cucumber.js" ] || [ ! -f "${project_path}/package.json" ] ; then
    echo "  Backdrop CMS: cucumber.js is not here yet — run the testing setup again once webship-js is scaffolded." ;
    return 1 ;
  fi

  echo "Adding the Backdrop CMS step pack (${BACKDROP_STEPS_PACKAGE} ${BACKDROP_STEPS_VERSION}).";
  set_backdrop_users ;
  local registry="" user user_name user_password handle ;
  for user in "${users[@]}" ; do
    user_name="user_${user}_name"; user_password="user_${user}_password";
    # The pack's features call the administrator "admin".
    handle="${user}" ; [ "${user}" == 'administrator' ] && handle="admin" ;
    registry="${registry}${handle}|${!user_name}|${!user_password}"$'\n' ;
  done

  # The pack reads SITE_<HANDLE>_USER and SITE_<HANDLE>_PASSWORD: the registry keeps its names.
  python3 - "${project_path}" "${BACKDROP_STEPS_PACKAGE}" "${BACKDROP_STEPS_VERSION}" 'SITE' 'PASSWORD' "${registry}" <<'PYEOF' || return 1
import json, re, sys

project, pack, version, prefix, secret, registry = sys.argv[1:7]

# package.json: the pack as a dev dependency, at the release line this plugin was proven on.
pkg_file = project + '/package.json'
pkg = json.load(open(pkg_file))
if pack not in pkg.get('dependencies', {}) and pack not in pkg.get('devDependencies', {}):
    pkg.setdefault('devDependencies', {})[pack] = version
    open(pkg_file, 'w').write(json.dumps(pkg, indent=2) + '\n')
    print('  package.json: %s %s' % (pack, version))

# cucumber.js: the pack's step definitions after webship-js's own, and the users registry.
cucumber_file = project + '/cucumber.js'
src = open(cucumber_file).read()
before = src

if ('node_modules/%s/' % pack) not in src:
    line = "'node_modules/%s/tests/step-definitions/**/*.js'," % pack
    core = re.search(r"^([ \t]*)'node_modules/webship-js/tests/step-definitions/[^']*',.*$", src, re.M)
    opening = re.search(r"^([ \t]*)require:[ \t]*\[[ \t]*$", src, re.M)
    if core:
        src = src[:core.end()] + '\n' + core.group(1) + line + src[core.end():]
    elif opening:
        src = src[:opening.end()] + '\n' + opening.group(1) + '  ' + line + src[opening.end():]
    else:
        sys.exit("  cucumber.js has no require list this can add to. Add this line to it:\n    " + line)
    print('  cucumber.js: the step definitions of %s' % pack)

if not re.search(r"^[ \t]*users:[ \t]*\{", src, re.M):
    world = re.search(r"^([ \t]*)worldParameters:[ \t]*\{[ \t]*$", src, re.M)
    if not world:
        sys.exit("  cucumber.js has no worldParameters block to add the users registry to.")
    pad = world.group(1) + '  '
    rows = [r.split('|') for r in registry.splitlines() if r.strip()]
    block = [
        pad + "// The users registry: a handle a scenario reads, mapped to an account of this site (the default",
        pad + "// accounts: cmd-tools-add-users.sh). Override one with %s_<HANDLE>_USER and %s_<HANDLE>_%s." % (prefix, prefix, secret),
        pad + "users: {",
    ]
    for handle, name, password in rows:
        env = '%s_%s' % (prefix, handle.upper())
        block.append(pad + "  %s: { username: process.env.%s_USER || '%s', password: process.env.%s_%s || '%s' }," % (handle, env, name, env, secret, password))
    block.append(pad + "},")
    src = src[:world.end()] + '\n' + '\n'.join(block) + src[world.end():]
    print('  cucumber.js: the users registry (%s)' % ', '.join(r[0] for r in rows))

if src != before:
    open(cucumber_file, 'w').write(src)
PYEOF

  # A first feature, when the project has none for the site yet: the front page, the log in form,
  # each default account in its role.
  local feature="${WORKSPACE_SCRIPTS}/plugins/backdrop-cms/site.feature" ;
  if [ -f "${feature}" ] && [ ! -f "${project_path}/tests/features/site.feature" ] ; then
    mkdir -p "${project_path}/tests/features" && cp "${feature}" "${project_path}/tests/features/site.feature" \
      && echo "  tests/features/site.feature: a first feature for the site" ;
  fi

  # The scenarios log in as the default accounts: make sure an installed site has them.
  if backdrop_is_installed "${project_path}" ; then
    ( add_backdrop_users > /dev/null ) && echo "  the default accounts are on the site (${users[*]})" ;
  fi
}
