// The ad's footage: short takes of the real demo canvas, each exactly a beat or two long (a beat
// is 30 frames at 120 bpm), with the camera close on what happens. The cut (ad-cut.py) lays them
// on the beat between the words.
//   FILM_HOME=<the film server's demo folder> node scripts/film/ad.mjs <desktop|phone> <out dir> [take names]
import path from "node:path";
import { openCanvas } from "./frame.mjs";
import { holdBack, land, heldNote, reply, FIX } from "./stage.mjs";

const URL = process.env.FILM_URL || "http://localhost:4805";
const HOME = process.env.FILM_HOME;
const [view = "desktop", OUT] = process.argv.slice(2);
const only = process.argv.slice(4);
const VIEWS = {
  desktop: { width: 1440, height: 810, scale: 2, out: [1920, 1080] },
  phone: { width: 864, height: 1080, scale: 2.5, out: [1080, 1350] },
};
const V = VIEWS[view];
const B = 30; // frames in a beat

await holdBack(HOME, URL);
const note = heldNote(HOME);
const { browser, page, film } = await openCanvas({ url: `${URL}/`, width: V.width, height: V.height, scale: V.scale });

const rect = (sel) => film.rect(sel);
const byHash = (h) => `[data-key$="-${h}"]`;
const textRect = (t) => page.evaluate((t) => {
  const e = [...document.querySelectorAll(".will-change-transform div, .will-change-transform span")].find((x) => x.childElementCount === 0 && x.textContent === t);
  const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
}, t);
const stageBox = () => page.evaluate(() => {
  const e = [...document.querySelectorAll("div")].find((d) => d.style.boxShadow === "var(--shadow-stage)");
  const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
});
// the canvas's zoom, read off the world's own transform (the dock no longer shows a percent)
const zoom = () => page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector(".origin-top-left.will-change-transform")).transform).a);
// off camera: everything in view first, then in on a thing (get() finds it) to a zoom, brought
// to a place on screen, and the screens given time to load sharp
async function goTo(get, z, at = { x: V.width / 2, y: V.height / 2 }) {
  await page.keyboard.press("0");
  await film.wait(50, { shoot: false });
  const r = await get();
  await film.place(r.cx, r.cy);
  await film.pinch(z / (await zoom()), 24, (t) => t);
  await film.wait(6, { shoot: false });
  const after = await get();
  await film.pan(after.cx, after.cy, at.x, at.y, 12);
  await film.wait(40, { shoot: false });
}
const roadTop = async () => { const r = await textRect("The Road"); return { ...r, cy: r.cy + r.h * 3 }; };

// a take: exactly n frames, the camera where it's put
const takes = [];
async function take(name, n, fn) {
  const filming = !only.length || only.includes(name);
  if (filming) film.start(path.join(OUT, `${view}-ad-${name}.mp4`), ...V.out);
  const start = film.frames;
  await fn();
  while (film.frames - start < n && filming) await film.tick();
  if (!filming) { /* nothing */ }
  if (filming) { const f = await film.stop(); takes.push([name, f]); console.log(view, name, f); }
  film.camMove = null;
  film.cam = { x: 0, y: 0, w: V.width };
}
// ticks inside a take: filmed only when the take is
const tick = () => film.tick();
// the camera keeps moving through a take: a slow push to k of its width, centred where it is
const push = (k, n) => { const c = film.cam, H = (c.w * V.height) / V.width; film.camTo(c.x + c.w / 2, c.y + H / 2, c.w * k, n, (t) => t); };

await film.settle(90);
await film.afterStamp();
await film.pointer(false);

