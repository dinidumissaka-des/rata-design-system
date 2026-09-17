import { Boxes, Icon, Palette } from "@rata/icons";
import type { LucideIcon } from "@rata/icons";
import usage from "@rata/tokens/usage";
import componentIndex from "../../../docs/components/index.json";
import type { Page } from "./routing.js";
import { TableScroll } from "./table-scroll.js";

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
    <section className="pg-section pg-section--home">
      <h2>Ratā</h2>
      <p className="pg-lede">
        A token-first, <strong>machine-readable</strong> design system. Every token carries a
        written contract and every component&rsquo;s props are parsed from its implementation
        rather than written twice — so the same answers reach a person reading a page, an editor
        showing a tooltip, and an agent asking the CLI, and none of the three can drift from the
        code.
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

      {/* No figures in this table on purpose. The numbers that would fit here
          — file sizes, the A/B run's error count — are command output rather
          than anything this page can count, and inventing them in prose is
          exactly what the stats above avoid. Names and mechanisms are facts;
          quoting `51 → 0 errors` from the last time someone ran `npm run
          vibe` would not be. */}
      <h3>Machine-readable</h3>
      <TableScroll>
        <table className="pg-table">
          <thead>
            <tr>
              <th>Artifact</th>
              <th>What it carries</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>@rata/tokens/usage</code>
              </td>
              <td>
                Every token&rsquo;s contract as JSON — what it is for, what it is{" "}
                <em>not</em> for, what to use instead, and the measured contrast of every documented
                pairing. This page&rsquo;s own numbers are read from it.
              </td>
            </tr>
            <tr>
              <td>
                <code>@rata/tokens</code> types
              </td>
              <td>
                The same rules as JSDoc, so they arrive on hover and in completions rather than
                needing to be looked up.
              </td>
            </tr>
            <tr>
              <td>
                <code>contracts.json</code>
              </td>
              <td>
                Every component contract as JSON. The derived half — prop names, types, defaults — is
                parsed from source, so the build fails if a documented prop stops existing.
              </td>
            </tr>
            <tr>
              <td>
                <code>rata props</code> · <code>rata contract</code>
              </td>
              <td>
                A CLI that answers both from the implementation, for an agent writing code against
                this system rather than reading about it.
              </td>
            </tr>
          </tbody>
        </table>
      </TableScroll>
      <p className="pg-note">
        Whether any of that actually changes what a machine writes is itself tested:{" "}
        <code>internal/vibe-tests</code> scores generated component code with the guidance and
        without it, and fails the build if the checker stops telling the two apart.
      </p>

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
