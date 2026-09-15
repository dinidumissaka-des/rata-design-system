import { useEffect, useState } from "react";

/**
 * Subscribe to a media query.
 *
 * This lives in the app rather than in `@rata/react` on purpose. There are no
 * breakpoint tokens in this system, deliberately: where a rail stops fitting
 * depends on the rail's width and the page around it, which is the page's
 * knowledge. SideNav and MobileNav both say so in their contracts — neither
 * decides when it applies — so the playground owns its own breakpoint, and
 * this is where it reads it.
 */
export function useMediaQuery(query: string): boolean {
  // Read during the first render rather than in an effect. An effect-only
  // read paints the wide layout once on a narrow viewport and then swaps,
  // which is visible as a flash of the wrong thing.
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    // Re-read on subscribe as well as on change: the viewport can have moved
    // between the first render and this effect running, and nothing would
    // otherwise tell us.
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * The one breakpoint this app has, stated once.
 *
 * `60rem` is where the shell already changes hands — the side rail gives way
 * to MobileNav's drawer in `playground.css`. The token inspector changes from
 * a Panel to a Sheet at the same width, because a layout with two breakpoints
 * in it reads as a bug whichever one you are looking at.
 */
export const NARROW = "(max-width: 60rem)";
