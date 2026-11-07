import { describe, expect, test } from "vitest";
import { getStepsProps } from "./steps.js";

const checkout = [
  { id: "shipping", label: "Shipping" },
  { id: "payment", label: "Payment" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
];

describe("getStepsProps", () => {
  test("steps before current are complete, after it upcoming", () => {
    const { items } = getStepsProps({ steps: checkout, current: "payment" });
    expect(items.map((i) => i.status)).toEqual(["complete", "current", "upcoming", "upcoming"]);
    expect(items.map((i) => i.current)).toEqual([false, true, false, false]);
  });

  test("each name states position and state in words", () => {
    const { items } = getStepsProps({ steps: checkout, current: "payment" });
    expect(items.map((i) => i.name)).toEqual([
      "Step 1 of 4, Shipping, completed",
      "Step 2 of 4, Payment, current",
      "Step 3 of 4, Review, upcoming",
      "Step 4 of 4, Done, upcoming",
    ]);
    expect(items[0]!.prefix).toBe("Step 1 of 4, ");
    expect(items[0]!.suffix).toBe(", completed");
  });

  test("an invalid step overrides its position and is named as needing attention", () => {
    const steps = [{ ...checkout[0]!, invalid: true }, ...checkout.slice(1)];
    const { items } = getStepsProps({ steps, current: "review" });
    expect(items[0]!.status).toBe("invalid");
    expect(items[0]!.name).toBe("Step 1 of 4, Shipping, needs attention");
  });

  test("the current step can be invalid and is still current", () => {
    const steps = checkout.map((s) => (s.id === "payment" ? { ...s, invalid: true } : s));
    const item = getStepsProps({ steps, current: "payment" }).items[1]!;
    expect(item.current).toBe(true);
    expect(item.status).toBe("invalid");
    expect(item.suffix).toBe(", current, needs attention");
  });

  test("nothing is navigable without navigable", () => {
    const { items } = getStepsProps({ steps: checkout, current: "review" });
    expect(items.some((i) => i.navigable)).toBe(false);
  });

  test("only reached and invalid steps are navigable, never current or upcoming", () => {
    const steps = checkout.map((s) => (s.id === "done" ? { ...s, invalid: true } : s));
    const { items } = getStepsProps({ steps, current: "review", navigable: true });
    expect(items.map((i) => i.navigable)).toEqual([true, true, false, true]);
    const plain = getStepsProps({ steps: checkout, current: "review", navigable: true });
    expect(plain.items.map((i) => i.navigable)).toEqual([true, true, false, false]);
  });

  test("an unknown current id leaves every step upcoming and no summary", () => {
    const state = getStepsProps({ steps: checkout, current: "nope", navigable: true });
    expect(state.currentIndex).toBe(-1);
    expect(state.items.every((i) => i.status === "upcoming" && !i.navigable)).toBe(true);
    expect(state.summary).toBeNull();
  });

  test("the compact summary counts from 1", () => {
    expect(getStepsProps({ steps: checkout, current: "payment" }).summary).toBe("Step 2 of 4");
  });
});
