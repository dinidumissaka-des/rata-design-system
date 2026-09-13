import { describe, expect, test, vi, afterEach, beforeAll } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Star } from "@rata/icons";
import { Button } from "./button.js";
import { TopNav } from "./top-nav.js";
import { installPopoverShim } from "./test-support.js";

// The disclosure panel is a popover, which jsdom does not implement. See
// test-support.ts for what the shim does and does not pretend to have.
beforeAll(installPopoverShim);

afterEach(cleanup);

const ITEMS = [
  { label: "Invoices", href: "/invoices", current: true },
  { label: "Clients", href: "/clients" },
  { label: "Reports", href: "/reports" },
];

describe("TopNav", () => {
  test("is the page's banner, with a named nav landmark inside it", () => {
    render(<TopNav items={ITEMS} />);
    const banner = screen.getByRole("banner");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(banner.contains(nav)).toBe(true);
    // The banner itself is unnamed: a page has one.
    expect(banner.getAttribute("aria-label")).toBeNull();
  });

  test("label renames the nav, for a page with a side nav too", () => {
    render(<TopNav items={ITEMS} label="Sections" />);
    expect(screen.getByRole("navigation", { name: "Sections" })).toBeTruthy();
  });

  test("destinations are a list of links, in order", () => {
    render(<TopNav items={ITEMS} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual([
      "Invoices",
      "Clients",
      "Reports",
    ]);
  });

  test("the current page is announced, not only coloured", () => {
    render(<TopNav items={ITEMS} />);
    expect(screen.getByRole("link", { name: "Invoices" }).getAttribute("aria-current")).toBe(
      "page"
    );
    for (const name of ["Clients", "Reports"]) {
      expect(screen.getByRole("link", { name }).getAttribute("aria-current")).toBeNull();
    }
  });

  test("nothing is current when nothing says it is", () => {
    render(<TopNav items={[{ label: "Clients", href: "/clients" }]} />);
    expect(screen.getByRole("link", { name: "Clients" }).getAttribute("aria-current")).toBeNull();
  });

  test("every link is its own tab stop — a nav is not a menubar", () => {
    render(<TopNav items={ITEMS} />);
    // Roving tabindex would promise arrow-key navigation this does not have.
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("tabindex")).toBeNull();
    }
  });

  test("brand and actions sit OUTSIDE the nav landmark", () => {
    render(
      <TopNav
        items={ITEMS}
        brand={<a href="/">Ratā</a>}
        actions={<Button>New invoice</Button>}
      />
    );
    const nav = screen.getByRole("navigation");
    // A logo is not a destination even when it links home, and an account
    // menu is not one at all.
    expect(nav.contains(screen.getByRole("link", { name: "Ratā" }))).toBe(false);
    expect(nav.contains(screen.getByRole("button", { name: "New invoice" }))).toBe(false);
    // Both are still in the banner.
    const banner = screen.getByRole("banner");
    expect(banner.contains(screen.getByRole("button", { name: "New invoice" }))).toBe(true);
  });

  test("no brand or actions renders no empty slots", () => {
    const { container } = render(<TopNav items={ITEMS} />);
    expect(container.querySelector(".rata-top-nav-brand")).toBeNull();
    expect(container.querySelector(".rata-top-nav-actions")).toBeNull();
  });

  test("an item's icon is decorative — the label is the link text", () => {
    const { container } = render(
      <TopNav items={[{ label: "Starred", href: "/starred", icon: Star }]} />
    );
    expect(screen.getByRole("link", { name: "Starred" })).toBeTruthy();
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });

  test("passes the rest through, so the banner can be identified or made sticky", () => {
    render(<TopNav items={ITEMS} id="banner" data-testid="b" />);
    const banner = screen.getByRole("banner");
    expect(banner.id).toBe("banner");
    expect(banner.getAttribute("data-testid")).toBe("b");
  });

  test("onClick intercepts the navigation, and the row stays a real link", async () => {
    const onClick = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(<TopNav items={[{ label: "Invoices", href: "/invoices", onClick }]} />);
    const link = screen.getByRole("link", { name: "Invoices" });
    await userEvent.click(link);
    expect(onClick).toHaveBeenCalledOnce();
    expect(link.getAttribute("href")).toBe("/invoices");
  });

  describe("a destination with sub-destinations", () => {
    const WITH_PANEL = [
      { label: "Invoices", href: "/invoices" },
      {
        label: "Reports",
        current: true,
        items: [
          { label: "Revenue", href: "/reports/revenue", current: true },
          { label: "Ageing", href: "/reports/ageing" },
        ],
      },
    ];

    test("is a disclosure button, NOT a menu", async () => {
      render(<TopNav items={WITH_PANEL} />);
      const trigger = screen.getByRole("button", { name: /Reports/ });
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      expect(trigger.getAttribute("aria-controls")).toBeTruthy();
      // The mistake this shape exists to prevent: role="menu" announces a
      // keyboard model a list of links does not have.
      expect(trigger.getAttribute("role")).toBeNull();
      await userEvent.click(trigger);
      expect(screen.queryByRole("menu")).toBeNull();
      expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
    });

    test("the panel holds ordinary links, each its own tab stop", async () => {
      render(<TopNav items={WITH_PANEL} />);
      await userEvent.click(screen.getByRole("button", { name: /Reports/ }));
      const revenue = screen.getByRole("link", { name: "Revenue" });
      expect(revenue.getAttribute("tabindex")).toBeNull();
      expect(screen.getByRole("link", { name: "Ageing" })).toBeTruthy();
    });

    test("the panel is named by its trigger", async () => {
      render(<TopNav items={WITH_PANEL} />);
      const trigger = screen.getByRole("button", { name: /Reports/ });
      await userEvent.click(trigger);
      const panel = document.getElementById(trigger.getAttribute("aria-controls")!)!;
      expect(panel.getAttribute("aria-labelledby")).toBe(trigger.id);
    });

    test("its links stay inside the nav landmark, despite the top layer", async () => {
      // The accessibility tree follows the document, not the paint order.
      render(<TopNav items={WITH_PANEL} />);
      await userEvent.click(screen.getByRole("button", { name: /Reports/ }));
      const nav = screen.getByRole("navigation");
      expect(nav.contains(screen.getByRole("link", { name: "Revenue" }))).toBe(true);
    });

    test("Escape closes it and hands focus back to the trigger", async () => {
      render(<TopNav items={WITH_PANEL} />);
      const trigger = screen.getByRole("button", { name: /Reports/ });
      await userEvent.click(trigger);
      await userEvent.keyboard("{Escape}");
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(trigger);
    });

    test("the trigger toggles it shut again", async () => {
      render(<TopNav items={WITH_PANEL} />);
      const trigger = screen.getByRole("button", { name: /Reports/ });
      await userEvent.click(trigger);
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      await userEvent.click(trigger);
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });

    test("two kinds of current: the page, and the area leading to it", async () => {
      render(<TopNav items={WITH_PANEL} />);
      const trigger = screen.getByRole("button", { name: /Reports/ });
      // Not "page" — you are not on this one, you are inside the area.
      expect(trigger.getAttribute("aria-current")).toBe("true");
      await userEvent.click(trigger);
      expect(screen.getByRole("link", { name: "Revenue" }).getAttribute("aria-current")).toBe(
        "page"
      );
    });

    test("each panel gets its own anchor name, so two do not collide", () => {
      render(
        <TopNav
          items={[
            { label: "A", items: [{ label: "A1", href: "/a1" }] },
            { label: "B", items: [{ label: "B1", href: "/b1" }] },
          ]}
        />
      );
      const names = screen
        .getAllByRole("button")
        .map((b) => b.style.getPropertyValue("--rata-top-nav-anchor"));
      expect(names[0]).toMatch(/^--rata-top-nav-/);
      expect(names[0]).not.toBe(names[1]);
    });

    test("an entry with items needs no href", () => {
      render(<TopNav items={[{ label: "Reports", items: [{ label: "R", href: "/r" }] }]} />);
      // It reveals rather than navigates, so there is nothing to point at.
      expect(screen.getByRole("button", { name: /Reports/ })).toBeTruthy();
      expect(screen.queryByRole("link", { name: "Reports" })).toBeNull();
    });

    test("an empty items array is still just a link", () => {
      render(<TopNav items={[{ label: "Reports", href: "/reports", items: [] }]} />);
      expect(screen.getByRole("link", { name: "Reports" })).toBeTruthy();
      expect(screen.queryByRole("button")).toBeNull();
    });
  });
});
