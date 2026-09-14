# Agent-Ready UI Workflow

A portable process for building UI with an AI agent. Stack-agnostic, but written for Next.js + TypeScript + Tailwind + shadcn/ui.

---

## The one idea

**The agent never recalls your component API from memory. It looks it up.**

Every failure mode this workflow prevents traces back to the same root cause: a model that half-remembers your codebase invents props, invents imports, and reaches for generic React patterns. The fix is not a better prompt. The fix is making lookup cheaper than guessing.

Everything below is machinery in service of that.

---

## Layer 0 — Generated context, never hand-written

Hand-written agent docs rot. The component you renamed last week is still in the file, and the agent trusts it.

**Rule:** the agent context file is *generated from the codebase*, not authored.

```json
// package.json
"scripts": {
  "ui:sync": "node scripts/generate-ui-context.mjs"
}
```

The script walks `components/ui/`, extracts each component's exported props interface, and writes `.claude/ui-context.md`. Run it on install and after any component change.

```json
"scripts": {
  "postinstall": "npm run ui:sync"
}
```

**What goes in the generated file:**
- Component index — name, import path, one-line purpose
- Props per component, with types and defaults
- Token reference — every CSS custom property, with its value

**What stays hand-written** (in `CLAUDE.md`, committed, rarely changes):
- Anti-patterns
- Layout rules
- The pre-write ritual below

Keep these in separate files. The generated one is disposable; the authored one is the contract.

---

## Layer 1 — Make lookup a command, not a search

Agents guess file paths and fail silently. Give them a named command that cannot be gotten wrong.

```json
"scripts": {
  "ui": "node scripts/ui.mjs"
}
```

```bash
npm run ui -- list              # every component, one line each
npm run ui -- props Dialog      # props, types, defaults, example
npm run ui -- tokens            # spacing, color, radius reference
npm run ui -- pages             # existing page patterns in this repo
```

Two flags worth building in:

- `--dense` — token-efficient output for pasting into a chat window
- `--example` — a real usage snippet pulled from the repo, not a synthesized one

If you'd rather skip the CLI, an MCP server over the same index does the same job without manual pasting. The CLI is the lower-effort start.

---

## Layer 2 — The pre-write ritual

**Non-negotiable. Three steps before any UI code is written.**

1. **Find the precedent.** `npm run ui -- pages` — is there an existing page in this repo doing something structurally similar? Open it.
2. **Study the frame.** Read that page's layout shell only. Ignore its content. What are the regions, and how are they budgeted?
3. **Read the props.** `npm run ui -- props <Name>` for *every* component the new page will touch. No exceptions for "obvious" ones — Button is where agents invent props most often.

Put this in `CLAUDE.md` verbatim. The value is that it's mechanical: the agent doesn't decide whether it needs to look something up.

---

## Layer 3 — Frame-first layout

Decide the shell before you write content. Retrofitting a layout around content that was written first is the most expensive rework in UI.

**Order of operations:**
1. Pick the page shell (sidebar / full-width / centered / split)
2. Name the regions (header, content, footer, aside) and budget them
3. *Then* fill

**Container rules:**

| Content type | Container |
|---|---|
| Dense, scannable data | Rows — Table or List, edge-to-edge, divided |
| Widgets, galleries, settings groups | Card |
| Everything else | Neither — plain sections |

The default failure is wrapping every list item and every page section in a Card. It looks tidy in isolation and turns into visual noise at page scale.

---

## Layer 4 — Token discipline

Your app code never references a specific color or measurement. That's what makes theming and dark mode work without touching screens.

**Semantic, not appearance.** `--color-surface`, not `--color-gray-50`. `--spacing-section`, not `--spacing-32`. The name says what it's for, so changing the value doesn't create a lie.

```css
/* globals.css — layer order declared explicitly */
@layer reset, theme, base, components, utilities;
```

Declare the layer order once, and assign every stylesheet to a layer deliberately. Unlayered styles override layered ones regardless of specificity — this is the single most common source of "why won't my override apply."

**Selector surface for external CSS:** target the stable component class plus a reflected data attribute.

```css
.ui-button[data-variant="primary"] { }
```

Not bare state classes like `.primary`. They collide with everything.

---

## Layer 5 — Anti-patterns

