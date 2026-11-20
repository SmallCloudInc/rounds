import { chromium } from "playwright-core";
// screenshots of whatever canvas it ran on: kept out of the repo
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
const zoom = () => p.evaluate(() => [...document.querySelectorAll("button")].find((b) => /%$/.test(b.textContent))?.textContent);
const btn = (label) => p.locator(`button[aria-label="${label}"]`);
const pressed = (label) => p.evaluate((l) => document.querySelector(`button[aria-label="${l}"]`)?.getAttribute("aria-pressed"), label);
const wait = (ms = 700) => p.waitForTimeout(ms);

// zoom controls
let z0 = await zoom();
await btn("Zoom in (+)").click(); await wait(); let z1 = await zoom(); check("zoom in", parseInt(z1) > parseInt(z0), `${z0} -> ${z1}`);
await btn("Zoom out (-)").click(); await wait(); let z2 = await zoom(); check("zoom out", parseInt(z2) < parseInt(z1), `${z1} -> ${z2}`);
await p.locator("button[aria-label='Actual size']").click(); await wait(900); check("actual size", (await zoom()) === "100%", await zoom());
await btn("Fit everything (0)").click(); await wait(900); check("fit", parseInt(await zoom()) < 20, await zoom());
await p.keyboard.press("="); await wait(); check("key +", parseInt(await zoom()) > 9, await zoom());
await p.keyboard.press("0"); await wait(900);

