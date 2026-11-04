// The look of the island: soft inked toys. Every solid thing is one ring of
// points lofted through heights, lit by one toon shader with a moving sun, and
// merged into a few draw calls. No image or model files, so the game stays
// one small page that a cheap laptop or phone can run.
import * as THREE from "three";

// Colours are written straight to the screen, as painted.
THREE.ColorManagement.enabled = false;

export const U = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uSun: { value: new THREE.Vector3(0.45, 0.8, 0.4).normalize() },
  uLight: { value: new THREE.Color(1, 0.98, 0.93) },
  uShade: { value: new THREE.Color(0.62, 0.66, 0.84) },
  uRim: { value: new THREE.Color(1, 1, 1) },
  uFog: { value: new THREE.Color(0.6, 0.85, 1) },
  uFogNear: { value: 60 },
  uFogFar: { value: 220 },
  uInk: { value: new THREE.Color(0.11, 0.13, 0.27) },
};

const VERT = /* glsl */ `
uniform float uTime, uWind;
attribute float sway;
varying vec3 vC, vN, vV;
varying float vD;
void main() {
  vec4 wp = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
    n = mat3(instanceMatrix) * n;
  #endif
  wp = modelMatrix * wp;
  n = mat3(modelMatrix) * n;
  if (sway > 0.0) {
    float s = sin(uTime * 1.6 + wp.x * 0.35 + wp.z * 0.27);
    float c = cos(uTime * 1.25 + wp.z * 0.31);
    wp.x += s * sway * uWind * 0.16;
    wp.z += c * sway * uWind * 0.11;
  }
  vC = color;
  #ifdef USE_INSTANCING_COLOR
    vC *= instanceColor;
  #endif
  vN = n;
  vV = cameraPosition - wp.xyz;
  vec4 mv = viewMatrix * wp;
  vD = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uSun, uLight, uShade, uRim, uFog;
uniform float uFogNear, uFogFar;
varying vec3 vC, vN, vV;
varying float vD;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(vV);
  float d = dot(n, uSun);
  float band = smoothstep(-0.12, -0.02, d) * 0.6 + smoothstep(0.42, 0.5, d) * 0.4;
  vec3 c = vC * mix(uShade, uLight, band);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.2);
  c += uRim * rim * 0.16 * (0.4 + 0.6 * band);
  float f = smoothstep(uFogNear, uFogFar, vD);
  gl_FragColor = vec4(mix(c, uFog, f), 1.0);
}`;

const INK_VERT = /* glsl */ `
uniform float uTime, uWind, uInkW;
attribute float sway;
varying float vD;
void main() {
  vec4 wp = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
    n = mat3(instanceMatrix) * n;
  #endif
  wp = modelMatrix * wp;
  n = normalize(mat3(modelMatrix) * n);
  if (sway > 0.0) {
    float s = sin(uTime * 1.6 + wp.x * 0.35 + wp.z * 0.27);
    float c = cos(uTime * 1.25 + wp.z * 0.31);
    wp.x += s * sway * uWind * 0.16;
    wp.z += c * sway * uWind * 0.11;
  }
  float dist = length(cameraPosition - wp.xyz);
  wp.xyz += n * clamp(dist * uInkW, 0.018, 0.1);
  vec4 mv = viewMatrix * wp;
  vD = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const INK_FRAG = /* glsl */ `
