// Everyone and everything that moves: the hero, the villagers, the duck, the
// fish, the goods you carry and the boat you are rebuilding. All original
// shapes, lofted in kit.js. Villagers share instanced meshes, so forty of them
// cost about the same as one.
import * as THREE from "three";
import { toon, ink, inked, hex, brush, noise2 } from "./kit.js";

const SKIN = [hex("#f2c49b"), hex("#d99f73"), hex("#b97e57"), hex("#ffd9b5")];
const NAVY = hex("#2a3560"), WHITE = hex("#ffffff"), DARK = hex("#1c2340"), BLUSH = hex("#ff9b8a");

const OUTFIT = {
  saltmaker: { shirt: hex("#f4f8ff"), sash: hex("#00bfff"), legs: hex("#5a7fb0"), hair: hex("#5a3b2a") },
  fisher: { shirt: hex("#2ec4b6"), sash: hex("#ffe08a"), legs: hex("#3d5a80"), hair: hex("#2c2433") },
  farmer: { shirt: hex("#7ccf6b"), sash: hex("#f2cf6b"), legs: hex("#a57e4b"), hair: hex("#3a2a22") },
  weaver: { shirt: hex("#a884f3"), sash: hex("#ff8fc2"), legs: hex("#5b3f9e"), hair: hex("#2a2038") },
  logger: { shirt: hex("#ff7d55"), sash: hex("#2a3560"), legs: hex("#5a4636"), hair: hex("#6b3e26") },
  keeper: { shirt: hex("#ffb84d"), sash: hex("#7a4a30"), legs: hex("#46507a"), hair: hex("#d8d8e4") },
};

function hatFor(b, role) {
  const o = OUTFIT[role];
  if (role === "farmer") {
    b.loft([{ y: 1.86, x: 1.02, c: hex("#d9a94a") }, { y: 1.96, x: 0.92 }, { y: 2.4, x: 0.08 }], hex("#f2cf6b"), { seg: 10, bottom: true, shade: 0.1 });
  } else if (role === "fisher") {
    b.loft([{ y: 1.9, x: 0.74 }, { y: 2, x: 0.56 }, { y: 2.22, x: 0.46 }, { y: 2.3, x: 0.3 }], hex("#ff9a45"), { seg: 10, bottom: true, shade: 0.1 });
  } else if (role === "logger") {
    b.loft([{ y: 1.84, x: 0.58 }, { y: 2.1, x: 0.54 }, { y: 2.32, x: 0.34 }, { y: 2.38, x: 0.12 }], hex("#3f4a78"), { seg: 10, shade: 0.1 });
    b.ball(0, 2.46, 0, 0.14, 0.14, 0.14, hex("#ffe08a"), { seg: 6, rows: 3 });
  } else if (role === "weaver") {
    b.loft([{ y: 1.5, x: 0.68, z: 0.66 }, { y: 1.95, x: 0.66, dz: -0.04 }, { y: 2.22, x: 0.42, dz: -0.04 }, { y: 2.32, x: 0.1 }], o.sash, { seg: 10, shade: 0.12, bottom: true });
  } else if (role === "saltmaker") {
    b.loft([{ y: 1.86, x: 0.62 }, { y: 1.98, x: 0.62 }], hex("#00bfff"), { seg: 10, top: false, shade: 0 });
    b.ball(0, 2.04, -0.05, 0.53, 0.28, 0.54, o.hair, { seg: 9, rows: 4 });
  } else {
    b.ball(0, 2.02, -0.04, 0.56, 0.34, 0.56, o.hair, { seg: 9, rows: 4 });
  }
}

