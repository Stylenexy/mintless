// web/audio.js — all game audio synthesized live with the Web Audio API (no files).
// Chain: master gain (0.8) -> DynamicsCompressor -> destination.
// All one-shots use short envelopes and low-pass filtering for a soft, rounded feel.

let auCtx = null;
let auMaster = null;
let auMuted = false;
let auNoiseBuf = null;
let auAmb = null;
let auMusicOn = false;
let auMusicTimer = null;
let auMusicNext = 0;
let auMusicBeat = 0;
let auMood = 'day';
let auMelodyIdx = 3;
const auScale = [220, 254, 292, 336, 386, 440, 508, 584];
const auStepDur = 60 / 84 / 2; // eighth note at ~84 bpm ≈ 0.357 s

export function unlockAudio() {
  try {
    if (!auCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const comp = (auCtx = new AC()).createDynamicsCompressor();
      auMaster = auCtx.createGain();
      auMaster.gain.value = auMuted ? 0 : 0.8;
      auMaster.connect(comp);
      comp.connect(auCtx.destination);
    }
    if (auCtx.state === 'suspended') auCtx.resume();
    return true;
  } catch (err) {
    auCtx = null;
    auMaster = null;
    return false;
  }
}

export function setMuted(flag) {
  auMuted = !!flag;
  if (auCtx && auMaster) {
    const t = auCtx.currentTime;
    auMaster.gain.cancelScheduledValues(t);
    auMaster.gain.setTargetAtTime(auMuted ? 0 : 0.8, t, 0.05);
  }
}

export function isMuted() {
  return auMuted;
}

function auPing(type, f0, f1, dur, vol, when, lp) {
  if (!auCtx || !auMaster) return;
  const t = when === undefined ? auCtx.currentTime : when;
  const o = auCtx.createOscillator();
  const g = auCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, f0), t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.012, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let out = o;
  if (lp) {
    const f = auCtx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(lp, t);
    o.connect(f);
    out = f;
  }
  out.connect(g);
  g.connect(auMaster);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function auBell(freq, when, dur, vol) {
  auPing('sine', freq, freq * 0.995, dur, vol, when);
  auPing('sine', freq * 2.76, freq * 2.755, dur * 0.35, vol * 0.35, when);
}

