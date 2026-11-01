# Blocks and page templates

> **Status: gate-0/gate-1 SPEC.** Every manifest under `registry/blocks/` is
> `future`. Nothing here is implemented, nothing here is read by the build,
> the CLI or the playground yet, and no layout CSS or React exists for any of
> it. This page is the thing being approved.

## Component, block, template

| | Component | Block | Template |
|---|---|---|---|
| Lives in | `registry/components/<name>.json` | `registry/blocks/<name>.json`, `kind: "block"` | `registry/blocks/<name>.json`, `kind: "template"` |
| Is | One governed UI element with behaviour, a props API and a token recipe | A region-sized **composition of components** with a named frame: a hero, a sign-in form, a settings group | A **whole page**: shell, landmarks, the single `<h1>`, the skip link, and blocks in order |
| Owns | Its states, ARIA, keyboard model, colour and type | Layout only — region widths, gaps, the band background — plus its slot API and heading outline relative to a `headingLevel` it is given | The viewport: the one media query, `<main>`, the outline in absolute levels, routing concerns (dirty-state prompts, URL-as-state) |
| Never | Knows what page it is on | Introduces a new visual treatment, an interactive primitive, a `<main>`, or a hand-rolled container (`<div className="card">`) | Restyles a block or a component |

The rule that makes the three layers checkable: **a block adds no new
visual decisions**. Every pixel a reader sees comes from a component; every
measurement *between* components comes from a `--rata-*` layout token (or a
`calc()` over one). If a block seems to need a colour, a shadow or a type
size of its own, that is a missing component or a missing component variant
— raise it there.

## The frame comes first

Every manifest answers CLAUDE.md's frame-first questions before it lists a
single component:

- `frame.shell` — `header`, `header-sidebar`, `sidebar`, `centered`,
  `full-width`, `stacked` or `split`.
- `frame.container` — `section`, `card`, `table` or `list`, per CLAUDE.md's
  table: dense rows → table/list, widgets/galleries/settings groups → card,
  everything else → plain section. `card` and `table` are `future`, so a
  block that picks either lists it in `dependsOnFuture`.
- `regions[]` — named, in source order, each with an inline-size **budget
  per breakpoint class** (`narrow` / `medium` / `wide`) written as a token
  expression, and a `collapse` rule saying what happens as space runs out.

The only page precedent is `apps/playground/src/app.tsx`. Its shell is
actually **sticky `TopNav` → (`aside` rail at `calc(var(--rata-size-control-lg) * 6)`
+ `main`) → `section`×n**, with one narrow media query that swaps the rail
for `MobileNav`. (CLAUDE.md describes it as "no sidebar" — that line is
stale; flagged, not edited, since this round writes only under
`registry/blocks/` and `docs/blocks/`.) The `dashboard`, `settings` and
`list-detail` templates adopt that shell verbatim, including its documented
cascade-order fix for the rail's media query.

### Measuring without layout tokens

This system deliberately has no breakpoint tokens and no container widths.
The specs follow the two habits already in the codebase rather than
inventing numbers:

1. **Intrinsic first.** Grids are `auto-fill` with the playground gallery's
   track minimum, `min(calc(var(--rata-size-control-lg) * 9), 100%)`, so the
   column count follows the space and no breakpoint is involved.
2. **Derive widths from the control scale.** The repo already measures in
   `size.control.lg` multiples: rail × 6, gallery tile × 9, Dialog sm/md/lg
   × 10/14/20. Blocks reuse those exact multipliers — the auth form column is
   Dialog sm's × 10, reading measure is Dialog lg's × 20 — and flag every
   *new* multiplier as a token gap.
3. **Blocks use container queries, templates own media queries.** A block
   reacts to its own width so it behaves the same beside a rail as
   full-bleed. Only a template knows the viewport, the same reasoning by
   which `TopNav`, `SideNav` and `MobileNav` refuse to own a breakpoint.

## Accessibility contract

