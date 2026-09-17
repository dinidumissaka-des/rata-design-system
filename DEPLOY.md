# Deploying the playground

The playground at `apps/playground` is the only deployable thing in this
repo — everything else is a library. It deploys to Vercel as static
files, configured by [`vercel.json`](vercel.json) at the repo root.

`vercel.json` cannot hold comments, so the reasoning is here. Each field
in it is a decision, and three of them are not obvious.

## Project settings

The project's Root Directory is `apps/playground`. That is a
project-level setting `vercel.json` cannot express, so the build is
written for it — and it behaves nothing like it reads.

**Vercel does not change directory for the Root Directory. It scopes npm
to that workspace.** The cwd stays the repo root and
`npm_config_workspace=playground` is set in the environment, so a root
script cannot be run by name:

```
npm error workspace playground@0.1.0
npm error location /vercel/path0/apps/playground
npm error Missing script: "build:playground"
```

Reproducible anywhere, which is how it was finally pinned down:

```sh
npm_config_workspace=playground npm run build:playground   # identical error
```

`build:playground` has to be a root script, because it builds the token
pipeline across six packages (tokens → themes → css → primitives → react
→ `ui:sync`) before the app. The playground workspace has only its own
`build`, which compiles the app alone against a `dist/` that is
gitignored and therefore absent on a fresh clone.

So the build command is [`scripts/vercel-build.sh`](scripts/vercel-build.sh),
which unsets the scoping and runs the root script. It is a script rather
than a one-liner because the reasoning above cost two failed
deployments, and a JSON string has nowhere to put it.

### The wrong fix, recorded so nobody tries it again

`cd ../.. && npm run build:playground` looks right and fails worse. The
cwd is *already* the repo root, so `cd ../..` walks out of the checkout
— `/vercel/path0` becomes `/` — and the build fails with
`Could not read package.json: ENOENT /package.json`. The first failure
made it look like a cwd problem. It was never a cwd problem.

### `outputDirectory` is relative to the repo root here, not the Root Directory

The same fact again, and it caught one more deployment: because Vercel
never changed directory, the output path is resolved from the repo root
too. So it is `apps/playground/dist`, not `dist`.

That build otherwise succeeded — Vite transformed 1,924 modules and
wrote the files — and failed only at the last step:

```
Error: No Output Directory named "dist" found after the Build completed.
```

Vercel was looking at `/vercel/path0/dist`. Vite had written
`/vercel/path0/apps/playground/dist`.

The consequence worth keeping: with this Root Directory, **nothing in
`vercel.json` is relative to it.** Not the build command's cwd, not the
output path. The setting's only observable effect is the
`npm_config_workspace` it puts in the environment.

### The other dashboard fields

**Framework Preset** shows as Vite and does not matter: `vercel.json`
wins. The failed builds prove it — they ran `npm ci` and this file's
build command rather than Vite's `npm install` and `vite build`.

**Node.js Version** is 24.x. `engines.node` is `>=22` so it is
permitted, but CI runs 22, which makes the deployed build the one
version nothing else in the project tests against. Worth aligning; not
a failure.

## The fields

| Field | Why |
|---|---|
| `buildCommand` | `sh scripts/vercel-build.sh`, which clears npm's workspace scoping and runs the root `build:playground` — `npm run build && npm run build -w playground`, the same pair CI runs. See above for why it cannot just be that command. |
| `installCommand` | `npm ci`, matching CI. `npm install` would be free to resolve a different tree than the lockfile, which is the whole point of having one. |
| `outputDirectory` | `apps/playground/dist`. Resolved from the repo ROOT, not the Root Directory — see above; this cost a deployment on its own. |
| `framework: null` | Says "Other", so nothing substitutes its own defaults for the commands above. The project carries a Vite preset and this file wins anyway, but stating it means that stays true if the preset is ever cleared. |
| `rewrites` | **The one that breaks if you remove it.** See below. |
| `headers` | See below. |

## The rewrite is load-bearing

The playground routes on `window.location.pathname` with `pushState` —
there is no router dependency, because there are only three URL shapes
(`/foundation/color`, `/components/button`,
`/components/button?tab=properties`). Those are real paths, not hashes.

On a static host that means a direct hit on `/components/button` asks for
a file that does not exist, and there is no file, because Vite emits one
`index.html`. Without the rewrite, every deep link 404s and so does every
refresh anywhere but `/`. The app works perfectly as long as you only
ever click, which is exactly the shape of bug that survives testing.

```json
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
```

This does not swallow the real files. Vercel's routing order is
redirects → **filesystem** → rewrites, so a real file — `/assets/index-abc123.js`,
or anything dropped in `apps/playground/public/` — is served before the
rewrite is ever consulted. A blanket rewrite is safe here for that reason
and only that reason; on a host that applied rewrites first, this would
break every asset on the page.

## The cache headers

Vite fingerprints its bundles (`assets/index-<hash>.js`), so those files
can never change under a given name — `immutable` for a year is correct
and costs nothing.

`index.html` is the opposite: its name is stable and its content changes
on every deploy, since it carries the `<script src>` pointing at the
current bundle hash. Cached, a returning reader gets an old document
asking for a bundle that no longer exists, and the page is blank with a
404 in the console. `max-age=0, must-revalidate` is the fix.

## What is not deployed

The docs under `docs/components/` are generated Markdown, read on GitHub.
They are not part of this build. If they ever want a site of their own
that is a second Vercel project, not a second output directory here.

## Verifying a change to this config locally

```sh
# Vercel's environment, reproduced: cwd is the repo root, npm is scoped
# to the playground workspace.
npm_config_workspace=playground npm run build:playground   # fails as it did
npm_config_workspace=playground sh scripts/vercel-build.sh # what runs now

npx serve apps/playground/dist            # NOT a substitute — see below
```

The first line is worth running once. It is the build-log failure in one
command, and it is the entire reason the script exists.

A plain static server will 404 on deep links the same way an unrewritten
Vercel deploy does, so `npx serve` proves the build and *not* the routing.
The only honest check of the rewrite is a Vercel preview deployment: open
one, then navigate to `/components/panel?tab=accessibility` in the
address bar directly rather than by clicking.
