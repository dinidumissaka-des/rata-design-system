# Gate-1 review — decisions (2026-11-02)

The answers to every open question raised by the gate-0/1 specs for the
new components, the native platform plan (`docs/platforms.md`) and the
blocks (`docs/blocks/README.md`). Each spec cites the decision it records.
Approving these questions is not approving the token values or the
state-by-state token mappings — those are gate 2, still to come.

## Native (`docs/platforms.md`)

| # | Question | Decision |
|---|---|---|
| N1 | Expo or bare React Native | **Both supported; develop on Expo.** No Expo-only APIs in `@rata/native` itself. |
| N2 | react-native-web | **Playground only.** Websites keep `@rata/react`. |
| N3 | Navigation library | **No coupling.** Components take a value and `onChange`; router adapters are doc recipes. |
| N4 | Minimum versions | **New Architecture only, iOS 15+, Android API 24+.** |
| N5 | OS controls vs Rata-drawn | **Decided per component**, recorded in each contract's "Web and native" decision. |
| N6 | Tier | **Native is `pro`.** Web components stay `free`. |

## Components

| # | Component | Decision |
|---|---|---|
| C1 | card | Variants **outlined (default) + raised** (`theme.elevation.raised`). |
| C2 | card | Whole-card click = **stretched heading link**. No `href`/`onClick` on Card. |
| C3 | tooltip | **Inverse surface.** Needs a new inverse surface/foreground token pair (gate via design-tokens). |
| C4 | link | **No visited colour.** |
| C5 | toast | **`ToastRegion` + `useToast()` approved.** |
| C6 | combobox | **Reuses Popover's positioning/dismissal.** Popover ships first. |
| C7 | combobox / select | Alias **`combo` moves from Select to Combobox.** |
| C8 | slider / progress | **Split by role:** Slider track `theme.border.strong` (3:1, interactive); Progress track `theme.bg.muted` (status). Both share a new track-thickness token. |
| C9 | slider / state-layer | **Extend `.rata-state-layer`** to respond to `[data-hovered]`/`[data-pressed]`, so drawn thumbs get identical feedback. A state-layer change in its own gated step. |
| C10 | date-range-picker | **Its own spec** (added). |
| C11 | file-upload | Rows **accept per-file progress and error** from the caller; uploading stays the app's job. |
| C12 | `tab-bar` alias | **Stays ambiguous** between bottom-nav and tabs. |

## Blocks (`docs/blocks/README.md`)

| # | Question | Decision |
|---|---|---|
| B1 | How blocks ship | **Both:** a published `@rata/blocks` package, and the CLI can eject a copy for customising. |
| B2 | Breakpoints | **Narrow / medium / wide** as tokens. |
| B3 | Native marketing blocks | **Website only.** App blocks (sign-in, sign-up, settings, onboarding, profile, empty-state, dashboard-stats) get native versions. |

## Tokens — sent to the design-tokens interview

