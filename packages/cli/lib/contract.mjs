/**
 * @file contract.mjs
 * @input registry/components/*.json (written) + packages/react/src/*.tsx (derived)
 * @output One assembled component contract per component
 * @position Doc-source loader; consumed by scripts/generate-component-docs.mjs
 *
 * A component contract has two provenances and they are never mixed:
 *
 *   DERIVED  prop name, type, optionality, default, `extends` — parsed from
 *            packages/react/src/<name>.tsx by lib/index.mjs. Never written by
 *            hand, so it cannot drift from the component it describes.
 *   WRITTEN  what a prop is *for*, when not to reach for it, what it conflicts
 *            with, the obligation it puts on the caller, worked use cases —
 *            judgment a parser cannot recover from source. Lives in the
 *            component's registry manifest, beside its status, files, tier and
 *            token recipe, so one file answers everything about it.
 *
 * The build cross-checks the two, exactly as the token build cross-checks
 * src/contracts/*.json against the resolved tokens: a contract entry naming a
 * prop that does not exist fails, and a declared prop with no contract entry
 * fails. That check is the whole point — prose that nothing verifies is prose
 * that rots, and a rotted contract is worse than none because it is the file
 * agents are told to trust.
 *
 * Two modes, decided by whether the component is implemented yet:
 *
 *   spec        status.react is `future`. There is no source to check against,
 *               so the contract is the *intent*: the props API approved at
 *               gate 1 of STRUCTURE.md's build order, before any React exists.
 *   documented  status.react is `latest`. The source exists, so both
 *               directions of the cross-check are enforced — and because the
 *               contract was written first, this is where an implementation
 *               that quietly drifted from its approved API gets caught.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { repoRoot, getComponentProps, unionValues, resolveComponent } from "./index.mjs";

/** Fields a written prop entry may carry. Anything else is a typo — we fail on it. */
const PROP_FIELDS = new Set(["summary", "use", "dont", "conflicts", "a11y", "type", "default", "required"]);

const asArray = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

/**
 * Assemble one component's contract.
 *
 * @param {string} name kebab-case component name
 * @param {object} registry from loadRegistry()
 * @returns {Promise<object>} the merged contract, with an `issues` array that
 *   is empty when written and derived agree
 */
