// Tests for the checker. A scoring tool that is wrong is worse than no tool:
// it makes bad code look fine, or teaches contributors to ignore it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTokenModel, evaluateSource, scoreCandidate } from "./rules.mjs";

const model = loadTokenModel();
const rules = (css) => evaluateSource(css, model).violations.map((v) => v.rule);
const find = (css, rule) => evaluateSource(css, model).violations.find((v) => v.rule === rule);

test("flags a palette token used in a component", () => {
  assert.ok(rules(".a { color: var(--rata-color-neutral-900); }").includes("palette-token"));
});

test("does not mistake a theme role token for a palette token", () => {
  // Regression: prefix matching under the old single "color" family could
  // confuse a palette ramp with a same-named role. theme.* and color.* are
  // now separate top-level families, but keep the guard.
  for (const token of [
    "--rata-theme-warning-role-subtle",
    "--rata-theme-warning-role-fg",
    "--rata-theme-accent-role-bg",
    "--rata-theme-danger-role-fg",
    "--rata-theme-success-role-subtle",
  ]) {
    assert.ok(
      !rules(`.a { color: var(${token}); }`).includes("palette-token"),
      `${token} must not be treated as a palette token`
    );
  }
});

test("flags an unknown token separately from a palette one", () => {
  const r = rules(".a { color: var(--rata-color-does-not-exist); }");
  assert.ok(r.includes("unknown-token"));
  assert.ok(!r.includes("palette-token"));
});

test("a pairing that fails in every theme is an error", () => {
  // The success fill is a non-text indicator in both schemes: its own label
  // token is white, and white on it lands in the low 3s. Warning used to be
  // the example here, but it now carries a dark label token that passes —
  // the gap moved rather than disappearing.
  const v = find(
    ".toast { background: var(--rata-theme-success-role-bg); color: var(--rata-theme-success-role-on); }",
    "forbidden-pairing"
  );
  assert.ok(v, "expected the white-on-success-fill pairing to be caught");
  assert.equal(v.severity, "error");
});

test("each role's own label token clears AA on its fill", () => {
  // Regression guard for the bug the theme engine surfaced: reusing
  // theme.fg.on-accent for status fills put dark text on a dark red button
  // in the dark scheme, because on-accent inverts with the accent and the
  // status fills do not.
  for (const role of ["danger", "warning"]) {
    const css = `.b { background: var(--rata-theme-${role}-role-bg); color: var(--rata-theme-${role}-role-on); }`;
    assert.equal(find(css, "forbidden-pairing"), undefined, `${role} label must clear AA`);
  }
});

test("a pairing verified in one theme is a warning, not an error", () => {
  // Graded severity: a combination that is sanctioned in one theme and short in
  // another is the palette's fault, not the component's. Built on a synthetic
  // model so the branch stays covered no matter what the real ramps measure.
  const synthetic = {
    index: {
      "rata-fg": { path: "fg", layer: "semantic" },
      "rata-bg": { path: "bg", layer: "semantic" },
      "rata-bg2": { path: "bg2", layer: "semantic" },
    },
    validVars: new Set(["rata-fg", "rata-bg", "rata-bg2"]),
    forbidden: new Map([
      ["fg|bg", { below: "AA-text", themes: ["dark"], measured: { dark: 3.68 }, workaround: "" }],
      ["fg|bg2", { below: "AA-text", themes: ["light", "dark"], measured: { light: 2.1 }, workaround: "" }],
    ]),
    verified: new Set(["fg|bg"]),
  };
  const severityFor = (bg) =>
    evaluateSource(`.a { background: var(--rata-${bg}); color: var(--rata-fg); }`, synthetic)
      .violations.find((v) => v.rule === "forbidden-pairing")?.severity;

  assert.equal(severityFor("bg"), "warn", "verified somewhere → warning");
  assert.equal(severityFor("bg2"), "error", "short everywhere → error");
});

test("the primary and destructive button pairings are clean in both themes", () => {
  // The dark accent-role.bg and danger-role.bg were retuned to step 600 (from
  // 500) so white text clears AA in both themes; this guards against them
  // drifting back.
  for (const bg of ["accent", "danger"]) {
    const css = `.button { background: var(--rata-theme-${bg}-role-bg); color: var(--rata-theme-fg-on-accent); }`;
    assert.equal(find(css, "forbidden-pairing"), undefined, `${bg} fill must clear AA in both themes`);
  }
});

test("accepts the documented success and warning notice recipe", () => {
  const css = `.n { background: var(--rata-theme-success-role-subtle); color: var(--rata-theme-success-role-fg); }`;
  assert.deepEqual(rules(css), []);
});

test("flags hardcoded colors, dimensions, weights, and motion", () => {
  assert.ok(rules(".a { color: #ff0000; }").includes("hardcoded-color"));
  assert.ok(rules(".a { padding: 16px; }").includes("hardcoded-dimension"));
  assert.ok(rules(".a { font-weight: 500; }").includes("hardcoded-font-weight"));
  assert.ok(rules(".a { transition: all 0.2s ease-in-out; }").includes("hardcoded-motion"));
});

