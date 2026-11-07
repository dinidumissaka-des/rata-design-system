import { describe, expect, test, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Search, Settings, User, Star } from "@rata/icons";
import { BottomNav } from "./bottom-nav.js";
import type { BottomNavItem } from "./bottom-nav.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const items: BottomNavItem[] = [
  { label: "Home", href: "/", icon: Star, current: true },
  { label: "Search", href: "/search", icon: Search },
  { label: "Inbox", href: "/inbox", icon: Settings, badge: { count: 3, label: "3 unread messages" } },
  { label: "Profile", href: "/me", icon: User },
];

describe("BottomNav", () => {
  test("is a navigation landmark named Main by default, holding a list of links", () => {
    render(<BottomNav items={items} />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    const list = within(nav).getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
  });

  test("label renames the landmark", () => {
    render(<BottomNav items={items} label="Sections" />);
    expect(screen.getByRole("navigation", { name: "Sections" })).toBeTruthy();
  });

  test("the current item, and only it, carries aria-current=page", () => {
    render(<BottomNav items={items} />);
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Search" }).hasAttribute("aria-current")).toBe(false);
  });

  test("every item is a real link with its href, and its icon is decorative", () => {
    render(<BottomNav items={items} />);
    const link = screen.getByRole("link", { name: "Search" });
    expect(link.getAttribute("href")).toBe("/search");
    expect(link.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });

  test("a badge's words join the link's name, and the visible count is hidden", () => {
    render(<BottomNav items={items} />);
    const link = screen.getByRole("link", { name: /^Inbox\s*,\s*3 unread messages$/ });
    const mark = link.querySelector(".rata-bottom-nav-badge")!;
    expect(mark.getAttribute("aria-hidden")).toBe("true");
    expect(mark.textContent).toBe("3");
  });

  test("a count over 99 shows 99+, and the label keeps the real number", () => {
    render(
      <BottomNav
        items={[
          ...items.slice(0, 2),
          { label: "Inbox", href: "/inbox", icon: Settings, badge: { count: 120, label: "120 unread messages" } },
        ]}
      />
    );
    const link = screen.getByRole("link", { name: /120 unread messages/ });
    expect(link.querySelector(".rata-bottom-nav-badge")!.textContent).toBe("99+");
  });

  test("a badge with no count is a dot, still named by its label", () => {
    render(
      <BottomNav
        items={[
          ...items.slice(0, 2),
          { label: "Updates", href: "/updates", icon: Star, badge: { label: "New updates" } },
        ]}
      />
    );
    const link = screen.getByRole("link", { name: /^Updates\s*,\s*New updates$/ });
    const mark = link.querySelector(".rata-bottom-nav-badge")!;
    expect(mark.className).toContain("rata-bottom-nav-badge--dot");
    expect(mark.textContent).toBe("");
  });

  test("onClick routes client-side while the item stays a link", () => {
    const onClick = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(
      <BottomNav
        items={[{ ...items[0]!, onClick }, items[1]!, items[3]!]}
      />
    );
    const link = screen.getByRole("link", { name: "Home" });
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(link.getAttribute("href")).toBe("/");
  });

  test("items compose the state layer, flush because they have no border", () => {
    render(<BottomNav items={items} />);
    const link = screen.getByRole("link", { name: "Profile" });
    expect(link.className).toContain("rata-state-layer");
    expect(link.className).toContain("rata-state-layer--flush");
  });

  test("warns in development outside three to five items, and not inside", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<BottomNav items={items} />);
    expect(warn).not.toHaveBeenCalled();
    cleanup();
    render(<BottomNav items={items.slice(0, 2)} />);
    expect(warn).toHaveBeenCalledTimes(1);
    cleanup();
    const six = Array.from({ length: 6 }, (_, i) => ({ label: `S${i}`, href: `/${i}`, icon: Star }));
    render(<BottomNav items={six} />);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
