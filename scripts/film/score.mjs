// The ad's music: an original track, made here, on the film's own beat map. 120 bpm, so a beat is
// half a second, thirty frames. F major. A hit on each of the first words, a riser into the drop,
// six bars of groove under the shots (a hit on each word card, a rewind for the time machine), an
// impact on the mark, and the chord ringing out under the name.
//   node scripts/film/score.mjs <out.wav>
import fs from "node:fs";

const RATE = 48000, BPM = 120, BEAT = 60 / BPM, BEATS = 44;
const N = Math.round(BEATS * BEAT * RATE);
const L = new Float32Array(N), R = new Float32Array(N);
const at = (beat) => Math.round((beat - 1) * BEAT * RATE); // beats count from 1, as in the cut
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// --- the beat map, shared with the cut ---
export const WORDS = [1, 2, 3, 13, 17, 21, 26, 30]; // a word card lands on each
const DROP = 9, MARK = 33, REWIND = 28;

// --- small tools ---
let seed = 7;
const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1;
function biquad(type, f, q) {
  const w = (2 * Math.PI * Math.min(f, RATE * 0.45)) / RATE, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
  let b0, b1, b2;
  if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
  else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  else { b0 = a; b1 = 0; b2 = -a; }
  const a0 = 1 + a;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * c) / a0, a2: (1 - a) / a0 };
}
function filter() {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, k = null;
  return { set(type, f, q = 0.707) { k = biquad(type, f, q); }, run(x) { const y = k.b0 * x + k.b1 * x1 + k.b2 * x2 - k.a1 * y1 - k.a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; } };
}
const add = (i, l, r = l) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r; } };
// the kick's pump on everything tonal that rides the groove
const pump = new Float32Array(N).fill(1);

