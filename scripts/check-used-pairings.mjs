/**
 * Is every foreground/background pair a component actually puts together one
 * that has been measured?
 *
 * THE HOLE THIS CLOSES. `themes:check` re-measures every pairing in
 * `usage.contrast.pairings` against every brand, and the vibe checker flags
 * any pairing listed in `usage.contrast.knownGaps`. Both work from those two
 * lists — 37 pairings and 2 gaps — so a combination in NEITHER list is not
 * judged as good or bad. It is not judged at all.
 *
 * WHAT GOT THROUGH. `.rata-button--destructive` set
 * `theme.fg.on-accent` on `theme.danger-role.bg`, which is the anti-pattern
 * CLAUDE.md names outright: every filled role owns its own label token,
 * because `on-accent` INVERTS with the accent in the dark scheme while the
 * status fills do not move. Measured, it was 4.83:1 in light and 2.58:1 in
 * dark — below AA — and the pairing appeared in neither list, so nothing said
 * anything. Worse, a vibe unit test asserted that exact CSS produced no
 * violation, and passed: not because the pairing was sound, but because it
 * was unknown. A test that passes for the wrong reason is the failure mode
 * this repo keeps rediscovering.
 *
 * So the invariant is: used ⊆ documented ⊆ measured. This script owns the
 * first half; `themes:check` already owns the second.
 *
 * WHAT IT CANNOT SEE. Only pairs set in the SAME rule. A colour on one
 * element over a background inherited from an ancestor is a real pairing that
 * no regex can resolve, so this is a floor rather than a proof — it catches
 * the filled-surface case, which is where the label-token mistake lives.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

/** Strip comments so a token named in prose is not read as a declaration. */
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Same-rule foreground/background pairs, as {fg, bg, selector} entries.
 *
 * The `color` match guards against `-color` suffixes — `background-color` and
 * `border-color` are not foregrounds, and matching them made every bordered
 * surface look like a text pairing.
 */
export function usedPairings(css, resolve) {
  const found = [];
  for (const rule of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = rule;
    const fg = body.match(/(?<![\w-])color\s*:\s*var\(--rata-([a-z0-9-]+)\)/);
    const bg = body.match(/(?<![\w-])background(?:-color)?\s*:\s*var\(--rata-([a-z0-9-]+)\)/);
    if (!fg || !bg) continue;
    const fgPath = resolve(fg[1]);
    const bgPath = resolve(bg[1]);
    if (!fgPath || !bgPath) continue;
    found.push({ fg: fgPath, bg: bgPath, selector: selector.trim().split("\n")[0] });
  }
  return found;
}

async function main() {
  const usage = JSON.parse(
    await readFile(path.join(root, "packages/tokens/dist/usage.json"), "utf8"),
  );
  const resolve = (varName) => usage.index[`rata-${varName}`]?.path;
  const documented = new Map(
    usage.contrast.pairings.map((p) => [`${p.fg}|${p.bg}`, p]),
  );
  const gaps = new Set(usage.contrast.knownGaps.map((g) => `${g.fg}|${g.bg}`));

  const dir = path.join(root, "packages/css/src");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".css")).sort();

  const problems = [];
  let checked = 0;
  const seen = new Set();

  for (const file of files) {
    const css = await readFile(path.join(dir, file), "utf8");
    for (const { fg, bg, selector } of usedPairings(css, resolve)) {
      const key = `${fg}|${bg}`;
      checked++;
      if (documented.has(key)) {
        seen.add(key);
        continue;
      }
      if (gaps.has(key)) {
        problems.push(
          `${file} ${selector}: ${fg} on ${bg} is a DOCUMENTED CONTRAST GAP — ` +
            `usage.json says this combination is short of its target, and the ` +
            `component uses it anyway`,
        );
        continue;
      }
      problems.push(
        `${file} ${selector}: ${fg} on ${bg} is measured nowhere — it is neither ` +
          `in usage.contrast.pairings nor in knownGaps, so no check can tell you ` +
          `whether it clears AA in both schemes. Either document the pairing (which ` +
          `makes themes:check measure it across every brand) or use the token that ` +
          `role owns.`,
      );
    }
  }

  if (problems.length > 0) {
    console.error("✖ a component sets a colour pair nothing has measured:\n");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `every colour pair set in a component rule is measured — ${checked} pairings ` +
      `across ${files.length} stylesheets, ${seen.size} distinct, all documented.`,
  );
}

/** The positives that must fire, and the shapes that must not be mistaken for pairings. */
function selfTest() {
  const resolve = (v) =>
    ({
      "theme-fg-on-accent": "theme.fg.on-accent",
      "theme-danger-role-bg": "theme.danger-role.bg",
      "theme-danger-role-on": "theme.danger-role.on",
      "theme-border-default": "theme.border.default",
      "theme-bg-surface": "theme.bg.surface",
    })[v];

  const cases = [
    {
      name: "the bug that got through — on-accent over a status fill",
      css: ".b { background: var(--rata-theme-danger-role-bg); color: var(--rata-theme-fg-on-accent); }",
      expect: ["theme.fg.on-accent|theme.danger-role.bg"],
    },
    {
      name: "the role's own label token is still reported, for the list to judge",
      css: ".b { background: var(--rata-theme-danger-role-bg); color: var(--rata-theme-danger-role-on); }",
      expect: ["theme.danger-role.on|theme.danger-role.bg"],
    },
    {
      name: "declaration order does not matter",
      css: ".b { color: var(--rata-theme-fg-on-accent); background: var(--rata-theme-danger-role-bg); }",
      expect: ["theme.fg.on-accent|theme.danger-role.bg"],
    },
    {
      name: "background-color counts as a background",
      css: ".b { background-color: var(--rata-theme-danger-role-bg); color: var(--rata-theme-fg-on-accent); }",
      expect: ["theme.fg.on-accent|theme.danger-role.bg"],
    },
    {
      name: "border-color is NOT a foreground",
      css: ".b { background: var(--rata-theme-bg-surface); border-color: var(--rata-theme-border-default); }",
      expect: [],
    },
    {
      name: "a colour with no background in the same rule is not a pairing",
      css: ".b { color: var(--rata-theme-fg-on-accent); }",
      expect: [],
    },
    {
      name: "a pairing named only in a comment is not a pairing",
      css: "/* background: var(--rata-theme-danger-role-bg); color: var(--rata-theme-fg-on-accent); */\n.b { color: var(--rata-theme-danger-role-on); }",
      expect: [],
    },
  ];

  let failed = 0;
  for (const { name, css, expect } of cases) {
    const got = usedPairings(css, resolve).map((p) => `${p.fg}|${p.bg}`);
    const ok = got.length === expect.length && got.every((v, i) => v === expect[i]);
    console.log(`  ${ok ? "✓" : "✖"} ${name}`);
    if (!ok) {
      console.log(`      expected [${expect}], got [${got}]`);
      failed++;
    }
  }
  if (failed > 0) {
    console.error(`\n✖ the pairing scanner is not discriminating: ${failed} case(s) wrong`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nthe scanner bites: ${cases.length} cases, positives and negatives both.`);
}

if (process.argv.includes("--self-test")) selfTest();
else await main();