// Body, head and clothes as one piece, standing on y = 0.
function personGeo(role, skin) {
  const o = OUTFIT[role];
  const b = brush();
  // legs and feet
  for (const s of [-1, 1]) {
    b.loft([{ y: 0.02, x: 0.15, z: 0.2, dx: s * 0.2, dz: 0.03, c: DARK }, { y: 0.16, x: 0.16, z: 0.2, dx: s * 0.2, dz: 0.03, c: DARK }, { y: 0.2, x: 0.14, dx: s * 0.2 }, { y: 0.55, x: 0.14, dx: s * 0.2 }], o.legs, { seg: 7 });
  }
  // body, a soft egg
  b.loft([{ y: 0.36, x: 0.2 }, { y: 0.46, x: 0.41 }, { y: 0.74, x: 0.45 }, { y: 1.02, x: 0.38 }, { y: 1.16, x: 0.24 }], o.shirt, { seg: 11, shade: 0.16 });
  b.loft([{ y: 0.6, x: 0.455 }, { y: 0.74, x: 0.462 }], o.sash, { seg: 11, top: false, shade: 0 });
  // arms
  for (const s of [-1, 1]) {
    b.ball(s * 0.5, 0.86, 0.02, 0.13, 0.28, 0.13, o.shirt, { seg: 6, rows: 3 });
    b.ball(s * 0.53, 0.6, 0.04, 0.12, 0.12, 0.12, skin, { seg: 6, rows: 3 });
  }
  // head: big, the face reads from far away
  b.ball(0, 1.58, 0, 0.62, 0.56, 0.58, skin, { seg: 12, rows: 7, shade: 0.1 });
  for (const s of [-1, 1]) b.ball(s * 0.62, 1.54, 0, 0.1, 0.13, 0.08, skin, { seg: 5, rows: 2 });
  for (const s of [-1, 1]) b.ball(s * 0.33, 1.42, 0.5, 0.11, 0.07, 0.03, BLUSH, { seg: 6, rows: 2, shade: 0 });
  b.ball(0, 1.82, -0.14, 0.58, 0.42, 0.52, o.hair, { seg: 10, rows: 5, shade: 0.14 });
  hatFor(b, role);
  return b.build();
}

const eyesGeo = (() => {
  const b = brush();
  for (const s of [-1, 1]) {
    b.ball(s * 0.22, 1.58, 0.56, 0.095, 0.13, 0.03, DARK, { seg: 8, rows: 3, shade: 0 });
    b.ball(s * 0.2, 1.62, 0.585, 0.03, 0.04, 0.012, WHITE, { seg: 5, rows: 2, shade: 0 });
  }
  return b.build();
})();
const smileGeo = (() => {
  const b = brush();
  b.ball(0, 1.38, 0.565, 0.09, 0.035, 0.02, hex("#a8483f"), { seg: 7, rows: 2, shade: 0 });
  return b.build();
})();

// All villagers. `set(i, x, y, z, ry, sy, blink)` poses one for this frame.
export function makeCrowd(scene, roles, lines = true) {
  const groups = [];
  const lookup = [];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  const total = roles.reduce((a, r) => a + r.count, 0);
  for (const r of roles) {
    const geos = [0, 1].map((k) => personGeo(r.key, SKIN[(k + r.key.length) % 4]));
    geos.forEach((g, k) => {
      const count = Math.ceil(r.count / 2);
      const body = new THREE.InstancedMesh(g, toon, count);
      const line = new THREE.InstancedMesh(g, ink, count);
      body.frustumCulled = line.frustumCulled = false;
      line.visible = lines;
      scene.add(body, line);
      groups.push({ role: r.key, body, line, k, used: 0 });
    });
  }
  const eyes = new THREE.InstancedMesh(eyesGeo, toon, total);
  const smile = new THREE.InstancedMesh(smileGeo, toon, total);
  eyes.frustumCulled = smile.frustumCulled = false;
  scene.add(eyes, smile);
  let n = 0;
  for (const r of roles) {
    for (let i = 0; i < r.count; i++) {
      const grp = groups.find((g) => g.role === r.key && g.k === i % 2);
      const slot = grp.used++;
      tint.setRGB(0.93 + noise2(n, 1) * 0.07, 0.93 + noise2(n, 2) * 0.07, 0.93 + noise2(n, 3) * 0.07);
      grp.body.setColorAt(slot, tint);
      lookup.push({ grp, slot });
      n++;
    }
  }
  groups.forEach((g) => (g.body.instanceColor.needsUpdate = true));
  return {
    set(i, x, y, z, ry, sy, blink, scale = 1) {
      const { grp, slot } = lookup[i];
      Q.setFromAxisAngle(Y, ry);
      const wide = 1 + (1 - sy) * 0.6;
      M.compose(P.set(x, y, z), Q, S.set(wide * scale, sy * scale, wide * scale));
      grp.body.setMatrixAt(slot, M);
      grp.line.setMatrixAt(slot, M);
      smile.setMatrixAt(i, M);
      if (blink) {
        // squash the eyes around their own height
        M.compose(P.set(x, y + 1.58 * sy * scale * 0.9, z), Q, S.set(wide * scale, sy * scale * 0.1, wide * scale));
      }
      eyes.setMatrixAt(i, M);
    },
    commit() {
      for (const g of groups) {
        g.body.instanceMatrix.needsUpdate = true;
        g.line.instanceMatrix.needsUpdate = true;
      }
      eyes.instanceMatrix.needsUpdate = true;
      smile.instanceMatrix.needsUpdate = true;
    },
  };
}

