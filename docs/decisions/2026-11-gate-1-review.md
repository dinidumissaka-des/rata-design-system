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
