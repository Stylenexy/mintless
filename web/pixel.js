// Pixel art for the town: palette, sprites as tiny text maps, and the world
// painter. Everything is drawn from code (no image files), so the whole game
// stays one small bundle and every pixel is ours.

export const VIEW_H = 225;
export const WORLD_W = 400;
export const STREET_TOP = 176;
export const STREET_BOTTOM = 196;

// One colour per good, chosen to read apart at 8 px: salt white, fish teal,
// rice gold, cloth violet, wood brown.
export const GOOD_COLOR = ["#f4f7fb", "#2ec4b6", "#f2c94c", "#9b5de5", "#b5651d"];

const PAL = {
  k: "#141824", w: "#f4f7fb", W: "#cfd8e6", g: "#8b97ab",
  t: "#2ec4b6", T: "#178f86", e: "#141824",
  y: "#f2c94c", Y: "#c79a2b", b: "#8a6a2f",
  v: "#9b5de5", V: "#6c3fb3",
  o: "#b5651d", O: "#7a3f12", r: "#e0a060",
  s: "#f1c7a0", S: "#d49a72", p: "#3a3f58", f: "#262a3a",
  d: "#00bfff", D: "#0a7fb8", R: "#e04f3f", G: "#5baa4a", n: "#d9b26f", N: "#a8823f",
  m: "#7a8ba6", M: "#55657e", u: "#7e57c2", c: "#8b5a2b", C: "#5e3a1a",
};

const ICON = [
  // salt: a white heap on a dish
  ["........", "...ww...", "..wwWw..", ".wwWwwW.", ".wWwwwWw", "wwwWwWww", "gggggggg", ".gggggg."],
  // fish
  ["........", "......t.", ".tt..tt.", "tTTttTTt", "tTeTTTt.", ".tTTTTTt", "..tt..t.", "........"],
  // rice sack
  ["...bb...", "..yYYy..", ".yyyyyy.", "yyYyyyYy", "yyyyyyyy", "yYyyYyyy", ".yyyyyy.", "..YYYY.."],
  // cloth bolt
  ["........", ".vvvvvv.", "vVvvvvVv", "vvvvvvvv", "vVvvvvVv", "vvvvvvvv", ".VVVVVV.", "........"],
  // wood log
  ["........", "..oooo..", ".oOrroO.", "oOrOOrOo", "oOrOOrOo", ".oOrroO.", "..oooo..", "........"],
];

// Characters, 8x12. h = hat, c = shirt, swapped per role.
const HEAD = ["..hhhh..", ".hhhhhh.", "hhhhhhhh", ".ssssss.", ".skssks.", ".ssssss."];
const BODY = [
  [...HEAD, "..cccc..", ".cccccc.", "s.cccc.s", "..pppp..", "..p..p..", ".ff..ff."],
  [...HEAD, "..cccc..", ".cccccc.", "s.cccc.s", "..pppp..", "..pp.p..", "..ff.ff."],
];

export const ROLE_LOOK = {
  saltmaker: { h: "#e8eef5", c: "#7a8ba6" },
  fisher: { h: "#f2c94c", c: "#2ec4b6" },
  farmer: { h: "#d9b26f", c: "#5baa4a" },
  weaver: { h: "#9b5de5", c: "#c86bd6" },
  logger: { h: "#e04f3f", c: "#8b5a2b" },
  you: { h: "#ffffff", c: "#00bfff" },
};

function paint(map, colors, scale = 1, outline = true) {
  const w = map[0].length + 2;
  const h = map.length + 2;
  const cv = document.createElement("canvas");
  cv.width = w * scale;
  cv.height = h * scale;
  const ctx = cv.getContext("2d");
  const px = (x, y, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(x * scale, y * scale, scale, scale);
  };
  if (outline) {
    for (let y = 0; y < map.length; y++)
      for (let x = 0; x < map[y].length; x++) {
        if (map[y][x] === ".") continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (ny < 0 || ny >= map.length || nx < 0 || nx >= map[0].length || map[ny][nx] === ".") px(nx + 1, ny + 1, "#0b0e18");
        }
      }
  }
  for (let y = 0; y < map.length; y++)
    for (let x = 0; x < map[y].length; x++) {
      const ch = map[y][x];
      if (ch === ".") continue;
      px(x + 1, y + 1, colors[ch] || PAL[ch] || "#ff00ff");
    }
  return cv;
}

