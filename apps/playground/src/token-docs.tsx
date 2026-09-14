// Token documentation, rendered from @rata/tokens/usage — the same machine-
// readable contract that generates TOKENS.md, the JSDoc in dist/index.d.ts,
// and the rules internal/vibe-tests scores against. Nothing here is written
// by hand: if a token's guidance changes, it changes in the contracts under
// packages/tokens/src/contracts/ and arrives here on the next build.
//
// The point of showing it beside the swatches is that a value alone never
// answers the question people actually have. "#0055D9" doesn't say that it is
// for exactly one action per view, that the only foreground allowed on it is
// theme.fg.on-accent, or that a tinted region wants accent-role.subtle
// instead. That is what the contract knows.
import { useRef } from "react";
import { Sheet } from "@rata/react";
import { NARROW, useMediaQuery } from "./use-media-query.js";
import type { Page } from "./routing.js";
import usage from "@rata/tokens/usage";

interface TokenEntry {
  layer?: string;
  summary?: string;
  use?: string[];
  dont?: string[];
  instead?: Record<string, string>;
  pairsWith?: string[];
  scale?: Record<string, string>;
  example?: { css?: string };
  cssVar?: string;
  value?: string | { light?: string; dark?: string };
}

interface Pairing {
  fg: string;
  bg: string;
  requires: string;
  themes: string[];
  measured: Record<string, number>;
}

interface Gap extends Pairing {
  below: string;
  note?: string;
  workaround?: string;
}

interface Usage {
  rules: string[];
  index: Record<string, { path: string; layer: string; value: string }>;
  tokens: Record<string, TokenEntry>;
  contrast: { pairings: Pairing[]; knownGaps: Gap[] };
  recipes: Record<string, { summary?: string; tokens: Record<string, string> }>;
}

const model = usage as unknown as Usage;

export const rules = model.rules;
export const pairings = model.contrast.pairings;
export const knownGaps = model.contrast.knownGaps;

/**
 * Find the contract covering a token path.
 *
 * Semantic tokens are documented individually (`theme.accent-role.bg`), while
 * primitive scales are documented as a family with per-step notes under
 * `scale` (`color`, `space`). So we walk up the path until something matches,
 * and report whether the hit was exact — a family-level entry is real
 * documentation, but it is about the scale, not about the one step clicked,
 * and saying so is the difference between a citation and a guess.
 */
export function lookupTokenDoc(path: string): {
  entry: TokenEntry | null;
  matchedPath: string | null;
  exact: boolean;
  step: string | null;
} {
  const parts = path.split(".");
  for (let i = parts.length; i > 0; i--) {
    const candidate = parts.slice(0, i).join(".");
    const entry = model.tokens[candidate];
    if (!entry) continue;
    const step = i === parts.length ? null : parts.slice(i).join(".");
    return { entry, matchedPath: candidate, exact: i === parts.length, step };
  }
  return { entry: null, matchedPath: null, exact: false, step: null };
}

/** Every verified pairing and known gap this token takes part in. */
export function contrastFor(path: string) {
  return {
    verified: pairings.filter((p) => p.fg === path || p.bg === path),
    gaps: knownGaps.filter((g) => g.fg === path || g.bg === path),
  };
}

function Ratios({ measured }: { measured: Record<string, number> }) {
  return (
    <>
      {Object.entries(measured).map(([theme, ratio]) => (
        <span className="pg-ratio" key={theme}>
          {theme} {ratio}:1
        </span>
      ))}
    </>
  );
}

/**
 * The Foundation category's overview — the sibling of ComponentIndex.
 *
 * Every row is derived. The count comes from the token index in usage.json
 * and the description is that family's own documented summary, so this page
 * cannot drift from the tokens the way a hand-written landing page would.
 * Two categories have no single family behind them and say so in a line of
 * the app's own copy, which is the honest way to mark the difference.
 */
const FOUNDATION_CATEGORIES: Array<{
  id: Page;
  label: string;
  /** Token prefixes this page covers, for the count. */
  prefixes: string[];
  /** The family whose documented summary describes it, when one does. */
  family?: string;
  /** Written copy, only where no single family speaks for the page. */
  note?: string;
}> = [
  { id: "color", label: "Color", prefixes: ["color", "theme"], family: "color" },
  { id: "spacing", label: "Spacing", prefixes: ["space"], family: "space" },
  { id: "radius", label: "Radius", prefixes: ["radius"], family: "radius" },
  { id: "typography", label: "Typography", prefixes: ["type", "font"], family: "type" },
  { id: "motion", label: "Motion", prefixes: ["motion"], family: "motion" },
  {
    id: "misc",
    label: "Misc",
    prefixes: ["elevation", "border", "opacity", "size", "state", "focus", "ring"],
    note: "The primitives with no family of their own — elevation, border widths, opacity, control sizes, state and focus. Grouped because each is too small for a page, not because they are related.",
  },
  {
    id: "contrast",
    label: "Rules & contrast",
    prefixes: [],
    note: "Not a token family: the measured contrast of every documented foreground/background pairing, re-checked on each build, plus the rules the other pages are written against.",
  },
];

