#!/usr/bin/env bash

argparse "$@" <<ARGEOF || exit 1
parser.add_argument('PROJECT_NAME',
                    help='The Backdrop CMS project in this workspace.')
parser.add_argument('-r', '--run',
                    default="_none_",
                    help='A Bee command to run in the project, without the leading bee. Example: --run "projects --type=module"')
parser.add_argument('-u', '--update',
                    action='store_true',
                    default=False,
                    help='Update Backdrop CMS itself and its modules, themes and layouts, run the database updates and flush the caches.')
parser.add_argument('-f', '--flush',
                    action='store_true',
                    default=False,
                    help='Flush every cache, and nothing else.')
parser.add_argument('-n', '--cron',
                    action='store_true',
                    default=False,
                    help='Run cron once: it fills the search index and does the periodic tasks.')
parser.add_argument('-a', '--add-users',
                    action='store_true',
                    default=False,
                    help='Add the default accounts, one per role. An account that is already there is left as it is.')
parser.add_argument('-c', '--cancel-users',
                    action='store_true',
                    default=False,
                    help='Delete the default accounts.')
ARGEOF
