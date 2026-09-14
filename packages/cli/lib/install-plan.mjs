// What `rata add` is actually going to write, worked out before anything is
// written — and the same computation a build-time check runs to prove the
// output would compile.
//
// The problem this exists to solve: a component's source lives flat in
// `packages/react/src/`, so it imports its helpers as `./cx.js`. The install
// layout is not flat — manifests send components to `components/` and shared
// helpers to `lib/` — so a verbatim copy emits a specifier pointing at a
// sibling that is one directory away. Every component with a `lib/` file was
// shipping an import that resolved to nothing.
//
// So the copy has to rewrite relative specifiers, and the rewrite has to be
// derived from the manifests rather than hardcoded, or it becomes a second
// source of truth for the layout.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "./index.mjs";

const CODE = /\.tsx?$/;

/** Relative `from "…"` / `import(…)` specifiers. Bare and aliased ones are left alone. */
const RELATIVE_IMPORT = /(\bfrom\s*|\bimport\s*\(\s*)(["'])(\.\.?\/[^"']+)\2/g;

/**
 * Resolve a relative specifier written in `fromSource` to a repo source file.
 *
 * TypeScript source in this repo uses ESM-correct `.js` specifiers that point
 * at `.ts`/`.tsx` files on disk, so the extension has to be mapped, not
 * trusted.
 */
function resolveSpecifier(fromSource, specifier, sourceExists) {
  const base = path.join(path.dirname(fromSource), specifier.replace(/\.js$/, ""));
  for (const candidate of [base + ".ts", base + ".tsx", base]) {
    if (sourceExists(candidate)) return candidate;
  }
  return null;
}

/**
 * The specifier to emit, given where both files land.
 *
 * Extensionless and relative, which is the form that needs no configuration
 * from the consumer: it resolves under Vite, Next, webpack and `tsc` with
 * bundler or node resolution alike. Keeping the `.js` would only work where
 * the toolchain maps it back to `.ts`, which a bundler does not, and an alias
 * (`@/lib/cx`) would require the consumer to have set one up.
 */
function specifierFor(fromTarget, toTarget) {
  const rel = path.relative(path.dirname(fromTarget), toTarget).replace(/\\/g, "/");
  const bare = rel.replace(CODE, "");
  return bare.startsWith(".") ? bare : `./${bare}`;
}

/** Every component reachable from `names` through `dependencies`, deduped. */
export function resolveClosure(names, registry) {
  const resolved = new Set();
  const queue = [...names];
  while (queue.length) {
    const name = queue.shift();
    if (resolved.has(name)) continue;
    const entry = registry[name];
    if (!entry) return { error: `Unknown component: ${name}` };
    resolved.add(name);
    queue.push(...(entry.dependencies ?? []));
  }
  return { resolved };
}

/**
 * Work out every file to write for `names`, and the import rewrites each needs.
 *
 * `problems` is the part worth checking in CI: an import that resolves to a
 * file nothing in the closure copies means the install is incomplete, and no
 * amount of path rewriting can fix it — the manifest is wrong.
 */
export async function planInstall(names, registry, options = {}) {
  const { readSource = (p) => readFile(path.join(repoRoot, p), "utf8") } = options;

  const { resolved, error } = resolveClosure(names, registry);
  if (error) return { error };

  // source → target across the whole closure. Two manifests may legitimately
  // list the same shared file; they must agree on where it goes.
  const targets = new Map();
  const conflicts = [];
  for (const name of resolved) {
    for (const file of registry[name].files ?? []) {
      const existing = targets.get(file.source);
      if (existing && existing !== file.target) {
        conflicts.push(`${file.source} is sent to both ${existing} and ${file.target}`);
      }
      targets.set(file.source, file.target);
    }
  }

  const sourceExists = (p) => targets.has(p);
  const files = [];
  const problems = [...conflicts];

  for (const name of [...resolved].sort()) {
    for (const file of registry[name].files ?? []) {
      if (!CODE.test(file.source)) {
        files.push({ ...file, rewrites: [] });
        continue;
      }
      const source = await readSource(file.source);
      const rewrites = [];
      for (const [, , , specifier] of source.matchAll(RELATIVE_IMPORT)) {
        const to = resolveSpecifier(file.source, specifier, sourceExists);
        if (!to) {
          problems.push(
            `${name}: ${file.source} imports "${specifier}", which no file in the install provides ` +
              `— add it to this component's files, or to a component it depends on`
          );
          continue;
        }
        const emitted = specifierFor(file.target, targets.get(to));
        if (emitted !== specifier) rewrites.push({ from: specifier, to: emitted });
      }
      files.push({ ...file, source, rewrites });
    }
  }

  return { resolved, files, problems };
}

/** Apply a planned file's rewrites to its source text. */
export function applyRewrites(source, rewrites) {
  if (!rewrites.length) return source;
  const byFrom = new Map(rewrites.map((r) => [r.from, r.to]));
  return source.replace(RELATIVE_IMPORT, (match, lead, quote, specifier) => {
    const to = byFrom.get(specifier);
    return to === undefined ? match : `${lead}${quote}${to}${quote}`;
  });
}
