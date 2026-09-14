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
import { Panel, Sheet } from "@rata/react";
import { NARROW, useMediaQuery } from "./use-media-query.js";
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
 * The full contract for one token, in whichever container fits.
 *
 * THIS IS THE PAIR PANEL AND SHEET WERE SPLIT FOR. On a wide viewport the
 * documentation is a Panel: in the layout, beside the swatch grid, because
 * reading a token's contract against the swatches still on screen is the
 * whole task. Narrow, there is no column to give it — so the same content
 * becomes a bottom Sheet, which covers the grid it can no longer sit beside
 * and is modal about it, as anything covering the page has to be.
 *
 * Nothing but the container changes. `TokenDocBody` is rendered by both.
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

  if (narrow) {
    return (
      <Sheet
        open={path !== null}
        onClose={() => onClose()}
        edge="block-end"
        size="lg"
        title={<code>{shown ?? ""}</code>}
        dismissLabel={shown === null ? "Close" : `Close documentation for ${shown}`}
      >
        {shown !== null && <TokenDocBody path={shown} />}
      </Sheet>
    );
  }

  if (path === null) return null;

  return (
    // This rail was hand-rolled until Panel existed: its own <aside>, its own
    // head, its own close button with its own focus ring, and `width: 340px`
    // — a bare pixel value in a repo whose first rule is that there are none.
    // What is left here is placement, which is what Panel's contract says the
    // page owns.
    <Panel
      className="pg-inspector"
      title={<code>{path}</code>}
      headingLevel={3}
      onClose={onClose}
      // Not "Close": the page can have this open beside a grid of swatches,
      // and a control named for the thing it closes is the difference between
      // a useful announcement and "button".
      closeLabel={`Close documentation for ${path}`}
    >
      <TokenDocBody path={path} />
    </Panel>
  );
}

/** The documentation itself, identical in both containers. */
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
