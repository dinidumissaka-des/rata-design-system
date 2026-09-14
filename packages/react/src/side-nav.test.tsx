import { describe, expect, test, vi, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/react";
import { Star } from "@rata/icons";
import { SideNav } from "./side-nav.js";

afterEach(cleanup);

const GROUPED = [
  {
    label: "Billing",
    items: [
      { label: "Invoices", href: "/invoices", current: true },
      { label: "Credit notes", href: "/credit-notes" },
    ],
  },
  { label: "Setup", items: [{ label: "Tax rates", href: "/tax" }] },
];

describe("SideNav", () => {
  test("is a named navigation landmark, and nothing more", () => {
    render(<SideNav label="Invoices" sections={GROUPED} />);
    expect(screen.getByRole("navigation", { name: "Invoices" })).toBeTruthy();
    // Unlike TopNav it claims no banner: where the rail sits is the page's call.
    expect(screen.queryByRole("banner")).toBeNull();
  });

  test("each section is a list named by its own label", () => {
    render(<SideNav sections={GROUPED} />);
    // A group announced with its name, without a heading — a nav cannot know
    // what heading level it sits under.
    expect(screen.getByRole("list", { name: "Billing" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Setup" })).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  test("an unlabelled section is a plain list, not one pointing at nothing", () => {
    const { container } = render(
      <SideNav sections={[{ items: [{ label: "Profile", href: "/profile" }] }]} />
    );
    const list = screen.getByRole("list");
    expect(list.getAttribute("aria-labelledby")).toBeNull();
    expect(container.querySelector(".rata-side-nav-section-label")).toBeNull();
  });

  test("the current page is announced, not only tinted", () => {
    render(<SideNav sections={GROUPED} />);
    expect(screen.getByRole("link", { name: "Invoices" }).getAttribute("aria-current")).toBe(
      "page"
    );
    expect(
      screen.getByRole("link", { name: "Credit notes" }).getAttribute("aria-current")
    ).toBeNull();
  });

  test("every destination is a link, in order, across sections", () => {
    render(<SideNav sections={GROUPED} />);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual([
      "Invoices",
      "Credit notes",
      "Tax rates",
    ]);
  });

  test("every link is its own tab stop — a nav is not a menubar", () => {
    render(<SideNav sections={GROUPED} />);
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("tabindex")).toBeNull();
    }
  });

  test("two sections with the same label still get distinct list names", () => {
    // The ids are generated per section index, so a repeated label cannot make
    // two lists point at one element.
    render(
      <SideNav
        sections={[
          { label: "Group", items: [{ label: "A", href: "/a" }] },
          { label: "Group", items: [{ label: "B", href: "/b" }] },
        ]}
      />
    );
    const ids = screen.getAllByRole("list").map((l) => l.getAttribute("aria-labelledby"));
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
  });

  test("an item's icon is decorative — the label is the link text", () => {
    const { container } = render(
      <SideNav sections={[{ items: [{ label: "Starred", href: "/starred", icon: Star }] }]} />
    );
    expect(screen.getByRole("link", { name: "Starred" })).toBeTruthy();
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });

  test("passes the rest through, so the rail can be sized or identified", () => {
    render(<SideNav sections={GROUPED} id="rail" data-testid="r" />);
    const nav = screen.getByRole("navigation");
    expect(nav.id).toBe("rail");
    expect(nav.getAttribute("data-testid")).toBe("r");
  });

  test("onClick intercepts the navigation, and the row stays a real link", async () => {
    // Found by building the playground's own rail out of this: the rows
    // navigate client-side, and with no way to intercept the click there was
    // no way to use SideNav without a full page load.
    const onClick = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(
      <SideNav
        sections={[{ items: [{ label: "Invoices", href: "/invoices", onClick }] }]}
      />
    );
    const link = screen.getByRole("link", { name: "Invoices" });
    await userEvent.click(link);
    expect(onClick).toHaveBeenCalledOnce();
    // Still an anchor with a real address, which is what middle-click,
    // copy-address and crawlers all depend on.
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/invoices");
  });

  test("a nested row can intercept its click too", async () => {
    const onClick = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(
      <SideNav
        sections={[
          {
            items: [
              {
                label: "Reports",
                defaultExpanded: true,
                items: [{ label: "Revenue", href: "/r", onClick }],
              },
            ],
          },
        ]}
      />
    );
    await userEvent.click(screen.getByRole("link", { name: "Revenue" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  describe("a group with pages nested under it", () => {
    const NESTED = [
      {
        items: [
          { label: "All invoices", href: "/invoices" },
          {
            label: "Reports",
            items: [
              { label: "Revenue", href: "/reports/revenue", current: true },
              { label: "Ageing", href: "/reports/ageing" },
            ],
          },
        ],
      },
    ];

    test("is a disclosure button, NOT a menu", () => {
      render(<SideNav sections={NESTED} />);
      const trigger = screen.getByRole("button", { name: /Reports/ });
      expect(trigger.getAttribute("aria-expanded")).toBeTruthy();
      expect(trigger.getAttribute("aria-controls")).toBeTruthy();
      expect(trigger.getAttribute("role")).toBeNull();
      expect(screen.queryByRole("menu")).toBeNull();
    });

    test("opens by itself when one of its children is the current page", () => {
      // A reader whose page sits inside a collapsed group cannot see where
      // they are, which is the one question a nav exists to answer.
      render(<SideNav sections={NESTED} />);
      expect(screen.getByRole("button", { name: /Reports/ }).getAttribute("aria-expanded")).toBe(
        "true"
      );
      expect(screen.getByRole("link", { name: "Revenue" })).toBeTruthy();
    });

    test("stays shut when nothing inside it is current", () => {
      render(
        <SideNav
          sections={[
            { items: [{ label: "Reports", items: [{ label: "Revenue", href: "/r" }] }] },
          ]}
        />
      );
      expect(screen.getByRole("button", { name: /Reports/ }).getAttribute("aria-expanded")).toBe(
        "false"
      );
      expect(screen.queryByRole("link", { name: "Revenue" })).toBeNull();
    });

    test("defaultExpanded overrides both defaults", () => {
      render(
        <SideNav
          sections={[
            {
              items: [
                {
                  label: "Reports",
                  defaultExpanded: false,
                  items: [{ label: "Revenue", href: "/r", current: true }],
                },
              ],
            },
          ]}
        />
      );
      expect(screen.getByRole("button", { name: /Reports/ }).getAttribute("aria-expanded")).toBe(
        "false"
      );
    });

    test("the nested list is unmounted while shut, not merely hidden", async () => {
      // A hidden list is one more thing a find-in-page can reach while the
      // group claims to be collapsed.
      const { container } = render(
        <SideNav
          sections={[
            { items: [{ label: "Reports", items: [{ label: "Revenue", href: "/r" }] }] },
          ]}
        />
      );
      expect(container.querySelector(".rata-side-nav-sublist")).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: /Reports/ }));
      expect(container.querySelector(".rata-side-nav-sublist")).toBeTruthy();
    });

    test("the nested list is named by its trigger", async () => {
      render(<SideNav sections={NESTED} />);
      const trigger = screen.getByRole("button", { name: /Reports/ });
      const panel = document.getElementById(trigger.getAttribute("aria-controls")!)!;
      expect(panel.getAttribute("aria-labelledby")).toBe(trigger.id);
    });

    test("the trigger toggles it, and Escape closes it with focus returned", async () => {
      render(<SideNav sections={NESTED} />);
      const trigger = screen.getByRole("button", { name: /Reports/ });
      await userEvent.click(trigger);
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      await userEvent.click(trigger);
      expect(trigger.getAttribute("aria-expanded")).toBe("true");

      trigger.focus();
      await userEvent.keyboard("{Escape}");
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(trigger);
    });

    test("two kinds of current: the page, and the group leading to it", () => {
      render(
        <SideNav
          sections={[
            {
              items: [
                {
                  label: "Reports",
                  current: true,
                  items: [{ label: "Revenue", href: "/r", current: true }],
                },
              ],
            },
          ]}
        />
      );
      expect(screen.getByRole("button", { name: /Reports/ }).getAttribute("aria-current")).toBe(
        "true"
      );
      expect(screen.getByRole("link", { name: "Revenue" }).getAttribute("aria-current")).toBe(
        "page"
      );
    });

    test("an empty items array is still just a link", () => {
      render(<SideNav sections={[{ items: [{ label: "Reports", href: "/r", items: [] }] }]} />);
      expect(screen.getByRole("link", { name: "Reports" })).toBeTruthy();
      expect(screen.queryByRole("button")).toBeNull();
    });
  });
});
