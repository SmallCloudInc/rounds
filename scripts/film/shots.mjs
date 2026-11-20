// The film's shots, from the real demo canvas: work lands, a screen opens, its before and after
// compare, a note is pinned and its session answers, then the time machine walks back through
// the days.  FILM_HOME=<the film server's demo folder> node scripts/film/shots.mjs <desktop|phone> <out dir>
import path from "node:path";
import fs from "node:fs";
import { openCanvas } from "./frame.mjs";
import { holdBack, land, heldNote, reply, FIX } from "./stage.mjs";

const URL = process.env.FILM_URL || "http://localhost:4805";
const HOME = process.env.FILM_HOME;
const [view = "desktop", OUT] = process.argv.slice(2);
const VIEWS = {
  desktop: { width: 1440, height: 810, scale: 2, out: [1920, 1080] },
  phone: { width: 864, height: 1080, scale: 2.5, out: [1080, 1350] },
};
const V = VIEWS[view];
const only = process.argv.slice(4);
const want = (name) => !only.length || only.includes(name);

await holdBack(HOME, URL);
const note = heldNote(HOME);
const { browser, page, film } = await openCanvas({ url: `${URL}/`, width: V.width, height: V.height, scale: V.scale });
const shot = (name) => film.start(path.join(OUT, `${view}-${name}.mp4`), ...V.out);
// moments inside each shot, in frames from its start, for the words laid over it
const marks = {};
const at = (shotName, what) => { (marks[shotName] ||= {})[what] = film.frames; };
const done = async (name) => { const n = await film.stop(); (marks[name] ||= {}).frames = n; console.log(view, name, n, "frames"); };
const byHash = (h) => `[data-key$="-${h}"]`;
// a project's name on the canvas itself (not the day sheets' lists of projects)
const textRect = (t) => page.evaluate((t) => {
  const e = [...document.querySelectorAll(".will-change-transform div, .will-change-transform span")].find((x) => x.childElementCount === 0 && x.textContent === t);
  const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height };
}, t);
const stageBox = () => page.evaluate(() => {
  const e = [...document.querySelectorAll("div")].find((d) => d.style.boxShadow === "var(--shadow-stage)");
  const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height };
});

await film.settle(90);
await film.afterStamp();

// 1. Work lands. The pointer already on its way to The Road, the newest post arriving as it
//    gets there, and a pinch drawing us in while its light is still on.
{
  land(HOME, (await page.evaluate(() => Date.now())) - 2000);
  await film.pollIn(26);
  const road = await textRect("The Road");
  // on a phone the push is all the way onto The Road, its neighbour off the frame
  const anchor = view === "phone" ? { x: road.x + 2, y: road.y + road.h * 0.6 } : { x: road.x + road.w * 0.55, y: road.y + road.h * 1.4 };
  await film.place(anchor.x + 140, anchor.y + 110);
  if (want("lands")) shot("lands");
  await film.move(anchor.x, anchor.y, 34);
  await film.pinch(view === "phone" ? 3.3 : 2.2, 130);
  await film.wait(10);
  if (want("lands")) await done("lands");
}