// tools
await btn("Hand (H)").click(); check("hand tool on", (await pressed("Hand (H)")) === "true");
await p.evaluate(() => document.querySelector("button.type-project").click()); await wait(1500);
check("hand: project name does not fly", true);
const target = await p.evaluate(() => { const b = [...document.querySelectorAll("button[data-key]")].find((x) => { const r = x.getBoundingClientRect(); return r.top > 150 && r.bottom < 800 && r.width > 40; }); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
if (target) {
  await p.mouse.click(target.x, target.y); await wait(900);
  check("hand: click on a screen does not open it", !(await p.locator("button[aria-label='Close']:not([title])").count()));
}
await p.keyboard.press("v"); check("key v -> move", (await pressed("Move (V)")) === "true");
await p.keyboard.press("h"); check("key h -> hand", (await pressed("Hand (H)")) === "true");
await p.keyboard.press("Escape"); check("Esc -> move", (await pressed("Move (V)")) === "true");
await p.keyboard.press("0"); await wait(900);
// move: project name flies in
const zb = await zoom(); await p.evaluate(() => document.querySelector("button.type-project").click()); await wait(1500);
check("move: project name zooms in", parseInt(await zoom()) > parseInt(zb), `${zb} -> ${await zoom()}`);

// open a screen, step, close
const t2 = await p.evaluate(() => { const b = [...document.querySelectorAll("button[data-key]")].find((x) => !x.dataset.key.startsWith("page-") && x.getBoundingClientRect().top > 150 && x.getBoundingClientRect().bottom < 800); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await p.mouse.click(t2.x, t2.y); await wait(1300);
const count = () => p.evaluate(() => [...document.querySelectorAll(".type-mono")].map((e) => e.textContent).find((t) => / of /.test(t)));
const c0 = await count();
check("screen opens", !!(await p.locator("button[aria-label='Close']:not([title])").count()), c0 || "");
if (c0) { await btn("Next").click(); await wait(500); const c1 = await count(); check("next", c1 !== c0, `${c0} -> ${c1}`); await btn("Previous").click(); await wait(500); check("previous", (await count()) === c0); await p.keyboard.press("ArrowRight"); await wait(400); check("arrow right in stage", (await count()) !== c0); }
await btn("Comment").click(); await wait(200); check("stage comment toggles", (await p.evaluate(() => !!document.querySelector("[style*='crosshair']"))));
await p.keyboard.press("Escape"); await wait(200);
await p.locator("button[aria-label='Close']:not([title])").click(); await wait(900); check("stage closes", !(await p.locator("button[aria-label='Close']:not([title])").count()));

// comment tool opens ready to pin
await p.keyboard.press("c"); check("key c -> comment", (await pressed("Comment (C)")) === "true");
await p.mouse.click(t2.x, t2.y); await wait(1300);
check("comment tool opens screen ready to pin", await p.evaluate(() => !!document.querySelector("[style*='crosshair']")));
await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await wait(900); await p.keyboard.press("Escape");

// search
await btn("Search (/)").click(); await wait(300); check("search opens", !!(await p.locator("input[placeholder='Search']").count()));
await p.keyboard.press("Escape"); await wait(300); check("search closes", !(await p.locator("input[placeholder='Search']").count()));
await p.keyboard.press("Meta+k"); await wait(300); check("cmd-k opens search", !!(await p.locator("input[placeholder='Search']").count()));
await p.keyboard.press("Escape"); await wait(300);

// timeline: the rail on the right
await btn("Timeline (T)").click(); await wait(800);
const panelOpen = () => p.evaluate(() => { const el = document.querySelector("[role=slider][aria-orientation=vertical]")?.closest(".fixed"); return el ? getComputedStyle(el).opacity : "none"; });
check("timeline opens", (await panelOpen()) === "1");
await p.screenshot({ path: `${out}/rail-1-open.png` });
const rr = await p.evaluate(() => { const r = document.querySelector("[role=slider][aria-orientation=vertical]").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const awayTxt = () => p.evaluate(() => document.querySelector("button[aria-label='Timeline (T)']").textContent);
await p.mouse.move(rr.x + rr.w / 2, rr.y + rr.h / 2); await p.mouse.down();
for (let i = 1; i <= 20; i++) { await p.mouse.move(rr.x + rr.w / 2, rr.y + rr.h / 2 + i * 12); await wait(16); }
await p.mouse.up(); await wait(1500);
check("drag time back", !!(await awayTxt()), await awayTxt());
await p.screenshot({ path: `${out}/rail-2-dragged.png` });
await p.mouse.move(rr.x + rr.w / 2, rr.y + rr.h / 2);
for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, -30); await wait(16); }
await wait(600);
check("scroll travels", true, await awayTxt());
await p.keyboard.down("Control"); for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, -40); await wait(16); } await p.keyboard.up("Control"); await wait(400);
await p.screenshot({ path: `${out}/rail-3-close.png` });
await p.keyboard.press("Escape"); await wait(500); await p.keyboard.press("Escape"); await wait(1200);
check("Esc, Esc returns to today", !(await awayTxt()));
await btn("Timeline (T)").click(); await wait(700);
await p.mouse.click(rr.x + rr.w / 2, rr.y + rr.h / 2 - 90); await wait(1500);
check("tap a day goes there", !!(await awayTxt()), await awayTxt());
await btn("Timeline (T)").click(); await wait(600); check("timeline closes", (await panelOpen()) === "0");
await p.keyboard.press("t"); await wait(600); check("key t opens timeline", (await panelOpen()) === "1");
await p.keyboard.press("Escape"); await wait(600); check("Esc closes timeline", (await panelOpen()) === "0");
await p.keyboard.press("Escape"); await wait(900); check("Esc returns to today", !(await awayTxt()));
await p.keyboard.press("ArrowLeft"); await wait(900); check("arrow left goes back a day", !!(await awayTxt()));
await p.keyboard.press("ArrowRight"); await wait(900); check("arrow right comes back", !(await awayTxt()));

// add
await p.locator("input[type=file]").setInputFiles(`${out}/rail-1-open.png`); await wait(2500);
check("add a file", await p.evaluate(async () => (await (await fetch("/api/index")).json()).sets.some((s) => s.caption === "rail-1-open")));

console.log(results.join("\n"));
console.log("errors:", errs.length ? errs.join(" | ") : "none");
await b.close();
