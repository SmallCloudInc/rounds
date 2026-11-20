// The link preview: a real frame of the demo canvas in a 1200x630 window, taken at twice the
// size and brought down, so edges and type stay crisp. Two frames to pick from: the canvas at
// work, and the time machine open on an earlier week.
//   FILM_HOME=<film demo folder> node scripts/film/og.mjs <out dir>
import path from "node:path";
import { execFileSync } from "node:child_process";
import { openCanvas } from "./frame.mjs";
import { holdBack, land } from "./stage.mjs";

const SITE = process.env.FILM_URL || "http://localhost:4805";
const HOME = process.env.FILM_HOME;
const [OUT] = process.argv.slice(2);
const W = 1200, H = 630;

// everything posted, the Road's newest post included
await holdBack(HOME, SITE);
land(HOME, Date.now() - 60e3);
await fetch(`${SITE}/api/index?fresh`);

const { browser, page, film } = await openCanvas({ url: `${SITE}/`, width: W, height: H, scale: 2 });
await page.addStyleTag({ content: "#film-pointer { display: none !important }" });
await film.settle(120);
const name = (t) => page.evaluate((t) => {
  const e = [...document.querySelectorAll(".will-change-transform div, .will-change-transform span")].find((x) => x.childElementCount === 0 && x.textContent === t);
  const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height };
}, t);
const save = async (file) => {
  const big = path.join(OUT, `${file}@2x.png`);
  await film.still(big);
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", big, "-vf", `scale=${W}:${H}:flags=lanczos`, path.join(OUT, `${file}.png`)]);
};

// 1. the canvas at work: in close enough that the screens read
const road = await name("The Road"), site = await name("krispuckett.com");
await film.place((road.x + site.x + site.w) / 2, road.y);
await film.pinch(1.75, 60, (t) => t);
// the hand off the canvas, so no project is hovered (hovering one dims the rest)
await film.place(W - 4, 4);
await film.settle(90);
await save("og-canvas");

// 2. the time machine, on the week Praxis and Le Tour were made
await page.keyboard.press("0");
await film.settle(60);
await page.keyboard.press("t");
await film.settle(50);
await film.place(W - 62, H * 0.42);
await film.tick({ shoot: false });
const days = await page.evaluate(() => {
  const shown = document.querySelector('[role="slider"][aria-label="Day"]').getAttribute("aria-valuetext").split(" ").slice(1).join(" ");
  return Math.round((new Date(`${shown} ${new Date().getFullYear()} 12:00`) - new Date("2026-07-18 12:00")) / 864e5);
});
for (let i = 0; i < days; i++) { await film.wheel(-14); await film.tick({ shoot: false }); }
await film.settle(60);
const tour = await name("Le Tour");
await film.place(tour.x + tour.w * 0.5, tour.y + tour.h * 2.6);
await film.pinch(2.6, 60, (t) => t);
await film.settle(90);
await save("og-time");

await browser.close();
console.log("og frames");