// 2. The loop. A note on the Rohan screen, the session's answer coming back on the pin, and with
//    it the fix landing on the canvas, opened: Shadowfax white against the grass. The Rohan screen
//    is open when the shot begins.
{
  await film.wait(90, { shoot: false }); // the light fades
  // off camera: far enough out that the top of The Road and the Rohan screen are both in view,
  // so the fix, landing at the column's top, lands where we can see it
  await page.keyboard.press("0");
  await film.wait(50, { shoot: false });
  const road = await textRect("The Road");
  await film.place(road.x, road.y);
  await film.pinch(view === "phone" ? 2.0 : 1.45, 30, (t) => t);
  await film.wait(30, { shoot: false });
  const rohan = await film.rect(byHash("e11a04d093b56d46"));
  await film.place(rohan.cx, rohan.cy);
  await film.tick({ shoot: false });
  await film.click(6);
  await film.wait(80, { shoot: false });
  // from the first frame to the pointer resting on the pin, so the answer comes with the
  // canvas's next look for news, 20 frames after
  const H = 4 + 1 + 28 + 7 + 6 + note.text.length + 6 + 1 + 12 + 22;
  await film.pollIn(H + 20);
  if (want("loop")) shot("loop");
  await film.wait(4);
  await page.keyboard.press("c");
  await film.tick();
  const box = await stageBox();
  const pinAt = { x: box.x + note.x * box.w, y: box.y + note.y * box.h };
  await film.move(pinAt.x, pinAt.y, 28);
  await film.click(6);
  at("loop", "pinned");
  // the camera leans in to read the note as it's written
  film.camTo(pinAt.x + 150, pinAt.y + 40, V.width / (view === "phone" ? 1.45 : 1.7), 40);
  await film.move(pinAt.x - 26, pinAt.y + 58, 6);
  for (const ch of note.text) { await page.keyboard.type(ch); await film.tick(); }
  await film.wait(6);
  await page.keyboard.press("Enter");
  await film.tick();
  at("loop", "sent");
  await film.move(pinAt.x + 70, pinAt.y + 90, 12);
  const pin = await film.rect('[aria-label^="Note 1"]');
  await film.move(pin.cx + 3, pin.cy + 3, 22);
  // the session answers and posts its fix, just before the canvas looks again
  await film.wait(Math.max(0, ((180 - film.sinceStamp) % 180) - 8));
  land(HOME, await page.evaluate(() => Date.now()), FIX);
  const id = await page.evaluate(() => fetch("/api/comments").then((r) => r.json())).then((all) => all.filter((c) => c.page === "shot-e11a04d093b56d46").pop().id);
  await reply(HOME, id, note.reply.text);
  await film.wait(10);
  at("loop", "answered");
  await film.wait(34);
  // back to the canvas, where the fix has just landed, lit
  film.camHome(26);
  await film.wait(6);
  await page.keyboard.press("Escape");
  await film.wait(30);
  const fix = await film.rect(byHash("778cf7acce459ada"));
  await film.move(fix.cx, fix.cy, 28);
  await film.wait(4);
  await film.click();
  at("loop", "fix");
  await film.wait(36);
  const open = await stageBox();
  // lean in, but never so far that the pair's edges or its title leave the frame
  film.camTo(open.x + open.w / 2, open.y + open.h / 2, Math.max(open.w + 48, V.width / (view === "phone" ? 1.12 : 1.18)), 44);
  await film.wait(64);
  film.cam = { x: 0, y: 0, w: V.width };
  if (want("loop")) await done("loop");
}

// 4. The time machine: the canvas becomes today's sheet, a day comes up from behind it, then a
//    flick along the rail goes back months.
{
  await page.keyboard.press("Escape");
  await film.wait(40, { shoot: false });
  await page.keyboard.press("0");
  await film.wait(60, { shoot: false });
  const clock = await film.rect('[aria-label="Timeline (T)"]');
  await film.place(clock.cx + 130, clock.cy - 90);
  if (want("time")) shot("time");
  await film.move(clock.cx, clock.cy, 24);
  await film.click();
  at("time", "stack");
  await film.wait(6);
  // lean in on the stack of days and the rail
  film.camTo(V.width * 0.49, V.height * 0.45, V.width * 0.9, 54);
  await film.move(V.width * 0.45, V.height * 0.45, 18);
  await film.wheel(-100);
  await film.wait(36);
  // then a flick along the rail, months back, to the week Praxis and Le Tour were made
  await film.move(V.width - 62, V.height * 0.42, 18);
  const days = await page.evaluate((target) => {
    const shown = document.querySelector('[role="slider"][aria-label="Day"]').getAttribute("aria-valuetext").split(" ").slice(1).join(" ");
    const d = new Date(`${shown} ${new Date().getFullYear()} 12:00`), t = new Date(`${target} 12:00`);
    return Math.round((d - t) / 864e5);
  }, process.env.FILM_BACK_TO || "2026-07-18");
  const N = 44, px = days * 14;
  const w = Array.from({ length: N }, (_, i) => Math.pow(1 - i / N, 1.6));
  const sum = w.reduce((a, b) => a + b, 0);
  let sent = 0;
  for (let i = 0; i < N; i++) {
    const goal = Math.round(((w.slice(0, i + 1).reduce((a, b) => a + b, 0)) / sum) * px);
    await film.wheel(-(goal - sent));
    sent = goal;
    await film.tick();
  }
  await film.wait(22);
  // arrived in July: lean in on the Tour's routes
  const tour = await textRect("Le Tour");
  if (view === "phone") {
    // narrow: pinch about the Tour's right edge, so its routes fill the frame and Praxis gives way
    const right = await page.evaluate((x0) => Math.max(...[...document.querySelectorAll(".will-change-transform [data-key]")].map((e) => e.getBoundingClientRect()).filter((r) => r.left >= x0 - 5 && r.width > 0).map((r) => r.right)), tour.x);
    await film.move(Math.min(right, V.width - 170), tour.y + tour.h * 2.6, 20);
  } else await film.move(tour.x + tour.w * 0.5, tour.y + tour.h * 2.6, 20);
  await film.pinch(view === "phone" ? 2.2 : 2.6, 72);
  // the hand comes away from the day's name
  if (view === "phone") { await film.move(V.width * 0.4, V.height * 0.86, 20); await film.wait(4); }
  else await film.wait(16);
  if (want("time")) await done("time");
}

await browser.close();
fs.writeFileSync(path.join(OUT, `${view}-marks.json`), JSON.stringify(marks, null, 1));