// F0, four beats: from close on Shadowfax under the volcano to the whole canvas. The canvas loads
// the screens around what's in view each time it comes to rest, so it rests once halfway out,
// where every screen is in reach and loads sharp, then goes in and starts back out without
// stopping: the whole canvas is all there when it shows. (Rested close in, screens far from
// the start never load.)
{
  // The Road, far from the site's profile card, which is
  // too small to read by the time it comes into frame
  const START = byHash("a29cbbc3a2052734");
  await page.keyboard.press("0");
  await film.wait(50, { shoot: false });
  await film.place(V.width / 2, V.height / 2);
  // first, where the start sits in the whole canvas as the end shows it: far out, the project
  // names and their activity strips grow, so it's measured there, everything that's drawn
  await film.pinch(0.17 / (await zoom()), 12, (t) => t);
  await film.wait(4, { shoot: false });
  const d = await page.evaluate((sel) => {
    const rs = [...document.querySelectorAll(".origin-top-left.will-change-transform *")].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    const s = document.querySelector(sel).getBoundingClientRect();
    return { x: s.x + s.width / 2 - (Math.min(...rs.map((r) => r.left)) + Math.max(...rs.map((r) => r.right))) / 2, y: s.y + s.height / 2 - (Math.min(...rs.map((r) => r.top)) + Math.max(...rs.map((r) => r.bottom))) / 2 };
  }, START);
  await film.pinch(0.55 / (await zoom()), 20, (t) => t);
  for (let i = 0; i < 400; i++) {
    await film.tick({ shoot: false });
    if (i > 40 && (await page.evaluate(() => [...document.querySelectorAll("[data-key] img")].every((m) => m.complete && m.naturalWidth > 0 && m.style.opacity === "1")))) break;
  }
  console.log(view, "screens loaded before the reveal:", await page.evaluate(() => document.querySelectorAll("[data-key] img").length), "of", await page.evaluate(() => document.querySelectorAll("[data-key]").length));
  // bring it to the middle (it can sit off screen halfway out), then in about it
  await film.place(V.width / 2, V.height / 2);
  const s0 = await rect(START);
  await film.pan(s0.cx, s0.cy, V.width / 2, V.height / 2, 10);
  const c0 = await rect(START);
  await film.place(c0.cx, c0.cy);
  await film.pinch((view === "phone" ? 1.3 : 1.1) / (await zoom()), 20, (t) => t);
  const s1 = await rect(START);
  await film.pan(s1.cx, s1.cy, V.width / 2, V.height / 2, 10);
  // the zoom out turns about the one point that ends with the start where it was measured and
  // so the whole canvas centred (about the start itself, the canvas ended far to one side)
  const k = 0.17 / (await zoom());
  await film.place(V.width / 2 + d.x / (1 - k), V.height * 0.47 + d.y / (1 - k));
  // from the last scroll to the first of the pinch out is under the canvas's 180 ms rest
  await take("reveal", 4 * B, async () => {
    await film.wait(6);
    await film.pinch(0.17 / (await zoom()), 4 * B - 12, (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2));
  });
}

// F1, a beat: the newest Road post lands, lit
{
  await goTo(roadTop, view === "phone" ? 0.5 : 0.42, { x: V.width * 0.42, y: V.height * 0.42 });
  await film.afterStamp();
  land(HOME, (await page.evaluate(() => Date.now())) - 2000);
  await film.pollIn(5);
  const r = await textRect("The Road");
  film.cam = film.frame({ x: r.x - 20, y: r.y - 10, w: r.w * 3.4, h: r.h * 6.5 }, 1.05);
  push(0.93, B);
  await take("lands", B, async () => {});
}

// F2 to F4, a beat each: the work up close, the camera drifting
// keepRight: the frame stops just past the screen's right edge, so the neighbour there stays out
async function drift(name, hash, z, dx = 0.08, keepRight = false) {
  await goTo(() => rect(byHash(hash)), z);
  const s = await rect(byHash(hash));
  const a = film.frame({ x: s.x, y: s.y, w: s.w, h: s.h }, 1.25);
  if (keepRight) a.x = s.x + s.w * 1.02 - a.w;
  film.cam = a;
  film.camTo(a.x + a.w / 2 + a.w * dx, a.y + a.w * (V.height / V.width) / 2, a.w * 0.93, B, (t) => t);
  await take(name, B, async () => {});
}
// the sunset's right-hand neighbour is the site's profile card, with its words: kept out of frame
await drift("sky", "c090c3510b86a43d", 0.9, -0.06, true);
await drift("top20", "28fec8d929ee0210", 0.9, -0.08);
await drift("night", "21205856b3f603cb", 0.9);

