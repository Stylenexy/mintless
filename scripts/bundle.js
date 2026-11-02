// Builds dist/mintless.html: the whole game in one file (engine, rules, page),
// for playing without Node, opening offline, or as a demo backup.
// Run: npm run bundle
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const strip = (src) =>
  src
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];\s*$/gm, "")
    .replace(/^export\s+(const|function|async function)/gm, "$1");

const modules = ["engine/rng.js", "rules/town.js", "engine/town.js", "engine/player.js", "engine/mystery.js", "web/app.js"].map((p) => `// ---- ${p}\n${strip(read(p))}`);
const chain = read("web/chain.json");
const script = modules.join("\n").replace('await (await fetch("./chain.json", { cache: "no-store" })).json()', `(${chain.trim()})`);

let html = read("web/index.html");
html = html.replace('<link rel="stylesheet" href="./style.css">', () => `<style>\n${read("web/style.css")}\n</style>`);
html = html.replace('<script type="module" src="./app.js"></script>', () => `<script type="module">\n${script}\n</script>`);

mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
writeFileSync(new URL("../dist/mintless.html", import.meta.url), html);
console.log(`dist/mintless.html written (${Math.round(html.length / 1024)} KB)`);
