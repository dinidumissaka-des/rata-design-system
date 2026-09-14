# Repo map

```
packages/
  tokens/       @rata/tokens — the token engine and the default theme.
    src/theme/      the generator: hct + colour maths, the four expanders,
                    defineTheme (composition/extends), resolveTokens (the shared
                    resolve pipeline). Ported from Astryx — see THEME-ENGINE.md.
    src/themes/     base.mjs — the default theme: four seeds plus the roles a
                    seed cannot know (status, rings, elevation, control text)
    src/primitives/ *.json, one file per scale, for what is NOT generated
                    (colour ramps, space, size, opacity, border, elevation, ring,
                    font family/weight/tracking)
    src/semantics/  *.json — theme-invariant roles a generator cannot produce
                    (spacing roles, border default, focus, state, motion roles)
    src/contracts/  the hand-written doc source, one file per token family
                    (theme.bg.json, focus.json, …) plus system.json for the
                    rules and contrast pairings that belong to no single
                    token; TOKENS.md is generated from these
    → dist/css/tokens.css, dist/index.{js,d.ts}, dist/tailwind/preset.cjs,
      dist/usage.json, TOKENS.md
  themes/       @rata/theme-* — brand themes: a few seeds + `extends: baseTheme`,
                built by tokens/build-theme.mjs into scoped override CSS that
                only emits if the brand holds every contrast promise
  css/          @rata/css — framework-free component CSS, built from packages/css/src/*.css
                → dist/index.css (concatenated) + dist/components/*.css (per-file)
  primitives/   @rata/primitives — headless behavior, pure functions, no DOM/React
  react/        @rata/react — styled components: primitives behavior + css appearance
                (source of truth the CLI copies from)
  cli/          @rata/cli — the `rata` binary
    bin/rata.mjs    entry point: list/add (distribution) + props/contract/tokens/pages
                  (agent lookup)
    lib/index.mjs shared logic behind both — reads registry + @rata/react src + tokens dist
    lib/contract.mjs  merges each component's WRITTEN contract (its manifest) with its
                  DERIVED props (parsed from @rata/react source) and fails on any
                  disagreement between them

registry/
  schema.json           the manifest shape (status states, files, tier, contract blocks)
  components/*.json     one manifest per component — name, family, status matrix,
                         dependencies, which files `rata add` copies where, its token
                         recipe, and its written contract (behavior/props/usage)

docs/
  components/*.md       GENERATED — one contract page per component, plus an index.
                         Regenerate with `npm run docs:components`; `npm run
                         docs:check` fails if stale

apps/
  playground/           the one page in this repo today (Vite + React)
    src/app.tsx          component gallery + status matrix, driven by registry/*.json

scripts/
  generate-ui-context.mjs   writes .claude/ui-context.md from packages/cli/lib
  generate-component-docs.mjs  writes docs/components/*.md from the manifests +
                         @rata/react source; --check fails instead of writing

.claude/
  ui-context.md         GENERATED — regenerate with `npm run ui:sync`
  launch.json           playground launch config
  skills/design-tokens/ authored: two-layer (primitive/semantic) token workflow —
                         Gate 1/2/3 interview, scale + role catalogs, a validator

CLAUDE.md               authored: pre-write ritual, anti-patterns, knowledge check
agent-workflow.md        the general workflow this repo's CLAUDE.md is a specific
                         instance of
```

## How a component becomes real

Order matters and each stage is a checkpoint — don't start the next one
until the current one is approved. This is a process rule, not something
the tooling enforces: nothing blocks you from skipping ahead, but skipping
ahead is exactly how a component ends up styled around behavior nobody
signed off on, or wired to tokens that get renamed once someone actually
looks at them.

0. `registry/components/<name>.json` — the manifest, even before any code
   exists (status: `future`). This is what `rata list` and the playground's
   status table read. No approval needed — it's a declaration of intent,
   not a decision.

1. **Primitives.** `packages/primitives/src/<name>.ts` — behavior only:
   states, keyboard/ARIA handling, the props API shape. Pure function, no
   DOM, no styling, no token references. This is the contract everything
   else builds on.

   Write the manifest's `behavior` and `props` blocks in the same step — the
   contract in *spec* mode (see "Component contracts" below). It records the
   props API and the decisions behind it while they are still being argued
   about, which is exactly when they are cheap to change, and it is the thing
   you are asking approval *for*. `npm run docs:components` renders it to
   `docs/components/<name>.md` so the approval has something to point at.
   → **Stop. Get this approved** — the behavior and the props API — before
   writing a line of CSS or React. Changing the primitive after the
   component is styled is expensive; changing it before is free.

