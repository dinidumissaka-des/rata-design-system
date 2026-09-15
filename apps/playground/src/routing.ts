// URL ↔ page state. The playground is a single view with no router, but a
// component page is exactly the kind of thing people send each other a link to
// ("look at what Button's contract says about loading"), so every page and
// every tab has an address:
//
//   /                                       the default foundation page
//   /foundation/color                       one token category
//   /recipes                                token recipes
//   /components                             the component index
//   /components/button                      one component, overview
//   /components/button?tab=properties       …its props
//   /components/button?tab=accessibility    …its accessibility obligations
//
// Component segments are the registry's kebab-case names (`text-field`, not
// `TextField`), the same names `npm run ui -- list` prints — one spelling for a
// component everywhere, including in a URL.

export type TokenPage =
  // The landing page, at `/`. It is a destination rather than a redirect to
  // the first token category: arriving at a design system and being dropped
  // into Color answers a question nobody asked.
  | "home"
  // The two category overviews the top nav points at. They are destinations in
  // their own right rather than redirects to a first child: a reader arriving
  // from the top nav wants to see what the category contains, and sending them
  // straight to Color would answer a question they had not asked.
  | "foundation"
  | "color"
  | "spacing"
  | "radius"
  | "typography"
  | "motion"
  | "misc"
  | "contrast"
  | "recipes"
  | "components";

/**
 * A component's page id is its registry name behind a `component:` prefix, so
 * routing needs no second list to stay in step with the registry: the nav is
 * built from the same contracts the pages render.
 */
export type Page = TokenPage | `component:${string}`;

export type ComponentTab = "overview" | "properties" | "accessibility";

export const COMPONENT_TABS: Array<{ id: ComponentTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "properties", label: "Properties" },
  { id: "accessibility", label: "Accessibility" },
];

const TOKEN_PAGES = new Set<string>([
  "color",
  "spacing",
  "radius",
  "typography",
  "motion",
  "misc",
  "contrast",
]);

/**
 * Where `/` lands, and where anything unrecognised falls back to.
 *
 * It was `color`, which meant the root canonicalised itself to
 * /foundation/color and the playground had no front door.
 */
export const DEFAULT_PAGE: Page = "home";

export const componentPage = (name: string): Page => `component:${name}`;

export const componentName = (page: Page): string | null =>
  page.startsWith("component:") ? page.slice("component:".length) : null;

/** The address of a page — `overview` is the bare URL, since it is the default tab. */
export function hrefFor(page: Page, tab: ComponentTab = "overview"): string {
  const name = componentName(page);
  if (name) return `/components/${name}${tab === "overview" ? "" : `?tab=${tab}`}`;
  if (page === "home") return "/";
  if (page === "foundation") return "/foundation";
  if (page === "components") return "/components";
  if (page === "recipes") return "/recipes";
  return `/foundation/${page}`;
}

/** The inverse. Anything unrecognized falls back to the default page rather than a 404 screen. */
export function parseLocation(pathname: string, search: string): { page: Page; tab: ComponentTab } {
  const segments = pathname.split("/").filter(Boolean);
  const raw = new URLSearchParams(search).get("tab");
  const tab = COMPONENT_TABS.some((t) => t.id === raw) ? (raw as ComponentTab) : "overview";

  if (segments[0] === "components") {
    return { page: segments[1] ? componentPage(segments[1]) : "components", tab };
  }
  if (segments[0] === "recipes") return { page: "recipes", tab };
  if (segments[0] === "foundation") {
    // A bare /foundation is the category overview. An unrecognised child falls
    // through to the default page below rather than 404ing, which is the same
    // bargain the rest of this function makes.
    if (!segments[1]) return { page: "foundation", tab };
    if (TOKEN_PAGES.has(segments[1])) return { page: segments[1] as Page, tab };
  }
  return { page: DEFAULT_PAGE, tab };
}