// F5, a beat: a screen flies open; F6, two beats: its before and after, the divider across and back
{
  await goTo(roadTop, view === "phone" ? 0.5 : 0.42, { x: V.width * 0.42, y: V.height * 0.42 });
  const play = await rect(byHash("ea6513ee246aded2"));
  await film.place(play.cx + 60, play.cy + 40);
  await film.pointer(true);
  await film.place(play.cx, play.cy);
  await film.click(2);
  await film.wait(2, { shoot: false });
  await take("open", B, async () => {});
  await film.wait(20, { shoot: false });
  const box = await stageBox();
  const y = box.y + box.h * 0.5;
  await film.place(box.x + 22, y);
  film.cam = film.frame({ x: box.x, y: box.y, w: box.w, h: box.h }, 1.04);
  push(0.95, 2 * B);
  await take("wipe", 2 * B, async () => {
    await page.mouse.down();
    await film.move(box.x + box.w * 0.7, y, 26);
    await film.wait(5);
    await film.move(box.x + box.w * 0.04, y, 24);
    await page.mouse.up();
  });
  await page.keyboard.press("Escape");
  await film.wait(40, { shoot: false });
}

// F7, a beat: a pin drops on Shadowfax; F8, two beats: the note's last words, and it's sent
let pinAt;
{
  const rohan = await rect(byHash("e11a04d093b56d46"));
  if (rohan.cy > V.height * 0.8 || rohan.cy < 0) await film.pan(rohan.cx, rohan.cy, rohan.cx, V.height * 0.5, 10);
  const r2 = await rect(byHash("e11a04d093b56d46"));
  await film.place(r2.cx, r2.cy);
  await film.click(4);
  await film.wait(60, { shoot: false });
  await page.keyboard.press("c");
  await film.wait(4, { shoot: false });
  const box = await stageBox();
  pinAt = { x: box.x + note.x * box.w, y: box.y + note.y * box.h };
  await film.place(pinAt.x + 70, pinAt.y + 50);
  film.cam = film.frame({ x: pinAt.x - 140, y: pinAt.y - 110, w: 520, h: 230 }, 1.0);
  push(0.94, B);
  await take("pin", B, async () => {
    await film.move(pinAt.x, pinAt.y, 7);
    await film.click(4);
  });
  // the first words written off camera, the last on it
  const cut = note.text.length - 40;
  for (const ch of note.text.slice(0, cut)) { await page.keyboard.type(ch); await film.tick({ shoot: false }); }
  await film.place(pinAt.x - 26, pinAt.y + 58);
  film.cam = film.frame({ x: pinAt.x - 60, y: pinAt.y - 70, w: 460, h: 160 }, 1.0);
  push(0.95, 2 * B);
  await take("note", 2 * B, async () => {
    for (const ch of note.text.slice(cut)) { await page.keyboard.type(ch); await tick(); }
    await film.wait(5);
    await page.keyboard.press("Enter");
    await tick();
  });
}

// F9, a beat: the answer comes back on the pin
{
  await film.move(pinAt.x + 70, pinAt.y + 90, 8, undefined);
  const pin = await rect('[aria-label^="Note 1"]');
  await film.move(pin.cx + 3, pin.cy + 3, 10);
  await film.pollIn(8);
  const id = await page.evaluate(() => fetch("/api/comments").then((r) => r.json())).then((all) => all.filter((c) => c.page === "shot-e11a04d093b56d46").pop().id);
  await reply(HOME, id, note.reply.text);
  film.cam = film.frame({ x: pin.x - 40, y: pin.y - 40, w: 420, h: 220 }, 1.0);
  push(0.94, B);
  await take("answer", B, async () => {});
}

