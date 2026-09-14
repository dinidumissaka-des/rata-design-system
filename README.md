# DS — Enterprise Design System (working name)

A token-first, multi-layer design system for web apps and websites. Benchmark: [eBay Playbook](https://playbook.ebay.com/design-system/components).

**Live preview:** [rata-design.vercel.app](https://rata-design.vercel.app) — the component gallery and status matrix (`apps/playground`), deployed on Vercel.

## Architecture

| Layer | Package | What it is | Distribution |
|---|---|---|---|
| Tokens | `@rata/tokens` | Seed-driven token engine → CSS variables, TypeScript, Tailwind preset, [usage docs](packages/tokens/TOKENS.md) | npm |
| Themes | `@rata/theme-*` | Brand themes: a few seeds + `extends`, built to scoped override CSS | npm (pro tier) |
| CSS components | `@rata/css` | Framework-free, per-component versioned CSS (works with plain HTML) | npm |
| Primitives | `@rata/primitives` | Headless, accessible behavior (pure functions — portable beyond React) | npm |
| React components | `@rata/react` | Styled components: primitives behavior + CSS appearance | npm **and** CLI copy-paste |
| Registry | `registry/` | Per-component manifests: family, status matrix, files, tier (free/pro) | drives CLI + docs |
| CLI | `@rata/cli` | `rata list`, `rata add <component>` — copies source into consumer repos; `rata props/tokens/pages` — agent lookup, read straight from source | npm |
| Playground | `apps/playground` | Live component gallery + status matrix | internal (docs site later) |

Key decisions:

- **CSS-first** (like eBay Skin): every component is usable without React; framework wrappers share one CSS layer, so adding Vue/Svelte later is cheap.
- **aria-disabled over disabled**: disabled controls stay focusable and screen-reader discoverable; activation is blocked in the behavior layer.
- **State layer as its own primitive**: uniform hover/press feedback across all interactive components.
- **Status matrix from registry metadata**: honest per-artifact lifecycle (latest / in-progress / future / deprecated / na), published on the docs site.
- **Open core**: tokens + primitives + base components free (MIT); composed blocks/templates and multi-brand theming are the paid tier (`tier: "pro"` in registry manifests).
- **Documented tokens are enforced tokens**: every token carries a contract in `packages/tokens/src/contracts/` — one file per token family, plus each component's recipe in its own registry manifest — and the build fails if a token is undocumented, documented twice, named but nonexistent, if a documented scale step no longer exists, or if a documented contrast pairing stops holding.
- **Generated, not enumerated**: colour, typography, radius and motion come from four seeds per theme, expanded by a generator ported from [Astryx](https://github.com/facebook/astryx). Because HCT tone fixes relative luminance independently of hue, the WCAG guarantees hold *for any brand colour a theme seeds* — and every brand re-measures them at build time. See [THEME-ENGINE.md](packages/tokens/THEME-ENGINE.md).

## Using the tokens

[`packages/tokens/TOKENS.md`](packages/tokens/TOKENS.md) is the reference for every token — what it is for, what it is not for, what to use instead, verified contrast pairings, and token-by-token recipes for common components. It is generated, so it cannot drift from the values.

The same content ships in three machine-readable forms, so an editor or a coding agent gets the rules without leaving the code:

- `@rata/tokens/css` — each CSS variable annotated with its usage
- `@rata/tokens` types — usage rules as JSDoc, shown on hover and in completions
- `@rata/tokens/usage` — JSON with the rules, resolved values per theme, measured contrast ratios, and component recipes

Whether that documentation actually changes what an agent writes is measured, not assumed: [`internal/vibe-tests`](internal/vibe-tests) scores generated component code against rules derived from the token build, and CI fails if the checker stops distinguishing documented answers from naive ones.

## Develop

```sh
npm install
npm run build       # tokens → css → primitives → react → ui:sync
npm run docs:check  # fail if TOKENS.md is out of date with usage.json
npm run themes:check # re-verify every brand theme's contrast promises
npm run vibe        # score the token-guidance A/B fixtures
npm test            # primitives unit tests
npm run dev         # playground at http://localhost:5173
```

Try the CLI (distribution):

```sh
npm run ui -- list
node packages/cli/bin/rata.mjs add button --dir /tmp/demo
```

## Agent-ready workflow

This repo is built so an agent looks up its component API — and its token
usage rules — instead of recalling either from memory. Start with
[CLAUDE.md](CLAUDE.md) for the rules this repo enforces and
[agent-workflow.md](agent-workflow.md) for the general workflow behind them.

```sh
npm run ui -- props button --example   # props, types, defaults + a real usage snippet
npm run ui -- tokens color             # --rata-* custom properties, filtered
npm run ui -- pages                    # existing page shells in this repo
```

`.claude/ui-context.md` is the same lookups as one generated file
(`npm run ui:sync`, which `npm run build` also runs last) — read it when you
want the whole surface at once instead of querying one component at a time.

Adding a component follows a gated order — primitive behavior approved,
then each token mapping approved state by state, only then CSS/React — see
[STRUCTURE.md](STRUCTURE.md#how-a-component-becomes-real). Proposing a new
token itself goes through the `design-tokens` skill
(`.claude/skills/design-tokens/`), not an ad hoc edit to the theme JSON.

**This context is monorepo-local, not distributed yet.** `npm install
@rata/react` carries prop names/types/JSDoc via the `.d.ts` output (real, if
partial, context — confirmed by checking `packages/react/dist/button.d.ts`).
`rata add <name>` carries none of it: it copies raw source only, no manifest,
no context file, and `rata props/tokens/pages` don't work once installed
outside this monorepo (their path resolution assumes they're still sitting
at `packages/cli/bin/`). See Open items below.

## Open items

- Product name + npm scope (placeholder: `@ds`)
- Docs site with eBay-Playbook-grade guidance pages (Types / Anatomy / Placement / Behavior / A11y / Tokens / API)
- Figma variables export + component library
- Visual regression (Playwright) and axe a11y gates in CI
- Hosted registry + license auth for the pro tier
- Brand palette — the accent seed (`#2563EB`) is still a placeholder; changing
  it is a one-line edit in `packages/tokens/src/themes/base.mjs` now, and the
  build re-verifies contrast for whatever replaces it
- Container components (`Card`, `Table`, `List`) — layout guidance in CLAUDE.md
  references these categories generically; none exist in the registry yet
- CSS cascade layers (`@layer`) — component CSS currently relies on the
  manual `ORDER` array in `packages/css/build.mjs` rather than a layer boundary
- Agent-lookup context doesn't travel past this monorepo — `rata add` copies
  raw source with no manifest/context, and `rata props/tokens/pages` don't
  work from an installed `@rata/cli` (path resolution assumes it's still
  inside `packages/cli/`). Two directions worth weighing later: teach
  `rata add` to drop a per-component context file alongside the source, or
  bundle the registry + a props snapshot into the published CLI so the
  live commands work post-install too
