import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { helpLines, voyageLimit } from "../web/help.js";

test("a newcomer sees the true deadline and how to leave fishing on a phone", () => {
  const help = helpLines(true, true).join(" ");
  assert.match(help, /no deadline/);
  assert.doesNotMatch(help, /before the tenth night/);
  assert.match(help, /Tap Stop fishing/);
  assert.match(help, /Drag the circle/);
  assert.match(help, /Drag the island/);
  assert.match(help, /gold slot/);
  assert.equal(voyageLimit(true), "no deadline");
  assert.equal(voyageLimit(false), "of 10");
  assert.match(helpLines(false, false).join(" "), /before the tenth night/);
  assert.match(helpLines(false, false).join(" "), /Press Q/);
});

test("the small-screen stylesheet keeps a finger-sized Help button accessible", () => {
  // Static CSS regression, not a browser layout measurement. The rule applies at 360px.
  const css = readFileSync(new URL("../web/game.css", import.meta.url), "utf8");
  const small = css.slice(css.indexOf("@media (max-width: 760px)"), css.indexOf("@media (max-height: 520px) {"));
  assert.match(small, /\.corner-btns\s*\{[^}]*display: flex/);
  assert.match(small, /\.corner-btns #help\s*\{[^}]*display: block;[^}]*min-width: 64px;[^}]*min-height: 44px/);
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  assert.match(html, /id="help"[^>]*>Help<\/button>/);
  assert.match(html, /id="day-limit"/);
});
