#!/bin/sh
# The build Vercel runs. It exists because two things about that environment
# are not what they look like, and both were diagnosed from failed builds
# rather than guessed.
#
# 1. The project's Root Directory is `apps/playground`, and Vercel expresses
#    that to npm by SCOPING IT TO THAT WORKSPACE — not by changing directory.
#    The cwd is the repo root. So `npm run build:playground`, a root script,
#    fails with:
#
#      npm error workspace playground@0.1.0
#      npm error location /vercel/path0/apps/playground
#      npm error Missing script: "build:playground"
#
#    Reproducible anywhere: `npm_config_workspace=playground npm run
#    build:playground` at the repo root gives the identical error.
#
# 2. Because the cwd is already the repo root, the obvious fix of prefixing
#    `cd ../..` walks OUT of the checkout — `/vercel/path0` becomes `/` — and
#    the next build failed with `Could not read package.json: ENOENT
#    /package.json`. That was the second wrong guess, and the reason this is a
#    script with the reasoning in it instead of a one-liner in vercel.json.
#
# The build has to run unscoped because `build:playground` builds the token
# pipeline across six packages (tokens → themes → css → primitives → react →
# ui:sync) before the app. The playground workspace has only its own `build`,
# which compiles the app alone against a dist/ that is gitignored and so
# absent on a fresh clone.
set -eu

# Self-locating rather than trusting the cwd, since the cwd is exactly what
# was misdiagnosed twice above.
root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

# The scoping, cleared. Both spellings: npm reads --workspace and
# --workspaces from these, and either would re-scope the child npm calls that
# `build:playground` is made of.
unset npm_config_workspace npm_config_workspaces

# Printed because a build log is the only place anyone sees this run, and
# these three lines are what the two failures above would have been diagnosed
# from in one attempt instead of three.
echo "vercel-build: repo root      $root"
echo "vercel-build: invoked from   $(pwd)"
echo "vercel-build: npm workspace  ${npm_config_workspace-<unset>}"

npm run build:playground
