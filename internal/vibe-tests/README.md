# vibe-tests

Measures whether [`packages/tokens/TOKENS.md`](../../packages/tokens/TOKENS.md) actually changes
what a coding agent writes.

The token build already proves the docs are *correct and current*. It cannot prove they are
*read and followed*. This does that: the same prompts are answered with and without the docs
in context, and both arms are scored by a checker that knows the token rules.

## Layout

| File | What it is |
|---|---|
| `prompts.json` | 12 prompts, each targeting a decision models get wrong without the docs |
| `rules.mjs` | The checker — derives every rule from `packages/tokens/dist` |
| `run.mjs` | Scaffold a run, score it, or lint an arbitrary file |
| `fixtures/` | A committed A/B pair that doubles as the checker's self-test |

## Running an A/B

```sh
npm run vibe:tasks                       # writes task files + an empty candidates/ dir
```

Point the agent under evaluation at the task files, once **without** `TOKENS.md` in context
and once **with** it, saving each answer to `candidates/<id>.css`. Then:

```sh
node internal/vibe-tests/run.mjs score --dir internal/vibe-tests/runs/<id>
```

Generation is deliberately not automated. Any harness that generates the code would bake in one
agent, one prompt format, and one model; the part worth keeping is the scoring.

## Scoring

Each candidate is checked for:

| Rule | Severity | Caught because |
|---|---|---|
| `palette-token` | error | Palette tokens are identical in both themes |
| `unknown-token` | error | The token does not exist — usually a plausible-looking invention |
| `hardcoded-color` | error | Every color has a token |
| `hardcoded-dimension` | error | A skipped step on the space / size / radius / type scale |
| `hardcoded-font-weight` | error | `500` instead of `type.control.weight` (or another `type.*.weight`) |
| `hardcoded-motion` | error | `0.2s ease-in-out` instead of the motion tokens |
| `forbidden-pairing` | error / warn | A combination `TOKENS.md` records as a contrast gap |
| `missing-required-token` | error | The prompt's documented answer was not used |
| `focus-removed` | error | `outline: none` with no replacement |
| `missing-focus-ring` | error | A focusable control that never draws one |
| `hand-rolled-hover` | warn | A background swap where `.rata-state-layer` belongs |
| `native-disabled-styling` | warn | `:disabled`, which drops the control from the tab order |
| `state-scoped-layout` | warn | Layout on `[open]` / `:popover-open`, which snaps while `display` is held |

`state-scoped-layout` comes from a bug that shipped in this repo's Dialog. A top-layer
overlay transitions `display` with `allow-discrete`, so on close `display` is *held* at its
open value for the length of the exit — while every other declaration on the same state
selector reverts the instant the attribute goes. A property that cannot animate therefore
snaps: `flex-direction: column` beside `display: flex` on `[open]` laid the dialog's header,
body and footer out in a row for the whole closing animation. The invariant is that a state
selector carries `display` and nothing else layout depends on.

`forbidden-pairing` is an error when the combination fails in every theme (white on
`theme.warning-role.bg`), and a warning when it is verified in one theme and a known gap in
another. The primary and destructive buttons (`theme.accent-role.bg` / `theme.danger-role.bg`
with `theme.fg.on-accent`) are the sanctioned pattern in both themes — see
[TOKENS.md](../../packages/tokens/TOKENS.md#verified-contrast) for what's actually verified.

**No rule is written twice.** The palette list, the valid token names, and the forbidden
pairings are all read from `packages/tokens/dist/usage.json`, which the token build generates.
Document a new contrast gap and this checker enforces it on the next build.

## The fixtures are the checker's own test

`fixtures/no-docs/` holds the answers a model gives without the docs; `fixtures/with-docs/`
holds the documented answers. `npm run vibe` scores both and **fails** unless the documented
arm is clean and the naive arm is not — so a checker that stops discriminating is caught in CI.

```
Without the token docs      0/6 clean
Following the token docs    6/6 clean ·  0 errors
```

## Linting real files

```sh
node internal/vibe-tests/run.mjs check packages/css/src/button.css
```

For a deliberate exception, state it in the file so the reason travels with the code:

```css
/* rata-allow: hardcoded-motion — the spin cycle has no motion token */
```
