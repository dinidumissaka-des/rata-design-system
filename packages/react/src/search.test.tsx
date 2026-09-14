import { describe, expect, test, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Search } from "./search.js";

afterEach(cleanup);

describe("Search", () => {
  test("is a searchbox with a name, even though the label is hidden", () => {
    render(<Search label="Search invoices" />);
    // role=searchbox comes from type="search" — the platform supplies it.
    const field = screen.getByRole("searchbox", { name: "Search invoices" });
    expect(field).toBeTruthy();
    // Hidden is not absent: the label element is rendered and bound.
    expect(screen.getByText("Search invoices").tagName).toBe("LABEL");
  });

  test("labelHidden defaults to true, and false shows it", () => {
    const { container: hidden } = render(<Search label="Search" />);
    expect(hidden.querySelector(".rata-visually-hidden")).toBeTruthy();
    const { container: shown } = render(<Search label="Search" labelHidden={false} />);
    expect(shown.querySelector(".rata-visually-hidden")).toBeNull();
  });

  test("clicking the label focuses the field", async () => {
    render(<Search label="Search" labelHidden={false} />);
    await userEvent.click(screen.getByText("Search"));
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
  });

  test("uncontrolled: it holds its own query", async () => {
    render(<Search label="Search" />);
    const field = screen.getByRole("searchbox") as HTMLInputElement;
    await userEvent.type(field, "inv");
    expect(field.value).toBe("inv");
  });

  test("controlled: the caller owns the query and hears every keystroke", async () => {
    const onValueChange = vi.fn();
    render(<Search label="Search" value="" onValueChange={onValueChange} />);
    await userEvent.type(screen.getByRole("searchbox"), "i");
    expect(onValueChange).toHaveBeenCalledWith("i");
    // Still empty, because the caller did not change it.
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
  });

  test("no clear control until there is something to clear", async () => {
    render(<Search label="Search" />);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    await userEvent.type(screen.getByRole("searchbox"), "inv");
    expect(screen.getByRole("button", { name: "Clear search" })).toBeTruthy();
  });

  test("clearing empties the field AND puts focus back on it", async () => {
    // The control vanishes the moment the field empties, so without the focus
    // move the reader loses the field they were typing in.
    render(<Search label="Search" />);
    const field = screen.getByRole("searchbox") as HTMLInputElement;
    await userEvent.type(field, "inv");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(field.value).toBe("");
    expect(document.activeElement).toBe(field);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  test("clearLabel names the control", async () => {
    render(<Search label="Filter" defaultValue="x" clearLabel="Clear the filter" />);
    expect(screen.getByRole("button", { name: "Clear the filter" })).toBeTruthy();
  });

  test("Escape clears a query", async () => {
    render(<Search label="Search" defaultValue="inv" />);
    const field = screen.getByRole("searchbox") as HTMLInputElement;
    field.focus();
    await userEvent.keyboard("{Escape}");
    expect(field.value).toBe("");
  });

  test("Escape on an empty field is left for whatever is around it", async () => {
    // The behaviour that makes a search usable inside a Dialog or a Menu:
    // swallowing Escape unconditionally would stop those closing.
    const onEscape = vi.fn();
    render(
      <div onKeyDown={(event) => event.key === "Escape" && onEscape()}>
        <Search label="Search" />
      </div>
    );
    screen.getByRole("searchbox").focus();
    await userEvent.keyboard("{Escape}");
    expect(onEscape).toHaveBeenCalledOnce();
  });

  test("Escape with a query does not reach the overlay around it", async () => {
    const onEscape = vi.fn();
    render(
      <div onKeyDown={(event) => event.key === "Escape" && onEscape()}>
        <Search label="Search" defaultValue="inv" />
      </div>
    );
    screen.getByRole("searchbox").focus();
    await userEvent.keyboard("{Escape}");
    // The keypress meant "clear the field", not "close the dialog".
    expect(onEscape).not.toHaveBeenCalled();
  });

  test("Enter commits the query", async () => {
    const onSearch = vi.fn();
    render(<Search label="Search" defaultValue="inv" onSearch={onSearch} />);
    screen.getByRole("searchbox").focus();
    await userEvent.keyboard("{Enter}");
    expect(onSearch).toHaveBeenCalledWith("inv");
  });

  test("with no onSearch, Enter is left alone so a form's submit still works", async () => {
    const onSubmit = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Search label="Search" defaultValue="inv" />
      </form>
    );
    screen.getByRole("searchbox").focus();
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  test("loading says a query is in flight, and nothing about the result", () => {
    const { container } = render(<Search label="Search" loading />);
    expect(screen.getByRole("searchbox").getAttribute("aria-busy")).toBe("true");
    // The glyph is decorative either way — the count is the caller's to announce.
    expect(container.querySelector(".rata-search-glyph")!.getAttribute("aria-hidden")).toBe("true");
  });

  test("landmark is opt-in, and unnamed on purpose", () => {
    expect(render(<Search label="Search" />).container.querySelector('[role="search"]')).toBeNull();
    cleanup();
    render(<Search label="Search" landmark />);
    const region = screen.getByRole("search");
    expect(region.getAttribute("aria-label")).toBeNull();
  });

  test("disabled refuses edits while staying focusable and announced", async () => {
    render(<Search label="Search" defaultValue="inv" disabled />);
    const field = screen.getByRole("searchbox") as HTMLInputElement;
    await userEvent.type(field, "x");
    expect(field.value).toBe("inv");
    expect(field).toHaveProperty("disabled", false);
    field.focus();
    expect(document.activeElement).toBe(field);
    expect(field.getAttribute("aria-disabled")).toBe("true");
    // And offers no clear control, since it could not honour it.
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  test("size picks a class and defaults to md", () => {
    const { container } = render(<Search label="Search" />);
    expect(container.querySelector(".rata-search-input--md")).toBeTruthy();
    expect(container.querySelector(".rata-search")!.getAttribute("data-size")).toBe("md");
  });

  test("passes the rest through, and forwards a ref to the input", () => {
    let node: HTMLInputElement | null = null;
    render(
      <Search
        label="Search"
        placeholder="Search invoices"
        data-testid="q"
        ref={(n) => {
          node = n;
        }}
      />
    );
    const field = screen.getByRole("searchbox");
    expect(field.getAttribute("placeholder")).toBe("Search invoices");
    expect(field.getAttribute("data-testid")).toBe("q");
    expect(node).toBe(field);
  });

  test("a query survives a re-render driven from outside", async () => {
    function Harness() {
      const [q, setQ] = useState("");
      return (
        <>
          <Search label="Search" value={q} onValueChange={setQ} />
          <output>{q}</output>
        </>
      );
    }
    render(<Harness />);
    await userEvent.type(screen.getByRole("searchbox"), "inv");
    expect(screen.getByRole("status").textContent).toBe("inv");
  });
});
