/**
 * @file readContracts.mjs
 * @input src/contracts/*.json and registry/components/*.json
 * @output One assembled usage model — the shape build.mjs consumes
 * @position Doc-source loader; consumed by build.mjs
 *
 * Documentation is stored one contract per thing, not as one catalogue:
 *
 *   src/contracts/theme.bg.json      the four background roles and nothing else
 *   src/contracts/focus.json         focus geometry
 *   src/contracts/system.json        rules, contrast pairings, known gaps
 *   registry/components/button.json  Button's manifest AND its token recipes
 *
 * This mirrors how the rest of the repo already splits — one file per
 * primitive scale, one manifest per component — and keeps each file small
 * enough to read whole and to merge without conflict. The single catalogue
 * it replaced was 1134 hand-edited lines.
 *
 * Two things stay central, in system.json, because they belong to no single
 * token: a contrast pairing names a foreground *and* a background, and a
 * system rule names neither.
 *
 * A component's recipe lives in its registry manifest rather than here, so
 * that one file answers everything about that component — status, files,
 * tier, and the exact token for every property.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));

/**
 * Assemble the usage model from the contract files.
 *
 * @param {{root: string, repoRoot: string}} options
 * @returns {Promise<{rules: string[], tokens: object, pairings: object[], knownGaps: object[], recipes: object, sources: Map<string,string>}>}
 */
export async function readContracts({ root, repoRoot }) {
  const dir = path.join(root, "src/contracts");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();

  const tokens = {};
  /** Which contract each entry came from — used to make errors point at a file. */
  const sources = new Map();
  let system = null;

  for (const file of files) {
    const contract = await readJson(path.join(dir, file));
    if (contract.$contract === "system") {
      system = contract;
      continue;
    }
    for (const [key, entry] of Object.entries(contract.tokens ?? {})) {
      if (sources.has(key)) {
        throw new Error(
          `Token "${key}" is documented twice: in ${sources.get(key)} and in ${file}. ` +
            `Each token belongs to exactly one contract.`,
        );
      }
      sources.set(key, file);
      tokens[key] = entry;
    }
  }

  if (!system) {
    throw new Error(
      `src/contracts/system.json is missing — it holds the rules, contrast ` +
        `pairings and known gaps, which belong to no single token.`,
    );
  }

  // Component recipes come from the registry manifests, so a component's
  // token spec sits beside its status and files rather than in a parallel
  // list that has to be kept in step with them.
  const recipes = {};
  const compDir = path.join(repoRoot, "registry/components");
  for (const file of (await readdir(compDir)).filter((f) => f.endsWith(".json")).sort()) {
    const manifest = await readJson(path.join(compDir, file));
    for (const [variant, recipe] of Object.entries(manifest.tokens ?? {})) {
      // "base" is the unqualified recipe for a single-variant component;
      // anything else reads as "<component>-<variant>".
      const name = variant === "base" ? manifest.name : `${manifest.name}-${variant}`;
      recipes[name] = recipe;
    }
  }

  return {
    rules: system.rules ?? [],
    pairings: system.pairings ?? [],
    knownGaps: system.knownGaps ?? [],
    tokens,
    recipes,
    sources,
  };
}