/** How many `--rata-*` custom properties a set of prefixes covers. */
function countTokens(prefixes: string[]): number {
  if (prefixes.length === 0) return 0;
  return Object.keys(model.index ?? {}).filter((name) =>
    prefixes.some((p) => name.startsWith(`rata-${p}-`)),
  ).length;
}

export function FoundationIndex({ onOpen }: { onOpen: (page: Page) => void }) {
  return (
    <section className="pg-section">
      <h2>Foundation</h2>
      <p className="pg-note">
        Every token in the system, by category. Each one is generated from four seeds in{" "}
        <code>packages/tokens/src/themes/base.mjs</code> — change the seed, not the output. Open a
        category for the values, and click any one of them for its contract: what it is for, what it
        is not for, and what to use instead.
      </p>
      <table className="pg-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Tokens</th>
            <th>What it covers</th>
          </tr>
        </thead>
        <tbody>
          {FOUNDATION_CATEGORIES.map((category) => {
            const count = countTokens(category.prefixes);
            return (
              <tr key={category.id}>
                <td>
                  <button type="button" className="pg-link" onClick={() => onOpen(category.id)}>
                    {category.label}
                  </button>
                </td>
                <td>{count > 0 ? count : "—"}</td>
                <td>{category.note ?? model.tokens[category.family!]?.summary ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/**
 * The full contract for one token, in a Sheet from whichever edge fits.
 *
 * This was a Panel on wide viewports — in the layout, beside the swatch grid,
 * on the argument that reading a token's contract against the swatches still
 * on screen is the task. The argument holds in general and lost here on
 * measure: a rail has to leave the grid room, which capped it at 324px, and
 * this content is long-form prose with code in it. Purpose, use-for,
 * do-not-use-for, the substitutions and the measured pairings each wrapped
 * every few words, and a contract nobody can read comfortably is not
 * serving the comparison either.
 *
 * So it is a Sheet at `size="lg"` — 648px — and the cost is real and
 * accepted: a sheet is modal, so the grid behind it is inert while it is
 * open. You no longer compare against the swatches; you read one contract
 * at a time.
 *
 * One component from either edge: `block-end` on a narrow viewport, where the
 * bottom is where a thumb already is, and `inline-end` on a wide one, which
 * is where the rail used to sit. `edge` exists so that is one prop rather
 * than two components.
 *
 * Panel is still the right component for a rail whose content fits one, and
 * its own page in this playground demonstrates it. It is no longer used by
 * the playground's chrome.
 *
 * Kept deliberately free of attribute-level comments: this JSX is scanned
 * into `docs/components/sheet.md` as the component's real usage in this repo,
 * and comments between props land there verbatim.
 */
export function TokenDoc({ path, onClose }: { path: string | null; onClose: () => void }) {
  const narrow = useMediaQuery(NARROW);

  // The last path stays available so the sheet can animate OUT with its
  // content still in it. `path` goes null the instant it closes, and an
  // unmounted <dialog> has no exit — it would vanish rather than leave.
  // Written during render, which is safe here because it is derived from the
  // current props and read by nothing else.
  const retained = useRef<string | null>(null);
  if (path !== null) retained.current = path;
  const shown = path ?? retained.current;

  return (
    <Sheet
      open={path !== null}
      onClose={() => onClose()}
      edge={narrow ? "block-end" : "inline-end"}
      size="lg"
      title={<code>{shown ?? ""}</code>}
      dismissLabel={shown === null ? "Close" : `Close documentation for ${shown}`}
    >
      {shown !== null && <TokenDocBody path={shown} />}
    </Sheet>
  );
}

/** The documentation itself, identical from either edge. */
function TokenDocBody({ path }: { path: string }) {
  const { entry, matchedPath, exact, step } = lookupTokenDoc(path);
  const { verified, gaps } = contrastFor(path);
  const stepNote = entry?.scale && step ? entry.scale[step] : null;

  return (
    <>

      {!entry && (
        <p className="pg-note">
          No contract entry for this token. Every token is supposed to have one — the token build
          fails on an undocumented token, so this means the path above isn&rsquo;t a real token path.
        </p>
      )}

      {entry && (
        <>
          <div className="pg-inspector-meta">
            {entry.layer && <span className={`pg-layer pg-layer--${entry.layer}`}>{entry.layer}</span>}
            {entry.cssVar && <code className="pg-inspector-var">{entry.cssVar}</code>}
          </div>

          {!exact && matchedPath && (
            <p className="pg-note">
              Documented as a scale: the guidance below is for <code>{matchedPath}</code> as a whole.
            </p>
          )}

          {stepNote && (
            <section className="pg-doc-block">
              <h4>This step</h4>
              <p>{stepNote}</p>
            </section>
          )}

          {entry.summary && (
            <section className="pg-doc-block">
              <h4>Purpose</h4>
              <p>{entry.summary}</p>
            </section>
          )}

          {entry.use?.length ? (
            <section className="pg-doc-block">
              <h4>Use for</h4>
              <ul>
                {entry.use.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {entry.dont?.length ? (
            <section className="pg-doc-block pg-doc-block--dont">
              <h4>Do not use for</h4>
              <ul>
                {entry.dont.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {entry.instead && Object.keys(entry.instead).length ? (
            <section className="pg-doc-block">
              <h4>Use instead</h4>
              <dl className="pg-instead">
                {Object.entries(entry.instead).map(([need, token]) => (
                  <div key={need}>
                    <dt>{need}</dt>
                    <dd>
                      <code>{token}</code>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {entry.pairsWith?.length ? (
            <section className="pg-doc-block">
              <h4>Pairs with</h4>
              <ul>
                {entry.pairsWith.map((token) => (
                  <li key={token}>
                    <code>{token}</code>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {verified.length > 0 && (
            <section className="pg-doc-block">
              <h4>Verified contrast</h4>
              <ul className="pg-pairing-list">
                {verified.map((p) => (
                  <li key={`${p.fg}|${p.bg}`}>
                    <code>{p.fg}</code> on <code>{p.bg}</code>
                    <span className="pg-requires">{p.requires}</span>
                    <Ratios measured={p.measured} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {gaps.length > 0 && (
            <section className="pg-doc-block pg-doc-block--dont">
              <h4>Known gaps</h4>
              <ul className="pg-pairing-list">
                {gaps.map((g) => (
                  <li key={`${g.fg}|${g.bg}`}>
                    <code>{g.fg}</code> on <code>{g.bg}</code>
                    <span className="pg-requires">below {g.below}</span>
                    <Ratios measured={g.measured} />
                    {g.note && <p>{g.note}</p>}
                    {g.workaround && <p>{g.workaround}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {entry.example?.css && (
            <section className="pg-doc-block">
              <h4>Example</h4>
              <pre className="pg-code">{entry.example.css}</pre>
            </section>
          )}
        </>
      )}
    </>
  );
}

/** Family-level guidance, shown at the top of a token page without a click. */
export function FamilyDoc({ path }: { path: string }) {
  const entry = model.tokens[path];
  if (!entry?.summary) return null;
  return (
    <div className="pg-family-doc">
      <p className="pg-family-summary">{entry.summary}</p>
      {entry.dont?.length ? (
        <p className="pg-family-dont">
          <strong>Not for:</strong> {entry.dont.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The system rules and every measured pairing — the part of the token
 * documentation that belongs to no single token, so no swatch can surface it.
 */
export function ContrastPage() {
  return (
    <>
      <section className="pg-section">
        <h2>Token rules</h2>
        <p className="pg-note">
          System-wide rules from <code>packages/tokens/src/contracts/system.json</code>. These are
          what <code>npm run vibe</code> scores generated component code against.
        </p>
        <ol className="pg-rules">
          {rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
      </section>

      <section className="pg-section">
        <h2>Verified contrast</h2>
        <p className="pg-note">
          Re-measured from the resolved values on every build — {pairings.length} pairings. A
          pairing that stops holding fails the build rather than shipping.
        </p>
        <table className="pg-table">
          <thead>
            <tr>
              <th>Foreground</th>
              <th>Background</th>
              <th>Requires</th>
              <th>Measured</th>
            </tr>
          </thead>
          <tbody>
            {pairings.map((p) => (
              <tr key={`${p.fg}|${p.bg}`}>
                <td>
                  <code>{p.fg}</code>
                </td>
                <td>
                  <code>{p.bg}</code>
                </td>
                <td>{p.requires}</td>
                <td>
                  <Ratios measured={p.measured} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="pg-section">
        <h2>Known gaps — do not use these combinations</h2>
        <ul className="pg-pairing-list pg-pairing-list--gaps">
          {knownGaps.map((g) => (
            <li key={`${g.fg}|${g.bg}`}>
              <div>
                <code>{g.fg}</code> on <code>{g.bg}</code>
                <span className="pg-requires">below {g.below}</span>
                <Ratios measured={g.measured} />
              </div>
              {g.note && <p>{g.note}</p>}
              {g.workaround && (
                <p>
                  <strong>Instead:</strong> {g.workaround}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** Per-component token recipes, the same ones TOKENS.md renders. */
export function RecipeList() {
  return (
    <>
      {Object.entries(model.recipes).map(([name, recipe]) => (
        <div className="pg-recipe" key={name}>
          <div className="pg-ramp-title">{name}</div>
          {recipe.summary && <p className="pg-note">{recipe.summary}</p>}
          <table className="pg-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Token</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(recipe.tokens).map(([property, token]) => (
                <tr key={property}>
                  <td>{property}</td>
                  <td>
                    <code>{token}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