// The hero: same proportions, separate limbs so the walk can be animated.
export function makeHero() {
  const skin = SKIN[0];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const hoodie = hex("#17b4f5"), pants = hex("#2a3560"), scarf = hex("#ff8a3d"), hair = hex("#2b2036");
  const t = brush();
  t.loft([{ y: 0.42, x: 0.26 }, { y: 0.5, x: 0.44 }, { y: 0.76, x: 0.47 }, { y: 1.04, x: 0.4 }, { y: 1.18, x: 0.26 }], hoodie, { seg: 12, shade: 0.16 });
  t.ball(0.0, 0.8, 0.43, 0.2, 0.14, 0.05, hex("#0a8fd0"), { seg: 8, rows: 3, shade: 0 });
  t.loft([{ y: 1.04, x: 0.42 }, { y: 1.12, x: 0.44 }, { y: 1.24, x: 0.3 }], scarf, { seg: 12, shade: 0.1 });
  t.ball(0.2, 1.0, -0.42, 0.13, 0.26, 0.05, scarf, { seg: 6, rows: 3 });
  t.ball(0, 1.6, 0, 0.63, 0.57, 0.59, skin, { seg: 14, rows: 8, shade: 0.1 });
  for (const s of [-1, 1]) t.ball(s * 0.63, 1.56, 0, 0.1, 0.13, 0.08, skin, { seg: 5, rows: 2 });
  for (const s of [-1, 1]) t.ball(s * 0.34, 1.43, 0.51, 0.11, 0.07, 0.03, BLUSH, { seg: 6, rows: 2, shade: 0 });
  t.ball(0, 1.84, -0.12, 0.6, 0.45, 0.54, hair, { seg: 12, rows: 6, shade: 0.14 });
  t.ball(0.28, 2.0, 0.3, 0.26, 0.17, 0.2, hair, { seg: 7, rows: 3 });
  t.ball(-0.25, 2.0, 0.34, 0.22, 0.15, 0.17, hair, { seg: 7, rows: 3 });
  t.ball(0.02, 2.2, -0.06, 0.14, 0.2, 0.14, hair, { seg: 6, rows: 3 });
  const torso = inked(t.build(), body);
  torso.frustumCulled = false;
  // A pale outline of you, drawn only where something stands in front.
  const ghost = new THREE.Mesh(torso.geometry, new THREE.MeshBasicMaterial({ color: 0x4fc8f5, depthFunc: THREE.GreaterDepth, depthWrite: false }));
  ghost.renderOrder = 1;
  ghost.frustumCulled = false;
  body.add(ghost);

  const eyes = new THREE.Mesh(eyesGeo, toon);
  const smile = new THREE.Mesh(smileGeo, toon);
  eyes.scale.set(1.05, 1.05, 1.05);
  body.add(eyes, smile);

  const limb = (len, r, col, end) => {
    const b = brush();
    b.loft([{ y: -len, x: r * 0.8 }, { y: -len * 0.5, x: r }, { y: 0, x: r * 0.9 }], col, { seg: 7, bottom: true });
    b.ball(0, -len, 0.03, r * 1.15, r * 1.1, r * 1.3, end, { seg: 6, rows: 3 });
    return b.build();
  };
  const part = (geo, x, y) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    inked(geo, g);
    body.add(g);
    return g;
  };
  const armGeo = limb(0.42, 0.125, hoodie, skin);
  const legGeo = limb(0.42, 0.15, pants, hex("#ff8a3d"));
  const armL = part(armGeo, -0.52, 1.02), armR = part(armGeo, 0.52, 1.02);
  const legL = part(legGeo, -0.21, 0.5), legR = part(legGeo, 0.21, 0.5);
  armL.rotation.z = -0.14;
  armR.rotation.z = 0.14;

  // wearables
  const wear = {};
  const hat = brush();
  hat.loft([{ y: 2.0, x: 1.0, c: hex("#d9a94a") }, { y: 2.1, x: 0.9 }, { y: 2.2, x: 0.5 }, { y: 2.5, x: 0.46 }, { y: 2.58, x: 0.3 }], hex("#f7d77a"), { seg: 12, bottom: true, shade: 0.1 });
  hat.loft([{ y: 2.2, x: 0.52 }, { y: 2.32, x: 0.5 }], hex("#ff6b5a"), { seg: 12, top: false, shade: 0 });
  wear.hat = inked(hat.build(), body);
  const crown = brush();
  crown.loft([{ y: 2.1, x: 0.44 }, { y: 2.38, x: 0.5 }], hex("#ffd166"), { seg: 12, top: false, shade: 0.05 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.28;
    crown.ball(Math.cos(a) * 0.48, 2.46, Math.sin(a) * 0.48, 0.08, 0.14, 0.08, hex("#ffd166"), { seg: 5, rows: 2, shade: 0 });
  }
  wear.crown = inked(crown.build(), body);
  for (const k in wear) wear[k].visible = false;
  root.traverse((o) => {
    if (o.isMesh && o !== ghost) o.renderOrder = 2;
  });

  return { root, body, armL, armR, legL, legR, eyes, torso, wear };
}

