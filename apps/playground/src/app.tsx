import { Suspense, lazy, useEffect, useState } from "react";
import { MobileNav, Search, SegmentedControl, SideNav, Spinner, TopNav } from "@rata/react";
import { tokens } from "@rata/tokens";
import { TokenDoc, FamilyDoc, ContrastPage, RecipeList } from "./token-docs.js";
// The nav needs a name and a title per component. It used to get them from
// `contracts.json`, which is 340kB of every decision, prop and worked example
// in the system — all of it in the chunk that loads before anything appears.
// This generated index is 1.6kB and comes out of the same contracts, so the
// staleness check that covers the doc pages covers it too.
import componentIndex from "../../../docs/components/index.json";

// Everything that actually reads a contract is behind a lazy boundary, which
// is what keeps contracts.json out of the first chunk. The boundary is by
// NAME rather than by contract for exactly that reason — see
// ComponentPageByName.
const ComponentIndexPage = lazy(() =>
  import("./component-page.js").then((m) => ({ default: m.ComponentIndex })),
);
const ComponentPageByName = lazy(() =>
  import("./component-page.js").then((m) => ({ default: m.ComponentPageByName })),
);
import { componentName, componentPage, hrefFor, parseLocation } from "./routing.js";
import { AccentSwitcher, DEFAULT_ACCENT } from "./accent-switcher.js";
import type { Scheme } from "./accent-switcher.js";
import type { ComponentTab, Page } from "./routing.js";

// One page per category, primitives and semantics merged into one flowing
// view (no sub-split). All token categories nest under one "Foundation"
// group; components nest under a second group, one page per component rather
// than one long scroll — a component's demo, props, contract and token recipe
// belong together and nowhere near another component's.
// The old standalone "Foundations" category (elevation/border/opacity/
// size.control/state/focus — the miscellaneous primitives with no family of
// their own) is renamed "Misc" here specifically to avoid colliding with
// the new parent group's name.
//
// `Page`, and the URL each one has, live in ./routing.ts.

interface NavLeaf {
  id: Page;
  label: string;
}

interface NavItem {
  id: string;
  label: string;
  children?: NavLeaf[];
  page?: Page; // set only on flat, directly-navigable items (no children)
}

const NAV: NavItem[] = [
  {
    id: "foundation",
    label: "Foundation",
    children: [
      { id: "color", label: "Color" },
      { id: "spacing", label: "Spacing" },
      { id: "radius", label: "Radius" },
      { id: "typography", label: "Typography" },
      { id: "motion", label: "Motion" },
      { id: "misc", label: "Misc" },
      { id: "contrast", label: "Rules & contrast" },
    ],
  },
  {
    id: "components",
    label: "Components",
    children: [
      { id: "components", label: "All components" },
      ...componentIndex.map((contract) => ({
        id: componentPage(contract.name),
        label: contract.title,
      })),
    ],
  },
  { id: "recipes", label: "Token recipes", page: "recipes" },
];

// ---- Token preview helpers ---------------------------------------------
// Everything below reads straight from the built `tokens` object (light-theme
// values, static) except theme semantics (color + elevation), which render
// via var(--rata-theme-*) so they stay theme-reactive when the toggle above is used.

// Every swatch is a button that opens its contract in the inspector rail.
// A swatch shows what a token looks like; the contract is the only place that
// says what it is for — so the two belong one click apart, not one document
// apart.
function SwatchButton({
  path,
  onInspect,
  children,
}: {
  path: string;
  onInspect: (path: string) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="pg-swatch-button rata-state-layer rata-state-layer--flush"
      onClick={() => onInspect(path)}
      aria-label={`Documentation for ${path}`}
    >
      {children}
    </button>
  );
}

/**
 * Read CSS custom properties off the document as they are *currently*
 * resolved.
 *
 * The imported token object is the base theme's build output, so painting a
 * swatch from it shows base's value no matter which brand is applied — which
 * is how the Colors page came to show a blue accent ramp under a red brand.
 * `color.accent.*` is generated from the accent seed, so its value depends on
 * the theme in the DOM, and the only source that knows the applied value is
 * the DOM itself.
 *
 * `revision` is what makes this re-read: the accent and the scheme both live
 * in attributes on <html>, and changing an attribute fires no React update, so
 * the caller passes the pair it just set.
 */