2. **Semantics.** Decide which semantic tokens each state of the component
   maps to — theme roles (`theme.*-role.*` and `theme.elevation.*` in
   `semantics/theme/*.json`) *and* theme-invariant roles (`space.*`/`radius.*`/
   `type.*`/`motion.*` in `semantics/*.json`, per
   [TOKENS.md](packages/tokens/TOKENS.md)). Go
   state by state, not as one batch — each mapping is its own decision
   (e.g. "disabled → `--rata-state-disabled-opacity`", "primary background →
   `--rata-theme-accent-role-bg`", "control padding → `--rata-space-control-padding-inline-md`"),
   and each gets approved on its own before moving to the next. Prefer an
   existing token — check `npm run ui -- tokens` first; only add a new one
   if nothing already fits, and that addition is its own approval too — run
   the **design-tokens** skill (`.claude/skills/design-tokens/`) for that:
   it's the Gate 1/2/3 interview for proposing a new semantic token with
   its four description fields (Purpose / Use when / Don't use for / Pairs
   with), documented in `packages/tokens/TOKENS.md`, rather than dropping a
   new key into a JSON file ad hoc.
   → **Stop. Every mapping approved** before any CSS is written — CSS is
   just these decisions rendered as rules, so writing it first means
   guessing at approvals that haven't happened yet.

3. **Component.** Only now: `packages/css/src/<name>.css`, using only the
   token mappings approved in step 2 — add it to `ORDER` in
   `packages/css/build.mjs` if load order matters relative to another
   component — and `packages/react/src/<name>.tsx`, wiring the approved
   primitive's behavior to the approved CSS's `rata-<name>` classes. Its
   exported `<Name>Props` interface and the function's default-parameter
   values are exactly what `npm run ui -- props <name>` reads — no separate
   doc to keep in sync.

4. Flip the manifest's `status.css`/`status.react` to `latest`, add `files`
   entries so `rata add <name>` can copy it, run `npm run build` (regenerates
   `docs/components/` and `.claude/ui-context.md` as its last steps).

   Flipping the status is what switches the contract from *spec* to
   *documented*, and the build now cross-checks the React you just wrote
   against the props API approved back at step 1: a prop you added along the
   way and never documented fails, and so does a documented prop you quietly
   renamed. Delete the hand-written `type`/`default`/`required` fields from
   the manifest in the same change — from here they are parsed from source,
   and the build rejects a second copy. This is the one place the build order
   above stops being purely a process rule.

## Component contracts

`registry/components/<name>.json` carries three blocks beyond distribution
metadata — `behavior`, `props` and `usage` — that `scripts/generate-component-docs.mjs`
renders into one page per component under `docs/components/`.

This is the same machine as the token contracts one layer up: hand-written
JSON in, generated Markdown out, and a build that fails rather than emit a
page it cannot verify. The split that makes it work is by **provenance**, not
by topic:

- **Derived** — prop name, type, optionality, default, `extends` — is parsed
  from `packages/react/src/<name>.tsx` and never written by hand, so it cannot
  drift from the component it describes.
- **Written** — what a prop is for, when not to reach for it, what it
  conflicts with, the obligation it puts on the caller, worked use cases — is
  judgment no parser can recover, so it lives in the manifest beside the
  component's status, files, tier and token recipe. One file answers
  everything about that component, which is the same reason the token recipes
  moved here rather than staying in a central catalogue.

The cross-check is the load-bearing part. A contract entry naming a prop that
does not exist fails the build; a declared prop with no contract entry fails
the build; and once a component is implemented, writing `type`, `default` or
`required` by hand fails the build too, because those are derived and a
hand-written copy is precisely the drift the whole arrangement exists to
prevent. Prose that nothing verifies is prose that rots, and a rotted contract
is worse than none — it is the file agents are told to trust.

Three modes, decided by `status.react`:

| Mode | When | What the page means |
|---|---|---|
| `spec` | `future` | The approved intent — the props API signed off at gate 1, with no code behind it. `type`/`default`/`required` are written by hand because there is nothing to parse. |
| `documented` | `latest` | Both halves exist and both directions of the cross-check are enforced. |
| `css-only` | `na` | No props API by design (`state-layer`). A `props` block here is itself an error; use `usage`. |

Because a contract can be written before its component, gate 1's approval
becomes something gate 4 verifies rather than something everyone remembers.
Worked `usage[].example` snippets are additionally linted through
`internal/vibe-tests/rules.mjs`, restricted to presence-based rules — a
fragment cannot be judged for what it lacks, only for what it contains.

## What doesn't exist yet

Per `registry/components/`: `dialog`, `menu`, `notice` and `text-field` have
manifests but no files. `text-field` additionally has an approved primitive
(`packages/primitives/src/text-field.ts`) and a spec-mode contract; the other
three have a token recipe and nothing else. There is no `card`, `table`, or `list` component — CLAUDE.md's layout
guidance references these categories generically; until they're built here,
compose plain `<section>`s rather than inventing one.

## The design-tokens skill and this repo's actual token pipeline

`.claude/skills/design-tokens/` is written stack-agnostic, and its examples
assume a project starting from nothing: `tokens/primitives.css` +
`tokens/semantic.css` (linked at runtime via `var()`) + `tokens/TOKENS.md`.
This repo doesn't look like that, and the gap is worth knowing before
reaching for the skill's `scripts/validate-tokens.mjs` directly:

- **Most of the two layers are generated, not written.** The skill's model is
  "write primitives, then write semantics on top". Here, colour, typography,
  radius and duration are produced from four seeds in
  `src/themes/base.mjs` (see [THEME-ENGINE.md](packages/tokens/THEME-ENGINE.md)),
  so there is nothing to hand-write for those scales at either layer — the
  skill's Gate 1/2/3 interview still applies, but its output is usually a
  changed *seed* or a new entry in the theme's `tokens` map, not a new JSON
  key. What remains genuinely hand-written is `src/primitives/*.json` (the
  scales no generator owns) and `src/semantics/*.json` (theme-invariant
  roles), both referencing others via `"{color.accent.600}"`-style strings
  that resolve across files the same as within one.
- **The built CSS has no `var()` chain.** `build.mjs` resolves every
  reference to a literal before writing `dist/css/tokens.css`, so both
  primitive and semantic custom properties land as raw values (e.g.
  `--rata-theme-accent-role-bg: #2563EB`) — retheming happens by rebuilding
  from the seeds, not by cascade override. This is a deliberate divergence
  from Astryx, which keeps `var()` chains so a scoped override re-themes a
  subtree at runtime: a `var()` chain has no measurable contrast ratio, and
  this repo would rather verify than re-theme live. The skill's validator checks for
  literal values it would call a bug; run it against this repo's *source*
  JSON structure conceptually, not against `dist/css/tokens.css` literally.
- **`packages/tokens/TOKENS.md`** is this repo's equivalent of the skill's
  `tokens/TOKENS.md` — every primitive scale's generation rule/range/not-for,
  and all four description fields for every semantic token, kept there
  rather than at the skill's assumed path. Unlike the skill's version, it's
  build-enforced, not just hand-maintained prose: it's generated from
  the contracts under `packages/tokens/src/contracts/` (per-token
  descriptions, plus system.json's rules, contrast pairings and known gaps)
  together with each component's recipe in `registry/components/*.json`,
  and the build fails if a token
  is undocumented, if `usage.json` names a token that doesn't exist, or if a
  documented contrast pairing stops holding when a palette value changes —
  see the provenance entry below on how that layer was merged in.

## Primitive provenance

`packages/tokens/src/primitives/{space,radius,size,motion,font,border,focus}.json`'s
scales, plus a new `color.json`'s `data.*` namespace (data-visualization
palette — categorical swatches + 5-step
blue/shamrock/orange/pink/purple/red/teal/yellow/gray ramps), were sourced
from [Astryx](https://astryx.atmeta.com/docs/tokens). The existing
`color.json`'s `neutral/accent/success/warning/danger` ramps and everything in
`semantics/color/{light,dark}.json` were deliberately left untouched — Astryx's
color tokens are mostly semantic-shaped (light/dark role pairs), which
belongs in the semantic layer with its own approval gate, not dropped into
the primitive layer. Notable adaptations made while porting the values over (not
straight copies): font sizes are now `rem`-based (was `px`) since that's
what Astryx publishes; token names were kept where the value matched an
existing key even if Astryx named it differently (e.g. their `--size-*`
tier values landed under our existing `size.control.sm/md/lg` keys, not a
new name); Astryx's role-named radius tokens (`inner`/`element`/`chat`/…)
were re-keyed onto our measure-named scale (`sm`/`md`/`lg`/`xl`/`2xl`) to
keep radius primitives named by measure, not role, per the design-tokens
skill's naming rule; data-viz primitives only carry their light-mode value
(Astryx's dark-mode alternates for `data-gray` would violate "primitives
reference nothing / are theme-invariant" if copied in as-is).

`semantics/theme/{light,dark}.json` *was* touched in a later pass, once semantics
for the non-color scales were built out too: `accent-role`/`danger-role`'s
`bg-hover`/`bg-active` were removed (dead — modeled a color-swap hover
mechanism this system doesn't use), and `secondary-role`/`tertiary-role`
were added so `.rata-button--secondary`/`--tertiary` have their own semantic
sets instead of reaching into generic `bg`/`border`/`fg` tokens.

**Primitives are now exactly seven scales** — `color`, `space`, `radius`,
`size`, `motion`, `font`, `elevation` — plus a small `opacity` scale added
to support the change below. `state.json` and `focus.json` moved out of
`primitives/` entirely and into `semantics/`: each held a single
already-made decision (how this system signals interaction feedback / focus
visibility), not a scale of raw options — the primitive/semantic test is
"scale vs. decision," not just "shared across every consumer" (which was
the reasoning that had kept them primitive up to that point).
`primitives/border.json` was expanded from one Astryx value (`1px`) into a
3-step stroke-width scale (`1`/`2`/`3`px) specifically so `border.default`
(semantic) and `focus.ring-width`/`ring-offset` (now semantic) have
something to point at without losing Astryx's exact 3px offset value.

**`src/themes/{light,dark}.json` moved to `src/semantics/color/{light,dark}.json`**
in a later pass still — color is a semantic group like any other
(`spacing.json`, `border.json`, …), just the one that needs two files
instead of one because it's the one thing that varies by theme; keeping it
in a separate top-level `themes/` directory implied it was structurally
different from the rest of Semantics, which it isn't. Confirmed
byte-identical `dist/css/tokens.css` output before/after — pure
reorganization, `build.mjs` just reads two paths instead of one.

**`src/semantics/color/{light,dark}.json` was later renamed again, to
`src/semantics/theme/{light,dark}.json`**, once a second semantic group
(`elevation`) needed to branch by light/dark too. The rationale above for
dropping the separate `themes/` directory — "color doesn't need special
treatment, it's a semantic group like any other" — stops holding once
there are *two* semantic groups that vary by theme instead of one: at that
point "theme" is the real shared property they have in common, and naming
the branching file/folder/CSS-var-prefix after just one of its two
occupants (`color`) is the thing that's now structurally misleading, not
the thing that fixes it. `color`'s existing roles (`bg`/`fg`/`border`/
`*-role`/`focus-ring`) moved into the file unchanged, nested one level
deeper under a new shared `"theme"` JSON key instead of `"color"`; a new
`elevation` block (`raised`/`overlay`/`modal`, pointing at the
`elevation.sm`/`md`/`lg` primitive steps — extended with `sm-strong`/
`md-strong`/`lg-strong` for dark, since a light-mode shadow opacity barely
reads against a dark canvas) sits alongside it. Emitted CSS custom
properties moved with it: `--rata-color-bg-canvas` → `--rata-theme-bg-canvas`,
etc.; primitive color (`--rata-color-accent-600`, `--rata-color-neutral-*`, …)
is untouched — only the semantic layer's prefix changed, not the raw
palette. `packages/css/src/button.css` and `apps/playground/src/{app.tsx,
playground.css}` (the only two consumers at the time) were updated to
match; the elevation primitive itself had existed since the earlier
primitive-provenance pass but was unused until this one gave it a semantic
consumer.

**The elevation primitive's guessed dark (`-strong`) values were replaced
with real ones in the very next pass**, once Astryx's actual shadow tokens
were fetched — the original primitive-provenance note above says Astryx's
shadow tokens "weren't extracted with enough fidelity to adopt safely,"
which was true of the doc page's rendered markdown (swatch previews only,
no printed values) but not of its raw HTML: the page renders each swatch
with an inline `style="box-shadow:…"` attribute, which a direct `curl` +
grep pulled out cleanly. Real data turned out richer than the scaffold in
two ways. First, `--shadow-low`/`-med`/`-high` are genuine light/dark pairs
(via CSS `light-dark()`), so `elevation.sm`/`md`/`lg` were renamed to
`elevation.low`/`med`/`high` to match Astryx's own names, and their
`-strong` (dark) counterparts got Astryx's real opacity values instead of
an invented multiplier — asymmetrically, for `high`: its second shadow
alone jumps to 0.3 in dark vs. 0.1 in light, kept exactly as sourced.
Second, Astryx also publishes `--shadow-inset-hover`/`-selected`/`-success`/
`-warning`/`-error` — a related but distinct concept (2px inset rings for
input/selection state, not surface elevation) — which became a new `ring`
primitive (`neutral`/`neutral-strong`/`accent`/`success`/`warning`/`danger`,
re-keyed off Astryx's role-flavored names the same way `radius` and
letter-spacing were re-keyed earlier) wired into the *existing*
`accent-role`/`success-role`/`warning-role`/`danger-role` semantic groups as
a new `ring` field each, rather than a parallel `ring-role.*` family. The
one deliberate omission: `ring.neutral`/`neutral-strong` (their hover ring)
was fetched and kept as real primitive data but **not** wired to any
semantic token — this system already has a standing, explicit decision that
hover feedback is opacity-only (see the removed `bg-hover`/`bg-active`
tokens, above), and a ring-based hover cue would reintroduce exactly the
second feedback channel that decision removed. `packages/tokens/TOKENS.md`
documents the full fetch method and every new token's four description
fields; nothing outside `@rata/tokens` needed touching beyond the same two
consumers as before, since the semantic *names* (`theme.elevation.raised`/
`overlay`/`modal`) didn't change — only what they resolve to.

**`primitives/font.json` was later fully replaced again**, this time
sourced from [eBay Playbook](https://playbook.ebay.com/foundations/typography)'s
real compiled tokens (found via its `evo-web`/Skin open-source repo, not
the marketing page — the page itself doesn't publish numeric values) —
superseding the earlier Astryx-derived font scale entirely, not merging
with it. `semantics/typography.json` was rebuilt alongside it to mirror
eBay's own named composites (`title`/`body`/`signal`) where this repo has a
real matching use. This was the one primitive/semantics update with real
fallout in unretouched component CSS: `packages/css/src/button.css` kept
referencing `--rata-font-weight-medium`, `--rata-font-line-height-tight`, and
`--rata-font-size-base/lg` — names that stopped existing under the rebuilt
scale — until the `usage.json` merge below added a checker that caught it;
`button.css` now goes through `type.control.*` like everything else.

**A parallel documentation-and-enforcement layer was merged in from a
separate line of work on this same token pipeline.** That work started from
the pre-split, single-file `base.json` + `themes/{light,dark}.json` layout
(the state this repo's tokens were in *before* the primitives/semantics
split above) and added a hand-written documentation source that `TOKENS.md`
is generated from — one entry per token with Use for / Do not use for / Use
instead / Pairs with, plus system rules, contrast pairings and known gaps
verified against the *resolved* values every build, and component recipes.
It also added `npm run docs:check` (CI fails if `TOKENS.md` is stale) and
`internal/vibe-tests/` (scores generated component code against rules
derived from the token build, self-tested via a committed A/B fixture pair
so the checker itself cannot silently stop discriminating).

**That documentation source was later split into one contract per thing.**
It had grown to 1134 hand-edited lines in a single `src/usage.json` — the
one file in the repo that did not follow the one-file-per-thing pattern the
primitives, the semantic roles and the component manifests all already used,
and a standing merge-conflict hazard (a large auto-merged file had already
been corrupted once, see the `.claude/ui-context.md` incident). It is now:

- `src/contracts/<family>.json` — one contract per token family, with the
  `theme.*` roles split further by role group (`theme.bg`, `theme.fg`,
  `theme.accent-role`, `theme.status-roles`, `theme.support-roles`,
  `theme.border`, `theme.elevation`);
- `src/contracts/system.json` — the system rules, contrast pairings and
  known gaps. These stay central deliberately: a pairing names a foreground
  *and* a background, so it belongs to a relationship rather than to either
  token, and a rule names no token at all;
- `registry/components/<name>.json` — each component's token recipe now sits
  in its own manifest, beside its status, files and tier, so one file answers
  everything about that component. This gave `menu` and `notice` their first
  manifests, since both had recipes but no registry entry.

`src/theme/readContracts.mjs` assembles the same model the single file used
to produce — `TOKENS.md` came out byte-identical apart from section order,
which now follows the contracts and reads more coherently for it. The split
also bought a new check: a token documented in two contracts fails the build,
which a single catalogue could not express.

`packages/themes/*` are brand themes: a few seeds plus `extends: baseTheme`,
built by `build-theme.mjs` into scoped CSS containing only what differs from
base — and refusing to emit at all if the brand breaks a contrast promise
`usage.json` makes. That is the multi-brand theming the README lists as the
paid tier, with the safety property that makes it sellable.
[THEME-ENGINE.md](packages/tokens/THEME-ENGINE.md) documents the precedence
rules, what is generated versus stated, and every deviation from Astryx.

Full reasoning for every primitive and semantic token is in
[TOKENS.md](packages/tokens/TOKENS.md).