// --- voices ---
function kick(b, v = 1) {
  const s = at(b);
  let ph = 0;
  for (let i = 0; i < 0.45 * RATE; i++) {
    const t = i / RATE, f = 48 + 120 * Math.exp(-t * 32);
    ph += (2 * Math.PI * f) / RATE;
    const click = i < 90 ? noise() * 0.25 * (1 - i / 90) : 0;
    add(s + i, (Math.sin(ph) * Math.exp(-t * 7.5) + click) * 0.62 * v);
  }
  for (let i = 0; i < 0.3 * RATE; i++) if (s + i < N) pump[s + i] = Math.min(pump[s + i], 1 - 0.62 * Math.exp(-(i / RATE) * 11));
}
function clap(b, v = 1) {
  const s = at(b), f = filter(); f.set("bp", 1500, 0.9);
  for (let i = 0; i < 0.32 * RATE; i++) {
    const t = i / RATE;
    const env = t < 0.024 ? (Math.floor(t / 0.008) % 1 === 0 ? Math.exp(-((t % 0.008) * 400)) : 0) : Math.exp(-(t - 0.024) * 16);
    const x = f.run(noise()) * env * 0.9 * v;
    add(s + i, x * 0.95, x);
    sendRev(s + i, x * 0.35);
  }
}
function hat(b, open = false, v = 1) {
  const s = at(b), f = filter(); f.set("hp", 7800, 0.7);
  const d = open ? 0.22 : 0.035;
  for (let i = 0; i < (d * 5) * RATE; i++) {
    const t = i / RATE, x = f.run(noise()) * Math.exp(-t / d) * 0.15 * v;
    add(s + i, x * (open ? 0.8 : 1.0), x * (open ? 1.0 : 0.85));
  }
}
function saw(ph) { return 2 * (ph - Math.floor(ph + 0.5)); }
function stab(b, notes, len = 0.32, v = 1, cut0 = 5200, cut1 = 1700, rev = 0.3) {
  const s = at(b), fl = filter(), fr = filter();
  const voices = notes.flatMap((m) => [-9, -3, 3, 9].map((c, k) => ({ f: hz(m) * Math.pow(2, c / 1200), ph: (noise() + 1) / 2, pan: k % 2 ? 0.75 : 0.25 })));
  for (let i = 0; i < (len + 0.25) * RATE; i++) {
    const t = i / RATE;
    if (i % 32 === 0) { const c = cut1 + (cut0 - cut1) * Math.exp(-t * 5); fl.set("lp", c, 0.9); fr.set("lp", c * 1.03, 0.9); }
    let l = 0, r = 0;
    for (const o of voices) { o.ph += o.f / RATE; const x = saw(o.ph); l += x * (1 - o.pan); r += x * o.pan; }
    const env = Math.min(1, t / 0.004) * (t < len ? Math.exp(-t * 2.2) : Math.exp(-len * 2.2) * Math.exp(-(t - len) * 18));
    const g = (0.12 * v * env) / Math.sqrt(notes.length);
    const xl = fl.run(l) * g, xr = fr.run(r) * g, p = pump[s + i] ?? 1;
    add(s + i, xl * p, xr * p);
    sendRev(s + i, (xl + xr) * rev * 0.5);
  }
}
function pad(b, beats, notes, v = 1, cut = 1400, attack = 0.25) {
  const s = at(b), len = beats * BEAT, fl = filter(), fr = filter();
  fl.set("lp", cut, 0.6); fr.set("lp", cut, 0.6);
  const voices = notes.flatMap((m) => [-12, -4, 4, 12].map((c, k) => ({ f: hz(m) * Math.pow(2, c / 1200), ph: (noise() + 1) / 2, pan: k % 2 ? 0.8 : 0.2 })));
  for (let i = 0; i < (len + 1.2) * RATE; i++) {
    const t = i / RATE;
    let l = 0, r = 0;
    for (const o of voices) { o.ph += o.f / RATE; const x = saw(o.ph); l += x * (1 - o.pan); r += x * o.pan; }
    const env = Math.min(1, t / attack) * (t < len ? 1 : Math.exp(-(t - len) * 3));
    const g = (0.065 * v * env) / Math.sqrt(notes.length);
    const xl = fl.run(l) * g, xr = fr.run(r) * g;
    add(s + i, xl, xr);
    sendRev(s + i, (xl + xr) * 0.4);
  }
}
function bass(b, m, len = 0.22, v = 1) {
  const s = at(b), f = filter();
  let ph = 0, ph2 = 0;
  for (let i = 0; i < (len + 0.05) * RATE; i++) {
    const t = i / RATE;
    if (i % 32 === 0) f.set("lp", 260 + 900 * Math.exp(-t * 14), 1.1);
    ph += hz(m) / RATE; ph2 += hz(m) / 2 / RATE;
    const env = Math.min(1, t / 0.003) * (t < len ? 1 : Math.exp(-(t - len) * 60));
    const x = (f.run(saw(ph)) * 0.7 + Math.sin(2 * Math.PI * ph2) * 0.45) * env * 0.28 * v * (pump[s + i] ?? 1);
    add(s + i, x);
  }
}
function pluck(b, m, v = 1) {
  const s = at(b);
  let ph = 0;
  for (let i = 0; i < 0.3 * RATE; i++) {
    const t = i / RATE;
    ph += hz(m) / RATE;
    const tri = 1 - 4 * Math.abs(ph - Math.floor(ph + 0.5)), sq = ph % 1 < 0.5 ? 1 : -1;
    const x = (tri * 0.75 + sq * 0.25) * Math.exp(-t * 16) * 0.17 * v;
    add(s + i, x * 0.7, x);
    // a dotted-eighth echo, the other side
    const e = s + i + Math.round(0.75 * BEAT * RATE);
    add(e, x * 0.35 * 0.9, x * 0.35 * 0.4);
    sendRev(s + i, x * 0.3);
  }
}
function riser(b0, beats, v = 1) {
  const s = at(b0), len = beats * BEAT, f = filter();
  let ph = 0;
  for (let i = 0; i < len * RATE; i++) {
    const t = i / RATE, k = t / len;
    if (i % 32 === 0) f.set("bp", 300 * Math.pow(30, k), 1.6);
    ph += (110 * Math.pow(8, k)) / RATE;
    const x = (f.run(noise()) * 0.6 + Math.sin(2 * Math.PI * ph) * 0.12) * k * k * 0.95 * v;
    add(s + i, x * (1 - 0.3 * Math.sin(t * 9)), x * (1 + 0.3 * Math.sin(t * 9)));
    sendRev(s + i, x * 0.3);
  }
}
function swoosh(b0, beats, v = 1) {
  // the rewind: noise falling through a band, left to right
  const s = at(b0), len = beats * BEAT, f = filter();
  for (let i = 0; i < len * RATE; i++) {
    const t = i / RATE, k = t / len;
    if (i % 32 === 0) f.set("bp", 9000 * Math.pow(1 / 30, k), 2.2);
    const x = f.run(noise()) * Math.sin(Math.PI * k) * 0.55 * v;
    add(s + i, x * (1 - k), x * k);
    sendRev(s + i, x * 0.25);
  }
}
function impact(b, v = 1) {
  const s = at(b), lf = filter(), hf = filter(); lf.set("lp", 180, 0.8); hf.set("hp", 5000, 0.7);
  let ph = 0;
  for (let i = 0; i < 2.4 * RATE; i++) {
    const t = i / RATE;
    ph += (40 + 30 * Math.exp(-t * 8)) / RATE;
    const boom = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 2.2) * 0.9;
    const thud = lf.run(noise()) * Math.exp(-t * 9) * 0.8;
    const crash = hf.run(noise()) * Math.exp(-t * 1.6) * 0.18;
    const x = (boom + thud + crash) * v;
    add(s + i, x + crash * 0.3, x - crash * 0.3);
    sendRev(s + i, crash * 0.6);
  }
}

