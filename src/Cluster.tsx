import { memo, useEffect, useMemo, useRef, useState } from "react";
import { clean, img, thumb, threadLink, when, type Page, type Thread } from "./data";
import { COL_GAP, type Cluster, type Group, type PlacedItem } from "./layout";
import { Glyph } from "./glyphs";

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function lastActive(at: number) {
  const d = new Date(at), now = new Date();
  if (dayKey(d) === dayKey(now)) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(y)) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// One column per day, today at the trailing edge, never resampled: a narrow cluster shows
// fewer days. A quiet day keeps one ghost block on the baseline so the window reads as a
// calendar. Blocks stack by how much happened: prompts typed, and a page published counts
// as a full day's work.
const PITCH = 14, BLOCK = 10, WEEK_GAP = 6, MAX_DAYS = 63;
// the strip far out: 21 days (the canvas holds three weeks), at this many screen pixels per unit
const STRIP_W = 21 * PITCH + 3 * WEEK_GAP - (PITCH - BLOCK), STRIP_K = 0.34;

function ActivityField({ threads, pages, days }: { threads: Thread[]; pages: Page[]; days: number }) {
  const cols = useMemo(() => {
    const load = new Map<string, number>();
    for (const t of threads) for (const [d, n] of Object.entries(t.days || {})) load.set(d, (load.get(d) || 0) + n);
    for (const p of pages) for (const v of p.versions) { const d = dayKey(new Date(v.at)); load.set(d, (load.get(d) || 0) + 6); }
    const fit = Math.min(MAX_DAYS, days);
    const out: { level: number; today: boolean; weekStart: boolean }[] = [];
    const now = new Date();
    for (let i = fit - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const n = load.get(dayKey(d)) || 0;
      out.push({ level: n === 0 ? 0 : n < 6 ? 1 : n < 25 ? 2 : 3, today: i === 0, weekStart: d.getDay() === 1 });
    }
    return out;
  }, [threads, pages, days]);

  let x = 0;
  const cells: React.ReactNode[] = [];
  cols.forEach((c, i) => {
    if (c.weekStart && i > 0) x += WEEK_GAP;
    const n = Math.max(1, c.level);
    for (let k = 0; k < n; k++) {
      cells.push(
        <span
          key={`${i}-${k}`}
          className="absolute rounded-[2.5px]"
          style={{
            left: x, bottom: k * (BLOCK + 3), width: BLOCK, height: BLOCK,
            background: c.level === 0 ? "rgba(28,25,20,0.07)" : c.today ? "var(--ink)" : "rgba(28,25,20,0.36)",
            boxShadow: c.level ? "inset 0 1px 0 rgba(255,255,255,0.28)" : "none",
          }}
        />,
      );
    }
    x += PITCH;
  });
  return <div className="relative" style={{ width: x - (PITCH - BLOCK), height: 3 * BLOCK + 6 }}>{cells}</div>;
}