function useComputedVars(varNames: string[], revision: string): Record<string, string> {
  const key = varNames.join(",");
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const computed = getComputedStyle(document.documentElement);
    const next: Record<string, string> = {};
    for (const name of varNames) {
      const value = computed.getPropertyValue(name).trim();
      if (value) next[name] = value.toLowerCase();
    }
    setValues(next);
    // varNames is rebuilt each render, so the joined key stands in for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision]);

  return values;
}

function ColorRamp({
  title,
  ramp,
  basePath,
  revision,
  onInspect,
}: {
  title: string;
  ramp: Record<string, string>;
  basePath: string;
  /** Changes whenever the applied accent or scheme does, to force a re-read. */
  revision: string;
  onInspect: (path: string) => void;
}) {
  const steps = Object.keys(ramp);
  const varFor = (step: string) => `--rata-${basePath.replaceAll(".", "-")}-${step}`;
  const applied = useComputedVars(
    steps.map(varFor),
    revision
  );

  return (
    <div>
      <div className="pg-ramp-title">{title}</div>
      <div className="pg-swatches">
        {steps.map((step) => {
          const name = varFor(step);
          // The built value is the fallback for the first paint, before the
          // effect has read the applied one — never the thing displayed once
          // the real value is known.
          const shown = applied[name] ?? ramp[step] ?? "";
          return (
            <SwatchButton key={step} path={`${basePath}.${step}`} onInspect={onInspect}>
              <div className="pg-swatch" style={{ background: `var(${name})` }} />
              <div className="pg-swatch-name">
                {step} · {shown}
              </div>
            </SwatchButton>
          );
        })}
      </div>
    </div>
  );
}

function SemanticSwatches({
  title,
  keys,
  cssVarPrefix,
  onInspect,
}: {
  title: string;
  keys: string[];
  cssVarPrefix: string;
  onInspect: (path: string) => void;
}) {
  return (
    <div>
      <div className="pg-ramp-title">{title}</div>
      <div className="pg-swatches">
        {keys.map((key) => (
          <SwatchButton key={key} path={`theme.${cssVarPrefix}.${key}`} onInspect={onInspect}>
            <div className="pg-swatch" style={{ background: `var(--rata-theme-${cssVarPrefix}-${key})` }} />
            <div className="pg-swatch-name">{key}</div>
          </SwatchButton>
        ))}
      </div>
    </div>
  );
}

function ElevationSwatches({
  title,
  keys,
  onInspect,
}: {
  title: string;
  keys: string[];
  onInspect: (path: string) => void;
}) {
  return (
    <div>
      <div className="pg-ramp-title">{title}</div>
      <div className="pg-swatches">
        {keys.map((key) => (
          <SwatchButton key={key} path={`theme.elevation.${key}`} onInspect={onInspect}>
            <div
              className="pg-swatch pg-swatch--elevation"
              style={{ boxShadow: `var(--rata-theme-elevation-${key})` }}
            />
            <div className="pg-swatch-name">{key}</div>
          </SwatchButton>
        ))}
      </div>
    </div>
  );
}

// Reads each role's `ring` field (validation/selection state — inset shadow,
// not a fill), which SemanticSwatches above deliberately skips since it
// assumes every key is a background color.
function RingSwatches({
  title,
  roles,
  onInspect,
}: {
  title: string;
  roles: string[];
  onInspect: (path: string) => void;
}) {
  return (
    <div>
      <div className="pg-ramp-title">{title}</div>
      <div className="pg-swatches">
        {roles.map((role) => (
          <SwatchButton key={role} path={`theme.${role}.ring`} onInspect={onInspect}>
            <div
              className="pg-swatch pg-swatch--elevation"
              style={{ boxShadow: `var(--rata-theme-${role}-ring)` }}
            />
            <div className="pg-swatch-name">{role}</div>
          </SwatchButton>
        ))}
      </div>
    </div>
  );
}