- **Blocks never pick their own heading level.** Any block with a heading
  takes a required `headingLevel` slot with no default, for the reason
  `Heading.level`, `Disclosure.headingLevel` and `Panel.headingLevel` have
  none. Its `a11y.headingOutline` is written relative to it (`base`,
  `base+1`). Templates pass the level explicitly and write their outline in
  absolute levels, so a page's whole outline is reviewable in one file.
- **Blocks render at most a labelled `section`** (a `region` landmark when it
  has a heading to be labelled by). Only templates render `<main>`; only
  `TopNav` renders the banner; only `site-footer` renders `contentinfo`.
- **Group labels are not headings** (site-footer columns, stat-tile labels),
  following SideNav's section-label decision.
- **Every template needs a skip link.** There is no skip-link component, so
  the specs compose `visually-hidden` — flagged as a gap.
- Status text in blocks uses the role's `subtle` background with its `fg`
  (Badge/Notice already do), never a saturated `bg`.

## Gating

Same discipline as STRUCTURE.md's "How a component becomes real", adapted
for something that has no primitive of its own:

0. **Manifest** — `registry/blocks/<name>.json`, every status `future`.
   *This round.*
1. **Composition approved** — frame, regions and budgets, the component
   list, the slot API, the heading outline and landmarks, the responsive
   steps, the native mapping, and every `behavior.decisions[]` entry.
   → **Stop. Approve.**
2. **Layout token mapping approved, region by region** — the `tokens` block,
   one region at a time. Any `tokenGaps[]` entry is resolved here: either an
   existing token is accepted, or the design-tokens skill's Gate 1/2/3 adds
   one. Never a literal.
   → **Stop. Every mapping approved.**
3. **Dependencies shipped** — every `dependsOnFuture` entry with
   `blocking: true` is `latest` in `registry/components/`. A template
   inherits the blocking dependencies of every non-optional block it
   composes (`via`). Non-blocking entries ship with their stated `interim`,
   never a hand-rolled stand-in.
4. **Implementation** — layout CSS and the React composition (location is an
   open decision; see below), then flip `status.layout`/`status.react` to
   `latest`, delete the hand-written slot `type`/`required`/`default`, and
   let the cross-check take over, exactly as for components.

## Proposed tooling (not built — this is a proposal)

