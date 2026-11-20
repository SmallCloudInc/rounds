import type { Commit, Index, Page, Shot, ShotSet, Thread, Topic } from "./data";
import { clean } from "./data";

// The canvas as an atlas. Each project is a column: its name, its days of activity, then
// its work as groups of screens laid straight onto the paper, newest first. A group is what
// a thread showed him in one sitting (sends from the same thread close together merge), with
// the thread's own caption as its title. A published page joins the group its thread was
// making at the time, as its first screen.

export const ROW_H = 260; // every screen in a row stands this tall
const ITEM_GAP = 20;
const MAX_ROW_W = 1760;
const MIN_COL_W = 972;
const HEAD = 184;
const TITLE_H = 44; // a group's title line and the air under it
const GROUP_GAP = 88;
const THREAD_ROW = 40;
const COL_GAP = 320;
const ROW_GAP = 360;
const WORLD_ROW_W = 10400; // columns wrap onto a new row past this: about the shape of a wide window
const WINDOW = 21 * 864e5; // what counts as recent, back from the day being shown
const MERGE = 45 * 60e3; // sends from one thread this close are one sitting
const JOIN = 3 * 3600e3; // a page joins a sitting this close to its publish
const GROUPS_PER_PROJECT = 10;
const MAX_ROWS = 2; // past this a group folds; the rest is a step away on the stage

export type Item =
  | { kind: "shot"; key: string; shot: Shot; before?: Shot; set: string; thread: string | null; w: number; h: number }
  | { kind: "note"; key: string; title: string; commits: Commit[]; files: string[]; at: number; w: number; h: number }
  | { kind: "page"; key: string; page: Page; hash: string; layers: number; w: number; h: number };
export type PlacedItem = Item & { x: number; y: number; dw: number; dh: number; more?: number };
export type Group = {
  id: string;
  title: string;
  thread: string | null;
  at: number;
  x: number; y: number; w: number; h: number;
  items: PlacedItem[]; // only what lies on the canvas
  all: Item[]; // everything in the group, for the stage
};
export type Cluster = {
  key: string;
  name: string;
  x: number; y: number; w: number; h: number;
  at: number;
  groups: Group[];
  threads: { item: Thread; x: number; y: number }[];
  pages: Page[]; // for the activity field
};

// A caption's first clause makes the title; a thread's name stands in when there is none.
function titleFrom(caption: string, fallback: string) {
  const first = clean(caption).split(/(?<=[a-z0-9)])[.:;!?](?:\s|$)/i)[0].trim();
  const t = first || clean(fallback);
  return t.length > 72 ? `${t.slice(0, 70).replace(/\s+\S*$/, "")}…` : t;
}