const cache = new Map();
export function iconSprite(good, scale = 1) {
  const key = `i${good}x${scale}`;
  if (!cache.has(key)) cache.set(key, paint(ICON[good], {}, scale));
  return cache.get(key);
}

export function personSprite(look, frame, scale = 1) {
  const key = `p${look}${frame}x${scale}`;
  if (!cache.has(key)) cache.set(key, paint(BODY[frame], ROLE_LOOK[look], scale));
  return cache.get(key);
}

export function iconURL(good, scale = 4) {
  return iconSprite(good, scale).toDataURL();
}

// Sky colours across the day. phase 0 = noon, 0.5 = midnight.
const SKY = [
  [0, "#00bfff", "#9fe6ff"],
  [0.18, "#3aa0f0", "#ffb36b"],
  [0.27, "#5a3fb8", "#ff8a3d"],
  [0.36, "#141a46", "#3b2a78"],
  [0.5, "#070a1f", "#1a1a44"],
  [0.7, "#141a46", "#4a3488"],
  [0.82, "#5a7ff0", "#ffb36b"],
  [1, "#00bfff", "#9fe6ff"],
];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const x = hex(a), y = hex(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
};
function skyAt(phase) {
  for (let i = 1; i < SKY.length; i++) {
    if (phase <= SKY[i][0]) {
      const [p0, a0, b0] = SKY[i - 1];
      const [p1, a1, b1] = SKY[i];
      const t = (phase - p0) / (p1 - p0);
      return [mix(a0, a1, t), mix(b0, b1, t)];
    }
  }
  return [SKY[0][1], SKY[0][2]];
}
export function darkness(phase) {
  return Math.max(0, 1 - Math.abs(phase - 0.5) / 0.22);
}

// Deterministic sprinkle so stars, grass and stones never flicker.
function hash(n) {
  n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  n ^= n >>> 13;
  return (Math.imul(n, 0xc2b2ae35) >>> 0) / 4294967296;
}

export const STALLS = [
  { good: 0, role: "saltmaker", x: 40, roof: "#e8eef5", roofDark: "#a9b5c7", wall: "#6d7891", label: "Salt works" },
  { good: 1, role: "fisher", x: 120, roof: "#2ec4b6", roofDark: "#178f86", wall: "#3d5a73", label: "Fish dock" },
  { good: 2, role: "farmer", x: 200, roof: "#f2c94c", roofDark: "#c79a2b", wall: "#7a5a2e", label: "Rice farm" },
  { good: 3, role: "weaver", x: 280, roof: "#9b5de5", roofDark: "#6c3fb3", wall: "#5a3d7a", label: "Weavers" },
  { good: 4, role: "logger", x: 360, roof: "#e04f3f", roofDark: "#9a2f25", wall: "#6b4422", label: "Log camp" },
];