uniform vec3 uInk, uFog;
uniform float uFogNear, uFogFar;
varying float vD;
void main() {
  gl_FragColor = vec4(mix(uInk, uFog, smoothstep(uFogNear, uFogFar, vD)), 1.0);
}`;

export const toon = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, vertexColors: true });
export const ink = new THREE.ShaderMaterial({
  uniforms: { ...U, uInkW: { value: 0.0026 } },
  vertexShader: INK_VERT,
  fragmentShader: INK_FRAG,
  side: THREE.BackSide,
});

// A mesh and its ink line, added to the same parent.
export function inked(geo, parent, line = true) {
  const m = new THREE.Mesh(geo, toon);
  parent.add(m);
  if (line) {
    const o = new THREE.Mesh(geo, ink);
    m.add(o);
  }
  return m;
}

export const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
export const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function noise2(x, y) {
  let n = Math.imul((x | 0) * 374761393 + (y | 0) * 668265263, 1274126177);
  n ^= n >>> 13;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function smooth(x, y, size) {
  const fx = x / size, fy = y / size;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fx - ix, ty = fy - iy;
  const a = noise2(ix, iy), b = noise2(ix + 1, iy), c = noise2(ix, iy + 1), d = noise2(ix + 1, iy + 1);
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
export const sstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// A geometry painter. Set a transform with `at`, then loft rings of points.
export function brush() {
  const P = [], N = [], C = [], W = [], I = [];
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const E = new THREE.Euler();
  const NM = new THREE.Matrix3();
  const T = new THREE.Vector3(), S = new THREE.Vector3();
  const v = new THREE.Vector3();
  let wind = 0;

  const api = {
    at(x = 0, y = 0, z = 0, ry = 0, s = 1, rx = 0, rz = 0) {
      E.set(rx, ry, rz);
      Q.setFromEuler(E);
      M.compose(T.set(x, y, z), Q, S.set(s, s, s));
      NM.getNormalMatrix(M);
      return api;
    },
    sway(w) {
      wind = w;
      return api;
    },
    // rings: [{ y, x (half width), z (half depth), dx, dz, c (colour) }]
    // n = 2 is a circle, higher is a rounder square.
    loft(rings, color, { n = 2, seg = 10, top = true, bottom = false, lump = 0, shade = 0.16 } = {}) {
      const base = P.length / 3;
      const rows = rings.length;
      const cols = seg;
      const grid = [];
      for (let r = 0; r < rows; r++) {
        const R = rings[r];
        const rx = R.x, rz = R.z ?? R.x;
        for (let s = 0; s < cols; s++) {
          const a = (s / cols) * Math.PI * 2 + Math.PI / cols;
          const ca = Math.cos(a), sa = Math.sin(a);
          let x = Math.sign(ca) * Math.abs(ca) ** (2 / n) * rx;
          let z = Math.sign(sa) * Math.abs(sa) ** (2 / n) * rz;
          let bump = 1;
          if (lump) bump = 1 + (noise2(s * 7 + 3, r * 11 + base) - 0.5) * lump;
          grid.push([x * bump + (R.dx || 0), R.y, z * bump + (R.dz || 0)]);
        }
      }
      const at = (r, s) => grid[r * cols + ((s + cols) % cols)];
      for (let r = 0; r < rows; r++) {
        const R = rings[r];
        const col = R.c || color;
        const lit = 1 - shade + shade * (r / Math.max(1, rows - 1));
        for (let s = 0; s < cols; s++) {
          const g = at(r, s);
          const a = at(r, s + 1), b = at(r, s - 1);
          const u = at(Math.min(rows - 1, r + 1), s), d = at(Math.max(0, r - 1), s);
          const tx = a[0] - b[0], ty = a[1] - b[1], tz = a[2] - b[2];
          const sx = u[0] - d[0], sy = u[1] - d[1], sz = u[2] - d[2];
          let nx = ty * sz - tz * sy, ny = tz * sx - tx * sz, nz = tx * sy - ty * sx;
          const l = Math.hypot(nx, ny, nz) || 1;
          v.set(g[0], g[1], g[2]).applyMatrix4(M);
          P.push(v.x, v.y, v.z);
          v.set(nx / l, ny / l, nz / l).applyMatrix3(NM).normalize();
          N.push(v.x, v.y, v.z);
          C.push(col[0] * lit, col[1] * lit, col[2] * lit);
          W.push(wind * (R.y > 0 ? 1 : 0));
        }
      }
      for (let r = 0; r < rows - 1; r++)
        for (let s = 0; s < cols; s++) {
          const a = base + r * cols + s, b = base + r * cols + (s + 1) % cols;
          const c = base + (r + 1) * cols + s, d = base + (r + 1) * cols + (s + 1) % cols;
          I.push(a, c, b, b, c, d);
        }
      const cap = (r, up) => {
        const R = rings[r];
        const col = R.c || color;
        const lit = 1 - shade + shade * (r / Math.max(1, rows - 1));
        const mid = P.length / 3;
        v.set(R.dx || 0, R.y, R.dz || 0).applyMatrix4(M);
        P.push(v.x, v.y, v.z);
        v.set(0, up ? 1 : -1, 0).applyMatrix3(NM).normalize();
        N.push(v.x, v.y, v.z);
        C.push(col[0] * lit, col[1] * lit, col[2] * lit);
        W.push(wind);
        for (let s = 0; s < cols; s++) {
          const a = base + r * cols + s, b = base + r * cols + (s + 1) % cols;
          up ? I.push(a, mid, b) : I.push(a, b, mid);
        }
      };
      if (top) cap(rows - 1, true);
      if (bottom) cap(0, false);
      return api;
    },
    // A ball, squashed by rx, ry, rz.
    ball(x, y, z, rx, ry, rz, color, { seg = 10, rows = 6, lump = 0, shade = 0.18 } = {}) {
      const rings = [];
      for (let i = 0; i <= rows; i++) {
        const a = (i / rows) * Math.PI - Math.PI / 2;
        const r = Math.max(0.001, Math.cos(a));
        rings.push({ y: y + Math.sin(a) * ry, x: r * rx, z: r * rz, dx: x, dz: z });
      }
      return api.loft(rings, color, { seg, top: false, lump, shade });
    },
    // A soft-cornered block sitting on y.
    block(x, y, z, w, h, d, color, { n = 6, seg = 12, bevel = 0.08, shade = 0.16, taper = 1 } = {}) {
      const b = Math.min(bevel, h / 3);
      return api.loft(
        [
          { y, x: w / 2 - b, z: d / 2 - b, dx: x, dz: z },
          { y: y + b, x: w / 2, z: d / 2, dx: x, dz: z },
          { y: y + h - b, x: (w / 2) * taper, z: (d / 2) * taper, dx: x, dz: z },
          { y: y + h, x: (w / 2) * taper - b, z: (d / 2) * taper - b, dx: x, dz: z },
        ],
        color,
        { n, seg, shade, bottom: false },
      );
    },
    // A tube between two points, for rails, masts and limbs.
    rod(a, b, r0, r1, color, { seg = 6, shade = 0.08 } = {}) {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const len = Math.hypot(dx, dy, dz);
      const keep = M.clone();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
      const L = new THREE.Matrix4().compose(new THREE.Vector3(a[0], a[1], a[2]), q, new THREE.Vector3(1, 1, 1));
      M.multiply(L);
      NM.getNormalMatrix(M);
      api.loft(
        [
          { y: 0, x: r0 },
          { y: len, x: r1 },
        ],
        color,
        { seg, shade, bottom: true },
      );
      M.copy(keep);
      NM.getNormalMatrix(M);
      return api;
    },
    get count() {
      return I.length / 3;
    },
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
      g.setAttribute("sway", new THREE.Float32BufferAttribute(W, 1));
      g.setIndex(I);
      return g;
    },
  };
  return api.at();
}

