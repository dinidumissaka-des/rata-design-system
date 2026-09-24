import { describe, expect, test, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "./select.js";

/**
 * The platform supplies the keyboard model, the picker and the typeahead, so
 * none of that is tested here — testing the browser is not this suite's job.
 * What is asserted is what this component decides: that it is a native select,
 * that the placeholder cannot be chosen, that groups render, and that
 * composing Field actually delivers the wiring.
 */
afterEach(cleanup);

const OPTIONS = [
  { value: "dev", label: "Development" },
  { value: "prod", label: "Production" },
];

const Fixture = (props: Record<string, unknown> = {}) => (
  <Select label="Environment" options={OPTIONS} {...props} />
);

describe("Select", () => {
  test("is a native select, which is what buys the platform's picker", () => {
    render(<Fixture />);
    const control = screen.getByLabelText("Environment");
    expect(control.tagName).toBe("SELECT");
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  test("the placeholder is shown and cannot be chosen", () => {
    render(<Fixture placeholder="Select an environment" required />);
    const placeholder = screen.getByRole("option", {
      name: "Select an environment",
    }) as HTMLOptionElement;

    // Disabled and empty, so `required` treats it as unanswered rather than as
    // a value the reader picked.
    expect(placeholder.disabled).toBe(true);
    expect(placeholder.value).toBe("");
    expect((screen.getByLabelText(/Environment/) as HTMLSelectElement).value).toBe("");
  });

  test("choosing reports the value, not the event", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} />);

    await user.selectOptions(screen.getByLabelText("Environment"), "prod");
    expect(onValueChange).toHaveBeenCalledWith("prod");
  });

  test("groups render as optgroups, which the platform draws for free", () => {
    const { container } = render(
      <Select
        label="Region"
        options={[
          { label: "Asia", options: [{ value: "lk", label: "Sri Lanka" }] },
          { label: "Europe", options: [{ value: "pt", label: "Portugal" }] },
        ]}
      />
    );
    const groups = container.querySelectorAll("optgroup");
    expect([...groups].map((g) => g.getAttribute("label"))).toEqual(["Asia", "Europe"]);
    expect(screen.getByRole("option", { name: "Sri Lanka" })).toBeTruthy();
  });

  test("a disabled option stays in the list rather than vanishing from it", () => {
    render(<Fixture options={[...OPTIONS, { value: "stg", label: "Staging", disabled: true }]} />);
    // So the list a reader hears does not change shape under them.
    const staging = screen.getByRole("option", { name: "Staging" }) as HTMLOptionElement;
    expect(staging.disabled).toBe(true);
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  test("composing Field delivers the description chain, hint before failure", () => {
    render(<Fixture description="Where it deploys." status="invalid" message="Pick one." />);
    const control = screen.getByLabelText("Environment");
    const ids = control.getAttribute("aria-describedby")!.split(" ");

    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0]!)?.textContent).toBe("Where it deploys.");
    expect(document.getElementById(ids[1]!)?.textContent).toBe("Pick one.");
    expect(control.getAttribute("aria-invalid")).toBe("true");
  });

  test("disabled uses the native attribute — this system's one documented exception", () => {
    render(<Fixture disabled />);
    const control = screen.getByLabelText("Environment") as HTMLSelectElement;

    // A select has no readOnly to fall back on, so aria-disabled alone would
    // leave a control that looks unavailable and is not.
    expect(control.disabled).toBe(true);
    expect(control.hasAttribute("readonly")).toBe(false);
  });

  test("required is announced once, and the marker is not the second time", () => {
    const { container } = render(<Fixture required placeholder="Select an environment" />);
    expect(screen.getByLabelText(/Environment/).getAttribute("aria-required")).toBe("true");
    expect(container.querySelector(".rata-field-required")?.getAttribute("aria-hidden")).toBe(
      "true"
    );
  });

  test("the chevron is decorative and adds nothing to announce", () => {
    const { container } = render(<Fixture />);
    const chevron = container.querySelector(".rata-select-chevron")!;
    expect(chevron.getAttribute("aria-hidden")).toBe("true");
  });

  test("labelHidden concedes the pixels, never the name", () => {
    const { container } = render(<Fixture labelHidden />);
    expect(screen.getByLabelText("Environment")).toBeTruthy();
    expect(container.querySelector("label")?.className).toContain("rata-visually-hidden");
  });
});
