// The film's words: the canvas's own ground filmed with nothing on it, and each line set in the
// canvas's own type (the project names' face, weight, tracking and ink; the second half in the
// quiet tone, the way the canvas sets a day and its date).
//   node scripts/film/cards.mjs <desktop|phone> <out dir>
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { openCanvas } from "./frame.mjs";

const SITE = process.env.FILM_URL || "http://localhost:4805";
const [view = "desktop", OUT] = process.argv.slice(2);
const VIEWS = {
  desktop: { width: 1440, height: 810, scale: 2, out: [1920, 1080], size: 72, end: 176, mono: 32, wrap: 1600 },
  phone: { width: 864, height: 1080, scale: 2.5, out: [1080, 1350], size: 60, end: 150, mono: 30, wrap: 1000 },
};
const V = VIEWS[view];

export const LINES = {
  c1: [["Your Claude sessions make things all day."]],
  c2: [["Open anything."], ["See what changed.", "quiet"]],
  c3: [["Leave a note on it."], ["The session that made it answers.", "quiet"]],
  c4: [["Go back to any day."]],
};

// the paper: the real ground, nothing on it
if (!fs.existsSync(path.join(OUT, `${view}-paper.mp4`))) {
  const { browser, page, film } = await openCanvas({ url: `${SITE}/`, width: V.width, height: V.height, scale: V.scale });
  await film.settle(60);
  await page.addStyleTag({ content: "#root > div > *:not(canvas) { opacity: 0 !important; transition: none !important; animation: none !important } #film-pointer { display: none !important }" });
  await film.settle(30);
  film.start(path.join(OUT, `${view}-paper.mp4`), ...V.out);
  await film.wait(60 * 5);
  await film.stop();
  await browser.close();
}

// the words, on clear, at twice the film's size
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage({ viewport: { width: V.out[0], height: V.out[1] }, deviceScaleFactor: 2 });
const fonts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/fonts");
const mono = `data:font/woff2;base64,${fs.readFileSync(path.join(fonts, "GeistMono-Variable.woff2")).toString("base64")}`;
const css = `
  @font-face { font-family: "Geist Mono"; src: url(${mono}) format("woff2"); font-weight: 100 900; }
  html, body { margin: 0; background: transparent; }
  body { width: 100vw; height: 100vh; display: grid; place-items: center; -webkit-font-smoothing: antialiased; }
  .line { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif; font-weight: 600; letter-spacing: -0.035em;
    color: rgba(21, 24, 29, 0.86); font-size: ${V.size}px; line-height: 1.12; text-align: center; max-width: ${V.wrap}px; text-wrap: balance; }
  .quiet { color: #9aa2ad; }
  .name { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif; font-weight: 600; letter-spacing: -0.045em;
    color: rgba(21, 24, 29, 0.86); font-size: ${V.end}px; line-height: 1; text-align: center; }
  .npx { font-family: "Geist Mono", ui-monospace, monospace; font-size: ${V.mono}px; color: #5d6570; text-align: center; margin-top: ${V.end * 0.36}px; letter-spacing: 0; }
`;
for (const [name, parts] of Object.entries(LINES)) {
  const html = `<div class="line">${parts.map(([t, tone]) => `<span class="${tone || ""}">${t}</span>`).join(view === "phone" ? "<br>" : " ")}</div>`;
  await page.setContent(`<style>${css}</style>${html}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, `${view}-${name}.png`), omitBackground: true });
}
await page.setContent(`<style>${css}</style><div><div class="name">Rounds</div><div class="npx">npx rounds-app</div></div>`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(OUT, `${view}-end.png`), omitBackground: true });
await browser.close();
console.log(view, "cards");
