// Shared logic behind `rata` (bin/rata.mjs) and the root ui-context generator
// (scripts/generate-ui-context.mjs). Kept here, once, so the CLI an agent
// runs interactively and the file an agent reads passively can never say two
// different things about the same component.
//
// Everything below reads straight from source (registry manifests, @rata/react
// .tsx files, @rata/tokens' build output) rather than a hand-maintained
// description. If it's wrong, the source is wrong — not a doc that drifted.
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../../..");
const registryDir = path.join(repoRoot, "registry/components");

export async function loadRegistry() {
  const entries = {};
  for (const file of await readdir(registryDir)) {
    if (!file.endsWith(".json")) continue;
    const manifest = JSON.parse(await readFile(path.join(registryDir, file), "utf8"));
    entries[manifest.name] = manifest;
  }
  return entries;
}

export function sortedEntries(registry) {
  return Object.values(registry).sort((a, b) => a.name.localeCompare(b.name));
}

function toPascalCase(kebab) {
  return kebab
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Parses `export interface <interfaceName> [extends ...] { ... }` — every
// prop the component actually declares, plus its leading `/** doc */` if any.
// Deliberately line-based rather than a full TS parse: the props interfaces
// in this repo are flat and single-line-per-field, and staying dependency-free
// matches every other build script in this monorepo.
function parsePropsInterface(source, interfaceName) {
  const header = source.match(new RegExp(`export interface ${interfaceName}\\b([^{]*)\\{`));
  if (!header) return null;
  const openIndex = header.index + header[0].length - 1;
  const closeIndex = findMatchingBrace(source, openIndex);
  const body = source.slice(openIndex + 1, closeIndex);
  const extendsMatch = header[1].match(/extends\s+([^\n{]+)/);

  const props = [];
  let pendingDoc = null;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("/**")) {
      pendingDoc = line.replace(/^\/\*\*|\*\/$/g, "").trim();
      continue;
    }
    if (line.startsWith("*") || line.startsWith("//")) continue;
    const propMatch = line.match(/^(\w+)(\?)?:\s*(.+?);?$/);
    if (propMatch) {
      props.push({
        name: propMatch[1],
        optional: Boolean(propMatch[2]),
        type: propMatch[3],
        description: pendingDoc,
      });
      pendingDoc = null;
    }
  }
  return { extends: extendsMatch ? extendsMatch[1].trim() : null, props };
}

// Defaults live in the destructured parameter list of the component function
// itself, e.g. `variant = "primary"` — not in the interface, so they need a
// second pass over the function signature.
function parseDefaults(source, componentName) {
  const fnMatch = source.match(new RegExp(`function ${componentName}\\s*\\(\\s*\\{`));
  if (!fnMatch) return {};
  const openIndex = source.indexOf("{", fnMatch.index);
  const closeIndex = findMatchingBrace(source, openIndex);
  const body = source.slice(openIndex + 1, closeIndex);
  const defaults = {};
  for (const match of body.matchAll(/(\w+)\s*=\s*("(?:[^"\\]|\\.)*"|[^,\n]+)/g)) {
    defaults[match[1]] = match[2].trim();
  }
  return defaults;
}

// `variant?: ButtonVariant` says what compiles but not what you may type, and
// the union members are one line away in the same file. Resolving them is what
// lets a UI offer the four real variants instead of a free-text box — and,
// like every other field here, it is read from source rather than restated.
function parseTypeAliases(source) {
  const aliases = {};
  for (const match of source.matchAll(/export type (\w+)\s*=\s*([^;]+);/g)) {
    aliases[match[1]] = match[2].trim();
  }
  return aliases;
}

/**
 * The string-literal members of a union type, or undefined when the type is
 * not one. Handles both an inline union (`"idle" | "valid"`) and a one-hop
 * alias to one (`ButtonVariant`); anything else — a generic, an object type, a
 * union of non-literals — has no enumerable set of values and gets none.
 */
export function unionValues(type, aliases = {}) {
  const resolved = aliases[type?.trim()] ?? type;
  if (typeof resolved !== "string") return undefined;
  const parts = resolved.split("|").map((part) => part.trim());
  if (parts.length < 2) return undefined;
  const values = [];
  for (const part of parts) {
    const literal = part.match(/^"([^"]*)"$/);
    if (!literal) return undefined;
    values.push(literal[1]);
  }
  return values;
}

async function walkFiles(dir, exts, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkFiles(full, exts, out);
    else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(full);
  }
  return out;
}

// Best-effort JSX usage extraction: real snippets from the repo, never
// synthesized. Handles the common cases (self-closing, single same-tag pair);
// it is not a JSX parser, so a deeply nested same-tag usage can over-match.
function extractTagUsages(source, tagName) {
  const usages = [];
  const selfClosing = new RegExp(`<${tagName}(?:\\s[^>]*)?/>`, "g");
  const container = new RegExp(`<${tagName}(?:\\s[^>]*)?>[\\s\\S]*?</${tagName}>`, "g");
  for (const re of [selfClosing, container]) {
    let match;
    while ((match = re.exec(source))) usages.push(match[0]);
  }
  return usages;
}

