import { describe, expect, test, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Check } from "lucide-react";
import { Icon } from "./icon.js";

afterEach(cleanup);

describe("Icon", () => {
  test("unlabelled, it is hidden — the decorative case needs no thought", () => {
    const { container } = render(<Icon icon={Check} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });

  test("labelled, it becomes an image with that name", () => {
    render(<Icon icon={Check} label="Verified" />);
    const el = screen.getByRole("img", { name: "Verified" });
    expect(el.getAttribute("aria-hidden")).toBeNull();
  });
});