export async function getComponentContract(name, registry) {
  // Follows alsoKnownAs, so asking for `modal` or `segmented-control` answers
  // with the component that implements it rather than "Unknown". The contract
  // is the command CLAUDE.md points at first, so it has to resolve the same
  // names `props` does.
  const resolved = resolveComponent(name, registry);
  if (resolved.via !== undefined) {
    console.log(`"${resolved.via}" is ${resolved.name} in this system — showing that.\n`);
    name = resolved.name;
  }
  const entry = resolved.entry;
  if (!entry) {
    return { name, issues: [`Unknown component: "${name}". Run \`rata list\` — don't guess.`] };
  }

  const written = entry.props ?? {};
  const derivedResult = await getComponentProps(name, registry);
  const reactState = entry.status?.react?.state ?? "tbd";
  const issues = [];

  // `na` means CSS-only by design (state-layer): there is no props API to
  // contract, and demanding one would be documenting a thing that shouldn't
  // exist. A written `props` block on such a component is itself the error.
  const mode = derivedResult.implemented ? "documented" : reactState === "na" ? "css-only" : "spec";

  if (mode === "css-only" && Object.keys(written).length) {
    issues.push(
      `${name}: status.react is "na" (CSS-only), so it has no props API — but the manifest documents ` +
        `${Object.keys(written).join(", ")}. Describe it in \`usage\` instead.`
    );
  }

  for (const [propName, doc] of Object.entries(written)) {
    for (const field of Object.keys(doc)) {
      if (!PROP_FIELDS.has(field)) {
        issues.push(
          `${name}.props.${propName}: unknown field "${field}". Allowed: ${[...PROP_FIELDS].join(", ")}.`
        );
      }
    }
    if (!doc.summary) {
      issues.push(`${name}.props.${propName}: missing "summary" — every documented prop needs one line saying what it is for.`);
    }
  }

  let props = [];

  if (mode === "documented") {
    const derived = derivedResult.props ?? [];
    const derivedNames = new Set(derived.map((p) => p.name));

    for (const [propName, doc] of Object.entries(written)) {
      // type/default/required are DERIVED fields. Restating them here would
      // create the second source of truth this whole module exists to prevent,
      // and a restatement that silently disagrees with source is the exact
      // failure mode. Spec mode is the only place they may be written.
      for (const derivedOnly of ["type", "default", "required"]) {
        if (doc[derivedOnly] !== undefined) {
          issues.push(
            `${name}.props.${propName}.${derivedOnly} is written by hand, but ${name} is implemented — ` +
              `${derivedOnly} is read from the component's React source, at the path the manifest's files array names. Delete it from the manifest.`
          );
        }
      }
      if (!derivedNames.has(propName)) {
        issues.push(
          `${name}.props.${propName} is documented but ${derivedResult.importPath ?? "@rata/react"}'s ` +
            `${entry.title} does not declare it. Either the contract is stale or the prop was renamed.`
        );
      }
    }

    props = derived.map((prop) => {
      const doc = written[prop.name];
      if (!doc) {
        issues.push(
          `${name}.props.${prop.name} is declared in source but has no contract entry. ` +
            `Document it in registry/components/${name}.json — an undocumented prop is an unusable one.`
        );
      }
      return {
        ...prop,
        declared: true,
        summary: doc?.summary ?? null,
        use: asArray(doc?.use),
        dont: asArray(doc?.dont),
        conflicts: asArray(doc?.conflicts),
        a11y: doc?.a11y ?? null,
      };
    });
  } else if (mode === "spec") {
    // Nothing to cross-check against yet, so the written entry carries the
    // shape too — `type` and `default` become required rather than optional,
    // since no parser can supply them.
    props = Object.entries(written).map(([propName, doc]) => {
      if (!doc.type) {
        issues.push(
          `${name}.props.${propName}: a spec-mode contract must state "type" itself — there is no ` +
            `React source to read it from yet.`
        );
      }
      return {
        name: propName,
        type: doc.type ?? "unknown",
        // A spec type is a written string rather than parsed source, but a
        // union in it is still a union: read the members out of it so a spec
        // page can offer the same real choices an implemented one does.
        values: unionValues(doc.type),
        optional: !doc.required,
        default: doc.default,
        description: null,
        declared: false,
        summary: doc.summary ?? null,
        use: asArray(doc.use),
        dont: asArray(doc.dont),
        conflicts: asArray(doc.conflicts),
        a11y: doc.a11y ?? null,
      };
    });
  }

  // Every named conflict must be a real sibling prop, in either mode.
  const known = new Set(props.map((p) => p.name));
  for (const prop of props) {
    for (const other of prop.conflicts) {
      if (!known.has(other)) {
        issues.push(`${name}.props.${prop.name}.conflicts names "${other}", which is not a prop of this component.`);
      }
    }
  }

  const behavior = entry.behavior ?? null;
  if (behavior?.primitive) {
    const primitivePath = path.join(repoRoot, `packages/primitives/src/${name}.ts`);
    let source = null;
    try {
      source = await readFile(primitivePath, "utf8");
    } catch {
      issues.push(
        `${name}.behavior.primitive names "${behavior.primitive}" but packages/primitives/src/${name}.ts does not exist.`
      );
    }
    if (source && !new RegExp(`export function ${behavior.primitive}\\b`).test(source)) {
      issues.push(
        `${name}.behavior.primitive names "${behavior.primitive}", which packages/primitives/src/${name}.ts does not export.`
      );
    }
  }

  return {
    name,
    title: entry.title,
    description: entry.description,
    family: entry.family,
    tier: entry.tier ?? "free",
    status: entry.status ?? {},
    dependencies: entry.dependencies ?? [],
    importPath: derivedResult.importPath ?? "@rata/react",
    mode,
    note: derivedResult.note ?? null,
    extends: derivedResult.extends ?? null,
    props,
    usage: entry.usage ?? [],
    behavior,
    tokens: entry.tokens ?? {},
    example: derivedResult.example ?? null,
    issues,
  };
}

/** Every component's contract, in registry order. */
export async function getAllContracts(registry) {
  const names = Object.keys(registry).sort();
  const contracts = [];
  for (const name of names) contracts.push(await getComponentContract(name, registry));
  return contracts;
}