export const ClusterView = memo(function ClusterView({ c, cap, far, near, live, dimmed, openKey, noted, fresh, threadsAll, onFocus, onHover, onOpen, onTitle }: {
  c: Cluster; cap: number; far: boolean; near: boolean; live: string; dimmed: boolean; openKey?: string;
  noted: Set<string>; fresh: Set<string>; threadsAll: Thread[];
  onFocus: (c: Cluster) => void; onHover: (key: string, on: boolean) => void; onOpen: (g: Group, i: number, el: HTMLElement) => void;
  onTitle: (g: Group) => boolean;
}) {
  const lit = useMemo(() => new Set(live.split(" ")), [live]);
  const projectThreads = useMemo(() => threadsAll.filter((t) => t.project === c.key), [threadsAll, c.key]);
  // Far out the name grows to hold 40px on screen, never past its own column. The camera
  // writes --z on the name itself (wb-z), so this follows zoom with no render.
  // one size for every name: as large as the tightest column allows
  const size = `min(${cap}px, max(56px, calc(40px / var(--z, 1))))`;
  return (
    <div
      style={{
        opacity: dimmed ? 0.22 : 1,
        filter: dimmed ? "blur(3px) saturate(0.6)" : "none",
        transition: "opacity 420ms var(--ease-out), filter 420ms var(--ease-out)",
      }}
    >
      <Layer>
        <div className="absolute" style={{ left: c.x, top: c.y, width: c.w, height: 96 }}>
          <button
            className="wb-z type-project absolute bottom-0 left-[-3px] flex items-baseline whitespace-nowrap text-left"
            style={{ fontSize: size, maxWidth: c.w + COL_GAP * 0.6 }}
            onClick={() => onFocus(c)}
            onMouseEnter={() => onHover(c.key, true)}
            onMouseLeave={() => onHover(c.key, false)}
          >
            <span className="shrink-0" style={{ color: "var(--title-ink, var(--ink))" }}>{c.name}</span>
            {/* close in, when it was last worked on; far out, its three weeks of work, one size on
                screen, for finding your way */}
            {far ? (
              // short of room, it gives up its oldest days first: today stays
              <span className="pointer-events-none relative inline-block min-w-0 shrink overflow-hidden" style={{ width: `calc(${STRIP_W}px * ${STRIP_K} / var(--z, 1))`, height: "0.72em", marginLeft: "0.28em" }}>
                <span className="absolute bottom-0 right-0" style={{ transform: `scale(calc(${STRIP_K} / var(--z, 1)))`, transformOrigin: "100% 100%", animation: "wb-strip 300ms var(--ease-out) both" }}>
                  <ActivityField threads={projectThreads} pages={c.pages} days={21} />
                </span>
              </span>
            ) : (
              <span style={{ color: "var(--quiet)", marginLeft: "0.32em", animation: "wb-strip 240ms var(--ease-out) both" }}>{lastActive(c.at)}</span>
            )}
          </button>
        </div>
      </Layer>

      {c.groups.map((g) => (
        <Layer key={g.id}>
          <GroupTitle g={g} far={far} colW={c.w} onTitle={onTitle} />
          {g.items.map((it, i) => (
            it.kind === "note"
              ? <Note key={it.key} it={it} far={far} />
              : <Screen key={it.key} it={it} far={far} near={near} live={lit.has(g.id)} hidden={openKey === it.key} noted={noted.has(it.kind === "page" ? it.page.id : `shot-${it.shot.hash}`)} fresh={it.kind === "page" && fresh.has(it.page.id)} label={g.title} onOpen={(el) => onOpen(g, i, el)} />
          ))}
        </Layer>
      ))}

      {!!c.threads.length && <Layer>
        {c.threads.map(({ item: t, x, y }) => (
          <a
            key={t.id}
            href={threadLink(t.id)}
            target="_blank"
            rel="noreferrer"
            className="group absolute flex items-center gap-2.5"
            style={{ left: x, top: y, width: Math.min(c.w, 972), height: 40, opacity: far ? 0 : 1, pointerEvents: far ? "none" : "auto", transition: "opacity 240ms var(--ease-out)" }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Glyph name="comment" size={15} className="shrink-0 text-[var(--quiet)] transition-colors duration-200 group-hover:text-[var(--ink)]" />
            <span className="min-w-0 flex-1 truncate text-[14px] font-[450] tracking-[-0.01em] text-[var(--muted)] transition-colors duration-200 group-hover:text-[var(--ink)]">
              {clean(t.title)}
            </span>
            <span className="type-mono shrink-0 text-[var(--quiet)]">{when(t.at)}</span>
          </a>
        ))}
      </Layer>}
    </div>
  );
});

// In Safari far out, each project's name, each group and each project's thread lines are a layer
// of their own (styles.css says why). Anywhere else this div does nothing.
function Layer({ children }: { children: React.ReactNode }) {
  return <div className="wb-layer">{children}</div>;
}

// A group's title: the thread's own caption, and when. It opens the thread it came from; in the
// timeline it shows that session's work alone instead (⌘-click still opens the thread). A
// session no longer on this Mac has no thread to open: its title always shows its work. Far out
// it holds one size on screen, growing up into the air above its group, so it never has to hide.
function GroupTitle({ g, far, colW, onTitle }: { g: Group; far: boolean; colW: number; onTitle: (g: Group) => boolean }) {
  const inner = (
    <>
      {/* past about 10% there's no air left above a group for it: it fades */}
      <span className="wb-z min-w-0 shrink truncate font-[560] tracking-[-0.014em] text-[var(--ink)]" style={{ fontSize: "max(15px, calc(12.5px / var(--z, 1)))", lineHeight: 1.2, opacity: "clamp(0, calc((var(--z, 1) - 0.095) * 100), 1)" }}>{g.title}</span>
      <span className="type-mono shrink-0 text-[var(--quiet)]" style={{ opacity: far ? 0 : 1, transition: "opacity 240ms var(--ease-out)" }}>{when(g.at)}</span>
      {g.thread && <Glyph name="comment" size={15} className="shrink-0 text-[var(--quiet)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />}
    </>
  );
  const style: React.CSSProperties = { left: g.x, top: g.y + 34, transform: "translateY(-100%)", width: far ? colW : Math.max(g.w, 640) };
  if (g.thread && g.gone) return (
    <button type="button" className="group absolute flex items-baseline gap-3 text-left" style={style} onPointerDown={(e) => e.stopPropagation()} onClick={() => onTitle(g)}>
      {inner}
    </button>
  );
  return g.thread ? (
    <a
      href={threadLink(g.thread)} target="_blank" rel="noreferrer" className="group absolute flex items-baseline gap-3" style={style}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && onTitle(g)) e.preventDefault(); }}
    >
      {inner}
    </a>
  ) : (
    <div className="absolute flex items-baseline gap-3" style={style}>{inner}</div>
  );
}

// A screen laid straight on the paper: no card, no caption, only a hairline and a shadow.
// A published page shows its first screen, with its earlier versions as sheets behind.
type Note = Extract<PlacedItem, { kind: "note" }>;
type Shown = Exclude<PlacedItem, { kind: "note" }>;

