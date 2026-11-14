#!/usr/bin/env bash

argparse "$@" <<ARGEOF || exit 1
parser.add_argument('PROJECT_NAME',
                    help='The name of the project: its folder, its DDEV project and its host name.')
parser.add_argument('-v', '--version',
                    default="${site_version}",
                    help='The Backdrop CMS release to download: latest, or a version number. Example: --version 1.32.0 [default %(default)s]')
parser.add_argument('-i', '--install',
                    action='store_true',
                    default=False,
                    help='Install Backdrop CMS, with the workspace account as the administrator.')
parser.add_argument('-a', '--add-users',
                    action='store_true',
                    default=False,
                    help='With --install, add the default accounts: one per role, the ones the test scenarios log in as.')
parser.add_argument('-l', '--launch',
                    action='store_true',
                    default=False,
                    help='Open the site in a browser when it is ready.')
parser.add_argument('--profile',
                    default="standard",
                    choices=['standard', 'minimal'],
                    help='The install profile. The default accounts and the first test feature are made for standard. [default %(default)s]')
parser.add_argument('--php-version',
                    default="8.3",
                    choices=['8.4', '8.3', '8.2', '8.1'],
                    help='PHP version for the project container. Example: --php-version 8.4 [default %(default)s]')
ARGEOF
