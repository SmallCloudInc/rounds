// Injected into the canvas before it loads, for filming. Two things:
// - every CSS transition, CSS animation and Web Animation is paused and stepped by hand
//   (window.__filmStep), so with Playwright's fake clock driving timers and animation frames,
//   each captured frame is exactly 1/60 s after the last;
// - a drawn pointer that follows the mouse, since a headless browser has none.
(() => {
  const anims = new Map();
  const done = new WeakSet();
  window.__filmStep = (dt) => {
    for (const a of document.getAnimations()) {
      if (done.has(a)) continue;
      let s = anims.get(a);
      if (!s) { a.pause(); s = { t: 0 }; anims.set(a, s); }
      s.t += dt;
      const end = a.effect ? a.effect.getComputedTiming().endTime : 0;
      if (Number.isFinite(end) && s.t >= end) { a.finish(); done.add(a); anims.delete(a); }
      else a.currentTime = s.t;
    }
    pointer.update();
  };

  // The pointer: the macOS arrow, a crosshair where the canvas asks for one, an I-beam over text.
  const SHAPES = {
    arrow: { hot: [3, 2], svg: `<svg width="28" height="34" viewBox="0 0 28 34"><path d="M3 2 L3 25.5 L8.6 20.1 L12.4 29 L16.6 27.2 L12.9 18.6 L20.6 18.6 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>` },
    crosshair: { hot: [14, 14], svg: `<svg width="28" height="28" viewBox="0 0 28 28"><path d="M14 3v22M3 14h22" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/><path d="M14 3v22M3 14h22" stroke="#111" stroke-width="1.5" stroke-linecap="round"/></svg>` },
    text: { hot: [8, 13], svg: `<svg width="16" height="26" viewBox="0 0 16 26"><path d="M4 2.5c2.2 0 3.4.8 4 2 .6-1.2 1.8-2 4-2M8 4.5v17M4 23.5c2.2 0 3.4-.8 4-2 .6 1.2 1.8 2 4 2" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M4 2.5c2.2 0 3.4.8 4 2 .6-1.2 1.8-2 4-2M8 4.5v17M4 23.5c2.2 0 3.4-.8 4-2 .6 1.2 1.8 2 4 2" fill="none" stroke="#111" stroke-width="1.4" stroke-linecap="round"/></svg>` },
  };
  const pointer = {
    x: -100, y: -100, shape: "", down: false, hidden: true, off: false, el: null,
    update() {
      if (!this.el) {
        if (!document.body) return;
        this.el = document.createElement("div");
        this.el.id = "film-pointer";
        this.el.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,0.28))";
        document.documentElement.appendChild(this.el);
      }
      const under = document.elementFromPoint(this.x, this.y);
      const css = under ? getComputedStyle(under).cursor : "default";
      const shape = css === "crosshair" ? "crosshair" : css === "text" ? "text" : "arrow";
      if (shape !== this.shape) { this.shape = shape; this.el.innerHTML = SHAPES[shape].svg; }
      const [hx, hy] = SHAPES[shape].hot;
      const k = this.down ? 0.9 : 1;
      this.el.style.display = this.hidden || this.off ? "none" : "block";
      this.el.style.transformOrigin = `${hx}px ${hy}px`;
      this.el.style.transform = `translate(${this.x - hx}px, ${this.y - hy}px) scale(${k})`;
    },
  };
  window.__filmPointer = pointer;
  addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.hidden = false; }, true);
  addEventListener("pointerdown", () => { pointer.down = true; }, true);
  addEventListener("pointerup", () => { pointer.down = false; }, true);
})();