// F10, a beat: the fix lands on the canvas, lit; F11, two beats: it opens, Shadowfax white
{
  await page.keyboard.press("Escape");
  await film.wait(40, { shoot: false });
  await goTo(roadTop, view === "phone" ? 0.5 : 0.42, { x: V.width * 0.42, y: V.height * 0.42 });
  await film.afterStamp();
  land(HOME, await page.evaluate(() => Date.now()), FIX);
  await film.pollIn(5);
  const r = await textRect("The Road");
  film.cam = film.frame({ x: r.x - 20, y: r.y - 10, w: r.w * 3.4, h: r.h * 6.5 }, 1.05);
  push(0.93, B);
  await take("fix", B, async () => {});
  await film.wait(60, { shoot: false });
  const pair = await rect(byHash("778cf7acce459ada"));
  await film.place(pair.cx, pair.cy);
  await film.click(4);
  await film.wait(50, { shoot: false });
  await film.pointer(false);
  const box = await stageBox();
  const a = film.frame({ x: box.x, y: box.y, w: box.w, h: box.h }, 1.03);
  film.cam = a;
  // lean toward the after
  film.camTo(box.x + box.w * 0.74, box.y + box.h * 0.6, box.w * 0.62, 2 * B - 4);
  await take("pair", 2 * B, async () => {});
  await page.keyboard.press("Escape");
  await film.wait(40, { shoot: false });
}

// F12, a beat: the canvas becomes today's sheet; F13, two beats: a flick back through the months;
// F14, two beats: July, and in on the Tour
{
  await page.keyboard.press("0");
  await film.wait(60, { shoot: false });
  await film.place(V.width * 0.5, V.height * 0.6);
  await take("stack", B, async () => {
    await page.keyboard.press("t");
    await tick();
  });
  await film.wait(10, { shoot: false });
  await film.pointer(true);
  await film.place(V.width - 62, V.height * 0.42);
  await film.tick({ shoot: false });
  const days = await page.evaluate((target) => {
    const shown = document.querySelector('[role="slider"][aria-label="Day"]').getAttribute("aria-valuetext").split(" ").slice(1).join(" ");
    return Math.round((new Date(`${shown} ${new Date().getFullYear()} 12:00`) - new Date(`${target} 12:00`)) / 864e5);
  }, "2026-07-18");
  film.cam = { x: V.width * 0.04, y: 0, w: V.width * 0.92 };
  push(0.96, 2 * B);
  await take("flick", 2 * B, async () => {
    const N = 46, px = days * 14, w = Array.from({ length: N }, (_, i) => Math.pow(1 - i / N, 1.6)), sum = w.reduce((a, b) => a + b, 0);
    let sent = 0, acc = 0;
    for (let i = 0; i < N; i++) { acc += w[i]; const goal = Math.round((acc / sum) * px); await film.wheel(-(goal - sent)); sent = goal; await tick(); }
  });
  await film.wait(30, { shoot: false });
  // in on the Tour, about the point that ends with all of it in frame: its name clear of the
  // earlier days' edges above, its gallery clear of the dock, centred across
  const tour = await textRect("Le Tour");
  const box = await page.evaluate((t) => {
    const rs = [...document.querySelectorAll(".will-change-transform [data-key]")].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.left >= t.x - 5 && r.top > t.y);
    let sheet = document.querySelector(".origin-top-left.will-change-transform");
    while (sheet && !String(sheet.style.background).includes("--wall")) sheet = sheet.parentElement;
    return { right: Math.max(...rs.map((r) => r.right)), bottom: Math.max(...rs.map((r) => r.bottom)), sheetTop: sheet ? sheet.getBoundingClientRect().top : 0 };
  }, tour);
  // the camera ends 0.8832 of the width wide, centred at 0.46 of the height
  const T = Math.max(box.sheetTop + V.height * 0.05, V.height * 0.08), Bm = V.height * 0.84;
  const f = Math.min(view === "phone" ? 2.2 : 2.6, (Bm - T) / (box.bottom - tour.y));
  const yc = (T + Bm) / 2, cy = (tour.y + box.bottom) / 2, cx = (tour.x + box.right) / 2;
  const px = Math.min(V.width - 200, Math.max(40, (V.width / 2 - f * cx) / (1 - f))), py = (yc - f * cy) / (1 - f);
  console.log(view, "july", { f: f.toFixed(2), px: Math.round(px), py: Math.round(py), sheetTop: Math.round(box.sheetTop) });
  await film.place(px, py);
  await film.pointer(false);
  film.cam = { x: V.width * 0.04, y: 0, w: V.width * 0.92 };
  await take("july", 2 * B, async () => {
    await film.pinch(f, 2 * B - 8);
  });
}

await browser.close();