export function drawWorld(ctx, cam, viewW, t, phase, rainy) {
  const [top, bottom] = skyAt(phase);
  const g = ctx.createLinearGradient(0, 0, 0, STREET_TOP);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, STREET_TOP);
  if (rainy) {
    ctx.fillStyle = "rgba(40,48,70,0.45)";
    ctx.fillRect(0, 0, viewW, STREET_TOP);
  }

  const night = darkness(phase);
  // stars
  if (night > 0) {
    for (let i = 0; i < 70; i++) {
      const sx = hash(i * 7 + 1) * WORLD_W - cam * 0.2;
      const sy = hash(i * 13 + 5) * 110;
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
      ctx.fillStyle = `rgba(255,255,255,${(night * (0.4 + 0.6 * tw)).toFixed(2)})`;
      ctx.fillRect(Math.round(((sx % viewW) + viewW) % viewW), Math.round(sy), 1, 1);
    }
  }
  // sun or moon on an arc
  const ang = phase * Math.PI * 2;
  const bx = viewW / 2 + Math.sin(ang) * viewW * 0.38;
  const by = 70 - Math.cos(ang) * 50;
  const moon = phase > 0.25 && phase < 0.75;
  const ox = viewW / 2 - Math.sin(ang) * viewW * 0.38;
  const oy = 70 + Math.cos(ang) * 50;
  if (!rainy) disc(ctx, Math.round(bx), Math.round(by), 9, "#fff2b0", "#ffd166");
  if (moon) disc(ctx, Math.round(ox), Math.round(oy), 7, "#e8ecff", "#b8c0e8");

  // clouds drift
  for (let i = 0; i < 6; i++) {
    const cx = ((hash(i * 31) * 520 + t * (3 + i)) % 520) - 60 - cam * 0.3;
    const cy = 18 + hash(i * 17) * 50;
    cloud(ctx, Math.round(((cx % (viewW + 80)) + viewW + 80) % (viewW + 80)) - 40, Math.round(cy), night, rainy);
  }

  // far hills, two layers, slight parallax
  hills(ctx, cam * 0.25, viewW, 132, 22, night > 0.3 ? "#1d2a52" : rainy ? "#4a5f7a" : "#4fa36a", 3);
  hills(ctx, cam * 0.5, viewW, 150, 16, night > 0.3 ? "#172042" : rainy ? "#3f5468" : "#3d8a55", 7);

  ctx.save();
  ctx.translate(-cam, 0);
  for (const st of STALLS) stall(ctx, st, night, t);
  ground(ctx, night);
  ctx.restore();

  if (rainy) rain(ctx, t, viewW);
}

function disc(ctx, cx, cy, r, fill, rim) {
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y));
    ctx.fillStyle = Math.abs(y) > r - 2 ? rim : fill;
    ctx.fillRect(cx - w, cy + y, w * 2, 1);
  }
}

function cloud(ctx, x, y, night, rainy) {
  const c = rainy ? "#8a94ab" : night > 0.3 ? "#2a3466" : "#ffffff";
  const s = rainy ? "#6d7790" : night > 0.3 ? "#202857" : "#d8eefa";
  ctx.fillStyle = c;
  ctx.fillRect(x + 6, y, 14, 4);
  ctx.fillRect(x + 2, y + 3, 26, 5);
  ctx.fillRect(x, y + 6, 34, 4);
  ctx.fillStyle = s;
  ctx.fillRect(x + 1, y + 9, 32, 2);
}

function hills(ctx, off, viewW, base, amp, col, seed) {
  ctx.fillStyle = col;
  for (let x = 0; x < viewW; x += 2) {
    const wx = x + off;
    const h = Math.sin(wx / 37 + seed) * amp * 0.5 + Math.sin(wx / 13 + seed * 2) * amp * 0.25 + amp * 0.6;
    const yy = Math.round(base - h);
    ctx.fillRect(x, yy - (yy % 2), 2, STREET_TOP - yy + 2);
  }
}

function ground(ctx, night) {
  // grass lip
  for (let x = 0; x < WORLD_W; x += 1) {
    const tall = hash(x * 3) > 0.7 ? 1 : 0;
    ctx.fillStyle = night > 0.3 ? "#2c5a3a" : "#5fcf5a";
    ctx.fillRect(x, STREET_TOP - tall, 1, 2 + tall);
  }
  // street: packed earth with pebbles
  ctx.fillStyle = night > 0.3 ? "#5a4a3a" : "#c9a36b";
  ctx.fillRect(0, STREET_TOP + 2, WORLD_W, STREET_BOTTOM - STREET_TOP - 2);
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(hash(i * 11 + 3) * WORLD_W);
    const y = STREET_TOP + 3 + Math.floor(hash(i * 5 + 9) * (STREET_BOTTOM - STREET_TOP - 4));
    ctx.fillStyle = night > 0.3 ? "#4a3d30" : hash(i) > 0.5 ? "#b38d58" : "#dcb987";
    ctx.fillRect(x, y, 1 + (i % 2), 1);
  }
  // block ground below: dirt blocks with darker seams and stones
  for (let bx = 0; bx < WORLD_W; bx += 10) {
    for (let by = STREET_BOTTOM; by < VIEW_H; by += 10) {
      const deep = by > STREET_BOTTOM + 15;
      ctx.fillStyle = night > 0.3 ? (deep ? "#2a2230" : "#3b2c28") : deep ? "#7a5236" : "#9a6a43";
      ctx.fillRect(bx, by, 10, 10);
      ctx.fillStyle = night > 0.3 ? "#221b26" : deep ? "#5e3e28" : "#7d5434";
      ctx.fillRect(bx, by + 9, 10, 1);
      ctx.fillRect(bx + 9, by, 1, 10);
      const k = hash(bx * 31 + by * 7);
      if (k > 0.55) {
        ctx.fillStyle = night > 0.3 ? "#3d3540" : "#b08a63";
        ctx.fillRect(bx + 2 + Math.floor(k * 5), by + 3, 2, 1);
      }
      if (k > 0.92) {
        ctx.fillStyle = "#8f98a8";
        ctx.fillRect(bx + 3, by + 5, 3, 2);
      }
    }
  }
}

