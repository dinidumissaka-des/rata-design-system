# The theme engine

How a handful of seeds becomes every token in this system, and what was
adapted from [Astryx](https://github.com/facebook/astryx) on the way in.

`TOKENS.md` tells you which token to use. This file tells you where the values
came from, so that changing one is a decision about a *seed* rather than a
hunt through a list of hexes.

## The idea

A theme states seeds. The engine expands them.

```js
// packages/tokens/src/themes/base.mjs
color:      { accent: "#1F7A5B", neutralStyle: "cool", contrast: "standard" },
typography: { scale: { base: 14, ratio: 1.2 } },
radius:     { base: 4, multiplier: 1, steps: {...} },
motion:     { fast: 130, medium: 210, slow: 700, ratio: 0.75 },
```

That is the whole colour, type, radius and motion definition. 127 tokens come
out of it.

**Why this and not a list of values?** Because a list drifts from the rule it
was supposed to express, silently. This repo's own motion scale is the proof:
its steps were transcribed from Astryx's published output rather than derived,
and two of the nine were wrong — `fast-max` read 230ms where `175 ÷ 0.75`
rounds to 235ms, and `medium-max` read 550ms against a true 545ms. Nothing
caught it, because there was nothing to check the numbers *against*. A seed
plus a formula cannot disagree with itself.

The colour generator carries a stronger version of the same argument. HCT tone
is CIE L\*, which pins relative luminance independently of hue and chroma — so
a token placed at a given tone holds its contrast against a surface at another
tone **for any accent a brand seeds**. The tone assignments carry the
accessibility guarantee, not the specific hexes. `theme.test.mjs` asserts this
directly across five unrelated seeds, and `build-theme.mjs` re-measures every
promise in `usage.json` against each brand before it will emit a stylesheet.

## Layout

| Path | What it does |
|---|---|
| `src/theme/color.mjs` | Hex parsing, formatting, WCAG contrast |
| `src/theme/hct.mjs` | HCT colour space and tonal palettes |
| `src/theme/expandColorScale.mjs` | Accent seed → the semantic colour layer, plus the `color.accent.*` ramp |
| `src/theme/expandTypeScale.mjs` | `{base, ratio}` → `font.size.*` and `type.*` |
| `src/theme/expandRadiusScale.mjs` | `{base, multiplier, steps}` → `radius.*` |
| `src/theme/expandMotionScale.mjs` | `{fast, medium, slow, ratio}` → `motion.duration.*` |
| `src/theme/defineTheme.mjs` | Composition, `extends`, precedence |
| `src/theme/resolveTokens.mjs` | The shared resolve pipeline both builds use |
| `src/themes/base.mjs` | The default theme |
| `packages/themes/*` | Brand themes that extend it |

## Precedence

Lowest to highest. The order is the contract:

1. `extends` — the base theme's resolved tokens
2. `color` — `expandColorScale`
3. `typography.scale` — `expandTypeScale`
4. `radius` — `expandRadiusScale`
5. `motion` — `expandMotionScale`
6. `typography` fonts — `font.family.*`
7. `tokens` — explicit overrides, which always win

Scale configs **replace** a base's rather than merging. They are inputs to a
generator, not values; half-merging two ratios yields a scale neither author
asked for.

## What is generated, and what is not

Generated: `theme.bg.*`, `theme.fg.*`, `theme.border.*`, `theme.accent-role.*`,
`theme.secondary-role.*`, `theme.tertiary-role.fg`, `theme.focus-ring`,
`color.accent.*`, `font.size.*`, `type.*`, `radius.*`, `motion.duration.*`.

`color.accent.*` is the one *palette* ramp that is generated. The other ramps
(`color.neutral.*`, the status hues, `color.data.*`) are stated, because they
are reference material rather than brand expression. The accent ramp is not:
a ramp named `accent` that ignored the accent showed a blue scale under a red
brand, which is the drift this whole file argues against. It is built from the
seed's hue at a fixed tone / chroma / hue-drift curve — `ACCENT_RAMP_SHAPE` in
`expandColorScale.mjs`, read off the hand-tuned ramp it replaced, so the base
theme reproduces eight of its eleven steps exactly and the other three to
within one unit of a channel. Step 600 *is* the seed. Unlike the `theme.*`
roles it is one value per step rather than a `[light, dark]` pair: the palette
layer promises a step looks the same in both schemes, and that promise is why
components are told never to reach for one.

Stated outright, and deliberately so:

- **Status roles** (success / warning / danger). Green means success whatever
  the accent is, so deriving them from a brand colour would be actively wrong.
  Astryx draws the same line.
- **`color.data.*`** — the categorical chart palette. A legend is a different
  design problem from a button.
- **Rings and elevation** — effects, not palette positions.
- **`space.*`** — no generator, in Astryx either. A spacing scale is a rhythm
  decision, and 4px steps do not benefit from a ratio.

## Deviations from Astryx

Everything here was ported from Astryx (MIT). Four deliberate differences:

**1. Dotted token paths, not flat CSS variable names.** Astryx keys tokens as
`'--color-background-surface'`. This repo keys them as
`theme.bg.surface` and derives the CSS name from the path. The dotted path is
what `usage.json`, `TOKENS.md`, the `.d.ts` output and the `rata` CLI all
address tokens by; switching to flat names would have meant rewriting the
documentation and enforcement layer to gain nothing this system was missing.

**2. `--rata-` prefix and this system's own role names.** A design system's token
names are part of its identity. Adopting Astryx's architecture is worth doing;
adopting its namespace is not.

**3. References resolve to literals; no `var()` chains.** Astryx emits
`var(--font-size-base)` in its semantic layer, so a scoped override re-themes
a whole subtree at runtime. This repo resolves every reference at build time,
because `usage.json` *measures* the values it documents and a `var()` chain
has no measurable contrast ratio. The trade is deliberate: runtime
re-accenting lost, build-time verification gained. `theme.accent-role.subtle`
is the sharpest case — Astryx makes its equivalent a translucent overlay that
composes over any surface; this repo makes it an opaque tonal stop so the text
that sits on it has a number the build can enforce.

**4. Per-role label tokens.** Astryx has `--color-on-accent` alongside
`--color-on-success` / `-warning` / `-error`. This repo originally reused
`theme.fg.on-accent` for every filled role — which broke the moment the
generator made the accent *invert* in the dark scheme (light fill, dark label)
while the status fills stayed dark. Dark text on a dark red destructive
button. Each role owns its label now: `theme.danger-role.on`,
`theme.warning-role.on`, `theme.success-role.on`.

Two adaptations that are extensions rather than deviations: the radius step
table is a theme input (Astryx hard-codes 1/2/3/7/7), and `theme.fg.muted`
sits a step stronger than Astryx's `text-disabled` because this system
documents it for *placeholders*, which are not exempt from WCAG 1.4.3 the way
disabled text is.

## Adding a brand theme

```js
import { defineTheme } from "@rata/tokens/theme";
import { baseTheme } from "@rata/tokens/theme/base";

export const myTheme = defineTheme({
  name: "my-brand",
  extends: baseTheme,
  color: { accent: "#B7410E", neutralStyle: "warm", contrast: "high" },
});
```

Then `node packages/tokens/build-theme.mjs src/myTheme.mjs -o dist/theme.css`.
It emits only the tokens that differ from base, scoped to
`[data-rata-theme="my-brand"]`, and **fails** if the brand breaks any contrast
promise `usage.json` makes. `packages/themes/ember` and `packages/themes/slate`
are worked examples; `npm run themes:check` verifies both.

If a seed cannot carry the contract, the build says which pairings broke and
by how much. The fix is to re-seed, raise `contrast` to `'high'`, or state the
affected roles outright — not to loosen the promise.

## Attribution

`color.mjs`, `hct.mjs`, `expandColorScale.mjs`, `expandTypeScale.mjs`,
`expandRadiusScale.mjs`, `expandMotionScale.mjs` and `defineTheme.mjs` are
ported from [Astryx](https://github.com/facebook/astryx) (MIT, © Meta
Platforms). `hct.mjs` descends further from Google's
material-color-utilities (Apache-2.0). See `NOTICE`.
