import { Boxes, Icon, Palette } from "@rata/icons";
import type { LucideIcon } from "@rata/icons";
import usage from "@rata/tokens/usage";
import componentIndex from "../../../docs/components/index.json";
import type { Page } from "./routing.js";

/**
 * The playground's front door.
 *
 * EVERY NUMBER ON IT IS COUNTED, not written. A landing page that states how
 * large a system is, in prose, is the first thing to go stale — and it goes
 * stale silently, because nothing renders wrong. These come from the same two
 * generated files the rest of the app reads: the token index in
 * `@rata/tokens/usage`, and `docs/components/index.json`, which is emitted
 * from the contracts alongside the documentation pages and covered by the
 * same staleness check.
 *
 * `index.json` rather than `contracts.json` on purpose. The full contracts
 * are 340kB and sit behind the lazy boundary the components page loads across;
 * pulling them in here to count to thirty would put all of it back in the
 * chunk that loads before anything is on screen.
 */
const tokenCount = Object.keys((usage as { index?: Record<string, unknown> }).index ?? {}).length;
const pairingCount = (usage as { contrast?: { pairings?: unknown[] } }).contrast?.pairings?.length ?? 0;
const componentCount = componentIndex.length;
const builtCount = componentIndex.filter((c) => c.status === "latest").length;

const ENTRIES: Array<{ id: Page; icon: LucideIcon; label: string; blurb: string }> = [
  {
    id: "foundation",
    icon: Palette,
    label: "Foundation",
    blurb:
      "Colour, spacing, radius, typography and motion — every value generated from four seeds, and every one documented with what it is for and what it is not for.",
  },
  {
    id: "components",
    icon: Boxes,
    label: "Components",
    blurb:
      "Each one shown running, with a contract behind it: what every prop is for, what it conflicts with, the accessibility obligation it carries, and the token recipe it is built from.",
  },
];

export function HomePage({ onOpen }: { onOpen: (page: Page) => void }) {
  return (
    <section className="pg-section">
      <h2>Ratā</h2>
      <p className="pg-lede">
        A token-first design system, and the documentation is generated from the same source the
        code is. A component&rsquo;s prop names are parsed from its implementation rather than
        written twice, so a page here cannot describe a component that no longer exists.
      </p>

      {/* Counted, not claimed. See the note at the top of this file. */}
      <dl className="pg-stats">
        <div className="pg-stat">
          <dt>Components</dt>
          <dd>{componentCount}</dd>
          <p className="pg-stat-note">
            {builtCount} built, {componentCount - builtCount} either specified or with no React of
            their own
          </p>
        </div>
        <div className="pg-stat">
          <dt>Tokens</dt>
          <dd>{tokenCount}</dd>
          <p className="pg-stat-note">every one with a written contract, or the build fails</p>
        </div>
        <div className="pg-stat">
          <dt>Contrast pairings</dt>
          <dd>{pairingCount}</dd>
          <p className="pg-stat-note">re-measured on every build, for every brand theme</p>
        </div>
      </dl>

      {/* The same tiles the two overviews use, so the front door looks like
          the rooms it opens onto. */}
      <ul className="pg-gallery pg-gallery--entries">
        {ENTRIES.map((entry) => (
          <li key={entry.id} className="pg-gallery-item">
            <div
              className="pg-gallery-stage pg-gallery-stage--accent rata-state-layer rata-state-layer--flush"
              inert
            >
              <Icon icon={entry.icon} />
            </div>
            <button type="button" className="pg-gallery-name" onClick={() => onOpen(entry.id)}>
              {entry.label}
            </button>
            <p className="pg-note">{entry.blurb}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