function SpaceBars({ title, items }: { title: string; items: Array<[string, string]> }) {
  const max = Math.max(...items.map(([, v]) => parseFloat(v)));
  return (
    <div>
      <div className="pg-ramp-title">{title}</div>
      {items.map(([name, value]) => (
        <div className="pg-bar-row" key={name}>
          <span className="pg-bar-label">{name}</span>
          <span className="pg-bar-track">
            <span className="pg-bar" style={{ width: `${(parseFloat(value) / max) * 100}%` }} />
          </span>
          <span className="pg-bar-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

function RadiusPreviews({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <div>
      <div className="pg-ramp-title">{title}</div>
      <div className="pg-radii">
        {items.map(([name, value]) => (
          <div className="pg-radius-item" key={name}>
            <div className="pg-radius-preview" style={{ borderRadius: value }} />
            <div className="pg-swatch-name">
              {name} · {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TypeSamples({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <div>
      <div className="pg-ramp-title">{title}</div>
      {items.map(([name, size]) => (
        <div className="pg-type-sample-row" key={name}>
          <span className="pg-bar-label">{name}</span>
          <span className="pg-bar-value">{size}</span>
          <span className="pg-type-sample-text" style={{ fontSize: size }}>
            The quick brown fox jumps over the lazy dog
          </span>
        </div>
      ))}
    </div>
  );
}

function MotionTrack({ name, duration, easing }: { name: string; duration: string; easing: string }) {
  return (
    <div className="pg-motion-item">
      <span className="pg-bar-label">{name}</span>
      <div className="pg-motion-track">
        <div
          className="pg-motion-chip"
          style={{ transitionDuration: duration, transitionTimingFunction: easing }}
        />
      </div>
      <span className="pg-bar-value">{duration}</span>
    </div>
  );
}

// space.json's raw steps live alongside its semantic sub-objects (gap/stack/
// padding/section/control/page/size) under the same top-level key — pulled
// out explicitly here rather than walked generically, since the mixed shape
// isn't safely iterable with Object.entries().
const spacePrimitives: Array<[string, string]> = [
  ["0", tokens.space["0"]],
  ["0-5", tokens.space["0-5"]],
  ["1", tokens.space["1"]],
  ["1-5", tokens.space["1-5"]],
  ["2", tokens.space["2"]],
  ["3", tokens.space["3"]],
  ["4", tokens.space["4"]],
  ["5", tokens.space["5"]],
  ["6", tokens.space["6"]],
  ["7", tokens.space["7"]],
  ["8", tokens.space["8"]],
  ["9", tokens.space["9"]],
  ["10", tokens.space["10"]],
  ["11", tokens.space["11"]],
  ["12", tokens.space["12"]],
];

// radius.json's primitive + semantic entries all end up as flat sibling
// strings on tokens.radius (no nested sub-objects) — merged into one list,
// same treatment as everything else on this page now.
// The radius scale is generated from a base unit and a step table now, so
// there is no separate raw sm/md/lg ramp underneath these role names —
// see packages/tokens/src/themes/base.mjs.
const radiusNames = ["none", "inner", "element", "container", "chat", "page", "pill"] as const;

/**
 * What a lazy page shows while its chunk arrives. The system's own Spinner,
 * named, because an unnamed one announces nothing — and on a fast connection
 * this is never seen at all, which is the point of the chunk being small.
 */
function PageSpinner() {
  return (
    <div className="pg-page-spinner">
      <Spinner label="Loading" />
    </div>
  );
}

export function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  // Which of the five accent options is applied. The value is a theme slug,
  // and setting it on the document is the entire switch — see accent-switcher.
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [route, setRoute] = useState(() =>
    parseLocation(window.location.pathname, window.location.search)
  );
  const [search, setSearch] = useState("");
  const [inspecting, setInspecting] = useState<string | null>(null);

  const { page, tab } = route;

  // Every page has an address, so the back button and a pasted link both work.
  // pushState rather than a router dependency: there are three URL shapes and
  // no nested layouts, so a router would be more code than the thing it routes.
  function navigate(nextPage: Page, nextTab: ComponentTab = "overview") {
    window.history.pushState(null, "", hrefFor(nextPage, nextTab));
    setRoute({ page: nextPage, tab: nextTab });
    setInspecting(null);
    window.scrollTo({ top: 0 });
  }

  useEffect(() => {
    const onPopState = () =>
      setRoute(parseLocation(window.location.pathname, window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    // `rataTheme`, which writes data-rata-theme — the attribute every brand
    // stylesheet is scoped to. It read `dsTheme` until now, a survivor of the
    // rename: that pass searched for the literal string "data-ds-theme", and
    // the camelCase dataset key does not contain it. So the attribute being
    // set and the attribute being matched had different names, and no brand
    // theme applied at all — the switcher moved its own swatches (each carries
    // the attribute itself) while the page behind them never changed.
    document.documentElement.dataset.rataTheme = accent;
  }, [accent]);

  // Both the accent and the scheme are applied as attributes on <html>, which
  // React does not observe. Anything that reads a *resolved* token value off
  // the document re-reads when this changes.
  const paintRevision = `${accent}:${theme}`;

  // The URL the app booted on may not be the one it landed on (an unknown path
  // falls back to the default page), so make the address bar agree with what is
  // actually rendered rather than leaving a link that lies.
  useEffect(() => {
    const canonical = hrefFor(page, tab);
    if (window.location.pathname + window.location.search !== canonical) {
      window.history.replaceState(null, "", canonical);
    }
  }, [page, tab]);

  const activeName = componentName(page);

  const query = search.trim().toLowerCase();

  const filteredNav = query
    ? NAV.flatMap((item) => {
        if (item.children) {
          const groupMatches = item.label.toLowerCase().includes(query);
          const childMatches = item.children.filter((c) => c.label.toLowerCase().includes(query));
          if (!groupMatches && childMatches.length === 0) return [];
          return [{ ...item, children: groupMatches ? item.children : childMatches }];
        }
        return item.label.toLowerCase().includes(query) ? [item] : [];
      })
    : NAV;

  /**
   * The nav, in SideNav's shape.
   *
   * Each top-level group becomes a labelled section, which is what they
   * already were — the hand-rolled version expanded and collapsed them, but a
   * labelled section says the same thing to a screen reader without a button
   * to press. A leaf with no children becomes a one-item unlabelled section.
   *
   * `onClick` is where this stopped being possible before: the rows navigate
   * client-side, and until nav items could intercept their own click there
   * was no way to use SideNav here without a full page load. The `href` is
   * still real, so middle-click and copy-address still work.
   */
  const go = (target: Page) => (event: { preventDefault(): void }) => {
    event.preventDefault();
    navigate(target);
  };

  const navSections = filteredNav.map((item) =>
    item.children
      ? {
          label: item.label,
          items: item.children.map((leaf) => ({
            label: leaf.label,
            href: hrefFor(leaf.id),
            current: page === leaf.id,
            onClick: go(leaf.id),
          })),
        }
      : {
          items: [
            {
              label: item.label,
              href: hrefFor(item.page!),
              current: page === item.page,
              onClick: go(item.page!),
            },
          ],
        }
  );

  return (
    <div className="pg-app">
      {/* The playground's own chrome, built from the system it documents.
          Every hand-rolled equivalent that used to live here — a bare input
          with a ⌕ character for the search, buttons with a ⌄ span for the
          nav, an h1 and a div for the header — is now the real component, so
          a regression in any of them shows up on every page rather than
          waiting for someone to open that component's page. */}
      {/* No `items` and so no nav landmark: this product's navigation lives in
          the rail, and a second, empty one in the bar would appear in a
          landmark list promising destinations it does not have. No `label`
          either, for the same reason — and because the rail is already called
          "Sections", and two navigation landmarks sharing a name is the exact
          thing TopNav's own contract warns about. */}
      <TopNav
        className="pg-header"
        brand={
          <span className="pg-brand">
            {/* Decorative, because the wordmark beside it already names the
                product. TopNav's contract warns that an image in this slot
                needs its own alt text — it does, and for a mark paired with
                the name the correct alt text is empty. Giving it "Ratā" here
                would have a screen reader read the product twice. */}
            <img className="pg-brand-mark" src="/rata-icon.svg" alt="" />
            <strong className="pg-brand-name">Ratā</strong>
          </span>
        }
        actions={
          <>
            <MobileNav
              className="pg-drawer-trigger"
              title="Ratā"
              label="Sections"
              sections={navSections}
            />
            {/* The accent seed drives every generated colour token, so it sits
                next to the scheme toggle: both re-theme the whole page, and
                neither belongs to any one page's content. */}
            <AccentSwitcher value={accent} scheme={theme} onChange={setAccent} />
            {/* A SegmentedControl rather than a button that toggles. The
                button was labelled with the scheme you were NOT in — "Dark
                theme" while the page was light — which is the classic
                ambiguity of a toggle whose label describes its action rather
                than its state. Two named options with one marked is a
                question being answered, which is what this is. */}
            <SegmentedControl
              label="Colour scheme"
              size="sm"
              value={theme}
              onValueChange={(next) => setTheme(next as Scheme)}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </>
        }
      />

      <div className="pg-layout">
        <div className="pg-sidebar">
          <Search
            label="Search the system"
            placeholder="Search…"
            size="sm"
            value={search}
            onValueChange={setSearch}
          />

          {navSections.length > 0 ? (
            <SideNav label="Sections" sections={navSections} />
          ) : (
            <p className="pg-note">No matches.</p>
          )}
        </div>

        <main className="pg-main">
          {page === "color" && (
            <>
              <section className="pg-section">
                <h2>Color</h2>
                <p className="pg-section-lede">
                  Two layers, and the boundary between them is the point. Primitives are raw
                  material — the same value in light and dark, so a component that reaches for one
                  is broken in whichever scheme it was not designed in. Semantics are what
                  components actually use, and the only family whose value changes with the theme.
                  The data palette is the single documented exception.
                </p>
              </section>

              <section className="pg-section">
                <div className="pg-layer-head">
                  <h3>Primitives</h3>
                  <span className="pg-layer-tag">palette layer</span>
                </div>
                <FamilyDoc path="color" />
                <div className="pg-ramp-group">
                <ColorRamp title="neutral" ramp={tokens.color.neutral} basePath="color.neutral" revision={paintRevision} onInspect={setInspecting} />
                <ColorRamp title="accent" ramp={tokens.color.accent} basePath="color.accent" revision={paintRevision} onInspect={setInspecting} />
                <ColorRamp title="success" ramp={tokens.color.success} basePath="color.success" revision={paintRevision} onInspect={setInspecting} />
                <ColorRamp title="warning" ramp={tokens.color.warning} basePath="color.warning" revision={paintRevision} onInspect={setInspecting} />
                <ColorRamp title="danger" ramp={tokens.color.danger} basePath="color.danger" revision={paintRevision} onInspect={setInspecting} />
                </div>
                <p className="pg-note">
                  <code>color.accent.*</code> is the one ramp generated from the theme's accent
                  seed, so it moves with the brand; the rest are stated outright. Switch the accent
                  above and watch which of these change.
                </p>
              </section>

              <section className="pg-section">
                <div className="pg-layer-head">
                  <h3>Semantics</h3>
                  <span className="pg-layer-tag pg-layer-tag--semantic">theme.* — use these</span>
                </div>
                <p className="pg-section-lede">
                  One correct token per colour decision. If none of these fits, the theme needs a
                  new semantic token rather than a reach into the palette above.
                </p>
                <div className="pg-ramp-group">
                <SemanticSwatches title="bg" keys={Object.keys(tokens.theme.bg)} cssVarPrefix="bg" onInspect={setInspecting} />
                <SemanticSwatches title="fg" keys={Object.keys(tokens.theme.fg)} cssVarPrefix="fg" onInspect={setInspecting} />
                <SemanticSwatches
                  title="border"
                  keys={Object.keys(tokens.theme.border)}
                  cssVarPrefix="border" onInspect={setInspecting} />
                <SemanticSwatches
                  title="accent-role"
                  keys={Object.keys(tokens.theme["accent-role"]).filter((k) => k !== "ring")}
                  cssVarPrefix="accent-role" onInspect={setInspecting} />
                <SemanticSwatches
                  title="secondary-role"
                  keys={Object.keys(tokens.theme["secondary-role"])}
                  cssVarPrefix="secondary-role" onInspect={setInspecting} />
                <SemanticSwatches
                  title="tertiary-role"
                  keys={Object.keys(tokens.theme["tertiary-role"])}
                  cssVarPrefix="tertiary-role" onInspect={setInspecting} />
                <SemanticSwatches
                  title="success-role"
                  keys={Object.keys(tokens.theme["success-role"]).filter((k) => k !== "ring")}
                  cssVarPrefix="success-role" onInspect={setInspecting} />
                <SemanticSwatches
                  title="warning-role"
                  keys={Object.keys(tokens.theme["warning-role"]).filter((k) => k !== "ring")}
                  cssVarPrefix="warning-role" onInspect={setInspecting} />
                <SemanticSwatches
                  title="danger-role"
                  keys={Object.keys(tokens.theme["danger-role"]).filter((k) => k !== "ring")}
                  cssVarPrefix="danger-role" onInspect={setInspecting} />
                <RingSwatches
                  title="ring (accent/success/warning/danger-role)"
                  roles={["accent-role", "success-role", "warning-role", "danger-role"]} onInspect={setInspecting} />
                <div>
                  <div className="pg-ramp-title">focus-ring</div>
                  <div className="pg-swatches">
                    <SwatchButton path="theme.focus-ring" onInspect={setInspecting}>
                      <div className="pg-swatch" style={{ background: "var(--rata-theme-focus-ring)" }} />
                      <div className="pg-swatch-name">focus-ring</div>
                    </SwatchButton>
                  </div>
                </div>
                <ElevationSwatches title="elevation" keys={Object.keys(tokens.theme.elevation)} onInspect={setInspecting} />
                </div>
                <p className="pg-note">
                  Theme-reactive — try the light/dark toggle and the accent options above. Click any
                  swatch for its full contract: what it is for, what it is not for, and its measured
                  contrast.
                </p>
              </section>

              <section className="pg-section">
                <div className="pg-layer-head">
                  <h3>Data visualization</h3>
                  <span className="pg-layer-tag pg-layer-tag--semantic">base layer</span>
                </div>
                <FamilyDoc path="color.data" />
                <div className="pg-ramp-group">
                <ColorRamp title="data.categorical" ramp={tokens.color.data.categorical} basePath="color.data.categorical" revision={paintRevision} onInspect={setInspecting} />
                <ColorRamp title="data.blue" ramp={tokens.color.data.blue} basePath="color.data.blue" revision={paintRevision} onInspect={setInspecting} />
                <ColorRamp title="data.shamrock" ramp={tokens.color.data.shamrock} basePath="color.data.shamrock" revision={paintRevision} onInspect={setInspecting} />
                <ColorRamp title="data.orange" ramp={tokens.color.data.orange} basePath="color.data.orange" revision={paintRevision} onInspect={setInspecting} />
                <ColorRamp title="data.pink" ramp={tokens.color.data.pink} basePath="color.data.pink" revision={paintRevision} onInspect={setInspecting} />
                <ColorRamp title="data.purple" ramp={tokens.color.data.purple} basePath="color.data.purple" revision={paintRevision} onInspect={setInspecting} />
                <ColorRamp title="data.red" ramp={tokens.color.data.red} basePath="color.data.red" revision={paintRevision} onInspect={setInspecting} />
                <ColorRamp title="data.teal" ramp={tokens.color.data.teal} basePath="color.data.teal" revision={paintRevision} onInspect={setInspecting} />
                <ColorRamp title="data.yellow" ramp={tokens.color.data.yellow} basePath="color.data.yellow" revision={paintRevision} onInspect={setInspecting} />
                <ColorRamp title="data.gray" ramp={tokens.color.data.gray} basePath="color.data.gray" revision={paintRevision} onInspect={setInspecting} />
                </div>
                <p className="pg-note">
                  Scheme-independent like the primitives, but unlike them these are meant to be used
                  directly — a series colour is series identity, not a theme decision.
                </p>
              </section>
            </>
          )}

          {page === "spacing" && (
            <>
              <section className="pg-section">
                <h2>Spacing</h2>
                <FamilyDoc path="space" />
                <p className="pg-section-lede">
                  One family, two ways in. Unlike colour — where reaching into the palette is a
                  bug — a raw step is a legitimate choice here. The roles are simply the better one
                  when a role names the situation you are in.
                </p>
              </section>

              <section className="pg-section">
                <div className="pg-layer-head">
                  <h3>Scale</h3>
                  <span className="pg-layer-tag pg-layer-tag--neutral">raw steps</span>
                </div>
                <p className="pg-section-lede">
                  The base-4 scale every role below is built from. Use a step directly when no role
                  names what you are spacing.
                </p>
                <div className="pg-bars-group">
                  <SpaceBars title="space" items={spacePrimitives} />
                </div>
              </section>

              <section className="pg-section">
                <div className="pg-layer-head">
                  <h3>Named roles</h3>
                  <span className="pg-layer-tag pg-layer-tag--semantic">prefer these</span>
                </div>
                <p className="pg-section-lede">
                  Each of these names a spacing situation, so it survives a change to the scale
                  underneath it.
                </p>
                <div className="pg-bars-group">
                  <SpaceBars title="space.gap" items={Object.entries(tokens.space.gap)} />
                  <SpaceBars title="space.stack" items={Object.entries(tokens.space.stack)} />
                  <SpaceBars title="space.padding" items={Object.entries(tokens.space.padding)} />
                  <SpaceBars
                    title="space.control.padding-inline"
                    items={Object.entries(tokens.space.control["padding-inline"])}
                  />
                  <SpaceBars title="space.page" items={Object.entries(tokens.space.page)} />
                </div>
                <p className="pg-note">space.section (single value) = {tokens.space.section}</p>
              </section>
            </>
          )}

          {page === "radius" && (
            <section className="pg-section">
              <h2>Radius</h2>
              <FamilyDoc path="radius" />
              <RadiusPreviews title="radius" items={radiusNames.map((name) => [name, tokens.radius[name]])} />
            </section>
          )}

          {page === "typography" && (
            <section className="pg-section">
              <h2>Typography</h2>
              <FamilyDoc path="type" />
              {/* One geometric ramp now — font.size.* is generated from
                  {base, ratio}, so there is no second hand-listed scale
                  sitting beside it to show. */}
              <TypeSamples title="font.size" items={Object.entries(tokens.font.size)} />
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>font.weight</th>
                    <th>font.letter-spacing</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      {Object.entries(tokens.font.weight)
                        .map(([n, v]) => `${n}: ${v}`)
                        .join(" · ")}
                    </td>
                    <td>
                      {Object.entries(tokens.font["letter-spacing"])
                        .map(([n, v]) => `${n}: ${v}`)
                        .join(" · ")}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="pg-type-sample-row">
                <span className="pg-bar-label">type.heading</span>
                {/* The size column the generated-scale rows above also carry.
                    Without it the sample text on those rows and these started
                    84px apart on the same page — the label is 140px, the value
                    72px, and only one kind of row had both. */}
                <span className="pg-bar-value">{tokens.type.heading.size}</span>
                <span
                  className="pg-type-sample-text"
                  style={{
                    fontSize: tokens.type.heading.size,
                    fontWeight: tokens.type.heading.weight,
                    lineHeight: tokens.type.heading["line-height"],
                  }}
                >
                  The quick brown fox jumps over the lazy dog
                </span>
              </div>
              <div className="pg-type-sample-row">
                <span className="pg-bar-label">type.body</span>
                <span className="pg-bar-value">{tokens.type.body.size}</span>
                <span
                  className="pg-type-sample-text"
                  style={{
                    fontSize: tokens.type.body.size,
                    fontWeight: tokens.type.body.weight,
                    lineHeight: tokens.type.body["line-height"],
                  }}
                >
                  The quick brown fox jumps over the lazy dog
                </span>
              </div>
              <div className="pg-type-sample-row">
                <span className="pg-bar-label">type.label</span>
                <span className="pg-bar-value">{tokens.type.label.size}</span>
                <span
                  className="pg-type-sample-text"
                  style={{
                    fontSize: tokens.type.label.size,
                    fontWeight: tokens.type.label.weight,
                    lineHeight: tokens.type.label["line-height"],
                    letterSpacing: tokens.type.label["letter-spacing"],
                    textTransform: tokens.type.label["text-transform"] as "uppercase",
                  }}
                >
                  The quick brown fox jumps over the lazy dog
                </span>
              </div>
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>type.tracking</th>
                    <th>value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(tokens.type.tracking).map(([name, value]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td style={{ letterSpacing: value }}>{value} — tracked text</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {page === "motion" && (
            <section className="pg-section">
              <h2>Motion</h2>
              <FamilyDoc path="motion" />
              <div className="pg-motion-group">
                {Object.entries(tokens.motion.duration).map(([name, value]) => (
                  <MotionTrack
                    key={name}
                    name={name}
                    duration={value}
                    easing={tokens.motion.easing.standard}
                  />
                ))}
                <MotionTrack
                  name="interactive"
                  duration={tokens.motion.interactive.duration}
                  easing={tokens.motion.interactive.easing}
                />
                <MotionTrack
                  name="overlay"
                  duration={tokens.motion.overlay.duration}
                  easing={tokens.motion.overlay.easing}
                />
                <MotionTrack
                  name="modal"
                  duration={tokens.motion.modal.duration}
                  easing={tokens.motion.modal.easing}
                />
              </div>
              <p className="pg-note">hover each track</p>
            </section>
          )}

          {page === "misc" && (
            <section className="pg-section">
              <h2>Misc</h2>
              <div className="pg-elevation-row">
                {Object.entries(tokens.elevation).map(([name, value]) => (
                  <div key={name} className="pg-elevation-item">
                    <div className="pg-elevation-preview" style={{ boxShadow: value }} />
                    <div className="pg-swatch-name">{name}</div>
                  </div>
                ))}
              </div>
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>border (1 / 2 / 3)</td>
                    <td>
                      {tokens.border["1"]} / {tokens.border["2"]} / {tokens.border["3"]}
                    </td>
                  </tr>
                  <tr>
                    <td>border.default</td>
                    <td>{tokens.border.default}</td>
                  </tr>
                  <tr>
                    <td>opacity (8 / 12 / 50)</td>
                    <td>
                      {tokens.opacity["8"]} / {tokens.opacity["12"]} / {tokens.opacity["50"]}
                    </td>
                  </tr>
                  <tr>
                    <td>state (hover / press / disabled)</td>
                    <td>
                      {tokens.state["hover-opacity"]} / {tokens.state["press-opacity"]} /{" "}
                      {tokens.state["disabled-opacity"]}
                    </td>
                  </tr>
                  <tr>
                    <td>focus (ring-width / offset / style)</td>
                    <td>
                      {tokens.focus["ring-width"]} / {tokens.focus["ring-offset"]} /{" "}
                      {tokens.focus["ring-style"]}
                    </td>
                  </tr>
                  <tr>
                    <td>size.control (sm / md / lg)</td>
                    <td>
                      {tokens.size.control.sm} / {tokens.size.control.md} / {tokens.size.control.lg}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}

          {page === "contrast" && <ContrastPage />}

          {page === "recipes" && (
            <section className="pg-section">
              <h2>Token recipes</h2>
              <p className="pg-note">
                The exact token for every property of every component, from each component&rsquo;s
                registry manifest — including the ones not built yet, where the recipe is the spec.
              </p>
              <RecipeList />
            </section>
          )}

          {page === "components" && (
            <Suspense fallback={<PageSpinner />}>
              <ComponentIndexPage onOpen={(name) => navigate(componentPage(name))} />
            </Suspense>
          )}

          {/* Resolving the name to a contract is the lazy side's job: knowing
              a name is unknown requires knowing every known name, and that is
              the 340kB this boundary exists to defer. */}
          {activeName !== null && (
            <Suspense fallback={<PageSpinner />}>
              <ComponentPageByName name={activeName} tab={tab} onNavigate={navigate} />
            </Suspense>
          )}
        </main>
        {/* Rendered unconditionally, and given the selection rather than
            gated on it: on a narrow viewport this is a Sheet, and a <dialog>
            removed from the tree has no exit animation — it would disappear
            instead of leaving. TokenDoc returns null itself when there is
            nothing to show and it is not in sheet form. */}
        <TokenDoc path={inspecting} onClose={() => setInspecting(null)} />
      </div>
    </div>
  );
}