| Change | What it does |
|---|---|
| `packages/cli/lib` reads `registry/blocks/*.json` beside `registry/components/` | `rata list` gains a `--blocks` / kind column; `rata props <block>` shows slots; `rata contract <block>` shows regions, outline, decisions; `rata pages` lists templates as well as real pages |
| `rata add <block>` | Copies the block's `files` and recursively `rata add`s every entry in `components` (and, for templates, `blocks`). **Refuses** while any blocking `dependsOnFuture` component is not `latest`, naming it — the same "nothing to look up, don't invent it" message components give |
| `scripts/check-blocks.mjs` (in `npm run build`) | Validates against `registry/blocks/schema.json`; every `components[].name` exists in `registry/components/`; every `future` component used appears in `dependsOnFuture`; every region referenced exists; block names never collide with component names (they share `rata add`'s namespace); a `card`/`table` frame lists that dependency; blocks declare no `main` landmark and templates declare exactly one; `native.applies` agrees with `surface` |
| Outline check | Walk each template's `blocks[]` with their `headingLevel`s, expand each block's relative outline, and fail on a skipped level or a second `h1` |
| `tokens` lint | Run every `tokens` value and `usage[].example` through `internal/vibe-tests` (`node internal/vibe-tests/run.mjs check`) — no hex, no px, no palette tokens, no hand-rolled hover |
| Derived/written split once implemented | Slots parsed from the block's `<Name>Props`, exactly as `lib/contract.mjs` does for components; a hand-written slot `type` on a `latest` block fails |
| `npm run docs:blocks` / `docs:check` | Render `docs/blocks/<name>.md` from the manifests, as `docs/components/` is today; until then this README is hand-written and its index table is the only rendered view |
| `.claude/ui-context.md` | `ui:sync` adds a blocks section so agents look blocks up instead of composing a hero from memory |

The validation run for this round (outside the repo, not committed) already
applies the component-existence, future-dependency, region, landmark,
surface/native and no-hex/no-px checks above to all 23 manifests.

## Index

Surface: `website` = public marketing, `web-app` = signed-in product in a browser, `native-app` = iOS/Android. Marketing blocks are website-only: a native app is reached after install, so there is nothing to persuade or convert, and native purchase screens follow store billing rules. Each manifest's `native.reason` says so.

### Website blocks

| Name | Title | Surface | Native | Depends on future (**bold** = blocking) |
|---|---|---|---|---|
| [`hero`](../../registry/blocks/hero.json) | Hero | website | no | **link** |
| [`feature-grid`](../../registry/blocks/feature-grid.json) | Feature grid | website | no | link, card |
| [`pricing-table`](../../registry/blocks/pricing-table.json) | Pricing table | website | no | **card**, list, **link**, table |
| [`testimonial`](../../registry/blocks/testimonial.json) | Testimonial | website | no | — |
| [`logo-cloud`](../../registry/blocks/logo-cloud.json) | Logo cloud | website | no | — |
| [`cta-band`](../../registry/blocks/cta-band.json) | Call-to-action band | website | no | **link** |
| [`faq`](../../registry/blocks/faq.json) | FAQ | website, web-app, native-app | yes | divider, link |
| [`site-footer`](../../registry/blocks/site-footer.json) | Site footer | website, web-app | no | **link**, divider |
| [`newsletter-signup`](../../registry/blocks/newsletter-signup.json) | Newsletter sign-up | website | no | link |

### App blocks

| Name | Title | Surface | Native | Depends on future (**bold** = blocking) |
|---|---|---|---|---|
| [`sign-in`](../../registry/blocks/sign-in.json) | Sign in | website, web-app, native-app | yes | **link**, divider |
| [`sign-up`](../../registry/blocks/sign-up.json) | Sign up | website, web-app, native-app | yes | **link**, list, divider |
| [`settings-page-section`](../../registry/blocks/settings-page-section.json) | Settings section | web-app, native-app | yes | **card**, divider, list, toast |
| [`dashboard-stats`](../../registry/blocks/dashboard-stats.json) | Dashboard stats | web-app, native-app | yes | **card**, skeleton, link |
| [`data-table-toolbar`](../../registry/blocks/data-table-toolbar.json) | Data table toolbar | web-app | no | **table**, chip |
| [`empty-state-page`](../../registry/blocks/empty-state-page.json) | Empty state page | web-app, native-app | yes | **empty-state**, link |
| [`onboarding-steps`](../../registry/blocks/onboarding-steps.json) | Onboarding steps | web-app, native-app | yes | **steps**, progress, file-upload |
| [`profile-header`](../../registry/blocks/profile-header.json) | Profile header | web-app, native-app | yes | — |

### Templates

| Name | Title | Surface | Native | Depends on future (**bold** = blocking) |
|---|---|---|---|---|
| [`landing-page`](../../registry/blocks/landing-page.json) | Landing page | website | no | **link** |
| [`pricing-page`](../../registry/blocks/pricing-page.json) | Pricing page | website | no | **card**, **link**, table |
| [`dashboard`](../../registry/blocks/dashboard.json) | Dashboard | web-app, native-app | yes | **card**, table, list, bottom-nav, skeleton |
| [`settings`](../../registry/blocks/settings.json) | Settings | web-app, native-app | yes | **card** |
| [`auth`](../../registry/blocks/auth.json) | Auth page | website, web-app, native-app | yes | **link** |
| [`list-detail`](../../registry/blocks/list-detail.json) | List / detail | web-app, native-app | yes | **list**, pagination, skeleton, swipe-actions |

## Token gaps

Stated as needs, never as invented token names. Each would go through the
design-tokens skill.

| Need | Used by | Interim in the specs |
|---|---|---|
| **Container / content max-inline-size** | every marketing block, landing/pricing/dashboard templates | `calc(var(--rata-size-control-lg) * 32)` for marketing bands — a new multiplier, so explicitly provisional. The playground caps its column with a literal and a comment saying no measure token exists |
| **Breakpoint classes** (`narrow`/`medium`/`wide`) | every template; blocks via container queries | Intrinsic layouts where possible; otherwise the page owns its query, as the playground owns `NARROW` (60rem). Whether three classes are needed or one suffices (list-detail is the only spec that wants `medium`) is open |
| **Section-band rhythm** larger than `space.section` | hero, feature-grid, pricing, testimonial, cta-band, logo-cloud | `padding-block: var(--rata-space-section)`; `space.section` was sized for docs pages |
| **Grid gutter role** | feature-grid, pricing, testimonial, dashboard-stats, site-footer | `space.gap.lg` columns / `space.stack.lg` rows — `space.gap.*` is documented for inline items |
| **Pane / content widths for split layouts** | list-detail, onboarding-steps | `size.control.lg` × 9 / × 10 — reusing existing multipliers |
| **Layer (z-index) scale** | every template with a sticky header | `z-index: 1`, the playground's literal |
| **Media height / aspect** | logo-cloud, hero media | `block-size: var(--rata-size-control-lg)` for logos; `radius.container` for figures |
| **Skip link** (component, not token) | every template | `visually-hidden` content shown on `:focus-visible` |
| **Chart / sparkline** (component, not token) | dashboard-stats | Out of scope; `color.data.*` is the palette when one is specified |

## Blocked on future components

| Future component | Blocks it (blocking) | Used without blocking |
|---|---|---|
| `link` | hero, cta-band, site-footer, pricing-table, sign-in, sign-up, landing-page, pricing-page, auth | feature-grid, faq, newsletter-signup, dashboard-stats, empty-state-page |
| `card` | pricing-table, settings-page-section, dashboard-stats, dashboard, settings, pricing-page | feature-grid (future variant) |
| `table` | data-table-toolbar | pricing-table, pricing-page, dashboard |
| `list` | list-detail | pricing-table, sign-up, settings-page-section, dashboard |
| `empty-state` | empty-state-page | — |
| `steps` (or `stepper`) | onboarding-steps | — |
| `divider` | — | faq, site-footer, sign-in, sign-up, settings-page-section |
| `skeleton` | — | dashboard-stats, dashboard, list-detail |
| `progress`, `file-upload` | — | onboarding-steps |
| `chip` | — | data-table-toolbar |
| `toast` | — | settings-page-section |
| `pagination`, `swipe-actions` | — | list-detail |
| `bottom-nav` | — (native dashboard waits on it) | dashboard |

`link` is the single biggest unblocker: nine of 23 entries cannot ship
without it, because every marketing CTA navigates and `Button` renders a
`<button>`. `testimonial`, `logo-cloud` and `profile-header` depend on
nothing future and could go to gate 2 now.

## Open decisions

1. **Where implementations live.** `packages/blocks/` (a new `@rata/blocks`
   package the CLI copies from, like `@rata/react`) or copy-only source under
   `registry/blocks/src/`? Templates likely belong in `apps/` as real pages
   either way.
2. **Breakpoint classes.** Ratify `narrow`/`medium`/`wide` as named classes
   (values still page-owned), or keep the single-breakpoint rule and drop
   `medium`.
3. **Container width.** Add a container/measure token, or keep deriving from
   `size.control.lg` (and accept a × 32 multiplier for marketing bands).
4. **Native.** Is there a native target at all (React Native, SwiftUI,
   Compose)? The `native` blocks here are mapping guidance only; `status.native`
   is `future` for 12 entries and `na` for 11.
5. **`steps` vs `stepper`** — whichever name the component spec settles on;
   onboarding-steps references `steps`.
6. **Per-block questions** are in each manifest's `openQuestions` — notably
   the list-detail detail-heading level, sign-in password reveal (a TextField
   change), and whether `empty-state-page` should instead be a `size` variant
   of `empty-state`.