Explicit "don't" rules catch known model failure modes. Keep this list short enough that it's actually read.

| Don't | Instead |
|---|---|
| `style={{}}` on wrapper divs | Style the component directly via its style prop |
| Hardcoded colors (`#fff`, `rgb()`) | `var(--color-*)` or semantic Tailwind classes |
| Hardcoded spacing (`16px`, `1rem`) | Spacing tokens or Tailwind spacing utilities |
| Wrapping a component in a div just for margin | Pass the spacing to the component |
| Raw `<a>` for internal navigation | The router link abstraction, so it's swappable |
| Uncontrolled form inputs | Controlled — `value` + `onChange` |
| Inventing props | Read the docs first |
| Badge as decoration | Badge is for counts and enumerated states only |

---

## Layer 6 — The knowledge check

Before an agent writes UI in this repo, it answers three questions that are **impossible to guess correctly**. Pick ones specific to your codebase — a non-obvious import path, a prop with a surprising name, a component with a non-default control pattern.

```text
Before writing any UI code, answer:

1. What is the exact import path for <Component>?
2. How do you make <Component> non-dismissible?
3. What prop does <Component> use for its items?

If you can't answer all three, run `npm run ui -- list` and read
.claude/ui-context.md before continuing.
```

The point isn't the quiz. It's that a wrong answer is *legible* — to you and to the agent — where a wrong prop in generated code is not.

---

## Maintenance loop

| Trigger | Action |
|---|---|
| Component added, renamed, or props changed | `npm run ui:sync` |
| Dependency version bump | `npm run ui:sync`, then spot-check the diff |
| Same correction given to the agent twice | It belongs in `CLAUDE.md`, not in a chat message |

That last row is the one that compounds. Every repeated correction is a missing rule.

---

## Porting notes

**File layout for this stack:**

```
CLAUDE.md                  # authored: rules, ritual, anti-patterns
STRUCTURE.md               # authored: repo map
.claude/
  ui-context.md            # GENERATED — gitignored or committed, your call
  skills/                  # authored: reusable patterns
scripts/
  generate-ui-context.mjs
  ui.mjs
```

**shadcn/ui specifics.** shadcn already does the token half of this — `--background`, `--primary`, `--muted-foreground` are semantic CSS custom properties, and Tailwind reads from them. What it doesn't give you is the queryable index, because components live in your repo as source. That's exactly what Layer 0's generator is for: your `components/ui/` folder *is* the source of truth, so generating from it can't drift.

**Start order.** Layers 0, 2, and 5 deliver most of the value. Build the generator, write the ritual into `CLAUDE.md`, write the anti-pattern table. Add Layers 1 and 6 once the first three are habitual.

---

## Applied in this repo

This repo (`DS`) is not the Next.js/shadcn stack the workflow above assumes
— it's a token-first design system, and the "consumer app" is `apps/playground`
plus, eventually, whatever installs `@rata/react`. The porting differences,
made explicit rather than silently assumed:

- **Layer 0 & 1 share one implementation**, not two. `packages/cli/lib/index.mjs`
  holds the parsing (registry, props-interface, tokens, pages); both
  `packages/cli/bin/rata.mjs` (Layer 1's live commands) and
  `scripts/generate-ui-context.mjs` (Layer 0's static file) call into it. Two
  copies of the same source-reading logic is exactly the kind of drift this
  workflow exists to prevent.
- **`ui:sync` runs at the end of `npm run build`, not in `postinstall`.**
  The generator's token section needs `@rata/tokens` built; on a fresh clone
  `postinstall` fires before any workspace has been built, so it would either
  no-op or lie. `npm run build` is the point where every artifact it reads
  actually exists.
- **The lookup CLI *is* the distribution CLI** (`rata`/`@rata/cli`), not a second
  script. This repo already ships a registry-driven CLI for copy-paste
  distribution (`rata list`, `rata add`); Layer 1's `props`/`tokens`/`pages`
  were added as subcommands of it rather than a parallel `scripts/ui.mjs`,
  aliased at the root as `npm run ui`.
- See [CLAUDE.md](CLAUDE.md) for the resulting ritual, anti-patterns, and
  knowledge check, adapted to this repo's actual components and tokens
  instead of the generic placeholders above.
