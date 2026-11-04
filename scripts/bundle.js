// Builds single-file copies of the pages in dist/: the game (mintless.html)
// and the lab (mintless-lab.html), engine, rules and Three.js inlined, for
// playing without Node, opening offline, or as a demo backup.
// Run: npm run bundle
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const strip = (src) =>
  src
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];\s*$/gm, "")
    .replace(/^export\s+(const|function|async function)/gm, "$1");
const ENGINE = ["engine/rng.js", "rules/town.js", "engine/town.js", "engine/player.js", "engine/mystery.js"];
const GAME = ["engine/visitor.js", "engine/island.js", "web/kit.js", "web/island3d.js", "web/people.js", "web/art.js", "web/audio.js", "web/game.js"];
const chain = read("web/chain.json");

// Three.js as a plain object, so the page needs no import map or data URL.
function threeInline() {
  const src = read("web/vendor/three.module.min.js");
  const at = src.lastIndexOf("export{");
  const list = src.slice(at + 7, src.indexOf("}", at));
  const pairs = list.split(",").map((p) => {
    const [local, name] = p.trim().split(/\s+as\s+/);
    return `${name ?? local}:${local}`;
  });
  const body = src.slice(0, at) + src.slice(src.indexOf("}", at) + 1).replace(/^;/, "");
  return `const THREE = (() => {\n${body}\nreturn {${pairs.join(",")}};\n})();`;
}

function bundle(page, css, scripts, out, links) {
  const usesThree = scripts.includes("web/kit.js");
  const script = (usesThree ? threeInline() + "\n" : "") + [...ENGINE, ...scripts]
    .map((p) => `// ---- ${p}\n${strip(read(p))}`)
    .join("\n")
    .replace('await (await fetch("./chain.json", { cache: "no-store" })).json()', `(${chain.trim()})`);
  let html = read(page);
  html = html.replace(`<link rel="stylesheet" href="./${css}">`, () => `<style>\n${read(`web/${css}`)}\n</style>`);
  html = html.replace(/<script type="module" src="\.\/[a-z]+\.js"><\/script>/, () => `<script type="module">\n${script.replace(/<\/script/g, "<\\/script")}\n</script>`);
  html = html.replace(/\s*<script type="importmap">.*<\/script>/, "");
  for (const [from, to] of links) html = html.split(from).join(to);
  mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
  writeFileSync(new URL(`../dist/${out}`, import.meta.url), html);
  console.log(`dist/${out} written (${Math.round(html.length / 1024)} KB)`);
}

bundle("web/index.html", "game.css", GAME, "mintless.html", [['href="./lab.html"', 'href="./mintless-lab.html"']]);
bundle("web/lab.html", "lab.css", ["web/lab.js"], "mintless-lab.html", [['href="./index.html"', 'href="./mintless.html"']]);
