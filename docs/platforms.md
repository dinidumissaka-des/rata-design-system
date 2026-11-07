# Platforms — gate 0 proposal, gate-1 decisions recorded

> **Status: proposal; §6 decisions settled except font scaling (§6.5).** Nothing in this file has been
> built, and nothing in the tooling reads it. It is the decision record for
> whether — and how — Rata grows from a web system into one that also ships
> React Native. The gate-1 review
> ([`decisions/2026-11-gate-1-review.md`](decisions/2026-11-gate-1-review.md))
> answered the open questions as decisions **N1–N6**; §6 records each one and
> what is still open. Decision ids (N1–N6) are not the roadmap gates (N0–N5)
> in §5. Settling the decisions does not approve token values, token mappings
> or any component's native API — those keep their own gates.

Rata is a web system today. `README.md` says so in its first line ("for web
apps and websites"), and every layer below the tokens assumes a browser:
`@rata/css` is CSS, `@rata/react` renders DOM elements, and the primitives
return ARIA attributes. The ask is that every component serve three targets —
websites, web apps and native mobile apps — without forking the system into
two that drift.

The recommendation, in one paragraph: **add `@rata/native` as a third
rendering layer beside `@rata/css` + `@rata/react`, fed by a new native build
target in `@rata/tokens` and by a platform-agnostic core extracted from
`@rata/primitives`.** One registry manifest per component stays the single
source of the written contract; `status.native` joins `status.css`/`react`/
`figma`; and the derived-vs-written cross-check that `packages/cli/lib/contract.mjs`
runs against `packages/react` gets a native twin that runs against
`packages/native`. Websites and web apps stay on the existing web layers —
they are two *profiles* of one platform, not two platforms.

---

## 1. What each platform demands of a component

### 1.1 Definitions

| Platform | What it is | Rendered by | Primary input |
|---|---|---|---|
| **Website** | Marketing and content: landing pages, docs, articles. Read more than operated. | `@rata/css` alone, or `@rata/react` server-rendered | Pointer and keyboard; touch on phones |
| **Web app** | Operated software in a browser: dashboards, editors, settings. Installed as a PWA on some devices. | `@rata/react` (client-rendered or hydrated) | Pointer, keyboard **and** touch, often on one device |
| **Native app** | An iOS/Android binary built with React Native — Expo or bare, both supported (decision N1, §6.1). New Architecture, iOS 15+, Android API 24+ (decision N4). | `@rata/native` | Touch first; screen readers (VoiceOver/TalkBack); hardware keyboard on tablets; D-pad on TV |

### 1.2 Demands, and where Rata stands today

**Website.**

- *SSR-safe render.* Ids must be stable between server and client, and nothing
  may touch `window` or `document` during render. `@rata/react` looks right on
  both counts — 16 of its components use `useId`, and the only `window` read
  (`scroll-lock.ts:28`) is inside a function called from an effect — but **no
  test renders anything on a server**. The playground is a Vite SPA. "SSR-safe"
  is an unverified property until a `renderToString` smoke test exists.
- *Progressive enhancement.* The page must be usable before (or without)
  JavaScript. `@rata/css` is framework-free by design (README "CSS-first"), and
  the components that lean on the platform — `select` is a native `<select>`
  (`select.tsx:80`), `checkbox`/`radio`/`switch` are native inputs
  (`primitives/src/switch.ts:4`) — degrade well. `dialog`, `sheet`,
  `mobile-nav` and `menu` do not: they need `showModal()` or the menu
  primitive's focus model, so they are JS-required by construction.
- *SEO and outline.* Real headings, real links, landmark regions. `heading`
  separates outline level from visual size, `breadcrumbs`/`top-nav`/`side-nav`
  are links not menus (`primitives/src/disclosure.ts` header explains why).
  This profile is already well served.

**Web app.** Everything above, plus:

- *Touch, pointer and keyboard on one device.* Hover feedback must not be the
  only feedback (a phone never hovers), and touch targets must be big enough.
  Here there is a real gap: `size.control.*` is 28 / 32 / 36px
  (`tokens/src/primitives/size.json`). That clears WCAG 2.5.8's 24px minimum —
  `checkbox.json` and `radio.json` argue their 28px pitch through its spacing
  exception — but it is under the 44pt iOS and 48dp Android platform
  guidelines that a native app is reviewed against.
- *Responsive by the page, not the component.* `mobile-nav.css:9` says "the
  media query belongs to the page", and that stays true. This proposal adds no
  breakpoints; the gate-1 review did adopt **narrow / medium / wide** as
  breakpoint tokens for page templates (decision B2, `docs/blocks/README.md`),
  pending the design-tokens interview — components still never read them.
- *Safe areas and PWA chrome.* Nothing in `packages/css/src` reads
  `env(safe-area-inset-*)`. Edge-anchored surfaces — `sheet`, `mobile-nav`,
  `top-nav` — will sit under a notch or home indicator in an installed PWA.
- *Reduced motion.* Already handled per component (`sheet.css:237`,
  `dialog.css:106`, `menu.css:77`, `spinner.css:23`).

**Native app.**

- *No DOM, no CSS, no ARIA attributes in the web sense.* Styles are JS objects
  with unitless density-independent numbers; semantics are `role` /
  `accessibilityRole`, `accessibilityState`, `accessibilityLabel` and friends.
- *The OS owns more.* Navigation stacks, back gestures, the system picker,
  modal presentation and screen-reader focus are platform behavior a component
  joins rather than reimplements — the same stance `select.tsx` already takes
  toward the browser ("an accessibility implementation that is correct by
  construction rather than by our testing").
- *Dynamic Type / font scale.* The user's text size is an OS setting that
  scales every `Text`; it is the native analogue of `rem`.
- *Touch targets at 44pt/48dp*, safe areas, and the hardware back button on
  Android.

---

## 2. Architecture

### 2.1 Package map

```
packages/
  tokens/        + dist/native/   new build target (§2.2) — no new package
  themes/*       + dist/native.js new emit beside theme.css (§2.2)
  primitives/    split: src/core/ (platform-agnostic) + the existing web
                 get*Props, unchanged in output (§2.3)
  css/           unchanged — web only
  react/         unchanged — web only
  native/        NEW @rata/native — RN components: primitives core + native
                 adapters + native tokens. Peer deps: react, react-native,
                 react-native-reanimated (§2.5), react-native-safe-area-context
  icons/         + a native entry (lucide-react-native) behind the same names
  cli/           learns status.native and a --platform flag (§3)
```

Why a third rendering layer and not "make `@rata/react` render on both"? Two
reasons, both from the code:

1. `@rata/react` components extend DOM attribute types —
   `ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled">`
   (`react/src/button.tsx:10`) — and render `className`s that only
   `@rata/css` understands. A universal component would have to drop both,
   which is a breaking change to every web consumer to gain nothing on the web.
2. The hardest web components are hard *because* they lean on browser
   machinery: `modal-dialog.ts` exists to drive `showModal()`, which supplies
   the focus trap, `inert`, the top layer and `::backdrop`. RN has none of it.
   Sharing that file is not possible; sharing what it *decides* (when it may
   close, with what reason — `ModalCloseReason`) is, and that belongs in the
   primitives core.

`react-native-web` renders `@rata/native` in the **playground only**, for
review without a device (decision N2, §6.2). It is not a consumer web target:
websites and web apps keep `@rata/react` + `@rata/css`.

### 2.2 Tokens reach React Native

**What exists.** `packages/tokens/build.mjs` resolves every reference to a
literal and emits `dist/css/tokens.css`, `dist/index.{js,d.ts}`,
`dist/tailwind/preset.cjs` and `dist/usage.json`. The JS export is close to
what RN needs and not close enough:

- `tokens` is the base tree merged with **light values only** (build.mjs:350,
  "light values as defaults"), and its own JSDoc says "Prefer `cssVar()` …
  only the CSS variables react to the active theme".
- `index` carries `{ light, dark }` pairs for every scheme-dependent token,
  keyed by CSS variable name — the right data, the wrong keying.
- Every value is a CSS string: `"16px"`, `"1.5rem"`, `"130ms"`,
  `"cubic-bezier(0.24, 1, 0.4, 1)"`, `"0px 1px 1px rgb(0 0 0 / 0.1), …"`.
  RN wants numbers, and cannot parse half of these.

**Proposal: a fourth emit, `dist/native/index.{js,d.ts}`,** produced from the
same `resolveTheme()` result `build.mjs` already holds (no second resolver —
the same rule `cli/lib/index.mjs` states for its token reader). Shape:

```ts
export const base: NativeBaseTokens;          // space, size, radius, type, motion, …
export const schemes: { light: NativeThemeTokens; dark: NativeThemeTokens };
```

`base` holds theme-invariant scales once; `schemes` holds only the `theme.*`
roles, which are by definition the only tokens that differ by scheme
(TOKENS.md "Layers" table). The JSDoc from `jsdoc()` is reused verbatim, so
usage rules show on hover in an RN editor exactly as they do on the web.

**Value conversion.** Every rule below is mechanical and is the build's job,
never a component's — the same reason the CSS build resolves references
instead of shipping `var()` chains (THEME-ENGINE.md, deviation 3).

| Source value (example) | Native value | Rule |
|---|---|---|
| `"16px"` (space, size, radius, border, letter-spacing) | `16` | px → dp at 1:1. CSS px and RN dp are both density-independent. |
| `"1.5rem"` (`font.size.*`, `type.*.size`) | `24` | × 16, the same root `expandTypeScale.mjs:96` divides by. OS font scaling then multiplies it, which is what `rem` was standing in for. |
| `1.3333` unitless line-height | `32` (absolute) | RN `lineHeight` is absolute: size × ratio, re-snapped to the 4px grid the generator promises. Must be recomputed against the scaled size at runtime if `allowFontScaling` is on (§6.5). |
| `"1.15em"` (`size.icon.text`) | **no static value** | `em` has no RN meaning. Emitted as `{ relativeTo: "font", factor: 1.15 }`; `Icon` resolves it against its parent's font size from context. |
| `"9999px"` (`radius.pill`) | `9999` | RN clamps to half the side, as CSS does. |
| `"130ms"` | `130` | Milliseconds as a number, for Reanimated. |
| `"cubic-bezier(0.24, 1, 0.4, 1)"` | `[0.24, 1, 0.4, 1]` | A tuple for `Easing.bezier(...)`. |
| `"0.08"` (opacity, state) | `0.08` | Number. |
| `"#151D1A80"` | `"#151D1A80"` | RN accepts 8-digit hex. |
| `"rgb(0 0 0 / 0.1)"` (inside shadows, rings) | `"rgba(0, 0, 0, 0.1)"` | Normalized to the comma form; do not bet on every RN version parsing CSS Color 4 syntax. |
| `"0px 1px 1px …, 0px 2px 8px …"` (`elevation.*`, `theme.elevation.*`) | `boxShadow` array | RN's `boxShadow` style accepts layered shadows on the New Architecture. No `shadow*`/`elevation` fallback is emitted: decision N4 rules out the old architecture. |
| `"inset 0px 0px 0px 2px …"` (`ring.*`) | `{ borderWidth, borderColor }` on an overlay | RN has no inset shadow on older targets; a ring becomes an absolutely-positioned bordered `View`. |
| `"'Google Sans', -apple-system, …"` (`font.family.*`) | `"GoogleSans"` + a loading manifest | RN takes one loaded family name, not a fallback stack. The theme seed names the family; the native emit lists the font files the app must register (Expo: `useFonts`). A stack's generic fallbacks map to `undefined` (system font). |
| `"600"` (`font.weight.*`) | `"600"` | RN accepts the string — but only if the loaded family has that weight; §2.2 check below. |

**What the build should verify, as it already does for CSS:** that every
token has a native value or an explicit "web-only" mark (`size.icon.text`'s
`em` is the only one found so far that cannot be resolved statically), and —
new — that every `font.weight` a `type.*` role uses exists in the font files
the theme lists, since RN silently falls back to the nearest weight where CSS
would synthesize one.

**Contrast promises carry over unchanged.** `usage.json` measures pairs from
resolved hex values; the native emit uses those same values, so a pairing
verified for the web is verified for native. Nothing to re-measure.

**Theme switching.** The web switches by attribute (`[data-theme="dark"]`,
build.mjs:346) and by brand scope (`[data-rata-theme="<name>"]`,
build-theme.mjs). Native has no cascade, so both become React context:

```tsx
<RataProvider theme={emberNative} scheme="system">   {/* "light" | "dark" | "system" */}
  <App />
</RataProvider>
```

- `scheme="system"` reads RN's `useColorScheme()` and follows `Appearance`
  changes live; `"light"`/`"dark"` pin it, which is what the web's explicit
  `data-theme` attribute does.
- Components read `useRataTheme()` → `{ base, theme }` and build styles from
  it. A `StyleSheet` created at module scope cannot see context, so styles are
  built per scheme and memoized — two `StyleSheet.create` results per
  component per brand, not one per render.
- **Brand themes**: `build-theme.mjs` already re-verifies every contrast promise
  before it emits a brand's CSS. It gains a second emit, `dist/native.js`, from
  the same resolved values and behind the same verification — a brand that
  fails contrast emits neither. `extends: baseTheme` is untouched.

### 2.3 Primitives: what is shared, what is not

**Finding.** `packages/primitives` is described as "pure functions, no
DOM/React" (STRUCTURE.md) and the *logic* lives up to it: no primitive imports
React, touches `document`, sets a timer or moves focus — focus moves are
reported through callbacks like `onFocusValue` and the wrapper does the
focusing (`tabs.ts`, `radio-group.ts`, `menu.ts` headers all say so). But the
*return shape* of every primitive is a bag of HTML/ARIA props:

- `getButtonProps` returns `type: "button"`, `"aria-disabled"`, `"aria-busy"`,
  `"data-loading"`, `onClick` (`button.ts:15`).
- `getTabsProps` returns `role: "tab"`, `"aria-controls"`, `tabIndex`,
  `hidden`, and id strings built from `idBase` (`tabs.ts:84–122`).
- `getCheckboxProps` / `getSwitchProps` return `type: "checkbox"`,
  `label: { htmlFor }`, and checkbox tells the caller to set `indeterminate`
  as a DOM property (`checkbox.ts:56`).
- `getRadioGroupProps` leans on native radios sharing a `name` for exclusivity
  and form submission (`radio-group.ts:8`) — a mechanism RN does not have.
- `getFieldProps` wires `htmlFor`, `aria-describedby`, `aria-invalid` and an
  `aria-live` message region (`field.ts:51–119`).

So the primitives are **DOM-free but web-shaped**: roughly the decision logic
is portable as-is and the prop-getter layer is not. Classified:

| Primitive | Platform-agnostic core | Web-only surface |
|---|---|---|
| `button` | inert = disabled ‖ loading; the activation guard | `type`, `aria-*`, `data-loading`, `onClick` |
| `toggle-button` | pressed state, guard | `aria-pressed` |
| `button-group` | `hasAccessibleName`, orientation | `role="group"`, `aria-labelledby` |
| `toggle-button-group` | single/multiple selection rules, deselection, roving value, arrow-key target | `role`s, `tabIndex`, `aria-checked`/`pressed` |
| `segmented-control` | always-one selection, roving value, arrow-key target | `role="radiogroup"`/`radio`, `tabIndex` |
| `radio-group` | roving value skipping disabled, wrap-around, select-on-move | shared `name`, `type="radio"`, `tabIndex` |
| `tabs` | automatic vs manual activation, roving target, disabled-but-reachable | id pairing (`aria-controls`/`labelledby`), `tabIndex`, `hidden` |
| `menu` | first-enabled entry point, typeahead cycling with modifier rejection, close reasons (`trigger`/`select`/`escape`/`tab`) | `role="menu"`/`menuitem*`, `tabIndex`, Tab semantics |
| `disclosure` | open/close with reason, disabled guard on both paths | `aria-expanded`, `aria-controls` |
| `checkbox` | tri-state resolution (indeterminate → checked on first press, `checkbox.ts:108`) | `type`, `htmlFor`, DOM `indeterminate` |
| `switch` | on/off, guard | `type="checkbox"` + `role="switch"`, `htmlFor` |
| `field` | status → invalid/busy, which messages describe the control | `htmlFor`, `aria-describedby`, `aria-live` |
| `search` | the Escape rule — clear only when non-empty, otherwise leave the key alone (`search.ts:16`) | `type="search"`, ids |

Two more facts shape the split:

- **The arrow-key walk is written five times** — `menu.ts`, `radio-group.ts`,
  `segmented-control.ts`, `tabs.ts` and `toggle-button-group.ts` each carry
  their own previous/next/Home/End logic. Extracting it is worth doing for
  the web alone.
- **Keyboard handlers have no event source on most phones.** Core RN has no
  general key-event API on iOS/Android views, so `onKeyDown` from the
  primitives would never fire there. It *does* matter on react-native-web,
  react-native-windows/macos, Android with a hardware keyboard, and TV. The
  core should therefore express keys as *intents* (`"previous" | "next" |
  "first" | "last" | "activate" | "dismiss"`) that a web key map, a TV event
  handler or a VoiceOver/TalkBack `accessibilityActions` handler
  (`increment`/`decrement`, `escape`) can each feed.

**Proposal.**

```
packages/primitives/src/
  core/            NEW — pure state and decisions, no ARIA, no event shapes
    roving.ts        nextTarget(values, current, intent, { skip, wrap })
    selection.ts     single / multiple / always-one rules
    guard.ts         isInert, guarded(handler)
    typeahead.ts     the single-character cycling from menu.ts
    dismiss.ts       close reasons shared by menu, disclosure, dialog, sheet
  button.ts …      existing web adapters, rewritten to call core/ —
                   output byte-for-byte unchanged
packages/native/src/behavior/
  button.ts …      native adapters: core/ → role, accessibilityState,
                   accessibilityActions, onPress
```

The web refactor is safe to *verify*, not just to argue: every primitive has a
`*.test.ts` asserting its returned props, so "core extracted, web output
unchanged" is a green test run with no test edits. That is the first gate in
§5 for exactly that reason.

### 2.4 State layer, focus ring and `aria-disabled` on native

**State layer.** On the web it is a composed class drawing a `currentColor`
`::after` at `state.hover-opacity` / `state.press-opacity`, zeroed when
`aria-disabled` or `data-loading` (`css/src/state-layer.css`). The native
translation keeps the rule — *compose, don't reinvent* — and the tokens:

- A `<StateLayer>` primitive component (or `useStateLayer()` hook) renders an
  absolutely-filled `View` with `backgroundColor` = the host's foreground
  colour and `opacity` driven by `Pressable`'s interaction state:
  `pressed` → `state.press-opacity`; `hovered` (pointer on iPad, web, desktop)
  → `state.hover-opacity`; inert → `0`. Transition uses
  `motion.interactive.duration`/`easing`, as the CSS does.
- Every pressable `@rata/native` component composes it; none writes its own
  pressed colour. A native `check-state-layer` equivalent should lint that
  (§3).
- **Android ripple is a decision, not a default** — made per component (decision N5, §6.6). `android_ripple`
  is the platform's own press feedback; using it means Android and iOS differ
  visibly, using the state layer means Rata looks like Rata everywhere.

**Focus ring.** The web draws `theme.focus-ring` at `focus.ring-width` /
`focus.ring-offset` on `:focus-visible` (`css/src/button.css:32`). On native
there are two different focuses, and only one is ours:

- **Screen-reader focus** (VoiceOver / TalkBack cursor) is drawn by the OS.
  Rata draws nothing; drawing a second ring would be noise.
- **Keyboard / D-pad focus** (Android hardware keyboard, iPad Full Keyboard
  Access, TV, react-native-web) is ours. Components track `onFocus`/`onBlur`
  and draw the ring as an outer bordered `View` inset by `-(offset + width)`,
  or with RN's `outline*` style props where the target RN version supports
  them — which decision N4's New-Architecture floor allows (§6.4). Same three tokens, same rule: never removed, offset never `0`
  on a filled accent control.

**`aria-disabled`, not `disabled`.** The web rule exists because a natively
disabled button "leaves the tab order and stops being announced"
(`registry/components/button.json`, first decision). On native, the guarded
pattern carries over directly and is still the right call:

- Pass `aria-disabled` / `accessibilityState={{ disabled: true }}` so the
  control is announced as dimmed/unavailable and stays reachable by
  VoiceOver and TalkBack swipe navigation.
- **Do not** pass `Pressable`'s `disabled` prop. Block activation in the
  primitive's guard, exactly as `getButtonProps.onClick` does — one guard,
  shared by web and native through `core/guard.ts`. This also keeps keyboard
  focusability, which `disabled` may remove on Android.
- Style with `state.disabled-opacity`.
- `loading` maps to `aria-busy` / `accessibilityState.busy`; Spinner becomes
  `ActivityIndicator` or a Reanimated rotation at `motion.duration.spin`
  (`spin-reduced` under reduce-motion).

**ARIA → RN mapping the adapters need** (RN 0.71+ accepts `role` and a subset
of `aria-*` directly; verify each against the RN version pinned at gate N1 — New Architecture, iOS 15+, Android API 24+, decision N4):

| Web (from primitives) | Native | Gap |
|---|---|---|
| `role="button"`, `"switch"`, `"tab"`, `"radio"`, `"checkbox"`, `"menuitem"` | `role` / `accessibilityRole` of the same name | `menuitemradio`/`menuitemcheckbox` have no role; use `menuitem` + `accessibilityState.checked` |
| `aria-disabled`, `aria-busy`, `aria-checked` (incl. `"mixed"`), `aria-selected`, `aria-expanded` | same `aria-*` or `accessibilityState` | — |
| `aria-pressed` | `accessibilityState.selected` on a `togglebutton` role | announced differently per OS |
| `aria-label` | `accessibilityLabel` | — |
| `aria-labelledby`, `htmlFor` | `accessibilityLabelledBy` (Android only); otherwise compose the label into `accessibilityLabel` | iOS has no reference-by-id; the label text must be passed, not pointed at |
| `aria-describedby` | `accessibilityHint` (text, not reference) | the field's messages must be concatenated into the hint |
| `aria-controls`, `aria-orientation`, `aria-required` | none | announced via label/hint text, or dropped — each one an approved decision per component |
| `aria-invalid` | `accessibilityState` has none; prepend status to the label/hint | needs a contract decision in `field` |
| `aria-live="polite"` | `accessibilityLiveRegion="polite"` (Android) + `AccessibilityInfo.announceForAccessibility` (iOS) | two code paths |
| `role="tablist"`, `"radiogroup"`, `"menu"` | `tablist`, `radiogroup`, `menu` roles | iOS support for container roles is partial |
| `hidden` panels, `inert` page behind modal | unmount, or `accessibilityElementsHidden` (iOS) + `importantForAccessibility="no-hide-descendants"` (Android); `accessibilityViewIsModal` / `aria-modal` on the modal | — |

### 2.5 Motion tokens and Reanimated

The motion seeds (`fast`, `medium`, `slow`, `ratio` in
`tokens/src/themes/base.mjs`) generate `motion.duration.*` in ms; easings and
the three semantic roles (`motion.interactive|overlay|modal`) are stated in
`primitives/motion.json` / `semantics/motion.json`. The native emit converts
them to numbers and bezier tuples (§2.2), so a native transition reads:

```ts
withTiming(1, {
  duration: base.motion.overlay.duration,
  easing: Easing.bezier(...base.motion.overlay.easing),
});
```

Recommendation: **Reanimated as a peer dependency of `@rata/native`**, not the
built-in `Animated`. Sheets, drawers and menus need gesture-driven interruption
(drag a sheet down mid-open) that runs on the UI thread, and Reanimated's
`Easing.bezier` takes the token tuples unchanged. Reduced motion maps to
`useReducedMotion()` / `AccessibilityInfo.isReduceMotionEnabled`, the native
analogue of the `prefers-reduced-motion` blocks the CSS already has — and the
same per-component choice applies: reduce means *shorter or instant*, and the
spinner uses `motion.duration.spin-reduced`, never "no feedback".

---

## 3. Registry and schema change (proposed only)

**`registry/schema.json`:** add `native` beside `css`, `react` and `figma`
under `status`, reusing `#/definitions/artifact` — the same five states
(`latest`, `in-progress`, `future`, `deprecated`, `na`). `figma` is the
precedent: a third artifact was added without touching the state machine.
`na` means *web-only by design*, as `state-layer`/`visually-hidden` already
use `react: na`. Three smaller additions:

- **`files[].platform`** — `"web"` (default) or `"native"`. Without it, adding
  `packages/native/src/button.tsx` to `files` breaks the props parser:
  `getComponentProps` takes the *first* `files` entry matching
  `^packages/[^/]+/src/.+\.tsx$` (`cli/lib/index.mjs:263`), so a native file
  could be parsed as the web component.
- **`props.<name>.platforms`** — optional `["web"]` / `["native"]` on a written
  prop entry, for a prop that exists on one side only (`iconOnly` likely exists
  on both; `href`-style link props or `name` for form submission likely don't).
  Absent means both. It is a new key in `PROP_FIELDS` (`contract.mjs`), which
  currently rejects unknown fields — correctly.
- **A per-platform tier** (decision N6: native is `pro`, web stays `free`).
  Today `tier` is one top-level field (`free` | `pro`, default `free`), which
  cannot say "free on the web, pro on native". Proposed: `tier` keeps its
  meaning and becomes explicitly the **web** tier, and a sibling
  `tiers.native` (same `free` | `pro` enum, default `pro`) sits alongside the
  new `status.native` — so a manifest reads
  `"tier": "free", "status": { …, "native": "future" }` and inherits
  `native` = `pro` without stating it. A manifest states `tiers.native` only
  to deviate from the default, which N6 gives no reason to do today. Keeping
  `tier` rather than renaming it means no existing manifest, and nothing that
  reads `tier`, changes; the CLI (`rata list`, `rata add --platform native`)
  and the docs status matrix read the tier for the platform they show. When
  `status.native` is `na` the native tier is meaningless and the build
  should reject a stated `tiers.native`.

**Tooling it touches** (none of it edited by this proposal):

| Tool | Today | Change |
|---|---|---|
| `scripts/generate-component-docs.mjs` `renderPage` | `Status (css / react / figma)` row (line 87) | add `native`; a second import line for `@rata/native` when native is `latest` |
| `generate-component-docs.mjs` `renderIndex` | `Status (css / react)` column (line 188) | add native |
| `generate-component-docs.mjs` `renderComponentIndex` | emits `status.react` only, for the playground home page count | emit both, so "built" can be counted per platform |
| `packages/cli/bin/rata.mjs list` | prints `css:` and `react:` (line 58–61) | add `native:` |
| `cli/lib/index.mjs getComponentProps` | parses `<Name>Props` from the first matching `.tsx`; follows one hop into `packages/primitives/src/<name>.ts` for type aliases | filter `files` by platform; `rata props <name> --platform native` parses `packages/native/src/<name>.tsx`; the alias hop also reads `primitives/src/core/` |
| `cli/lib/contract.mjs` | mode (`spec`/`documented`/`css-only`) decided by `status.react` and the React parse | mode decided **per platform**; a page can be documented on web and spec on native |
| `rata add` / `cli/lib/install-plan.mjs`, `scripts/check-registry-install.mjs` | copies every `files` entry | `--platform web|native`; the install check runs once per platform |
| `apps/playground/src/component-page.tsx:2779` | three `StatusPill`s | a fourth |
| `scripts/generate-ui-context.mjs` → `.claude/ui-context.md` | web props only | a native section per component when native exists |

**The native cross-check.** The web cross-check works because the derived
half is parseable: an exported `<Name>Props` interface plus default
parameters. `@rata/native` should follow **the same source convention**
(`packages/native/src/<name>.tsx`, exported `<Name>Props`, defaults in the
destructuring) so `parsePropsInterface` and `parseDefaults` work unchanged,
and the cross-check becomes: every written prop not marked `["web"]` must
exist in the native interface, and every declared native prop must be
documented. `extends` will read `PressableProps` / `TextInputProps` /
`ViewProps` instead of HTML attribute types, and the docs should say so
rather than hide it.

**Web-specific checks that need native twins or an explicit skip:**
`check-aria-pairings.mjs` (ARIA role/attribute validity — the native twin
validates `role` + `accessibilityState` combinations, e.g. `checked` only on
`checkbox`/`switch`/`radio`/`menuitem`), `check-state-layer-after.mjs` (the
`::after` collision — the native twin checks every `Pressable` composes
`StateLayer`), and `internal/vibe-tests` (its rules scan CSS and TSX for
hardcoded hex/px and palette tokens; a native rule set would scan
`StyleSheet.create` objects for numeric literals that a token covers).

---

## 4. Parity matrix — all 34 components

Effort: **S** = adapter over an existing primitive; **M** = needs a new
native behavior or platform API; **L** = needs a design decision or a library.
"Web-only" means `status.native: na` is proposed — the gate can overrule it.

| Component | Native equivalent | Hard parts | Effort |
|---|---|---|---|
| `avatar` | `Image` + initials `Text` fallback | image load error → fallback; no `alt`, use `accessibilityLabel` | S |
| `badge` | `View` + `Text` | none beyond tokens | S |
| `breadcrumbs` | **Web-only** (`na`) | A native stack shows its trail as the header back button; a breadcrumb trail inside a screen duplicates OS navigation | — |
| `button` | `Pressable` + `getButtonProps` core | state layer, keyboard focus ring, 44pt minimum hit area via `hitSlop` vs. visual `size.control.*` | S |
| `button-group` | `View` with `role="group"`-equivalent | `aria-labelledby` → composed label on iOS | S |
| `checkbox` | `Pressable` drawing the box, `role="checkbox"`, `checked: "mixed"` | no native checkbox on iOS; tri-state from core; label must be inside the pressable (no `htmlFor`) | M |
| `dialog` | RN `Modal` (or a portal + `accessibilityViewIsModal`) | everything `showModal()` gave for free: focus containment, hidden background (`importantForAccessibility`), Android back = Escape (`onRequestClose`), initial focus via `AccessibilityInfo.setAccessibilityFocus` | L |
| `disclosure` | `Pressable` trigger + conditionally rendered panel | `aria-expanded` → `accessibilityState.expanded`; height animation with Reanimated; no Escape on phones | S |
| `field` | `View` wrapping label, control, helper, message | no `aria-describedby` → `accessibilityHint`; `aria-invalid` has no state; live message needs two code paths (§2.4) | M |
| `heading` | `Text` with `role="header"` | RN has **one** header role with no level — the outline-level/visual-size split collapses to visual size only; needs an approved decision | M |
| `icon` | `lucide-react-native` behind the same glyph names | `size.icon.text` is `em`-relative (§2.2); colour from parent text via context, since RN has no `currentColor` | M |
| `menu` | Anchored popover (a portal + measured trigger) or OS action sheet | anchoring/collision without CSS positioning; typeahead has no keys on phones; may defer to `@react-native-menu/menu` or native context menus — OS vs drawn is decided in its contract (decision N5, §6.6) | L |
| `menu-item` | Row inside `menu` | `menuitemradio/checkbox` roles don't exist (§2.4) | M (with menu) |
| `mobile-nav` | A drawer — React Navigation drawer, or Rata's own `sheet` from the start edge | the app's navigator owns the drawer; Rata styles it rather than ships it (decision N3, §6.3) | L |
| `notice` | `View` + `Text`, status role tokens | announce on appear via live region; `role="alert"` analogue | S |
| `panel` | `View` with title row + `ScrollView` | "beside the content" is a wide-screen layout; on a phone it becomes a sheet — a contract question | M |
| `radio` | Row inside `radio-group` | no shared `name`; exclusivity comes from the group, not the platform | S (with group) |
| `radio-group` | `View role="radiogroup"` + core roving/selection | no form submission; arrow keys only on keyboard targets | M |
| `search` | `TextInput` with clear `Pressable` | `returnKeyType="search"`, `clearButtonMode` (iOS) vs. Rata's clear control — pick one; the Escape rule maps to hardware keyboards only | M |
| `segmented-control` | `View` of pressables, core always-one selection | iOS has a native segmented control — join vs. draw decided in its contract (decision N5, §6.6) | M |
| `select` | Native picker | `select.tsx` already chose "the picker a phone shows". Native: `@react-native-picker/picker`, or an action sheet / Rata `sheet` with a list. Options-can't-be-styled carries over if a native picker is used | L |
| `sheet` | Bottom sheet with drag-to-dismiss | gestures, snap points, keyboard avoidance, safe-area inset, Android back; likely built on Reanimated + Gesture Handler, or `@gorhom/bottom-sheet` | L |
| `side-nav` | **Web-only** (`na`), or a styled drawer-content for a navigation library | a persistent rail is a tablet/desktop pattern; on a phone it is `mobile-nav` | — / M |
| `spinner` | `ActivityIndicator` or Reanimated rotation | `currentColor` → explicit colour from context; `spin-reduced` under reduce-motion | S |
| `state-layer` | `<StateLayer>` / `useStateLayer()` (§2.4) | `react: na` on web because it is a class; on native it must be a component, so `native: latest` with a props API | M |
| `switch` | Draw it (`Pressable` + Reanimated thumb) **or** RN `Switch` | RN's `Switch` is the OS control and ignores most styling; same join-vs-draw question | M |
| `tabs` | Two different things — in-screen tabs (`View role="tablist"` + core) vs. app-level bottom tabs (navigation library) | Rata ships the in-screen one; bottom tabs belong to the navigator (decision N3, §6.3) | M |
| `text` | `Text` at a `type.*` role | absolute line-heights and font scaling (§2.2, §6.5) | S |
| `text-field` | `TextInput` inside `field` | `keyboardType`/`autoComplete`/`textContentType` mapping; focus border; disabled-still-submits has no meaning without forms | M |
| `textarea` | `TextInput multiline` inside `field` | auto-grow height; keyboard avoidance | M |
| `toggle-button` | `Pressable`, `accessibilityState.selected` | `aria-pressed` has no exact native analogue | S |
| `toggle-button-group` | `View` + core selection rules | single vs. multiple announced via roles that partly exist | M |
| `top-nav` | **Web-only** (`na`); native apps use the navigator's header | Rata can ship header *styling* (title, actions slots) for React Navigation rather than a component | — / M |
| `visually-hidden` | **Not a component** — it is a prop pattern | Web hides visually but keeps in the a11y tree. Native has no off-screen trick; the analogue is the reverse: put the text in `accessibilityLabel`/`accessibilityHint`, and hide decorative views with `accessibilityElementsHidden` (iOS) + `importantForAccessibility="no-hide-descendants"` (Android). Proposed `native: na` with a documented recipe | — |

Totals: **4** proposed web-only (`breadcrumbs`, `side-nav`, `top-nav`,
`visually-hidden`), **10** S, **15** M (`menu-item` ships with `menu`), and
**5** L (`dialog`, `menu`, `mobile-nav`, `select`, `sheet`) — 34. One
(`state-layer`) changes shape: a CSS class on the web, a component on native.

**Cross-cutting gap: touch targets.** `size.control.md` is 32px. A native
button at that height fails iOS/Android review guidance. Two ways out, each its
own token decision via the design-tokens skill: (a) keep the visual size and
extend the hit area with `hitSlop` to a new `size.target.min` token (44), or
(b) a native-only density that maps `size.control.*` up a step. (a) keeps one
look across platforms and is recommended.

---

## 5. Roadmap and gates

This extends STRUCTURE.md's build order rather than replacing it: per
component, **primitive → approved → semantics → approved → component** still
holds, and native is a second component step sharing the first two. Each **N**
gate below is a stop, not a formality.

**Next step: tokens first.** The gate-1 review sent every proposed token gap
to the design-tokens interview (Purpose / Use when / Don't use for / Pairs
with) — for native that is `size.target.min` (§4, touch targets) and
`theme.elevation.floating` — and those are settled before anything else
moves, including N1 below. The native token emit (N1.2) builds on whatever
that interview approves, so it follows it; no native component, and no
native token shape, is written ahead of it.

**N0 — this document.** §6 is answered (decisions N1–N6, gate-1 review);
§2–§4 stand as the proposal those decisions were made against. Nothing is
built before the remaining open item in §6 is either settled or explicitly
deferred to the component that needs it.

**N1 — Foundations, no components.**
1. Extract `primitives/src/core/` and rewrite the web adapters on top of it.
   Acceptance: every existing `packages/primitives/src/*.test.ts` passes
   unedited, plus new unit tests for `core/` itself.
2. Add the native token emit (§2.2) and brand `dist/native.js`. Acceptance:
   every token has a native value or an explicit web-only mark; contrast
   verification gates the brand emit as it does today.
3. Pin what decisions N1 and N4 settled in `packages/native/package.json`:
   the RN version (New Architecture only), iOS 15+ / Android API 24+, and
   peer dependencies with no `expo-*` import in `packages/native/src` (Expo
   and bare both supported; development on Expo).
   → **Stop. Approve the core API and the native token shape** before any
   native component exists — the same reason gate 1 precedes CSS.

**N2 — Registry and tooling.** Schema additions (§3, including the
per-platform tier for decision N6), CLI `--platform`,
per-platform contract mode, docs status matrix, the native cross-check, and
`native: future` on every component except the four proposed `na`.
Acceptance: `npm run build` and `docs:check` pass with every component in
native spec mode, i.e. the tooling is proven before anything relies on it.
→ **Stop. Approve the per-component native contract format** (which props are
`platforms: ["web"]`) on two pilots before applying it to all 30.

**N3 — Pilot: `button`, `spinner`, `state-layer`, `text`.** These exercise
every foundation — tokens, state layer, focus ring, aria-disabled guard,
motion, font loading, dynamic type — with the least component behavior.
Per component: native semantics (which token each state maps to on native —
mostly identical to web; differences such as `hitSlop` are each approved),
then `packages/native/src/<name>.tsx`, then `status.native: latest`.
Acceptance: the cross-check passes, and a VoiceOver + TalkBack pass on a
device is recorded.
→ **Stop. Review the pilot on devices** before scaling out. Changing the
foundations after 30 components consume them is the expensive path.

**N4 — S and M components**, grouped by shared core: buttons family
(`button-group`, `toggle-button`, `toggle-button-group`); inputs
(`field`, `text-field`, `textarea`, `search`, `checkbox`, `switch`,
`radio-group`, `radio`, `segmented-control`); content (`avatar`, `badge`,
`heading`, `icon`, `notice`, `disclosure`, `panel`); `tabs` (in-screen).
Each component through the per-component gates; `heading`'s level decision
and `field`'s invalid/describedby decision are explicit approvals.

**N5 — Overlays and navigation (L).** `dialog`, `sheet`, `menu`/`menu-item`,
`select`, `mobile-nav`. Each starts with a written decision — build on RN
`Modal`/Reanimated, or wrap a library — approved before its primitive
adapter. Nothing couples to a navigation library (decision N3): components
take a value and `onChange`, and router adapters are documentation recipes.

**Web track, in parallel and independent of native:** a `renderToString`
smoke test for every `@rata/react` component (makes "SSR-safe" a fact), and
`env(safe-area-inset-*)` on `sheet`, `mobile-nav` and `top-nav` for installed
PWAs. Both are small and both are prerequisites for claiming the *website*
and *web app* profiles, not just native.

---

## 6. Decisions

Settled at the gate-1 review
([`decisions/2026-11-gate-1-review.md`](decisions/2026-11-gate-1-review.md)).
Each subsection keeps its original number so the references above still
resolve; the decision id is the one the review uses.

**6.1 Expo or bare React Native — settled, decision N1: both supported,
develop on Expo.** Consumers may use Expo or bare RN, so no `expo-*` (or other
Expo-only) import may appear in `packages/native/src`. `@rata/native` depends
only on `react-native`, `react-native-reanimated`,
`react-native-safe-area-context` (and `react-native-gesture-handler` once
sheets land) — all of which work in both. The development app and device
testing use Expo (dev client), where font loading (`expo-font`), OTA previews
and CI device builds are cheaper; the font loading manifest from §2.2 is
therefore framework-neutral data, with `useFonts` as one documented recipe.

**6.2 react-native-web — settled, decision N2: playground only.**
`@rata/native` components render in the existing playground through
react-native-web so they can be reviewed without a device, and the native
cross-check gets a visual check in CI. React-native-web is **not** a
supported consumer target: websites and web apps keep `@rata/react` +
`@rata/css`, and no second web implementation of any component exists.

**6.3 Navigation library coupling — settled, decision N3: no coupling.**
Rata ships no navigators and depends on no navigation library. Components that
overlap with a navigator (`tabs` at app level, `mobile-nav`, header and
drawer-content styling) take a value and `onChange`; adapters for React
Navigation / Expo Router are documentation recipes, not code in
`@rata/native`. A navigation library's major versions never set Rata's release
cadence.

**6.4 Minimum versions — settled, decision N4: New Architecture only, iOS
15+, Android API 24+.** The RN version is pinned at gate N1 (§5). Because the
old architecture is out, layered `boxShadow` and the `outline*` style props
are available, `role`/`aria-*` props can be relied on, and the native token
emit carries no `shadow*`/`elevation` fallback (§2.2).

**6.5 Font scaling policy — still open.** RN scales text with the OS setting
by default. Options: unlimited (most accessible; layouts must survive 200%+),
or a `maxFontSizeMultiplier` cap per role (controls stay usable; large-text
users lose some size). Recommendation: unlimited for `text`/`heading`, capped
for dense controls (`badge`, `segmented-control`) — each cap an approved token
through the design-tokens interview. Needed before the `text` pilot at N3.

**6.6 OS controls or Rata-drawn — settled, decision N5: decided per
component.** No blanket rule. Each component's contract records the choice in
its "Web and native" decision, approved at that component's gate 1 — for
example whether `select` uses the OS picker, whether `menu` uses an action
sheet / context menu on phones, whether `switch` and `segmented-control` are
drawn, and whether press feedback is the state layer or `android_ripple`. The
§4 parity column is a starting direction for those decisions, not the
decision.

**6.7 Tier — settled, decision N6: native is `pro`.** Web components stay
`free`; every `@rata/native` component is `pro`. The registry cannot express
this today — `tier` is a single field — so §3 proposes a per-platform tier:
`tier` stays the web tier, and `tiers.native` (default `pro`) sits alongside
the proposed `status.native`. That is a schema change, approved with the rest
of §3 at gate N2, not edited in by this decision.

## 7. What this document deliberately does not decide

- **Any component's native API.** Each one goes through its own gate 1 as
  STRUCTURE.md requires; §4's "native equivalent" column is a direction, not
  an approved contract.
- **New tokens.** `size.target.min`, any font-scale caps and any native-only
  density are proposals for the design-tokens skill, not additions.
- **Vue/Svelte or other web frameworks.** README's "CSS-first" decision already
  makes those cheap; they are unaffected by anything here.
- **Card, table, list.** Still absent from the registry on every platform
  (CLAUDE.md); native does not get them first.