function stall(ctx, st, night, t) {
  const x0 = st.x - 24;
  const base = STREET_TOP;
  // back wall
  ctx.fillStyle = st.wall;
  ctx.fillRect(x0 + 3, base - 30, 42, 30);
  // planks
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  for (let y = base - 28; y < base; y += 5) ctx.fillRect(x0 + 3, y, 42, 1);
  // window with lamp light at night
  ctx.fillStyle = night > 0.3 ? "#ffb347" : "#1d2333";
  ctx.fillRect(x0 + 18, base - 24, 12, 8);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x0 + 23, base - 24, 1, 8);
  if (night > 0.3) {
    ctx.fillStyle = `rgba(255,179,71,${(0.12 * night).toFixed(2)})`;
    ctx.fillRect(x0 + 8, base - 30, 32, 34);
  }
  // posts
  ctx.fillStyle = "#4a2f1a";
  ctx.fillRect(x0, base - 34, 3, 34);
  ctx.fillRect(x0 + 45, base - 34, 3, 34);
  // striped awning
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? st.roof : st.roofDark;
    ctx.fillRect(x0 - 3 + i * 4.5, base - 40, 5, 7);
    ctx.fillRect(x0 - 3 + i * 4.5, base - 33, 5, 2 + (i % 2));
  }
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x0 - 3, base - 41, 54, 1);
  // counter with goods on display
  ctx.fillStyle = "#6b4422";
  ctx.fillRect(x0 + 2, base - 9, 44, 9);
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(x0 + 2, base - 10, 44, 2);
  const ic = iconSprite(st.good);
  for (let i = 0; i < 4; i++) ctx.drawImage(ic, x0 + 4 + i * 10, base - 19);
  // hanging sign
  ctx.fillStyle = "#2a1c12";
  ctx.fillRect(x0 + 17, base - 52, 14, 12);
  ctx.fillStyle = "#f4e3c1";
  ctx.fillRect(x0 + 18, base - 51, 12, 10);
  ctx.drawImage(ic, x0 + 19, base - 51);
  ctx.fillStyle = "#2a1c12";
  ctx.fillRect(x0 + 19, base - 54, 1, 3);
  ctx.fillRect(x0 + 28, base - 54, 1, 3);
}

const DROPS = Array.from({ length: 90 }, (_, i) => [hash(i * 3 + 1), hash(i * 7 + 2), 0.6 + hash(i * 5) * 0.6]);
function rain(ctx, t, viewW) {
  ctx.fillStyle = "rgba(170,200,255,0.55)";
  for (const [a, b, s] of DROPS) {
    const x = Math.floor((a * viewW + t * 20 * s) % viewW);
    const y = Math.floor((b * VIEW_H + t * 160 * s) % VIEW_H);
    ctx.fillRect(x, y, 1, 4);
  }
}

// A bouncing "!" over traders worth visiting next.
export function drawMarker(ctx, x, y, t) {
  const bob = Math.round(Math.sin(t * 6) * 1.5);
  ctx.fillStyle = "#0b0e18";
  ctx.fillRect(x - 2, y - 11 + bob, 5, 9);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(x - 1, y - 10 + bob, 3, 5);
  ctx.fillRect(x - 1, y - 4 + bob, 3, 1);
}

export function drawGlint(ctx, x, y, t, seed) {
  const k = (t * 1.5 + seed * 0.37) % 3;
  if (k > 0.35) return;
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(x, y - 1, 1, 3);
  ctx.fillRect(x - 1, y, 3, 1);
}