test("allows font-relative sizing", () => {
  // Regression: the spinner is deliberately 1em so it scales with its container.
  assert.ok(!rules(".spinner { width: 1em; height: 1em; }").includes("hardcoded-dimension"));
});

test("accepts scale tokens in place of raw values", () => {
  const css = `.a {
    padding: var(--rata-space-4);
    font-weight: var(--rata-font-weight-bold);
    transition: opacity var(--rata-motion-duration-fast) var(--rata-motion-easing-standard);
  }`;
  assert.deepEqual(rules(css), []);
});

test("requires a focus ring on a focusable control", () => {
  assert.ok(rules(".btn { cursor: pointer; }").includes("missing-focus-ring"));
  const ok = `.btn { cursor: pointer; }
    .btn:focus-visible { outline: var(--rata-focus-ring-width) solid var(--rata-theme-focus-ring); }`;
  assert.ok(!rules(ok).includes("missing-focus-ring"));
});

test("does not demand a focus ring from a non-focusable overlay primitive", () => {
  // Regression: .rata-state-layer has :hover/:active rules but is never focused.
  const stateLayer = `.rata-state-layer::after { opacity: 0; pointer-events: none; }
    .rata-state-layer:hover::after { opacity: var(--rata-state-hover-opacity); }
    .rata-state-layer:active::after { opacity: var(--rata-state-press-opacity); }`;
  assert.ok(!rules(stateLayer).includes("missing-focus-ring"));
});

test("flags a removed focus ring", () => {
  assert.ok(rules(".btn:focus { outline: none; }").includes("focus-removed"));
});

test("warns on hand-rolled hover and native disabled styling", () => {
  assert.ok(
    rules(".btn:hover { background: var(--rata-theme-accent-role-subtle); }").includes("hand-rolled-hover")
  );
  assert.ok(rules(".btn:disabled { opacity: 0.5; }").includes("native-disabled-styling"));
  assert.ok(
    !rules('.btn[aria-disabled="true"] { opacity: var(--rata-state-disabled-opacity); }').includes(
      "native-disabled-styling"
    )
  );
});

test("flags layout scoped to an overlay's open state", () => {
  // The bug this exists for: `display` is the one property a top-layer overlay
  // transitions with allow-discrete, so it is held at its open value for the
  // whole exit while everything else on the same selector reverts at once.
  // flex-direction cannot ease, so it snaps and the children re-lay-out for
  // the length of the closing animation.
  assert.ok(
    rules(".d[open] { display: flex; flex-direction: column; }").includes("state-scoped-layout")
  );
  assert.ok(
    rules(".m:popover-open { display: flex; grid-auto-flow: row; }").includes(
      "state-scoped-layout"
    )
  );

  // `display` alone is the whole point of the state selector.
  assert.ok(!rules(".d[open] { display: flex; }").includes("state-scoped-layout"));
  // Animatable, or meant to revert at once — neither snaps visibly.
  assert.ok(
    !rules(".d[open] { opacity: 1; translate: 0 0; pointer-events: auto; }").includes(
      "state-scoped-layout"
    )
  );
  // Nothing to do with an overlay's open state.
  assert.ok(!rules(".card { flex-direction: column; }").includes("state-scoped-layout"));
});

test("rata-allow records a deliberate exception", () => {
  const css = `/* rata-allow: hardcoded-motion — the spin cycle has no token */
    .spinner { animation: spin 0.8s linear infinite; }`;
  assert.ok(!rules(css).includes("hardcoded-motion"));
});

test("rata-allow covers only the block it precedes", () => {
  // A file-wide exemption would quietly cover violations added later.
  const css = `/* rata-allow: hardcoded-dimension — app layout constant */
    .shell { width: 960px; }
    .later { padding: 13px; }`;
  const v = evaluateSource(css, model).violations.filter((x) => x.rule === "hardcoded-dimension");
  assert.equal(v.length, 1, "the second block must still be reported");
  assert.match(v[0].message, /13px/);
});

test("layout constraints are not scale violations", () => {
  assert.deepEqual(rules(".shell { max-width: 960px; }"), []);
  assert.ok(rules(".swatch { height: 48px; }").includes("hardcoded-dimension"));
});

test("scoring reports a missing required token", () => {
  const prompt = { id: "x", mustUse: ["theme.warning-role.subtle"] };
  const bad = scoreCandidate(".n { color: var(--rata-theme-fg-primary); }", prompt, model);
  assert.equal(bad.pass, false);
  assert.ok(bad.violations.some((v) => v.rule === "missing-required-token"));

  const good = scoreCandidate(
    ".n { background: var(--rata-theme-warning-role-subtle); color: var(--rata-theme-warning-role-fg); }",
    prompt,
    model
  );
  assert.equal(good.pass, true);
});