// The ride: a chubby sky-blue duck that walks and swims.
export function makeDuck() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const blue = hex("#5ccbff"), belly = hex("#e9f8ff"), beak = hex("#ff9a45");
  const b = brush();
  b.ball(0, 1.15, -0.1, 1.05, 0.92, 1.38, blue, { seg: 13, rows: 8, shade: 0.2 });
  b.ball(0, 0.92, 0.12, 0.8, 0.62, 1.05, belly, { seg: 11, rows: 6, shade: 0.12 });
  for (const s of [-1, 1]) b.ball(s * 1.0, 1.25, -0.25, 0.2, 0.46, 0.76, hex("#2ba7ea"), { seg: 8, rows: 4 });
  b.ball(0, 1.62, -1.42, 0.3, 0.42, 0.4, belly, { seg: 7, rows: 4 });
  // saddle
  b.loft([{ y: 1.86, x: 0.62, z: 0.72, dz: -0.1, c: hex("#a4583a") }, { y: 2.02, x: 0.56, z: 0.66, dz: -0.1 }], hex("#ff6b5a"), { n: 3, seg: 12, shade: 0.1 });
  const torso = inked(b.build(), body);
  torso.frustumCulled = false;
  const neck = new THREE.Group();
  neck.position.set(0, 1.55, 1.05);
  body.add(neck);
  const h = brush();
  h.loft([{ y: -0.2, x: 0.42 }, { y: 0.34, x: 0.36 }, { y: 0.7, x: 0.42 }], blue, { seg: 10 });
  h.ball(0, 1.02, 0.1, 0.56, 0.54, 0.58, blue, { seg: 12, rows: 7, shade: 0.12 });
  h.ball(0, 0.92, 0.72, 0.34, 0.11, 0.3, beak, { seg: 9, rows: 3, shade: 0.1 });
  h.ball(0, 0.82, 0.68, 0.28, 0.07, 0.25, hex("#e97a2a"), { seg: 8, rows: 3, shade: 0 });
  h.ball(0, 1.6, 0.02, 0.09, 0.2, 0.09, blue, { seg: 5, rows: 3 });
  inked(h.build(), neck);
  const e = brush();
  for (const s of [-1, 1]) {
    e.ball(s * 0.27, 1.14, 0.56, 0.16, 0.19, 0.06, WHITE, { seg: 8, rows: 3, shade: 0 });
    e.ball(s * 0.26, 1.13, 0.61, 0.09, 0.115, 0.03, DARK, { seg: 7, rows: 3, shade: 0 });
  }
  neck.add(new THREE.Mesh(e.build(), toon));
  const foot = () => {
    const f = brush();
    f.rod([0, 0.42, 0], [0, 0.06, 0], 0.07, 0.06, beak, { seg: 5 });
    f.ball(0, 0.05, 0.14, 0.24, 0.05, 0.3, beak, { seg: 7, rows: 2, shade: 0 });
    return f.build();
  };
  const fg = foot();
  const fl = new THREE.Group(), fr = new THREE.Group();
  fl.position.set(-0.46, 0.36, 0);
  fr.position.set(0.46, 0.36, 0);
  inked(fg, fl);
  inked(fg, fr);
  body.add(fl, fr);
  return { root, body, neck, fl, fr };
}