// --- reverb: a Schroeder room on a send ---
const REV = new Float32Array(N);
function sendRev(i, x) { if (i >= 0 && i < N) REV[i] += x; }
function room() {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ d, buf: new Float32Array(d), i: 0 }));
  const alls = [225, 556].map((d) => ({ d, buf: new Float32Array(d), i: 0 }));
  const outL = new Float32Array(N), outR = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const x = REV[n];
    let y = 0;
    for (const c of combs) { const o = c.buf[c.i]; c.buf[c.i] = x + o * 0.84; c.i = (c.i + 1) % c.d; y += o; }
    y /= 4;
    for (const a of alls) { const o = a.buf[a.i]; const v = y + o * 0.5; a.buf[a.i] = v; y = o - v * 0.5; a.i = (a.i + 1) % a.d; }
    outL[n] = y; if (n + 340 < N) outR[n + 340] = y;
  }
  for (let n = 0; n < N; n++) { L[n] += outL[n] * 0.9; R[n] += outR[n] * 0.9; }
}

// --- the arrangement ---
const F = [53, 57, 60, 64], Am = [57, 60, 64, 67], Bb = [58, 62, 65, 69], C = [60, 64, 67, 74], Dm = [62, 65, 69, 72];
const F9 = [53, 57, 60, 64, 67];
const ROOT = { F: 41, Am: 45, Bb: 46, C: 48, Dm: 50 };

// 1. the words: a hit under each of the first three, the chord left hanging on the fourth beat
for (const b of [1, 2, 3]) { kick(b, 0.8); stab(b, F, 0.36, 1.0, 2400, 600, 0.45); }
pad(3, 2, F, 0.7, 900);
// 2. the reveal: Bb then C, opening up, a riser and a roll into the drop
pad(5, 2, Bb, 0.9, 1100, 0.12); pad(7, 2, C, 1.0, 1600, 0.12);
riser(5, 3.75, 1);
for (let k = 0; k < 8; k++) clap(5 + 2 + k * 0.25, 0.4 + k * 0.08);
// 3. the groove, six bars, under the shots
const bars = [["F", F], ["Am", Am], ["Bb", Bb], ["C", C], ["Dm", Dm], ["Bb", Bb]];
for (let bar = 0; bar < 6; bar++) {
  const b0 = DROP + bar * 4, [name, chord] = bars[bar];
  const last = bar === 5;
  for (let q = 0; q < 4; q++) kick(b0 + q);
  clap(b0 + 1); clap(b0 + 3);
  for (let e = 0; e < 16; e++) hat(b0 + e / 4, false, e % 2 ? 0.55 : 0.85);
  for (let q = 0; q < 4; q++) hat(b0 + q + 0.5, true, 0.55);
  // bass on the off-beats, an octave jump on the last
  for (let q = 0; q < 4; q++) bass(b0 + q + 0.5, ROOT[name] + (q === 3 ? 12 : 0));
  bass(b0, ROOT[name], 0.12, 0.7);
  // chords, syncopated: the and of one, two and a half, four
  const ch = last && true ? chord : chord;
  for (const p of [0.5, 1.75, 3]) stab(b0 + p, ch, 0.22, 0.95);
  // the last half bar lifts to C for the mark
  if (last) { stab(b0 + 3.5, C, 0.3, 1.1); }
  // a pluck arp from the third bar on
  if (bar >= 2) {
    const tones = [...chord.map((m) => m + 12), chord[1] + 24];
    for (let e = 0; e < 16; e++) pluck(b0 + e / 4, tones[[0, 2, 1, 3, 4, 3, 2, 1][e % 8]], e % 4 === 0 ? 1 : 0.7);
  }
}
// a hit on each word card in the groove
for (const b of WORDS.filter((b) => b >= DROP)) { impact(b, 0.22); stab(b, bars[Math.floor((b - DROP) / 4)][1], 0.3, 0.7, 4200, 900, 0.5); }
// the rewind under the flick back through the months
swoosh(REWIND, 2, 1);
// 4. the mark: an impact, the full chord, then the name over it ringing out
impact(MARK, 1);
kick(MARK, 1);
stab(MARK, F9, 1.2, 1.4, 5000, 1100, 0.7);
pad(MARK, 8, F9, 1.1, 1700, 0.02);
stab(MARK + 2, [65, 69, 72, 76], 0.5, 0.6, 3000, 800, 0.8);
stab(MARK + 4, [64, 67, 72, 76], 0.45, 0.42, 2600, 800, 0.85);
stab(MARK + 6, [60, 64, 67, 72], 0.6, 0.5, 2500, 700, 0.9);

room();
// master: soft clip, then -1 dB peak, a fade on the last half second
let peak = 0;
for (let n = 0; n < N; n++) { L[n] = Math.tanh(L[n] * 1.2); R[n] = Math.tanh(R[n] * 1.2); peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n])); }
const g = 0.89 / peak, fade = 0.5 * RATE;
const out = Buffer.alloc(44 + N * 4);
out.write("RIFF", 0); out.writeUInt32LE(36 + N * 4, 4); out.write("WAVE", 8); out.write("fmt ", 12);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(RATE, 24);
out.writeUInt32LE(RATE * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write("data", 36); out.writeUInt32LE(N * 4, 40);
for (let n = 0; n < N; n++) {
  const f = n > N - fade ? (N - n) / fade : 1;
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[n] * g * f)) * 32767), 44 + n * 4);
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[n] * g * f)) * 32767), 46 + n * 4);
}
fs.writeFileSync(process.argv[2] || "score.wav", out);
console.log("score", (N / RATE).toFixed(2), "s");
