// Goods as tiny pixel maps, used for the HUD and the marks over villagers.
const ICON_MAPS = [
  ["........", "...ww...", "..wwWw..", ".wwWwwW.", ".wWwwwWw", "wwwWwWww", "gggggggg", ".gggggg."],
  ["........", "......t.", ".tt..tt.", "tTTttTTt", "tTeTTTt.", ".tTTTTTt", "..tt..t.", "........"],
  ["...bb...", "..yYYy..", ".yyyyyy.", "yyYyyyYy", "yyyyyyyy", "yYyyYyyy", ".yyyyyy.", "..YYYY.."],
  ["........", ".vvvvvv.", "vVvvvvVv", "vvvvvvvv", "vVvvvvVv", "vvvvvvvv", ".VVVVVV.", "........"],
  ["........", "..oooo..", ".oOrroO.", "oOrOOrOo", "oOrOOrOo", ".oOrroO.", "..oooo..", "........"],
];
const ICON_PAL = {
  w: "#f4f7fb", W: "#cfd8e6", g: "#8b97ab", t: "#2ec4b6", T: "#178f86", e: "#141824",
  y: "#f2c94c", Y: "#c79a2b", b: "#8a6a2f", v: "#9b5de5", V: "#6c3fb3", o: "#b5651d", O: "#7a3f12", r: "#e0a060",
};

export function iconCanvas(good, scale = 4) {
  const map = ICON_MAPS[good];
  const cv = document.createElement("canvas");
  cv.width = cv.height = 10 * scale;
  const ctx = cv.getContext("2d");
  const on = (x, y) => y >= 0 && y < 8 && x >= 0 && x < 8 && map[y][x] !== ".";
  ctx.fillStyle = "#0b0e18";
  for (let y = -1; y <= 8; y++)
    for (let x = -1; x <= 8; x++)
      if (!on(x, y) && (on(x + 1, y) || on(x - 1, y) || on(x, y + 1) || on(x, y - 1))) ctx.fillRect((x + 1) * scale, (y + 1) * scale, scale, scale);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      if (!on(x, y)) continue;
      ctx.fillStyle = ICON_PAL[map[y][x]];
      ctx.fillRect((x + 1) * scale, (y + 1) * scale, scale, scale);
    }
  return cv;
}

export const iconURL = (good, scale = 4) => iconCanvas(good, scale).toDataURL();