// The shipwright at the bench gets a mesh of their own.
export function makeKeeper(role = "keeper") {
  const g = new THREE.Group();
  inked(personGeo(role, SKIN[1]), g);
  g.add(new THREE.Mesh(eyesGeo, toon), new THREE.Mesh(smileGeo, toon));
  return g;
}

// Goods as tiny props: carried on your back, flying between hands, and huge on
// the money pillar. Index order matches the rules: salt, fish, rice, cloth, wood.
export function goodGeo(g) {
  const b = brush();
  if (g === 0) {
    b.ball(0, 0.32, 0, 0.4, 0.34, 0.36, hex("#fbfdff"), { seg: 9, rows: 5, lump: 0.08, shade: 0.2 });
    b.loft([{ y: 0.6, x: 0.12 }, { y: 0.72, x: 0.2 }], hex("#00bfff"), { seg: 7, shade: 0 });
  } else if (g === 1) {
    b.at(0, 0.28, 0, 0, 1, 0, 0);
    b.ball(0, 0, 0, 0.46, 0.22, 0.17, hex("#2ec4b6"), { seg: 9, rows: 5, shade: 0.1 });
    b.ball(0.08, -0.08, 0, 0.32, 0.1, 0.13, hex("#d9fff6"), { seg: 7, rows: 3, shade: 0 });
    b.ball(-0.5, 0, 0, 0.1, 0.2, 0.05, hex("#ff9a45"), { seg: 6, rows: 3 });
    b.ball(0.28, 0.07, 0.15, 0.05, 0.05, 0.02, DARK, { seg: 5, rows: 2, shade: 0 });
    b.ball(0.28, 0.07, -0.15, 0.05, 0.05, 0.02, DARK, { seg: 5, rows: 2, shade: 0 });
  } else if (g === 2) {
    b.ball(0, 0.3, 0, 0.36, 0.34, 0.36, hex("#f7d77a"), { seg: 9, rows: 5, lump: 0.14, shade: 0.22 });
    b.loft([{ y: 0.02, x: 0.2 }, { y: 0.26, x: 0.42 }, { y: 0.32, x: 0.44 }], hex("#ff8a5a"), { seg: 10, bottom: true, top: false, shade: 0.2 });
  } else if (g === 3) {
    b.at(0, 0.28, 0, 0, 1, 1.57, 0);
    b.loft([{ y: -0.42, x: 0.26 }, { y: -0.4, x: 0.28 }, { y: 0.4, x: 0.28 }, { y: 0.42, x: 0.26 }], hex("#9b6df0"), { seg: 10, bottom: true, shade: 0.04 });
    b.loft([{ y: -0.16, x: 0.285 }, { y: 0.16, x: 0.285 }], hex("#ff8fc2"), { seg: 10, top: false, shade: 0 });
  } else {
    b.at(0, 0.24, 0, 0, 1, 1.57, 0);
    b.loft([{ y: -0.46, x: 0.22, c: hex("#f0cb96") }, { y: -0.44, x: 0.24 }, { y: 0.44, x: 0.24 }, { y: 0.46, x: 0.22, c: hex("#f0cb96") }], hex("#a86a42"), { seg: 8, bottom: true, shade: 0.04 });
  }
  return b.build();
}

