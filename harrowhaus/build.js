#!/usr/bin/env node
/**
 * Harrow Haus dogfooding build.
 *
 * Compiles source.html through the Quoin compiler with:
 *   tokens-geist (harvested)
 *   + project-local quoin.tokens.json overrides
 *   + vocab-marketing + vocab-editorial + vocab-dashboard
 *   + impl-tailwind
 *
 * Produces dist/index.html, plus the token-pack tokens.css and the
 * Tailwind shim CSS as static assets. Zero hand-written CSS in the
 * source — the page must render production-grade off the pack stack
 * alone.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAB_ROOT = path.resolve(__dirname, "..", "..", "..");
const COMPILER_DIST = path.resolve(LAB_ROOT, "01_compiler", "dist");
const REF_PACKS = path.resolve(LAB_ROOT, "02_reference-packs");
const HARVEST_PACKS = path.resolve(LAB_ROOT, "03_harvest", "packs");
const SHIM_CSS = path.join(REF_PACKS, "demos", "shared", "tailwind-shim.css");
const OUT = path.join(__dirname, "dist");

const url = (p) => pathToFileURL(p).href;
const { compile } = await import(url(path.join(COMPILER_DIST, "compiler.js")));
const {
  loadTokenPack,
  loadVocabularyPack,
  loadImplementationPack
} = await import(url(path.join(COMPILER_DIST, "pack-loader.js")));

async function main() {
  const [tokenPack, vocabMarketing, vocabEditorial, vocabDashboard, implTw] =
    await Promise.all([
      loadTokenPack(path.join(HARVEST_PACKS, "tokens-geist")),
      loadVocabularyPack(path.join(HARVEST_PACKS, "vocab-marketing")),
      loadVocabularyPack(path.join(REF_PACKS, "vocab-editorial")),
      loadVocabularyPack(path.join(REF_PACKS, "vocab-dashboard")),
      loadImplementationPack(path.join(REF_PACKS, "impl-tailwind"))
    ]);

  const overridesRaw = JSON.parse(
    await fs.readFile(path.join(__dirname, "quoin.tokens.json"), "utf8")
  );
  const projectTokens = flattenOverrides(overridesRaw);

  const source = await fs.readFile(path.join(__dirname, "source.html"), "utf8");
  const result = compile({
    source,
    tokenPack,
    vocabularyPacks: [vocabMarketing, vocabEditorial, vocabDashboard],
    implementationPack: implTw,
    projectTokens,
    filename: "dogfood/harrowhaus/source.html"
  });

  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, "index.html"), result.html, "utf8");

  // Pack the tokens.css from the base pack, then append the project
  // overrides so they win on cascade.
  const baseCss = await fs.readFile(
    path.join(HARVEST_PACKS, "tokens-geist", "tokens.css"),
    "utf8"
  );
  const overrideCss = buildOverrideCss(overridesRaw);
  await fs.writeFile(
    path.join(OUT, "tokens.css"),
    baseCss + "\n/* ---- Harrow Haus project overrides ---- */\n" + overrideCss
  );
  await fs.copyFile(SHIM_CSS, path.join(OUT, "impl.css"));

  // Eliminate any surviving Quoin tag — the dogfood gate is binary.
  const tagPattern = /<\/?([a-z][a-z0-9-]*)\b/g;
  const allTags = new Set();
  for (const m of result.html.matchAll(tagPattern)) allTags.add(m[1]);
  const quoinTags = [
    ...Object.keys(vocabMarketing.primitives),
    ...Object.keys(vocabEditorial.primitives),
    ...Object.keys(vocabDashboard.primitives)
  ];
  const survived = quoinTags.filter((t) => allTags.has(t));

  console.log(`compiled  ${result.html.length} bytes`);
  console.log(`warnings  ${result.warnings.length}`);
  console.log(`survived  ${survived.length === 0 ? "none" : survived.join(", ")}`);
  if (survived.length > 0) {
    console.error("FAIL: Quoin tags survived compilation");
    process.exit(1);
  }
}

function flattenOverrides(input) {
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (k.startsWith("$")) continue;
    if (v && typeof v === "object" && typeof v.$value === "string") {
      out[k] = v.$value;
    }
  }
  return out;
}

function buildOverrideCss(input) {
  const lines = [":root {"];
  for (const [k, v] of Object.entries(input)) {
    if (k.startsWith("$")) continue;
    if (v && typeof v === "object" && typeof v.$value === "string") {
      lines.push(`  --${k}: ${v.$value};`);
    }
  }
  lines.push("}", "");
  return lines.join("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