All proposed gaps go to the interview (Purpose / Use when / Don't use for / Pairs with), none written ad hoc:

- Touch + elevation: `size.target.min`, `theme.elevation.floating`
- Component sizing: track thickness, `size.measure.*`, `motion.delay.hint`, the tooltip inverse surface pair
- Layout: container max-width, narrow/medium/wide breakpoints, a band spacing step above `space.section`, grid gutters, pane widths, a z-index scale
- Contrast: verify `theme.accent-role.bg` on `theme.bg.muted` (AA non-text) for the Progress fill

## Next

Tokens first, then gate-2 token mappings for Link, Card and Popover — the
three components that unblock the most blocks — each paused for approval.

## Token interview — results

| # | Token | Layer | Value | Decision | Rejected alternative |
|---|---|---|---|---|---|
| T1 | `size.target.min` | primitive (`size.json`) | `48px`, every platform | Minimum hit area for any touch-operable control; never the drawn size. | 44px web/iOS + 48dp Android — one value so touch behaviour can't differ by platform. |
| T2 | `theme.elevation.floating` | semantic | `elevation.med` / `elevation.med-strong` | Persistent controls over scrolling content (FAB, bottom-nav, sticky action bar). | Reusing `overlay` — would tie the FAB's shadow to menus. |
| T3 | `size.track` | primitive | `4px` | Thickness of slider and progress bars. | A 6px "thick" step — nothing needs it. |
| T4 | `size.measure.tight / compact / prose` | primitive | `32ch / 45ch / 65ch` | Max line length: tooltip; toast, popover, empty-state; running prose. In `ch`, so it follows the font. | Container widths — those are layout (group 3). |
| T5 | `motion.delay.hint` | semantic | → `motion.duration.medium-max` (280ms) | Pointer rest before a tooltip opens; focus opens immediately. | `slow-min` (525ms) — the user chose the snappier step. |
| T6 | `theme.bg.inverse` / `theme.fg.on-inverse` | semantic, generated | neutral 20/99 light, 90/10 dark | Tooltip-only inverse surface; verified 12.88:1 / 13.3:1. | Tone 30/80, and an accent-tinted inverse. |
| T7 | pairing `theme.accent-role.bg` on `theme.bg.muted` | contrast | AA-nontext | Progress fill on its track; measured 4.89:1 / 7.75:1, holds across every brand theme. | — |
| T8 | `breakpoint.medium / wide` | primitive | `40rem / 60rem` | Narrow is the default below medium; wide keeps the playground's existing 60rem. CSS writes `@media (--rata-medium)` and `packages/css/build.mjs` expands it; `@rata/css/custom-media.css` ships the `@custom-media` rules. | 48/80rem and 40/64rem — both moved today's breakpoint. |
| T9 | `size.container.max` | primitive | `75rem` | Widest page content column (`breakpoint.wide` × 1.25). | 64rem and 80rem. |
| T10 | `size.pane.sm / md / lg` | primitive | `15 / 20 / 25rem` | Rail, list pane, inspector. SideNav and Panel migrate in their own change. | — |
| T11 | `space.16`, `space.24` + `space.band.sm / lg`, `space.grid.gap` | primitive + semantic | `64px`, `96px`; band → 16 / 24; grid gap → `space.6` | Page-band rhythm and block-grid gaps; the 4px scale extended by its own rule, stopping at 24. | A single band step; a separate narrow grid gap. |
| T12 | `layer.sticky / floating / overlay / toast` | primitive | `100 / 200 / 300 / 400` | Page-level z-index. Dialog and Sheet use the top layer and take none. | A `layer.modal` step; no scale at all. |

Follow-ups, each its own change: point the playground's `use-media-query.ts` at `breakpoint.wide`; migrate SideNav and Panel widths to `size.pane.*`; replace the blocks' `size.control.lg` multiples with the layout tokens.

## Gate 2 — token mappings

### Link (approved state by state)

| # | State | Mapping |
|---|---|---|
| L1 | inline · rest | `theme.accent-role.fg`, underline `border.1` at `space.0-5`, font inherited. Adds five verified pairings: `accent-role.fg` on `bg.subtle`, `bg.muted`, and the success/warning/danger `subtle` backgrounds (≥ 4.89:1). |
| L2 | inline · hover/press | No change; cursor only. |
| L3 | inline · focus | `focus.ring-width` `theme.focus-ring`, `focus.ring-offset`, `radius.inner`, `box-decoration-break: clone`. |
| L4 | new-tab glyph | `size.icon.text`, `space.gap.xs`, glyph `aria-hidden`, visually hidden "(opens in new tab)". |
| L5 | standalone · rest | `theme.accent-role.fg`, no underline, `type.control.weight`, `space.1` inline padding, `radius.inner`. |
| L6 | standalone · hover/press | Compose `.rata-state-layer`. |
| L7 | standalone · focus | Same ring as L3. |

### Card (approved state by state)

| # | State | Mapping |
|---|---|---|
| C1 | outlined · rest | `theme.bg.surface`, `theme.fg.primary`, `border.default` `theme.border.default`, `radius.container`, `space.padding.md`, `space.stack.sm` between children, no margin. |
| C2 | raised | C1 + `theme.elevation.raised`; border kept. |
| C3 | media | Full bleed: negative `space.padding.md`, clipped by the card's `radius.container`, `space.stack.sm` below. |
| C4 | linked · hover/press | Heading link's `::after` stretches over the card; card composes `.rata-state-layer` via `:has()`. |
| C5 | linked · focus | Ring around the card while the link is `:focus-visible`; link outline suppressed only there. |
| C6 | secondary actions | `position: relative`, after the heading in source order; no z-index. |

C7 (gate 3): a linked card's heading uses the inline Link variant; the standalone variant's state layer collides with C4's stretched `::after`.

### Popover (approved state by state)

| # | State | Mapping |
|---|---|---|
| P1 | surface | `theme.bg.surface`, `theme.fg.primary`, `border.default` `theme.border.default`, `theme.elevation.overlay`, `radius.container`, `space.padding.sm`, `type.body` — Menu's surface. |
| P2 | title | `type.body.size`, `type.label.weight`, `theme.fg.primary`, `space.stack.xs` below. |
| P3 | size / position | Text ≤ `size.measure.compact`, ≤ viewport − `space.padding.lg`; `space.gap.xs` from the trigger with flip fallbacks; top layer, no z-index. |
| P4 | enter | `motion.overlay.duration` + `motion.easing.enter`, fade and `space.1` rise, reduced-motion off. |
| P5 | exit | Instant, like Menu. The spec's exit transition is dropped. |
| P6 | focus | No ring on the popover; first control (or `initialFocus`) takes focus and draws its own ring; trigger keeps its ring and `aria-expanded`. |

### Remaining 21 components — gate 2 approved as a batch (2026-11-07)

The owner approved, in one decision, every remaining spec's existing `tokens`
recipe as its gate-2 mapping: bottom-nav, chip, combobox, date-picker,
date-range-picker, divider, empty-state, fab, file-upload, list, list-item,
number-field, pagination, pin-input, progress, skeleton, slider, steps, table,
toast, tooltip. This replaces the state-by-state interview used for Link, Card
and Popover. A recipe that cannot be built as written is not improvised at
gate 3: the implementer stops and reports it, as Card's C4/L6 collision was.
Slider's thumb composes the state layer through `[data-hovered]` /
`[data-pressed]` (decision C9), which extends `state-layer.css` in the same
change.

Steps (gate 3): collapses by measuring overflow (ResizeObserver), not a container query — the needed width depends on step count and label lengths, so no token threshold fits.

Pagination (gate 3): buttons get size.target.min hit areas — owner amendment.