// Ranks by "cleanest" — fewest interpolations, then shortest — so a loop
// variable like `{variant}` loses to a literal, real usage.
export async function getExamples(tagName, limit = 1) {
  const files = await walkFiles(path.join(repoRoot, "apps"), [".tsx", ".jsx"]);
  const usages = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    usages.push(...extractTagUsages(source, tagName));
  }
  usages.sort(
    (a, b) => (a.match(/\{/g)?.length ?? 0) - (b.match(/\{/g)?.length ?? 0) || a.length - b.length
  );
  return usages.slice(0, limit);
}

/**
 * The published package name for a source path under packages/*.
 *
 * Read from that package's own package.json rather than guessed from the
 * directory: `packages/icons` publishes as `@rata/icons`, and the two only
 * happen to look alike. A component's documented import has to be the one a
 * consumer would actually write.
 */
function packageNameFor(sourcePath) {
  const dir = sourcePath.split("/")[1];
  if (!dir) return "@rata/react";
  try {
    const manifest = JSON.parse(
      readFileSync(path.join(repoRoot, "packages", dir, "package.json"), "utf8")
    );
    return manifest.name ?? "@rata/react";
  } catch {
    return "@rata/react";
  }
}

/**
 * The component that answers to `name`, following `alsoKnownAs`.
 *
 * The repo's premise is that looking a component up is cheaper than
 * remembering it — which fails the moment someone looks up a real name this
 * system happens to spell differently. `segmented-control` is the case that
 * prompted this: it exists, as `toggle-button-group` in its default
 * configuration, and asking for it by the name on every other design system's
 * tin returned "Unknown component". That is the lookup surface being wrong,
 * not the asker.
 */
export function resolveComponent(name, registry) {
  if (registry[name]) return { name, entry: registry[name] };
  for (const [canonical, entry] of Object.entries(registry)) {
    if ((entry.alsoKnownAs ?? []).includes(name)) {
      return { name: canonical, entry, via: name };
    }
  }
  return {};
}

export async function getComponentProps(name, registry) {
  const { name: resolved, entry, via } = resolveComponent(name, registry);
  if (!entry) return { error: `Unknown component: "${name}". Run \`rata list\` — don't guess.` };
  if (via !== undefined) {
    console.log(`"${via}" is ${resolved} in this system — showing that.\n`);
  }
  name = resolved;

  // The manifest declares where a component's React source lives, so this
  // trusts it rather than assuming one package. @rata/icons holds its own
  // component, and hardcoding packages/react/src/ made the docs build treat it
  // as having no source at all — i.e. as an unimplemented spec.
  const reactFile = entry.files?.find((f) => /^packages\/[^/]+\/src\/.+\.tsx$/.test(f.source));
  if (!reactFile) {
    const state = entry.status?.react?.state ?? "tbd";
    return {
      name,
      title: entry.title,
      implemented: false,
      note:
        state === "na"
          ? `No standalone React component — "${entry.title}" is CSS-only (see registry description), composed onto other components' className.`
          : `No React implementation yet (status: ${state}). There is nothing to look up — don't invent props for this one.`,
    };
  }

  const source = await readFile(path.join(repoRoot, reactFile.source), "utf8");
  const pascal = toPascalCase(name);
  const parsed = parsePropsInterface(source, `${pascal}Props`);
  const defaults = parseDefaults(source, pascal);

  // A prop's union type may be declared in the primitive rather than beside the
  // component — `orientation?: ButtonGroupOrientation` re-exported from
  // @rata/primitives, say. Following that one hop is what keeps "look it up" true
  // for types the component owns but does not declare; re-declaring them in the
  // .tsx to keep the parser happy would be the second source of truth this
  // whole module exists to prevent. Local declarations still win.
  let aliases = parseTypeAliases(source);
  try {
    const primitiveSource = await readFile(
      path.join(repoRoot, `packages/primitives/src/${name}.ts`),
      "utf8"
    );
    aliases = { ...parseTypeAliases(primitiveSource), ...aliases };
  } catch {
    // No primitive for this component — nothing to resolve against.
  }
  const props = (parsed?.props ?? []).map((prop) => ({
    ...prop,
    default: defaults[prop.name],
    values: unionValues(prop.type, aliases),
  }));
  const [example] = await getExamples(pascal, 1);

  return {
    name,
    title: entry.title,
    // Derived from where the source actually lives, so a component in its own
    // package documents the import a consumer would really write.
    importPath: packageNameFor(reactFile.source),
    implemented: true,
    extends: parsed?.extends ?? null,
    props,
    example: example ?? null,
  };
}

// Flat resolved token map, e.g. { "color-accent-500": "#3b82f6", "space-4": "16px" }.
// Reads @rata/tokens' own build output rather than re-resolving base+theme JSON
// a second time — one resolver (packages/tokens/build.mjs), two readers.
export async function getTokens() {
  const distPath = path.join(repoRoot, "packages/tokens/dist/index.js");
  let mod;
  try {
    mod = await import(pathToFileURL(distPath).href);
  } catch {
    return null; // not built yet
  }
  const flatten = (node, prefix = []) => {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "string") out[[...prefix, key].join("-")] = value;
      else Object.assign(out, flatten(value, [...prefix, key]));
    }
    return out;
  };
  return flatten(mod.tokens);
}

const LANDMARKS = ["header", "nav", "main", "aside", "footer"];

function describeShell(source) {
  const present = LANDMARKS.filter((tag) => new RegExp(`<${tag}[\\s>]`).test(source));
  const sectionCount = (source.match(/<section[\s>]/g) ?? []).length;
  const parts = [...present];
  if (sectionCount) parts.push(`section×${sectionCount}`);
  return parts.length ? parts.join(" → ") : "no structural landmarks detected";
}

// Existing page shells, for the "find the precedent" step of the pre-write
// ritual — one entry per app entry-point found under apps/*/src.
export async function getPages() {
  const appsDir = path.join(repoRoot, "apps");
  let appDirs;
  try {
    appDirs = await readdir(appsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const pages = [];
  for (const dirent of appDirs) {
    if (!dirent.isDirectory()) continue;
    const files = await walkFiles(path.join(appsDir, dirent.name, "src"), [".tsx", ".jsx"]);
    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (!/export function App\b|export default function/.test(source)) continue;
      pages.push({ path: path.relative(repoRoot, file), shell: describeShell(source) });
    }
  }
  return pages;
}
