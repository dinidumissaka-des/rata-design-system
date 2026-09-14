import { SegmentedControl } from "@rata/react";

/**
 * The accent switcher — this system's five accent options.
 *
 * Each option is a real brand theme under `packages/themes/<slug>/`, stating
 * one accent seed and inheriting everything else from base. Selecting one sets
 * `data-rata-theme` on the document, which is the whole switch: the theme's
 * stylesheet re-declares every colour token the new accent generates, so every
 * component re-tones at once without re-rendering anything.
 *
 * Note what this file does NOT contain: any colour. The swatches carry
 * `data-rata-theme` themselves, so each one resolves
 * `--rata-theme-accent-role-bg` through its own theme's scope — the swatch shows
 * the real generated fill rather than a hex someone re-typed here, and it
 * cannot drift from the theme it stands for.
 *
 * The names below are the only thing hand-listed. There is no themes registry
 * to read them from; if you add a sixth package, add it here too.
 */

export type Scheme = "light" | "dark";

export interface AccentOption {
  slug: string;
  title: string;
  /** Why this option exists — shown as the control's title text. */
  note: string;
}

export const ACCENTS: AccentOption[] = [
  {
    slug: "pine",
    title: "Pine",
    note: "#1F7A5B — deep green. The brand's primary, and the base theme's own seed, so this option overrides nothing.",
  },
  {
    slug: "lime",
    title: "Lime",
    note: "#9FE870 — bright lime. Too light for a button fill, so the fill generates dark (#1D6D00) and the lime itself shows up as the tint.",
  },
  {
    slug: "rust",
    title: "Rust",
    note: "#C22D05 — burnt orange-red, greys warmed to match. Sits near the danger role, so primary and destructive read alike.",
  },
  {
    slug: "ink",
    title: "Ink",
    note: "#15151B — near-black, below the palette's chroma floor, so it lifts to a blue-violet accent rather than a black one.",
  },
  {
    slug: "cobalt",
    title: "Cobalt",
    note: "#3854FF — vivid blue, the most saturated of the five.",
  },
];

export const DEFAULT_ACCENT = "pine";

export function AccentSwitcher({
  value,
  scheme,
  onChange,
}: {
  value: string;
  scheme: Scheme;
  onChange: (slug: string) => void;
}) {
  return (
    /* A SegmentedControl, which is what this always was: one choice out of
       five, every answer shown. It was a hand-rolled fieldset of radios,
       written before this system had the component — and a design system's own
       chrome using a hand-rolled version of a component it ships is the kind
       of thing nobody notices until the component changes and the copy does
       not.
       The swatch goes in the option's label, which is a ReactNode, so each one
       still resolves its own theme's accent rather than a hex re-typed here. */
    <SegmentedControl
      className="pg-accent"
      label="Accent colour"
      size="sm"
      value={value}
      onValueChange={onChange}
      options={ACCENTS.map((accent) => ({
        value: accent.slug,
        label: (
          <span className="pg-accent-option" title={accent.note}>
            {/* Both attributes, because a theme's dark half is scoped
                [data-rata-theme="x"][data-theme="dark"] — one compound
                selector, so the swatch needs both to show the right value in
                dark mode. */}
            <span
              className="pg-accent-swatch"
              data-rata-theme={accent.slug}
              data-theme={scheme}
              aria-hidden="true"
            />
            <span className="pg-accent-name">{accent.title}</span>
          </span>
        ),
      }))}
    />
  );
}