export function layout(index: Index, asOf: number | null = null): { clusters: Cluster[]; w: number; h: number; nameCap: number } {
  const end = asOf ?? Date.now();
  const start = end - WINDOW;
  const threadById = new Map(index.threads.map((t) => [t.id, t]));

  const raw = Object.keys(index.projects).map((key) => {
    // A topic gathers every send filed under it, across threads and days; a send no topic
    // holds yet stays its own sitting, merged with sends from its thread close in time.
    type G = { id: string; thread: string | null; first: number; last: number; caption: string; topic: boolean; sets: ShotSet[]; items: Item[] };
    const topicOf = new Map<string, Topic>();
    for (const t of index.topics?.[key] || []) for (const id of t.sets) topicOf.set(id, t);
    const gs: G[] = [];
    const byTopic = new Map<string, G>();
    for (const s of index.sets) {
      if (s.project !== key || s.at > end || s.at < start) continue;
      const t = topicOf.get(s.id);
      if (t) {
        let g = byTopic.get(t.id);
        if (!g) { g = { id: `t-${t.id}`, thread: s.thread, first: s.at, last: s.at, caption: t.title, topic: true, sets: [], items: [] }; byTopic.set(t.id, g); gs.push(g); }
        g.sets.push(s); g.first = Math.min(g.first, s.at); if (s.at >= g.last) { g.last = s.at; g.thread = s.thread; }
        continue;
      }
      const prev = [...gs].reverse().find((g) => !g.topic && g.thread === s.thread);
      if (prev && s.thread && s.at - prev.last < MERGE) { prev.sets.push(s); prev.last = s.at; }
      else gs.push({ id: s.id, thread: s.thread, first: s.at, last: s.at, caption: s.caption, topic: false, sets: [s], items: [] });
    }
    // newest send first inside a group, each send's screens in the order it showed them
    for (const g of gs) {
      const seen = new Set<string>();
      for (const s of [...g.sets].sort((a, b) => b.at - a.at)) {
        s.shots.forEach((shot, k) => {
          if (seen.has(shot.hash)) return;
          seen.add(shot.hash);
          g.items.push({ kind: "shot", key: `${g.id}-${shot.hash}`, shot, before: s.before?.[k], set: s.id, thread: s.thread, w: shot.w, h: shot.h });
        });
        // a push recorded without screens: its commits, set like a page of notes
        if (!s.shots.length && s.commits?.length) g.items.push({ kind: "note", key: `${g.id}-note-${s.id}`, title: s.caption, commits: s.commits, files: s.files || [], at: s.at, w: 520, h: 325 });
      }
    }
    // pages, each as it stood at the end of the day being shown
    for (const page of index.pages) {
      if (page.project !== key) continue;
      const shown = page.versions.filter((v) => v.at <= end);
      if (!shown.length) continue;
      const v = shown[shown.length - 1];
      if (v.at < start) continue;
      const item: Item = { kind: "page", key: `page-${page.id}`, page, hash: v.hash, layers: Math.min(2, shown.length - 1), w: 1280, h: 800 };
      // a page posted under a topic joins it; otherwise the sitting its thread was in
      const named = page.topic && gs.find((g) => g.topic && g.caption.toLowerCase() === page.topic!.toLowerCase());
      const home = named || (page.thread && gs.find((g) => g.sets.some((s) => s.thread === page.thread && Math.abs(s.at - v.at) < JOIN)));
      if (home) { home.items.unshift(item); home.last = Math.max(home.last, v.at); }
      else gs.push({ id: `p-${page.id}`, thread: page.thread, first: v.at, last: v.at, caption: page.topic || page.title, topic: true, sets: [], items: [item] });
    }
    gs.sort((a, b) => b.last - a.last);
    const groups = gs.slice(0, GROUPS_PER_PROJECT);
    const threads = index.threads
      .filter((t) => t.project === key && !t.archived && t.at <= end + 864e5 && end - t.at < WINDOW)
      .filter((t) => !groups.some((g) => g.thread === t.id))
      .sort((a, b) => b.at - a.at)
      .slice(0, 6);
    const at = Math.max(0, ...groups.map((g) => g.last), ...threads.map((t) => Math.min(t.at, end)));
    return { key, name: index.projects[key], groups, threads, at };
  })
    .filter((c) => c.groups.length || c.threads.length)
    .sort((a, b) => b.at - a.at);

  // Columns flow left to right, newest project first, wrapping into rows.
  const clusters: Cluster[] = [];
  let cx = 0, cy = 0, rowH = 0;
  for (const c of raw) {
    // each group's screens laid out in rows of even height, wrapping at the column's width
    const laid = c.groups.map((g) => {
      const items: PlacedItem[] = [];
      let x = 0, y = TITLE_H, w = 0, row = 0;
      for (const it of g.items) {
        const dh = ROW_H;
        const dw = Math.round(Math.min(ROW_H * (it.w / it.h), MAX_ROW_W));
        if (x > 0 && x + dw > MAX_ROW_W) {
          if (++row >= MAX_ROWS) { items[items.length - 1].more = g.items.length - items.length; break; }
          x = 0; y += ROW_H + ITEM_GAP;
        }
        items.push({ ...it, x, y, dw, dh });
        x += dw + ITEM_GAP;
        w = Math.max(w, x - ITEM_GAP);
      }
      return { g, items, w, h: y + ROW_H };
    });
    const colW = Math.max(MIN_COL_W, ...laid.map((l) => l.w));
    if (cx > 0 && cx + colW > WORLD_ROW_W) { cx = 0; cy += rowH + ROW_GAP; rowH = 0; }
    let y = cy + HEAD;
    const groups: Group[] = laid.map(({ g, items, w, h }) => {
      const t = g.thread ? threadById.get(g.thread) : null;
      const out: Group = {
        id: g.id,
        title: g.topic ? clean(g.caption) : titleFrom(g.caption, t?.title || ""),
        thread: g.thread,
        at: g.last,
        x: cx, y, w, h,
        items: items.map((it) => ({ ...it, x: cx + it.x, y: y + it.y })),
        all: g.items,
      };
      y += h + GROUP_GAP;
      return out;
    });
    if (!groups.length) y += 8;
    const threads = c.threads.map((item, i) => ({ item, x: cx, y: y + i * THREAD_ROW }));
    y += threads.length * THREAD_ROW;
    const h = y - cy;
    clusters.push({
      key: c.key, name: c.name, x: cx, y: cy, w: colW, h, at: c.at, groups, threads,
      pages: index.pages.filter((p) => p.project === c.key),
    });
    cx += colW + COL_GAP;
    rowH = Math.max(rowH, h);
  }
  const w = Math.max(...clusters.map((c) => c.x + c.w), 1);
  const h = Math.max(...clusters.map((c) => c.y + c.h), 1);
  // the largest size every project name can share without running into the next column
  const nameCap = Math.floor(Math.min(...clusters.map((c) => (c.w + COL_GAP * 0.75) / (c.name.length * 0.56)), 400));
  return { clusters, w, h, nameCap };
}
