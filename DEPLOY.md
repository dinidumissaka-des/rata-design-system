# Deploying the playground

The playground at `apps/playground` is the only deployable thing in this
repo — everything else is a library. It deploys to Vercel as static
files, configured by [`vercel.json`](vercel.json) at the repo root.

`vercel.json` cannot hold comments, so the reasoning is here. Each field
in it is a decision, and three of them are not obvious.

## Project settings

**This file is written for `Root Directory = apps/playground`**, which is
what the project is set to. That coupling is the one thing to know before
editing `vercel.json`, because two of its fields depend on it:

| If Root Directory is | `buildCommand` | `outputDirectory` |
|---|---|---|
| `apps/playground` (current) | `cd ../.. && npm run build:playground` | `dist` |
| the repo root | `npm run build:playground` | `apps/playground/dist` |

There is no setting of those two fields that works for both, because
`outputDirectory` is resolved relative to the Root Directory. Vercel
treats Root Directory as a project-level setting that `vercel.json`
cannot express, so the file has to be written for one of them and this
is the one.

Changing Root Directory without changing these fails loudly rather than
silently — either `Missing script: "build:playground"` or `No Output
Directory named "dist" found` — so it is not a trap, just a two-line
edit.

### Why the build command leaves the directory it starts in

`build:playground` is a ROOT script, and it has to be: it builds the
token pipeline across six packages (tokens → themes → css → primitives
→ react → `ui:sync`) before the app. The playground workspace has only
its own `build`, which compiles the app alone against a `dist/` that is
gitignored and therefore absent on a fresh clone.

With the Root Directory set to the app, npm runs commands scoped to that
workspace, so `npm run build:playground` looks for the script *there* and
does not find it:

```
npm error workspace playground@0.1.0
npm error location /vercel/path0/apps/playground
npm error Missing script: "build:playground"
```

`cd ../..` is what puts it back at the repo root. This works because the
whole repository is present in the build container even though the Root
Directory points inside it — the same reason `npm ci` succeeds there,
reading the root workspace config and installing 189 hoisted packages.
If Vercel's "Include source files outside of the Root Directory" option
were ever turned off, this would stop being true and the `cd` would
land somewhere that has no `package.json`.

### The other dashboard fields

**Framework Preset** shows as Vite, and that turns out not to matter:
`vercel.json` wins. The failed builds prove it — they ran
`npm ci` and `npm run build:playground`, this file's commands, rather
than Vite's `npm install` and `vite build`. Leaving the preset alone is
fine.

**Node.js Version** is 24.x. `engines.node` is `>=22` so it is permitted,
but CI runs 22, which makes the deployed build the one version nothing
else in the project tests against. Worth aligning; not a failure.

## The fields

| Field | Why |
|---|---|
| `buildCommand` | `cd ../.. && npm run build:playground` — the root script, which is `npm run build && npm run build -w playground`, the same pair CI runs. See above for why it has to leave the directory it starts in. |
| `installCommand` | `npm ci`, matching CI. `npm install` would be free to resolve a different tree than the lockfile, which is the whole point of having one. |
| `outputDirectory` | `dist`, resolved relative to the Root Directory, so `apps/playground/dist` — where Vite puts it. |
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
redirects → **filesystem** → rewrites, so `/assets/index-abc123.js` and
`/rata-icon.svg` are served before the rewrite is ever consulted. A
blanket rewrite is safe here for that reason and only that reason; on a
host that applied rewrites first, this would break every asset on the
page.

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
cd apps/playground && npm run build:playground   # fails, as Vercel did
cd apps/playground && (cd ../.. && npm run build:playground)   # what runs now
npx serve apps/playground/dist                   # NOT a substitute — see below
```

The first line is worth running once: it is the failure in the build log,
reproduced in one command, and it is the reason the second line exists.

A plain static server will 404 on deep links the same way an unrewritten
Vercel deploy does, so `npx serve` proves the build and *not* the routing.
The only honest check of the rewrite is a Vercel preview deployment: open
one, then navigate to `/components/panel?tab=accessibility` in the
address bar directly rather than by clicking.