// A fish: `a` body, `b` belly, length about 1.
export function fishGeo(a, c, fin) {
  const b = brush();
  const rings = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, r = Math.sin(t * Math.PI) ** 0.7 * 0.28 + 0.012;
    rings.push({ y: -0.6 + t * 1.2, x: r * 0.62, z: r, c: i < 4 ? mix3(a, c, 0.15) : a });
  }
  b.at(0, 0, 0, 0, 1, 0, -1.57).loft(rings, a, { seg: 9, bottom: true, shade: 0 });
  b.at().ball(0.72, 0, 0, 0.3, 0.05, 0.27, fin, { seg: 6, rows: 3 }).ball(0.1, 0, 0.27, 0.2, 0.04, 0.2, fin, { seg: 6, rows: 2 }).ball(0.1, 0, -0.27, 0.2, 0.04, 0.2, fin, { seg: 6, rows: 2 });
  b.ball(-0.36, 0.06, 0.16, 0.05, 0.05, 0.03, DARK, { seg: 5, rows: 2, shade: 0 }).ball(-0.36, 0.06, -0.16, 0.05, 0.05, 0.03, DARK, { seg: 5, rows: 2, shade: 0 });
  return b.build();
}
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// The boat, with the parts shown one by one as you pay for them.
export function makeBoat() {
  const root = new THREE.Group();
  const hullC = hex("#c98a56"), rim = hex("#ff6b5a"), deck = hex("#e8bb86");
  const wrecked = brush();
  wrecked.at(0, 0, 0, 0.1, 1, 0.05, 0.3);
  wrecked.loft([{ y: 0.1, x: 1.6, z: 0.5 }, { y: 0.8, x: 3.1, z: 1.1 }, { y: 1.3, x: 3.5, z: 1.3 }, { y: 1.38, x: 3.3, z: 1.12, c: rim }, { y: 0.7, x: 2.6, z: 0.82, c: hex("#7c5238") }], hullC, { n: 1.35, seg: 16, bottom: true, lump: 0.05 });
  wrecked.rod([0.3, 0.7, 0], [1.2, 3.1, 0.4], 0.13, 0.09, hex("#a86a42"));
  wrecked.at(-4.4, 0.4, 1.2, 0.7).block(0, 0, 0, 2, 0.14, 0.5, hullC).at(2.4, 0.3, 2.5, -0.5).block(0, 0, 0, 1.6, 0.14, 0.4, deck).at(-1.5, 0.4, -2.6, 1.1).rod([0, 0, 0], [2.6, 0.4, 0.2], 0.1, 0.08, hex("#a86a42"));
  const wreck = inked(wrecked.build(), root);
  const stage = (paint) => {
    const b = brush();
    paint(b);
    const m = inked(b.build(), root);
    m.frustumCulled = false;
    m.visible = false;
    return m;
  };
  const hull = stage((b) => {
    b.loft([{ y: 0.1, x: 1.6, z: 0.5, c: hex("#a86a42") }, { y: 0.8, x: 3.2, z: 1.15 }, { y: 1.4, x: 3.7, z: 1.35 }, { y: 1.56, x: 3.72, z: 1.37, c: rim }, { y: 1.68, x: 3.7, z: 1.35, c: rim }, { y: 1.7, x: 3.48, z: 1.14, c: rim }, { y: 1.25, x: 3.4, z: 1.08, c: deck }], hullC, { n: 1.35, seg: 18, bottom: true });
  });
  const mast = stage((b) => {
    b.rod([0.2, 1.2, 0], [0.2, 7.2, 0], 0.15, 0.1, hex("#a86a42"));
    b.rod([-1.8, 2.5, 0], [2.6, 2.5, 0], 0.08, 0.08, hex("#a86a42"));
  });
  const sail = stage((b) => {
    const rings = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      rings.push({ y: 2.6 + t * 4.3, x: 2.2 - t * 1.6, z: 0.05, dx: 0.3, dz: Math.sin(t * 3.14) * 0.45, c: i % 2 ? hex("#ffffff") : hex("#7fdcff") });
    }
    b.sway(0.25).loft(rings, WHITE, { n: 6, seg: 8, bottom: true, shade: 0 }).sway(0);
  });
  const rudder = stage((b) => {
    b.at(-3.8, 0, 0).block(0, 0.2, 0, 0.8, 1.4, 0.14, rim, { n: 6, seg: 8, bevel: 0.04 });
    b.at().sway(0.6).ball(0.8, 7.1, 0, 0.62, 0.28, 0.04, hex("#ffd166"), { seg: 7, rows: 3, shade: 0 }).sway(0);
  });
  return { root, wreck, parts: [hull, mast, sail, rudder] };
}
