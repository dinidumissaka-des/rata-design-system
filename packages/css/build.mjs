// CSS build: copies each component file to dist/components/ and concatenates
// everything (tokens first) into dist/index.css for drop-in plain-HTML use.
import { mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Order matters: primitives (state-layer) before components that compose them.
const ORDER = [
  "state-layer.css",
  "spinner.css",
  // Beside spinner, the other loading placeholder; it composes nothing.
  "skeleton.css",
  // With the loading indicators; a status bar that composes nothing.
  "progress.css",
  "button.css",
  // After button: the same primary pair, and its `position: fixed` must win
  // over the state layer's `position: relative`.
  "fab.css",
  "button-group.css",
  "toggle-button.css",
  // After toggle-button: the attached bar overrides the radius each option sets.
  "toggle-button-group.css",
  "icon.css",
  // Before text-field: Field owns everything around a control's box, and the
  // components that compose it override only inside that box.
  "field.css",
  "text-field.css",
  // After text-field: all three borrow its look and its focus treatment.
  "textarea.css",
  "select.css",
  // After text-field: composes Field and redraws the text field's box, with two step wells.
  "number-field.css",
  // After text-field: composes Field and draws the text field's box once per character.
  "pin-input.css",
  "search.css",
  "checkbox.css",
  // After checkbox: radio shares its construction and overrides the shape.
  "radio.css",
  "radio-group.css",
  // After radio: the switch shares their construction and redraws the control.
  "switch.css",
  // Typography before the components that set text inside themselves: both are
  // element-agnostic and neither should win over a component's own type rules.
  "heading.css",
  "text.css",
  // After typography: a rule between text blocks, owning only its own border.
  "divider.css",
  // After typography, which a card holds but never restyles; before the
  // controls that sit inside one, so their own rules win any tie.
  "card.css",
  // Same reasoning as card: after typography and state-layer, before the
  // badges, links and buttons its cells hold, so their own rules win.
  "table.css",
  "badge.css",
  // After badge: the removable value is read beside the static label it is not.
  "chip.css",
  "avatar.css",
  "disclosure.css",
  "breadcrumbs.css",
  // After state-layer and beside breadcrumbs: a nav row that composes the
  // layer and must win its own current tint over nothing but itself.
  "pagination.css",
  "top-nav.css",
  "side-nav.css",
  // After side-nav: the drawer renders one and overrides its scrolling.
  "mobile-nav.css",
  // With the other navigation: a bar of links that composes the state layer
  // and overrides nothing loaded before it.
  "bottom-nav.css",
  "tabs.css",
  "segmented-control.css",
  "notice.css",
  // After notice: the same feedback family, drawn on the content's surface; it
  // only colours the Icon it holds, so it follows icon.css.
  "empty-state.css",
  // After notice, whose frame it copies; after button, whose margin it trims.
  "toast.css",
  // After notice: both are surfaces, and the menu sits above one.
  "menu.css",
  // After menu: the same top-layer surface and anchoring, read beside it.
  "popover.css",
  // After popover: the same top-layer anchoring, on an inverse chip instead.
  "tooltip.css",
  // After popover: the listbox popup composes .rata-popover and overrides its
  // padding, width and height.
  "combobox.css",
  // After combobox: the same field box beside an overlay, read with it.
  "date-picker.css",
  "dialog.css",
  // After dialog: Sheet is the same native-modal construction with different
  // geometry, and its rules are written to replace dialog.css's where they
  // overlap rather than to coexist with them.
  "sheet.css",
  "panel.css",
  // Near the end: a link sits inside other components' text, and its colour and
  // underline must win over the type rules of whatever it lands in.
  "link.css",
  // Last on purpose: a class whose job is to hide must not lose the cascade
  // to a component rule that happens to set position or padding.
  "visually-hidden.css",
];

const srcFiles = await readdir(path.join(root, "src"));
const unordered = srcFiles.filter((f) => f.endsWith(".css") && !ORDER.includes(f));
const files = [...ORDER.filter((f) => srcFiles.includes(f)), ...unordered];

await rm(path.join(root, "dist"), { recursive: true, force: true });
await mkdir(path.join(root, "dist/components"), { recursive: true });

// Breakpoints. var() cannot appear inside @media, so a component or page
// writes `@media (--rata-medium)` / `(--rata-wide)` and this step expands each
// name to the token's value at build time. dist/custom-media.css carries the
// same names as @custom-media rules for a consumer with a PostCSS toolchain.
const { tokens } = require("@rata/tokens");
const BREAKPOINTS = {
  "--rata-medium": `(min-width: ${tokens.breakpoint?.medium})`,
  "--rata-wide": `(min-width: ${tokens.breakpoint?.wide})`,
};
for (const [name, query] of Object.entries(BREAKPOINTS)) {
  if (query.includes("undefined")) throw new Error(`@rata/css: no token behind ${name}`);
}
function expandCustomMedia(css, file) {
  // Only inside an @media prelude — `var(--rata-…)` elsewhere is untouched.
  return css.replace(/@media[^{]*\{/g, (prelude) =>
    prelude.replace(/\((--rata-[a-z-]+)\)/g, (match, name) => {
      if (!(name in BREAKPOINTS)) throw new Error(`@rata/css: ${file} uses unknown custom media ${name}`);
      return BREAKPOINTS[name];
    })
  );
}

const tokensCss = require.resolve("@rata/tokens/css");
const parts = [await readFile(tokensCss, "utf8")];

for (const file of files) {
  const from = path.join(root, "src", file);
  const css = expandCustomMedia(await readFile(from, "utf8"), file);
  await writeFile(path.join(root, "dist/components", file), css);
  parts.push(css);
}

await writeFile(
  path.join(root, "dist/index.css"),
  "/* Generated by @rata/css — tokens + all components. */\n\n" + parts.join("\n")
);

await writeFile(
  path.join(root, "dist/custom-media.css"),
  "/* Generated by @rata/css — breakpoint names for PostCSS custom-media. */\n" +
    Object.entries(BREAKPOINTS).map(([n, q]) => `@custom-media ${n} ${q};`).join("\n") + "\n"
);

console.log(`@rata/css built: ${files.length} components`);