// A push recorded with no screens (made outside Claude, so nobody captured it): its commits on
// a sheet of paper, newest first, in the project's own place on the canvas.
function Note({ it, far }: { it: Note; far: boolean }) {
  return (
    <div
      className="absolute overflow-hidden rounded-[10px] bg-[#fbfbfa] px-6 py-5"
      style={{ left: it.x, top: it.y, width: it.dw, height: it.dh, boxShadow: "var(--shadow-tile), inset 0 0 0 0.5px rgba(21,24,29,0.12)" }}
    >
      <div className="flex items-baseline gap-2 text-[13px] font-[600] tracking-[-0.01em] text-[var(--ink)]" style={{ opacity: far ? 0 : 1 }}>
        <span className="min-w-0 truncate">{it.title}</span>
        <span className="type-mono shrink-0 font-normal text-[var(--quiet)]">{it.commits.length} commit{it.commits.length === 1 ? "" : "s"}</span>
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        {it.commits.slice(0, 9).map((c) => (
          <div key={c.sha} className="flex items-baseline gap-3 text-[12.5px] leading-snug">
            <span className="type-mono shrink-0 text-[var(--quiet)]">{c.sha.slice(0, 7)}</span>
            <span className="min-w-0 truncate text-[var(--muted)]">{c.subject}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Screen({ it, far, near, live, hidden, noted, fresh, label, onOpen }: {
  it: Shown; far: boolean; near: boolean; live: boolean; hidden: boolean; noted: boolean; fresh: boolean; label: string; onOpen: (el: HTMLElement) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  // sharp at the size a screen is actually drawn: wide ones need more pixels than narrow ones
  const wide = it.dw > 420;
  // far out a screen is a couple hundred pixels tall at most: the smallest size is plenty
  const want = it.kind === "shot" ? img(it.shot, far ? (wide ? 480 : 240) : near ? (wide ? 1600 : 960) : wide ? 960 : 480) : thumb(it.hash);
  // a new size swaps in once it's decoded, so crossing a zoom line never leaves a blank frame
  const [src, setSrc] = useState(want);
  useEffect(() => {
    if (want === src || !live) { if (!live) setSrc(want); return; }
    let on = true;
    const im = new Image(); im.src = want;
    im.decode().catch(() => {}).then(() => { if (on) setSrc(want); });
    return () => { on = false; };
  }, [want, live]);
  const r = 10;
  return (
    <button
      ref={ref}
      data-key={it.key}
      // what VoiceOver reads: the group, which kind of thing, and what's waiting on it
      aria-label={[label, it.kind === "page" ? "page" : "screen", it.more ? `${it.more} more` : "", noted ? "has notes" : "", fresh ? "new" : ""].filter(Boolean).join(", ")}
      className="press group absolute block"
      style={{ left: it.x, top: it.y, width: it.dw, height: it.dh, visibility: hidden ? "hidden" : "visible" }}
      onClick={() => ref.current && onOpen(ref.current)}
    >
      {(it.kind === "page" ? it.layers : it.more ? 2 : it.before ? 1 : 0) > 0 && Array.from({ length: it.kind === "page" ? it.layers : it.more ? 2 : 1 }, (_, i) => (
        <span
          key={i}
          className="absolute inset-0 bg-[#fbfaf6]"
          style={{
            borderRadius: r,
            transform: `translateY(${-(i + 1) * 7}px) scale(${1 - (i + 1) * 0.04})`,
            boxShadow: "0 1px 2px rgba(20,18,15,0.06), 0 10px 24px -14px rgba(20,18,15,0.22)",
            opacity: 1 - (i + 1) * 0.26,
          }}
        />
      ))}
      <span
        className="absolute inset-0 overflow-hidden bg-[var(--wall-deep)] transition-[transform,box-shadow] duration-[420ms] [transition-timing-function:var(--spring)] group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-lift)]"
        style={{ borderRadius: r, boxShadow: "var(--shadow-tile)" }}
      >
        {live && <img
          src={src}
          alt=""
          draggable={false}
          decoding="async"
          onLoad={() => setLoaded(true)}
          className="h-full w-full object-cover object-top"
          style={{ opacity: loaded ? 1 : 0, transition: "opacity 420ms var(--ease-out)" }}
        />}
        <span
          className="pointer-events-none absolute inset-0"
          style={{ borderRadius: r, boxShadow: fresh ? "inset 0 0 0 1.5px var(--honey), inset 0 0 0 6px var(--honey-wash)" : "inset 0 0 0 0.5px rgba(28,25,20,0.14)" }}
        />
      </span>
      {!!it.more && (
        <span className="glass type-mono absolute bottom-3 right-3 grid h-8 min-w-8 place-items-center rounded-full px-2.5 text-[var(--ink)]">+{it.more}</span>
      )}
      {noted && (
        <span className="glass absolute -right-2.5 -top-2.5 grid h-7 w-7 place-items-center rounded-full text-[var(--honey)]">
          <Glyph name="comment" size={14} />
        </span>
      )}
    </button>
  );
}
