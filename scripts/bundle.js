// Builds single-file copies of the pages in dist/: the game (mintless.html)
// and the lab (mintless-lab.html), engine and rules inlined, for playing
// without Node, opening offline, or as a demo backup.
// Run: npm run bundle
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const strip = (src) =>
  src
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];\s*$/gm, "")
    .replace(/^export\s+(const|function|async function)/gm, "$1");
const ENGINE = ["engine/rng.js", "rules/town.js", "engine/town.js", "engine/player.js", "engine/mystery.js"];
const chain = read("web/chain.json");

function bundle(page, css, scripts, out, links) {
  const script = [...ENGINE, ...scripts]
    .map((p) => `// ---- ${p}\n${strip(read(p))}`)
    .join("\n")
    .replace('await (await fetch("./chain.json", { cache: "no-store" })).json()', `(${chain.trim()})`);
  let html = read(page);
  html = html.replace(`<link rel="stylesheet" href="./${css}">`, () => `<style>\n${read(`web/${css}`)}\n</style>`);
  html = html.replace(/<script type="module" src="\.\/[a-z]+\.js"><\/script>/, () => `<script type="module">\n${script}\n</script>`);
  for (const [from, to] of links) html = html.split(from).join(to);
  mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
  writeFileSync(new URL(`../dist/${out}`, import.meta.url), html);
  console.log(`dist/${out} written (${Math.round(html.length / 1024)} KB)`);
}

bundle("web/index.html", "game.css", ["engine/visitor.js", "web/pixel.js", "web/game.js"], "mintless.html", [['href="./lab.html"', 'href="./mintless-lab.html"']]);
bundle("web/lab.html", "lab.css", ["web/lab.js"], "mintless-lab.html", [['href="./index.html"', 'href="./mintless.html"']]);
