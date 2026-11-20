import { chromium } from "playwright-core";
// A click-through of the canvas on whatever data the dev server (:4797) has. Screenshots go to
// .audit, kept out of the repo. It adds one dropped image to that canvas: delete added.json and
// the file in drops/ after.
const out = new URL("../.audit", import.meta.url).pathname;
(await import("node:fs")).mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--use-angle=metal"] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => m.type() === "error" && !m.text().includes("Failed to load resource") && errs.push(m.text().slice(0, 140)));
await p.goto("http://localhost:4797/", { waitUntil: "networkidle" }); await p.waitForTimeout(2500);
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " (" + extra + ")" : ""}`);
// the camera, read off the world's own transform
const cam = () => p.evaluate(() => { const w = [...document.querySelectorAll("div")].find((d) => d.style.transform.startsWith("translate3d")); const m = w.style.transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px, 0px\) scale\(([-\d.]+)\)/); return { x: +m[1], y: +m[2], z: +m[3] }; });
const btn = (label) => p.locator(`button[aria-label="${label}"]`);
const wait = (ms = 700) => p.waitForTimeout(ms);

// the dock: the day and search, nothing else
const dock = await p.evaluate(() => [...document.querySelectorAll(".dock button")].map((x) => x.dataset.tip));
check("dock holds the day and search", dock.join(",") === "Timeline (T),Search (/)", dock.join(", "));

// zoom by keys and by pinch
let z0 = (await cam()).z;
await p.keyboard.press("="); await wait(900); let z1 = (await cam()).z; check("key + zooms in", z1 > z0, `${z0.toFixed(2)} -> ${z1.toFixed(2)}`);
await p.keyboard.press("-"); await wait(900); check("key - zooms out", (await cam()).z < z1);
await p.keyboard.press("0"); await wait(900);
await p.mouse.move(720, 450); await p.keyboard.down("Control"); for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, -40); await wait(16); } await p.keyboard.up("Control"); await wait(400);
check("pinch zooms", (await cam()).z > z0);
await p.keyboard.press("0"); await wait(900);
let c0 = await cam(); for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 40); await wait(16); } await wait(300);
check("scroll pans", (await cam()).y < c0.y);
await p.keyboard.press("0"); await wait(900);
c0 = await cam(); await p.mouse.move(700, 120); await p.keyboard.down(" "); await p.mouse.down(); await p.mouse.move(600, 160, { steps: 8 }); await p.mouse.up(); await p.keyboard.up(" "); await wait(600);
check("space and drag pans", (await cam()).x !== c0.x);
await p.keyboard.press("0"); await wait(900);

// a project name flies in
const zb = (await cam()).z; await p.evaluate(() => document.querySelector("button.type-project").click()); await wait(1500);
check("project name zooms in", (await cam()).z > zb);

// open a screen, step, pin, close
const t2 = await p.evaluate(() => { const b = [...document.querySelectorAll("button[data-key]")].find((x) => !x.dataset.key.startsWith("page-") && x.getBoundingClientRect().top > 150 && x.getBoundingClientRect().bottom < 800); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await p.mouse.click(t2.x, t2.y); await wait(1300);
check("screen opens", !!(await p.locator("button[aria-label='Close']:not([title])").count()));
await btn("Comment").click(); await wait(200); check("the viewer's comment tool turns on", await p.evaluate(() => !!document.querySelector("[style*='crosshair']")));
await p.keyboard.press("Escape"); await wait(200);
await p.locator("button[aria-label='Close']:not([title])").click(); await wait(900); check("screen closes", !(await p.locator("button[aria-label='Close']:not([title])").count()));

// search
await btn("Search (/)").click(); await wait(300); check("search opens", !!(await p.locator("input[placeholder='Search']").count()));
await p.keyboard.press("Escape"); await wait(300); check("search closes", !(await p.locator("input[placeholder='Search']").count()));
await p.keyboard.press("Meta+k"); await wait(300); check("cmd-k opens search", !!(await p.locator("input[placeholder='Search']").count()));
await p.keyboard.press("Escape"); await wait(300);

// one session: found by its name, the canvas holds only its work, Esc shows everything again
const busiest = await p.evaluate(async () => {
  const i = await fetch("/api/index").then((r) => r.json()), n = {};
  for (const s of i.sets) if (s.thread) n[s.thread] = (n[s.thread] || 0) + 1;
  const t = i.threads.filter((t) => n[t.id] && t.title).sort((a, b) => n[b.id] - n[a.id])[0];
  return t && { id: t.id, title: t.title };
});
if (busiest) {
  await btn("Search (/)").click(); await wait(300);
  await p.keyboard.type(busiest.title); await wait(200); await p.keyboard.press("Enter"); await wait(900);
  const links = await p.evaluate(() => [...document.querySelectorAll("a[href*='epitaxy']")].map((a) => a.getAttribute("href")));
  check("a session shows only its own work", links.length > 0 && links.every((h) => h.endsWith(busiest.id)), `${links.length} groups`);
  check("the dock names the session", !!(await p.locator("button[data-tip='Show all (Esc)']").count()));
  await p.keyboard.press("Escape"); await wait(900);
  check("Esc shows every session again", !(await p.locator("button[data-tip='Show all (Esc)']").count()));
  // a group's title opens its thread in Claude; in the timeline it shows that session instead
  // (read at the window, after the canvas has had its say, then stopped: the audit opens nothing)
  const kept = await p.evaluate(() => new Promise((res) => { addEventListener("click", (e) => { res(!e.defaultPrevented); e.preventDefault(); }, { once: true }); document.querySelector("a[href*='epitaxy']").click(); }));
  check("a group's title opens its thread", kept);
  await p.keyboard.press("t"); await wait(900);
  const pick = await p.evaluate(() => { const a = document.querySelector("a[href*='epitaxy']"); a.click(); return a.getAttribute("href"); });
  await wait(900);
  const after = await p.evaluate(() => [...document.querySelectorAll("a[href*='epitaxy']")].map((a) => a.getAttribute("href")));
  check("in the timeline a group's title shows its session", !!(await p.locator("button[data-tip='Show all (Esc)']").count()) && after.every((h) => h === pick), `${after.length} groups`);
  await p.keyboard.press("Escape"); await wait(700); await p.keyboard.press("Escape"); await wait(900);
}

// a session's files: a sheet lists them, a file opens what the session changed in it, a name on
// the sheet shows that session
const sheet = await p.evaluate(() => { const s = document.querySelector("[data-sheet]"); return s && s.querySelectorAll("button[aria-label]").length; });
check("a session's files are on a sheet", !!sheet, `${sheet || 0} files`);
if (sheet) {
  await p.evaluate(() => document.querySelector("[data-sheet] button[aria-label]").click()); await wait(1600);
  const opened = await p.evaluate(() => { const d = document.querySelector("[role=dialog]"); return d ? d.querySelectorAll("section").length : -1; });
  check("a file opens its changes", opened > 0, `${opened} changes`);
  await p.keyboard.press("Escape"); await wait(900);
  check("Esc closes the file", !(await p.locator("[role=dialog]").count()));
  const named = await p.evaluate(() => { const b = document.querySelector("[data-sheet] button[aria-label^='Also changed by']"); if (!b) return null; b.click(); return b.textContent; });
  if (named) {
    await wait(1400);
    check("a name on a sheet shows that session", (await p.evaluate(() => document.querySelector("button[data-tip='Show all (Esc)']")?.textContent || "")).includes(named), named);
    await p.keyboard.press("Escape"); await wait(900);
  }
}

// the time machine: one switch
const panelOpen = () => p.evaluate(() => { const el = document.querySelector("[role=slider][aria-orientation=vertical]")?.closest(".fixed"); return el ? getComputedStyle(el).opacity : "none"; });
const away = () => p.evaluate(() => document.querySelector("button[data-tip='Timeline (T)']").dataset.away || "");
await p.locator("button[data-tip='Timeline (T)']").click(); await wait(800);
check("timeline opens", (await panelOpen()) === "1");
await p.screenshot({ path: `${out}/rail-1-open.png` });
const rr = await p.evaluate(() => { const r = document.querySelector("[role=slider][aria-orientation=vertical]").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
await p.mouse.move(rr.x + rr.w / 2, rr.y + rr.h / 2); await p.mouse.down();
for (let i = 1; i <= 20; i++) { await p.mouse.move(rr.x + rr.w / 2, rr.y + rr.h / 2 + i * 12); await wait(16); }
await p.mouse.up(); await wait(1500);
check("drag the rail back", !!(await away()), await away());
const day = await away(); c0 = await cam();
await p.mouse.move(600, 500); for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 40); await wait(16); } await wait(600);
check("scroll over the canvas pans, the day holds", (await away()) === day && (await cam()).y !== c0.y, `${day} -> ${await away()}`);
await p.mouse.move(rr.x + rr.w / 2, rr.y + rr.h / 2); for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, -30); await wait(16); } await wait(800);
check("scroll over the rail travels", (await away()) !== day, `${day} -> ${await away()}`);
await p.keyboard.press("Escape"); await wait(1200);
check("Esc closes it and comes back to today", (await panelOpen()) === "0" && !(await away()));
await p.keyboard.press("t"); await wait(700);
await p.mouse.click(rr.x + rr.w / 2, rr.y + rr.h / 2 - 90); await wait(1500);
check("tap a day goes there", !!(await away()), await away());
await p.locator("button[data-tip='Timeline (T)']").click(); await wait(1200);
check("closing it comes back to today", (await panelOpen()) === "0" && !(await away()));
await p.keyboard.press("ArrowLeft"); await wait(1200);
check("arrow left opens it a day back", (await panelOpen()) === "1" && !!(await away()), await away());
await p.keyboard.press("ArrowRight"); await wait(900); check("arrow right comes back", !(await away()));
await p.keyboard.press("Escape"); await wait(900);

// drop an image on the canvas
await p.evaluate(async () => {
  const cv = Object.assign(document.createElement("canvas"), { width: 64, height: 40 });
  const g = cv.getContext("2d"); g.fillStyle = "#3f6fe0"; g.fillRect(0, 0, 64, 40);
  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  const dt = new DataTransfer(); dt.items.add(new File([blob], "audit-drop.png", { type: "image/png" }));
  const root = document.querySelector(".grain");
  for (const type of ["dragenter", "dragover", "drop"]) root.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: 500, clientY: 400 }));
});
await wait(2500);
check("drop an image", await p.evaluate(async () => (await (await fetch("/api/index")).json()).sets.some((s) => s.caption === "audit-drop")));

console.log(results.join("\n"));
console.log("errors:", errs.length ? errs.join(" | ") : "none");
await b.close();
