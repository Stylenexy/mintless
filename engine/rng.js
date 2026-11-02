// Deterministic 32-bit PRNG (mulberry32). Integer-only so the Rust contract
// can reproduce exactly the same sequence with wrapping u32 arithmetic.

export function nextU32(state) {
  const a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { state: a, value: (t ^ (t >>> 14)) >>> 0 };
}

// Small stateful wrapper. `rng.state` is a plain u32 that can be saved
// into a town snapshot and restored later.
export function makeRng(seed) {
  const rng = {
    state: seed >>> 0,
    next() {
      const r = nextU32(rng.state);
      rng.state = r.state;
      return r.value;
    },
    below(n) {
      return rng.next() % n;
    },
  };
  return rng;
}
