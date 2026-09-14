# Deploying the playground

The playground at `apps/playground` is the only deployable thing in this
repo — everything else is a library. It deploys to Vercel as static
files, configured by [`vercel.json`](vercel.json) at the repo root.

`vercel.json` cannot hold comments, so the reasoning is here. Each field
in it is a decision, and three of them are not obvious.

## Project settings

Connect the repo with **Root Directory left at the repo root**, not
`apps/playground`. The playground depends on seven workspace packages
(`@rata/tokens`, `@rata/css`, `@rata/primitives`, `@rata/react`,
`@rata/icons`, and the theme packages), none of which are published — they
resolve through npm workspaces from the root `package-lock.json`. Pointing
Vercel at `apps/playground` would install only that package's own
dependencies and the build would fail on the first `@rata/*` import.

Everything else comes from `vercel.json`, so the dashboard's Build
Command, Output Directory and Install Command fields should stay empty.
A value typed into the dashboard **overrides** the file, which is the
usual reason a repo's committed config appears to be ignored.

## The fields

| Field | Why |
|---|---|
| `buildCommand` | `npm run build:playground`, which is `npm run build && npm run build -w playground` — the same pair CI runs. The first builds the token pipeline in order (tokens → themes → css → primitives → react → `ui:sync`); the second typechecks and runs Vite. Building only the app would compile against whatever `dist/` happened to be committed, and `dist/` is gitignored, so it would not build at all. |
| `installCommand` | `npm ci`, matching CI. `npm install` would be free to resolve a different tree than the lockfile, which is the whole point of having one. |
| `outputDirectory` | `apps/playground/dist`, where Vite puts it. |
| `framework: null` | Vercel would otherwise detect Vite and apply its own defaults for the commands above. Set to "Other" explicitly so the fields in this file are the ones that run. |
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
npm run build:playground                  # exactly what Vercel runs
npx serve apps/playground/dist            # NOT a substitute — see below
```

A plain static server will 404 on deep links the same way an unrewritten
Vercel deploy does, so `npx serve` proves the build and *not* the routing.
The only honest check of the rewrite is a Vercel preview deployment: open
one, then navigate to `/components/panel?tab=accessibility` in the
address bar directly rather than by clicking.
