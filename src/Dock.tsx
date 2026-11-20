// The dock along the bottom: the tools on the left, the scrubber through the middle, zoom and
// search on the right. One strip of glass, every target 44 points.
import { useRef, useState } from "react";
import { Glyph } from "./glyphs";

export type Tool = "move" | "hand" | "comment";

// Each key names itself in a small glass label above the dock, with its shortcut.
const tipOf = (label: string) => {
  const m = label.match(/^(.*?)\s*\((.+)\)$/);
  return m ? { text: m[1], kbd: m[2] } : { text: label, kbd: "" };
};

function Key({ label, on, accent, onClick, children }: { label: string; on?: boolean; accent?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      data-tip={label}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-[background,color,transform] duration-200 active:scale-95"
      style={{ background: on ? (accent ? "var(--honey)" : "var(--ink)") : "transparent", color: on ? "white" : "var(--ink)" }}
    >
      {children}
    </button>
  );
}
// Groups part with a hairline and 8 points of air on each side; inside a group, keys sit
// edge to edge at 44 so the pressed circle stays concentric with the dock (6 in from its ends).
const Rule = () => <span className="mx-2 h-5 w-px shrink-0" style={{ background: "rgba(21,24,29,0.1)" }} />;

export function Dock({ tool, hidden, timeOn, away, zoomRef, onTool, onTime, onZoom, onFit, onReset, onAdd, onSearch }: {
  tool: Tool; hidden: boolean; timeOn: boolean; away: string | null;
  zoomRef: (el: HTMLButtonElement | null) => void;
  onTool: (t: Tool) => void; onTime: (from: DOMRect) => void;
  onZoom: (f: number) => void; onFit: () => void; onReset: () => void; onAdd: (files: File[]) => void; onSearch: () => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const timeBtn = useRef<HTMLButtonElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  // a short pause before the first label; after that they follow the pointer at once
  const [tip, setTip] = useState<{ label: string; x: number } | null>(null);
  const tipTimer = useRef(0);
  const over = (e: React.PointerEvent) => {
    const b = (e.target as HTMLElement).closest("[data-tip]") as HTMLElement | null;
    clearTimeout(tipTimer.current);
    if (!b || !dock.current) { tipTimer.current = window.setTimeout(() => setTip(null), 120); return; }
    const r = b.getBoundingClientRect(), d = dock.current.getBoundingClientRect();
    const next = { label: b.dataset.tip!, x: r.left + r.width / 2 - d.left };
    if (tip) setTip(next);
    else tipTimer.current = window.setTimeout(() => setTip(next), 450);
  };

  return (
    <div
      ref={dock}
      onPointerOver={over}
      onPointerLeave={() => { clearTimeout(tipTimer.current); setTip(null); }}
      onPointerDownCapture={() => { clearTimeout(tipTimer.current); setTip(null); }}
      className="glass lite dock fixed bottom-6 left-1/2 flex h-14 items-center rounded-full px-1.5"
      style={{
        transform: `translate(-50%, ${hidden ? 24 : 0}px)`,
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? "none" : "auto",
        transition: "transform 420ms var(--ease-out), opacity 300ms var(--ease-out)",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Key label="Move (V)" on={tool === "move"} onClick={() => onTool("move")}><Glyph name="move" /></Key>
      <Key label="Hand (H)" on={tool === "hand"} onClick={() => onTool("hand")}><Glyph name="hand" /></Key>
      <Key label="Comment (C)" on={tool === "comment"} accent onClick={() => onTool(tool === "comment" ? "move" : "comment")}><Glyph name="comment" /></Key>
      <Key label="Add images or pages" onClick={() => file.current?.click()}><Glyph name="photos" /></Key>
      <input
        ref={file}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,.html,.htm"
        className="hidden"
        onChange={(e) => { const f = [...(e.target.files || [])]; e.target.value = ""; if (f.length) onAdd(f); }}
      />
      <Rule />
      {/* time: opens the timeline above; when the canvas is on another day, that day rides here */}
      <button
        ref={timeBtn}
        onClick={() => timeBtn.current && onTime(timeBtn.current.getBoundingClientRect())}
        aria-label="Timeline (T)"
        aria-pressed={timeOn}
        data-tip="Timeline (T)"
        className="flex h-11 shrink-0 items-center gap-2 rounded-full transition-[background,color,padding] duration-200 active:scale-95"
        style={{ background: timeOn ? "var(--ink)" : away ? "var(--honey-wash)" : "transparent", color: timeOn ? "white" : "var(--ink)", paddingInline: away ? "13px 16px" : 13 }}
      >
        <Glyph name="time" />
        {away && <span className="whitespace-nowrap text-[13px] font-[560] tracking-[-0.01em] [font-variant-numeric:tabular-nums]" style={{ color: timeOn ? "white" : "var(--ink)" }}>{away}</span>}
      </button>
      <Rule />
      <Key label="Zoom out (-)" onClick={() => onZoom(1 / 1.4)}><Glyph name="minus" /></Key>
      <button ref={zoomRef} onClick={onReset} aria-label="Actual size" data-tip="Actual size" className="h-11 w-11 shrink-0 rounded-full text-center text-[12px] font-[540] tracking-[-0.01em] text-[var(--muted)] transition-colors [font-variant-numeric:tabular-nums] hover:text-[var(--ink)]">100%</button>
      <Key label="Zoom in (+)" onClick={() => onZoom(1.4)}><Glyph name="add" /></Key>
      <Key label="Fit everything (0)" onClick={onFit}><Glyph name="fit" /></Key>
      <Rule />
      <Key label="Search (/)" onClick={onSearch}><Glyph name="search" /></Key>
      {tip && (() => {
        const t = tipOf(tip.label);
        return (
          <span
            className="glass thick pointer-events-none flex h-8 items-center gap-2 whitespace-nowrap rounded-full pl-3 text-[13px] font-[520] text-[var(--ink)]"
            style={{ position: "absolute", left: tip.x, bottom: 56 + 10, transform: "translateX(-50%)", paddingRight: t.kbd ? 6 : 12, animation: "wb-tip 160ms var(--ease-out) both" }}
          >
            {t.text}
            {t.kbd && <kbd className="type-mono grid h-5 min-w-5 place-items-center rounded-[6px] px-1 text-[11px] text-[var(--muted)]" style={{ background: "rgba(21,24,29,0.06)" }}>{t.kbd}</kbd>}
          </span>
        );
      })()}
      <style>{`@keyframes wb-tip { from { opacity: 0; transform: translate(-50%, 3px) } }`}</style>
    </div>
  );
}
