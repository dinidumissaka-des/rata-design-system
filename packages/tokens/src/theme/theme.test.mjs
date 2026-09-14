/**
 * Port-fidelity tests for the theme engine.
 *
 * Every expected value here is one Astryx documents in its own source or
 * tests. A port that quietly drifts from its origin is worse than no port:
 * it inherits the reputation of the original without its behaviour. When one
 * of these fails, the question is which side is right — not which number to
 * edit.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { contrastRatio, parseHex, hexWithAlpha } from "./color.mjs";
import { hexToHct, hctToHex, tonalPalette } from "./hct.mjs";
import { expandMotionScale } from "./expandMotionScale.mjs";
import { expandRadiusScale, DEFAULT_RADIUS_STEPS } from "./expandRadiusScale.mjs";
import { expandTypeScale } from "./expandTypeScale.mjs";
import { expandColorScale } from "./expandColorScale.mjs";
import { defineTheme, isDefinedTheme } from "./defineTheme.mjs";

// ── colour utilities ────────────────────────────────────────────────────────

test("parseHex handles shorthand, longhand, and alpha", () => {
  assert.deepEqual(parseHex("#fff"), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseHex("#0064E0"), { r: 0, g: 100, b: 224, a: 1 });
  assert.equal(parseHex("#00000080").a, 128 / 255);
  assert.equal(parseHex("nope"), null);
});

test("contrastRatio matches known WCAG anchors", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
  assert.equal(contrastRatio("#ffffff", "#ffffff"), 1);
});

test("contrastRatio composites a translucent foreground, refuses a translucent background", () => {
  // 50% black over white is mid-grey — must not be measured as if opaque.
  const composited = contrastRatio("#00000080", "#ffffff");
  assert.ok(composited > 1 && composited < 21);
  assert.throws(() => contrastRatio("#000000", "#ffffff80"), TypeError);
});

// ── HCT ─────────────────────────────────────────────────────────────────────

test("hexToHct round-trips through hctToHex", () => {
  for (const hex of ["#0064E0", "#B7410E", "#22C55E", "#737373"]) {
    const back = hctToHex(hexToHct(hex));
    const a = parseHex(hex);
    const b = parseHex(back);
    // Gamut mapping may shave chroma; tone and hue are what must survive.
    for (const ch of ["r", "g", "b"]) {
      assert.ok(
        Math.abs(a[ch] - b[ch]) <= 12,
        `${hex} → ${back}: ${ch} drifted by ${Math.abs(a[ch] - b[ch])}`,
      );
    }
  }
});

test("tone anchors resolve to black and white", () => {
  assert.equal(hctToHex({ hue: 250, chroma: 48, tone: 0 }), "#000000");
  assert.equal(hctToHex({ hue: 250, chroma: 48, tone: 100 }), "#FFFFFF");
});

test("tone fixes luminance regardless of hue — the contrast guarantee", () => {
  // This is the property the whole generator rests on: same tone, different
  // hue, materially the same relative luminance. If this stops holding, the
  // fixed tone assignments in expandColorScale stop guaranteeing anything.
  const white = "#FFFFFF";
  const ratios = [0, 60, 120, 180, 240, 300].map((hue) =>
    contrastRatio(hctToHex({ hue, chroma: 48, tone: 40 }), white),
  );
  const spread = Math.max(...ratios) - Math.min(...ratios);
  assert.ok(spread < 1.0, `tone-40 contrast spread across hues was ${spread}`);
});

test("tonalPalette covers the standard stops", () => {
  const p = tonalPalette(250, 48);
  for (const tone of [0, 10, 40, 50, 90, 99, 100]) {
    assert.match(p[tone], /^#[0-9A-F]{6}$/, `tone ${tone}`);
  }
});

test("hexWithAlpha appends an uppercase two-digit suffix", () => {
  assert.equal(hexWithAlpha("#0064E0", 0.1), "#0064E01A");
  assert.equal(hexWithAlpha("#0064E0", 1), "#0064E0FF");
});

// ── motion ──────────────────────────────────────────────────────────────────

test("expandMotionScale reproduces Astryx's default scale", () => {
  const t = expandMotionScale({ fast: 175, medium: 410, slow: 975, ratio: 0.75 });
  assert.equal(t["motion.duration.fast-min"], "130ms");
  assert.equal(t["motion.duration.fast"], "175ms");
  assert.equal(t["motion.duration.fast-max"], "235ms");
  assert.equal(t["motion.duration.medium-min"], "310ms");
  assert.equal(t["motion.duration.medium"], "410ms");
  assert.equal(t["motion.duration.medium-max"], "545ms");
  assert.equal(t["motion.duration.slow-min"], "730ms");
  assert.equal(t["motion.duration.slow"], "975ms");
  assert.equal(t["motion.duration.slow-max"], "1300ms");
});

test("expandMotionScale omits the slow band unless asked", () => {
  const t = expandMotionScale({ fast: 100, medium: 250, ratio: 0.75 });
  assert.equal(t["motion.duration.slow"], undefined);
  assert.equal(t["motion.duration.fast"], "100ms");
});

// ── radius ──────────────────────────────────────────────────────────────────

test("expandRadiusScale reproduces Astryx's documented default", () => {
  const t = expandRadiusScale({
    base: 4,
    multiplier: 1,
    steps: DEFAULT_RADIUS_STEPS,
  });
  assert.equal(t["radius.none"], "0px");
  assert.equal(t["radius.inner"], "4px");
  assert.equal(t["radius.element"], "8px");
  assert.equal(t["radius.container"], "12px");
  assert.equal(t["radius.page"], "28px");
  assert.equal(t["radius.chat"], "28px");
  assert.equal(t["radius.pill"], "9999px");
});

test("a zero multiplier squares every scalable step but not the anchors", () => {
  const t = expandRadiusScale({ base: 4, multiplier: 0 });
  assert.equal(t["radius.element"], "0px");
  assert.equal(t["radius.none"], "0px");
  assert.equal(t["radius.pill"], "9999px");
});

// ── type ────────────────────────────────────────────────────────────────────

test("expandTypeScale reproduces Astryx's documented base=14 ratio=1.2 output", () => {
  const t = expandTypeScale({ base: 14, ratio: 1.2 });
  assert.equal(t["font.size.base"], "0.875rem");
  assert.equal(t["font.size.2xl"], "1.5rem");
  assert.equal(t["type.heading-1.size"], "{font.size.2xl}");
  assert.equal(t["type.heading-1.line-height"], "1.3333");
  assert.equal(t["type.body.size"], "{font.size.base}");
  assert.equal(t["type.body.line-height"], "1.4286");
});

test("leading is tiered and 4px-snapped, never tighter than size + 4px", () => {
  // 40px sits in the >= 32px tier (ratio 1.25): 40 × 1.25 = 50, which snaps
  // up to 52 (Math.round(12.5) rounds half away from zero), so 52 / 40 = 1.3.
  const t = expandTypeScale({ base: 40, ratio: 1.2 });
  assert.equal(t["type.body.line-height"], "1.3");

  // The floor bites at small sizes: 10 × 1.5 = 15 snaps to 16, not 12,
  // because size + 4 = 14 rounds up to the next 4px stop.
  const small = expandTypeScale({ base: 10, ratio: 1.2 });
  assert.equal(small["type.body.line-height"], "1.6");
});

test("heading weight overrides reach the generated tokens", () => {
  const t = expandTypeScale({
    base: 16,
    ratio: 1.2,
    weights: { heading: { 1: "{font.weight.bold}" } },
  });
  assert.equal(t["type.heading-1.weight"], "{font.weight.bold}");
  assert.equal(t["type.heading-2.weight"], "{font.weight.semibold}");
});

// ── colour scale ────────────────────────────────────────────────────────────

test("expandColorScale emits light/dark tuples for every generated theme role", () => {
  const t = expandColorScale({ accent: "#0064E0" });
  for (const [key, value] of Object.entries(t)) {
    if (!key.startsWith("theme.")) continue;
    assert.ok(Array.isArray(value) && value.length === 2, `${key} is not a tuple`);
  }
});

test("the generated accent ramp is one value per step, not a per-scheme pair", () => {
  // The palette layer promises a step is the same value in both schemes —
  // that promise is the reason components are told never to use one directly.
  // A [light, dark] ramp would quietly break it, so the shape is asserted
  // rather than assumed.
  const t = expandColorScale({ accent: "#0064E0" });
  const steps = Object.keys(t).filter((k) => k.startsWith("color.accent."));
  assert.equal(steps.length, 11, "expected 11 ramp steps, 50 → 950");
  for (const step of steps) {
    assert.equal(typeof t[step], "string", `${step} should be scheme-independent`);
  }
});

test("the accent ramp is anchored on the seed's hue at step 600", () => {
  // Step 600 is the seed: the ramp is built around the colour the brand named,
  // which is what makes "the accent ramp" mean the accent rather than a fixed
  // palette that happens to be filed under that name.
  //
  // The tolerance is 10 degrees, not 0, because tone and chroma are forced to
  // the ramp's curve and the result is gamut-mapped into sRGB — which moves
  // hue a little. Sweeping the whole hue circle at four chromas and four tones
  // puts the worst case at 8.1 degrees (a high-chroma green at #64C100, where
  // sRGB has least room). A wrong hue is out by tens of degrees, so this still
  // fails loudly for the mistake it is guarding against.
  for (const accent of ["#2563EB", "#B7410E", "#22C55E", "#7C3AED", "#FD0100"]) {
    const t = expandColorScale({ accent });
    const seedHue = hexToHct(accent).hue;
    const anchorHue = hexToHct(t["color.accent.600"]).hue;
    const drift = Math.abs(anchorHue - seedHue);
    assert.ok(
      Math.min(drift, 360 - drift) < 10,
      `step 600 hue ${anchorHue.toFixed(1)} should track the seed's ${seedHue.toFixed(1)}`
    );
  }
});

test("the accent ramp's tone falls monotonically from 50 to 950", () => {
  // The structural promise: 50 is the lightest step and 950 the darkest, for
  // every seed. Callers read the ramp as an ordered scale — the orientation
  // note in the contract maps step ranges to uses — so a seed that reordered
  // it would invalidate that guidance rather than just look different.
  const steps = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
  for (const accent of ["#2563EB", "#B7410E", "#22C55E", "#7C3AED", "#FD0100", "#111111"]) {
    const t = expandColorScale({ accent });
    const tones = steps.map((step) => hexToHct(t[`color.accent.${step}`]).tone);
    for (let i = 1; i < tones.length; i += 1) {
      assert.ok(
        tones[i] < tones[i - 1],
        `${accent}: step ${steps[i]} (tone ${tones[i].toFixed(1)}) should be darker than ` +
          `${steps[i - 1]} (tone ${tones[i - 1].toFixed(1)})`
      );
    }
  }
});

test("an accent-less config leaves the stated accent ramp alone", () => {
  // Same reasoning as the accent roles: defaulting the seed would silently
  // re-colour the ramp of every neutral-only brand.
  const t = expandColorScale({ neutralStyle: "cool" });
  const steps = Object.keys(t).filter((k) => k.startsWith("color.accent."));
  assert.equal(steps.length, 0);
});

test("generated text clears WCAG AA against every generated surface", () => {
  // The guarantee that justifies generating instead of hand-picking. If a
  // brand seed could break this, the whole argument for the generator fails.
  for (const accent of ["#0064E0", "#B7410E", "#22C55E", "#7C3AED", "#111111"]) {
    const t = expandColorScale({ accent });
    for (const scheme of [0, 1]) {
      for (const surface of ["theme.bg.canvas", "theme.bg.surface"]) {
        for (const text of ["theme.fg.primary", "theme.fg.secondary"]) {
          const ratio = contrastRatio(t[text][scheme], t[surface][scheme]);
          assert.ok(
            ratio >= 4.5,
            `${accent} ${scheme ? "dark" : "light"}: ${text} on ${surface} = ${ratio.toFixed(2)}`,
          );
        }
      }
    }
  }
});

test("the emphasized border reaches the 3:1 non-text boundary in both schemes", () => {
  for (const accent of ["#0064E0", "#B7410E", "#22C55E"]) {
    const t = expandColorScale({ accent });
    for (const scheme of [0, 1]) {
      const ratio = contrastRatio(
        t["theme.border.strong"][scheme],
        t["theme.bg.surface"][scheme],
      );
      assert.ok(ratio >= 3, `${accent} scheme ${scheme}: ${ratio.toFixed(2)}`);
    }
  }
});

test("high contrast widens the text/surface gap", () => {
  const std = expandColorScale({ accent: "#0064E0", contrast: "standard" });
  const high = expandColorScale({ accent: "#0064E0", contrast: "high" });
  const gap = (t) =>
    contrastRatio(t["theme.fg.secondary"][0], t["theme.bg.surface"][0]);
  assert.ok(gap(high) > gap(std));
});

test("an accent-less config re-tones neutrals but leaves accent roles alone", () => {
  const t = expandColorScale({ neutralStyle: "warm" });
  assert.equal(t["theme.accent-role.bg"], undefined);
  assert.ok(t["theme.bg.canvas"]);
});

test("a [light, dark] accent seeds each scheme from its own colour", () => {
  const t = expandColorScale({ accent: ["#0064E0", "#48CAE4"] });
  const single = expandColorScale({ accent: "#0064E0" });
  assert.equal(t["theme.accent-role.bg"][0], single["theme.accent-role.bg"][0]);
  assert.notEqual(t["theme.accent-role.bg"][1], single["theme.accent-role.bg"][1]);
});

test("neutralStyle changes the grey temperature", () => {
  const cool = expandColorScale({ accent: "#0064E0", neutralStyle: "cool" });
  const neutral = expandColorScale({ accent: "#0064E0", neutralStyle: "neutral" });
  assert.notEqual(cool["theme.bg.canvas"][0], neutral["theme.bg.canvas"][0]);
});

// ── defineTheme ─────────────────────────────────────────────────────────────

test("defineTheme requires a name and brands its output", () => {
  assert.throws(() => defineTheme({}), /`name` is required/);
  const t = defineTheme({ name: "x" });
  assert.ok(isDefinedTheme(t));
  assert.equal(isDefinedTheme({ name: "x", tokens: {} }), false);
});

test("explicit tokens beat every generator", () => {
  const t = defineTheme({
    name: "x",
    color: { accent: "#0064E0" },
    motion: { fast: 175, medium: 410, ratio: 0.75 },
    tokens: {
      "theme.accent-role.bg": "#FF0000",
      "motion.duration.fast": "1ms",
    },
  });
  assert.equal(t.tokens["theme.accent-role.bg"], "#FF0000");
  assert.equal(t.tokens["motion.duration.fast"], "1ms");
});

test("extends inherits, and the child overrides what it restates", () => {
  const base = defineTheme({
    name: "base",
    color: { accent: "#0064E0" },
    tokens: { "theme.custom": "inherited" },
  });
  const child = defineTheme({
    name: "child",
    extends: base,
    tokens: { "theme.accent-role.bg": "#FF0000" },
  });
  assert.equal(child.tokens["theme.custom"], "inherited");
  assert.equal(child.tokens["theme.accent-role.bg"], "#FF0000");
  assert.equal(child.tokens["theme.bg.canvas"], base.tokens["theme.bg.canvas"]);
});

test("a child's own generators outrank the inherited values", () => {
  const base = defineTheme({ name: "base", color: { accent: "#0064E0" } });
  const child = defineTheme({
    name: "child",
    extends: base,
    color: { accent: "#B7410E" },
  });
  assert.notEqual(
    child.tokens["theme.accent-role.bg"][0],
    base.tokens["theme.accent-role.bg"][0],
  );
});

test("extends refuses a non-theme rather than silently inheriting nothing", () => {
  assert.throws(
    () => defineTheme({ name: "x", extends: { tokens: {} } }),
    /must be a theme from defineTheme/,
  );
  assert.throws(
    () => defineTheme({ name: "x", extends: undefined }),
    /got undefined/,
  );
});

test("font families compose, and heading falls back to body", () => {
  const t = defineTheme({
    name: "x",
    typography: {
      body: { family: "Figtree", fallbacks: "sans-serif" },
      code: { family: "SF Mono", fallbacks: "monospace" },
    },
  });
  assert.equal(t.tokens["font.family.sans"], "Figtree, sans-serif");
  assert.equal(t.tokens["font.family.heading"], "Figtree, sans-serif");
  // A family with a space gets quoted so the stack stays valid CSS.
  assert.equal(t.tokens["font.family.mono"], "'SF Mono', monospace");
});

test("the returned theme is frozen", () => {
  const t = defineTheme({ name: "x", tokens: { a: "1" } });
  assert.throws(() => {
    t.tokens.a = "2";
  }, TypeError);
});