function auNoiseSrc() {
  if (!auCtx) return null;
  if (!auNoiseBuf) {
    const len = auCtx.sampleRate * 2;
    auNoiseBuf = auCtx.createBuffer(1, len, auCtx.sampleRate);
    const d = auNoiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = auCtx.createBufferSource();
  src.buffer = auNoiseBuf;
  src.loop = true;
  return src;
}

function auNoiseBurst(dur, vol, ftype, f0, f1, when, q) {
  if (!auCtx || !auMaster) return;
  const t = when === undefined ? auCtx.currentTime : when;
  const src = auNoiseSrc();
  if (!src) return;
  const f = auCtx.createBiquadFilter();
  const g = auCtx.createGain();
  f.type = ftype;
  f.frequency.setValueAtTime(f0, t);
  if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  if (q) f.Q.value = q;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(auMaster);
  src.start(t);
  src.stop(t + dur + 0.05);
}

function auTap(when) { // wood-block style knock
  auPing('sine', 850, 480, 0.055, 0.14, when, 1800);
  auPing('sine', 420, 300, 0.045, 0.1, when, 1100);
}

function auQuack(when) {
  if (!auCtx || !auMaster) return;
  const o = auCtx.createOscillator();
  const f = auCtx.createBiquadFilter();
  const g = auCtx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(300, when);
  o.frequency.exponentialRampToValueAtTime(140, when + 0.12); // fast pitch drop
  f.type = 'bandpass';
  f.frequency.setValueAtTime(1100, when);
  f.frequency.exponentialRampToValueAtTime(620, when + 0.12);
  f.Q.value = 4;
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(0.14, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.14);
  o.connect(f);
  f.connect(g);
  g.connect(auMaster);
  o.start(when);
  o.stop(when + 0.16);
}

function auThunder(when) { // 2.5 s low filtered noise rumble
  if (!auCtx || !auMaster) return;
  const src = auNoiseSrc();
  if (!src) return;
  const f = auCtx.createBiquadFilter();
  const g = auCtx.createGain();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(100, when);
  f.frequency.linearRampToValueAtTime(320, when + 0.4);
  f.frequency.linearRampToValueAtTime(70, when + 2.2);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(0.24, when + 0.35);
  g.gain.linearRampToValueAtTime(0.09, when + 1.3);
  g.gain.linearRampToValueAtTime(0, when + 2.5);
  src.connect(f);
  f.connect(g);
  g.connect(auMaster);
  src.start(when);
  src.stop(when + 2.5);
}

export function sfx(name) {
  if (!auCtx || auMuted) return;
  const t = auCtx.currentTime;
  switch (name) {
    case 'step': auPing('triangle', 150, 90, 0.08, 0.06, t, 900); break;
    case 'jump': auPing('triangle', 240, 480, 0.16, 0.1, t, 1600); break;
    case 'land': auPing('sine', 130, 60, 0.12, 0.12, t, 600); break;
    case 'splash': auNoiseBurst(0.45, 0.16, 'lowpass', 1400, 300, t); break;
    case 'plop': auPing('sine', 380, 120, 0.13, 0.14, t, 1000); break;
    case 'tick': auPing('sine', 1900, 1750, 0.045, 0.05, t); break; // tiny nibble
    case 'bite': // urgent double ping
      auPing('sine', 660, 640, 0.07, 0.12, t);
      auPing('sine', 880, 850, 0.07, 0.12, t + 0.09);
      break;
    case 'reel': // short ratchet click
      auNoiseBurst(0.03, 0.1, 'bandpass', 2400, 2400, t, 6);
      auPing('triangle', 640, 520, 0.035, 0.08, t, 2400);
      break;
    case 'creak': auNoiseBurst(0.55, 0.07, 'bandpass', 170, 140, t, 8); break; // line strain
    case 'snap': // line break: bright crack + low whip
      auNoiseBurst(0.1, 0.2, 'bandpass', 2600, 900, t, 3);
      auPing('sine', 220, 60, 0.18, 0.14, t + 0.02, 800);
      break;
    case 'catch': // rising 4-note happy arpeggio
      [392, 494, 587, 784].forEach((f, i) => auBell(f, t + i * 0.09, 0.18, 0.1));
      break;
    case 'swap': auTap(t); auTap(t + 0.11); break;
    case 'deny': // soft low double thud
      auPing('sine', 120, 108, 0.12, 0.16, t);
      auPing('sine', 95, 85, 0.16, 0.16, t + 0.14);
      break;
    case 'buy':
      auBell(660, t, 0.3, 0.1);
      auBell(990, t + 0.13, 0.4, 0.1);
      break;
    case 'part': // hammer knocks then 5-note fanfare
      auTap(t); auTap(t + 0.16); auTap(t + 0.32);
      [523, 659, 784, 988, 1175].forEach((f, i) => auBell(f, t + 0.58 + i * 0.12, 0.32, 0.1));
      break;
    case 'money': // bright bell swell for a new money
      auBell(587, t, 1.0, 0.12);
      auBell(880, t + 0.14, 1.0, 0.09);
      break;
    case 'thunder': auThunder(t); break;
    case 'quack': auQuack(t); auQuack(t + 0.18); break;
    case 'open': auPing('sine', 440, 660, 0.14, 0.08, t, 2000); break;
    case 'close': auPing('sine', 660, 440, 0.14, 0.08, t, 2000); break;
    case 'night': // soft descending two notes
      auPing('sine', 330, 328, 0.3, 0.08, t);
      auPing('sine', 262, 260, 0.45, 0.08, t + 0.28);
      break;
    case 'dawn': // soft rising three notes
      [330, 415, 494].forEach((f, i) => auPing('sine', f, f * 0.997, 0.28, 0.07, t + i * 0.18));
      break;
  }
}

// Villager gibberish: count syllables, 70 ms each with 25 ms gaps. Returns seconds.
export function babble(pitch, count) {
  if (!auCtx || !auMaster) return 0;
  count = Math.max(1, count | 0);
  const gap = 0.095;
  const t0 = auCtx.currentTime;
  for (let i = 0; i < count; i++) {
    const when = t0 + i * gap + 0.02;
    const f = Math.max(40, pitch * (0.82 + Math.random() * 0.36)); // around pitch, ±18%
    const glide = f * (0.9 + Math.random() * 0.2);
    const o = auCtx.createOscillator();
    const o2 = auCtx.createOscillator();
    const g = auCtx.createGain();
    const form = auCtx.createBiquadFilter(); // little formant-like bandpass sweep
    o.type = 'sine';
    o2.type = 'triangle';
    o.frequency.setValueAtTime(f, when);
    o.frequency.linearRampToValueAtTime(glide, when + 0.07);
    o2.frequency.setValueAtTime(f * 1.02, when);
    o2.frequency.linearRampToValueAtTime(glide * 1.02, when + 0.07);
    form.type = 'bandpass';
    form.frequency.setValueAtTime(f * 1.4, when);
    form.frequency.linearRampToValueAtTime(f * 2.2, when + 0.07);
    form.Q.value = 2;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.075, when + 0.02);
    g.gain.linearRampToValueAtTime(0, when + 0.07);
    o.connect(g);
    o2.connect(g);
    g.connect(form);
    form.connect(auMaster);
    o.start(when);
    o2.start(when);
    o.stop(when + 0.1);
    o2.stop(when + 0.1);
  }
  return count * gap;
}

