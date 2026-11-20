// The film's shots, from the real demo canvas: work lands, a screen opens, its before and after
// compare, a note is pinned and its session answers, then the time machine walks back through
// the days.  FILM_HOME=<the film server's demo folder> node scripts/film/shots.mjs <desktop|phone> <out dir>
import path from "node:path";
import { openCanvas } from "./frame.mjs";
import { holdBack, land, heldNote, reply, NOTE } from "./stage.mjs";

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
const done = async (name) => console.log(view, name, await film.stop(), "frames");
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

// 1. Work lands. The overview, the pointer drifting in, and the newest Road post arriving while
//    a pinch draws us toward it.
{
  land(HOME, (await page.evaluate(() => Date.now())) - 2000);
  await film.pollIn(60);
  const road = await textRect("The Road");
  await film.place(V.width * 0.78, V.height * 0.7);
  if (want("lands")) shot("lands");
  await film.wait(12);
  // on a phone the push is all the way onto The Road, its neighbour off the frame
  if (view === "phone") await film.move(road.x + 2, road.y + road.h * 0.6, 66);
  else await film.move(road.x + road.w * 0.55, road.y + road.h * 1.4, 66);
  await film.pinch(view === "phone" ? 3.3 : 2.0, 180);
  await film.wait(22);
  if (want("lands")) await done("lands");
}

// 2. A screen opens, and its before and after compare.
{
  await film.wait(90, { shoot: false }); // the light fades
  const play = await film.rect(byHash("ea6513ee246aded2"));
  if (want("open")) shot("open");
  await film.wait(4);
  await film.move(play.cx, play.cy, 44);
  await film.wait(8);
  await film.click();
  await film.wait(52);
  const box = await stageBox();
  const y = box.y + box.h * 0.5;
  await film.move(box.x + 22, y, 36);
  await film.wait(4);
  await page.mouse.down();
  await film.wait(4);
  await film.move(box.x + box.w * 0.64, y, 64);
  await film.wait(32);
  await film.move(box.x + box.w * 0.02, y, 54);
  await page.mouse.up();
  await film.wait(20);
  if (want("open")) await done("open");
}

// 3. A note goes on a screen, and the session that made it answers. The Rohan screen is already
//    open when the shot begins: opening was the shot before.
{
  await page.keyboard.press("Escape");
  await film.wait(50, { shoot: false });
  let rohan = await film.rect(byHash("e11a04d093b56d46"));
  if (rohan.cy > V.height * 0.7 || rohan.cy < V.height * 0.15) {
    await film.place(V.width / 2, V.height / 2);
    await film.wheel(rohan.cy - V.height * 0.45);
    await film.wait(20, { shoot: false });
    rohan = await film.rect(byHash("e11a04d093b56d46"));
  }
  await film.place(rohan.cx, rohan.cy);
  await film.tick({ shoot: false });
  await film.click(6);
  await film.wait(80, { shoot: false });
  // from the first frame to the pointer resting on the pin, so the session's answer comes with
  // the canvas's next look for news, 40 frames after
  const H = 8 + 32 + 7 + 40 + 7 + 14 + note.text.length + 10 + 1 + 18 + 32;
  await film.pollIn(H + 40);
  if (want("note")) shot("note");
  await film.wait(8);
  const btn = await film.rect('[aria-label="Comment"]');
  await film.move(btn.cx, btn.cy, 32);
  await film.click(6);
  const box = await stageBox();
  const at = { x: box.x + note.x * box.w, y: box.y + note.y * box.h };
  await film.move(at.x, at.y, 40);
  await film.click(6);
  // the camera leans in to read the note as it's written
  film.camTo(at.x + 150, at.y + 40, V.width / (view === "phone" ? 1.45 : 1.7), 50);
  // the hand drifts off the pin while the note is written
  await film.move(at.x - 26, at.y + 58, 14);
  for (const ch of note.text) { await page.keyboard.type(ch); await film.tick(); }
  await film.wait(10);
  await page.keyboard.press("Enter");
  await film.tick();
  // the hand comes off the pin it just placed, then back to read it
  await film.move(at.x + 70, at.y + 90, 18);
  const pin = await film.rect('[aria-label^="Note 1"]');
  await film.move(pin.cx + 3, pin.cy + 3, 32);
  // the session reads it and answers, just before the canvas looks again
  await film.wait(Math.max(0, ((180 - film.sinceStamp) % 180) - 8));
  const id = await page.evaluate(() => fetch("/api/comments").then((r) => r.json())).then((all) => all.filter((c) => c.page === "shot-e11a04d093b56d46").pop().id);
  await reply(HOME, id, note.reply.text);
  await film.wait(116);
  film.cam = { x: 0, y: 0, w: V.width };
  if (want("note")) await done("note");
}

// 4. The time machine: the canvas becomes today's sheet, and the days before it come up one
//    after another.
{
  await page.keyboard.press("Escape");
  await film.wait(40, { shoot: false });
  await page.keyboard.press("0");
  await film.wait(60, { shoot: false });
  const clock = await film.rect('[aria-label="Timeline (T)"]');
  if (want("time")) shot("time");
  await film.wait(6);
  await film.move(clock.cx, clock.cy, 40);
  await film.wait(4);
  await film.click();
  await film.wait(12);
  // lean in on the stack of days and the rail
  film.camTo(V.width * 0.49, V.height * 0.45, V.width * 0.9, 64);
  await film.wait(6);
  await film.move(V.width * 0.45, V.height * 0.45, 26);
  // a day back, then another
  for (let i = 0; i < 2; i++) {
    await film.wheel(-100);
    await film.wait(46);
  }
  // then a flick along the rail, months back, to the week Praxis and Le Tour were made
  await film.move(V.width - 62, V.height * 0.42, 26);
  const days = await page.evaluate((target) => {
    const shown = document.querySelector('[role="slider"][aria-label="Day"]').getAttribute("aria-valuetext").split(" ").slice(1).join(" ");
    const d = new Date(`${shown} ${new Date().getFullYear()} 12:00`), t = new Date(`${target} 12:00`);
    return Math.round((d - t) / 864e5);
  }, process.env.FILM_BACK_TO || "2026-07-18");
  const N = 56, px = days * 14;
  const w = Array.from({ length: N }, (_, i) => Math.pow(1 - i / N, 1.6));
  const sum = w.reduce((a, b) => a + b, 0);
  let sent = 0;
  for (let i = 0; i < N; i++) {
    const goal = Math.round(((w.slice(0, i + 1).reduce((a, b) => a + b, 0)) / sum) * px);
    await film.wheel(-(goal - sent));
    sent = goal;
    await film.tick();
  }
  await film.wait(36);
  // arrived in July: lean in on the Tour's routes
  const tour = await textRect("Le Tour");
  if (view === "phone") {
    // narrow: pinch about the Tour's right edge, so its routes fill the frame and Praxis gives way
    const right = await page.evaluate((x0) => Math.max(...[...document.querySelectorAll(".will-change-transform [data-key]")].map((e) => e.getBoundingClientRect()).filter((r) => r.left >= x0 - 5 && r.width > 0).map((r) => r.right)), tour.x);
    await film.move(Math.min(right, V.width - 170), tour.y + tour.h * 2.6, 30);
  } else await film.move(tour.x + tour.w * 0.5, tour.y + tour.h * 2.6, 30);
  await film.pinch(view === "phone" ? 2.2 : 2.6, 90);
  // the hand comes away from the day's name
  if (view === "phone") { await film.move(V.width * 0.4, V.height * 0.86, 30); await film.wait(6); }
  else await film.wait(36);
  if (want("time")) await done("time");
}

await browser.close();