// Looping filtered noise layers, created lazily once. sea/wind/rain are 0..1.
export function ambience(opts) {
  if (!auCtx || !auMaster) return;
  if (!auAmb) {
    const mk = (ftype, freq, q) => {
      const src = auNoiseSrc();
      if (!src) return null;
      const f = auCtx.createBiquadFilter();
      const g = auCtx.createGain();
      f.type = ftype;
      f.frequency.setValueAtTime(freq, auCtx.currentTime);
      if (q) f.Q.value = q;
      g.gain.value = 0;
      src.connect(f);
      f.connect(g);
      g.connect(auMaster);
      src.start();
      return g;
    };
    const sea = mk('lowpass', 380, 0.7);
    if (sea) {
      const lfo = auCtx.createOscillator(); // slow swell, 0.12 Hz
      lfo.frequency.value = 0.12;
      const depth = auCtx.createGain();
      depth.gain.value = 0.45;
      lfo.connect(depth);
      depth.connect(sea.gain);
      lfo.start();
    }
    auAmb = { sea, wind: mk('bandpass', 500, 1.2), rain: mk('highpass', 1800, 0.8) };
  }
  if (!auAmb) return;
  const t = auCtx.currentTime;
  const ramp = (node, level, cap) => {
    if (!node) return;
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(Math.max(node.gain.value, 0.0001), t);
    node.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, level)) * cap, t + 0.8);
  };
  ramp(auAmb.sea, opts.sea, 0.3);
  ramp(auAmb.wind, opts.wind, 0.12);
  ramp(auAmb.rain, opts.rain, 0.09);
}

// Sparse generative gamelan-ish tune on soft bells, very quiet.
export function music(on) {
  if (!auCtx) return;
  if (on && !auMusicOn) {
    auMusicOn = true;
    auMusicNext = auCtx.currentTime + 0.15;
    auMusicBeat = 0;
    auMusicTimer = setInterval(auMusicSchedule, 200);
  } else if (!on && auMusicOn) {
    auMusicOn = false;
    if (auMusicTimer) clearInterval(auMusicTimer);
    auMusicTimer = null;
  }
}

export function musicMood(name) {
  if (name === 'day' || name === 'dusk' || name === 'storm') auMood = name;
}

function auMusicSchedule() {
  if (!auCtx || !auMusicOn) return;
  const horizon = auCtx.currentTime + 0.6;
  while (auMusicNext < horizon) {
    const t = auMusicNext;
    const beat = auMusicBeat;
    const mul = auMood === 'storm' ? 0.89 : 1; // storm drops pitch a whole step
    if (beat % 8 === 0) auBell(110 * mul, t, 2.4, 0.06); // low gong, bar start
    if (beat % 8 === 0) auBell(220 * mul, t + 0.05, 1.1, 0.032); // ostinato A
    if (beat % 8 === 4) auBell(336 * mul, t + 0.05, 1.1, 0.03); // ostinato B
    const rate = auMood === 'storm' ? 0 : (auMood === 'dusk' ? 0.2 : 0.4);
    if (rate > 0 && Math.random() < rate) {
      auMelodyIdx = Math.min(7, Math.max(0, auMelodyIdx + (Math.random() < 0.5 ? -1 : 1)));
      auBell(auScale[auMelodyIdx] * mul, t, 0.9, 0.05);
    }
    auMusicNext += auStepDur;
    auMusicBeat = (beat + 1) % 64; // sparse repeating 8-bar pattern
  }
}
