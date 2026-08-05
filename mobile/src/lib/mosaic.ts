import type { Memory } from './types';

/**
 * Timeline layout: groups memories into date sections, then packs each section into
 * a mosaic of rows with varying tile sizes (hero / pair / big+small / trio). The
 * layout is deterministic — driven only by position — so appending a page of
 * memories never reflows what's already on screen.
 *
 * Tiles are cover-cropped to their computed box (the detail view shows the full,
 * uncropped media). We don't have per-image dimensions yet; when the API starts
 * returning width/height this can graduate to a true aspect-ratio justified layout.
 */

export interface MosaicTileLayout {
  memory: Memory;
  width: number;
  height: number;
}

export interface MosaicRow {
  key: string;
  height: number;
  tiles: MosaicTileLayout[];
}

export interface TimelineSection {
  key: string;
  title: string;
  /** Number of memories in this date bucket (for the section header). */
  count: number;
  data: MosaicRow[];
}

interface LayoutOpts {
  /** Content width available for a row (screen width minus horizontal padding). */
  width: number;
  /** Gap between tiles in a row (and between rows). */
  gap: number;
}

// Row templates: column weight arrays + a height factor (× content width).
// The mix of shapes is what gives the feed its varied, editorial rhythm.
interface Template {
  cols: number[];
  h: number;
}

const TEMPLATES: Template[] = [
  { cols: [1], h: 0.66 }, // full-width hero (landscape)
  { cols: [1, 1], h: 0.5 }, // two squares
  { cols: [2, 1], h: 0.52 }, // big left + tall right
  { cols: [1, 1, 1], h: 0.36 }, // trio
  { cols: [1, 2], h: 0.52 }, // tall left + big right
];

function fallbackTemplate(remaining: number): Template {
  if (remaining <= 1) return { cols: [1], h: 0.66 };
  if (remaining === 2) return { cols: [1, 1], h: 0.5 };
  return { cols: [1, 1, 1], h: 0.36 };
}

/** Pack an ordered list of memories into mosaic rows. `seed` varies the opening shape per section. */
export function buildRows(memories: Memory[], opts: LayoutOpts, seed = 0): MosaicRow[] {
  const { width, gap } = opts;
  const rows: MosaicRow[] = [];
  let i = 0;
  let t = seed;

  while (i < memories.length) {
    const remaining = memories.length - i;
    let template = TEMPLATES[t % TEMPLATES.length];
    if (template.cols.length > remaining) template = fallbackTemplate(remaining);

    const cols = template.cols;
    const sum = cols.reduce((a, b) => a + b, 0);
    const avail = width - gap * (cols.length - 1);
    const height = Math.round(template.h * width);

    const tiles: MosaicTileLayout[] = cols.map((c, c_i) => ({
      memory: memories[i + c_i],
      width: Math.round((avail * c) / sum),
      height,
    }));

    rows.push({ key: tiles.map((tile) => tile.memory.id).join('-'), height, tiles });
    i += cols.length;
    t += 1;
  }

  return rows;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Human date bucket for a memory relative to `now`. */
export function dateBucket(iso: string, now: Date): { key: string; title: string } {
  const d = new Date(iso);
  const days = Math.floor((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return { key: 'today', title: 'Today' };
  if (days === 1) return { key: 'yesterday', title: 'Yesterday' };
  if (days < 7) return { key: 'week', title: 'This Week' };
  const sameYear = d.getFullYear() === now.getFullYear();
  return {
    key: `m-${d.getFullYear()}-${d.getMonth()}`,
    title: sameYear ? MONTHS[d.getMonth()] : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  };
}

/**
 * Build the full timeline: memories → date sections → mosaic rows. Memories are
 * assumed newest-first (as the API returns them); buckets keep that order.
 */
export function buildTimeline(memories: Memory[], opts: LayoutOpts, now: Date = new Date()): TimelineSection[] {
  const order: string[] = [];
  const groups = new Map<string, { title: string; items: Memory[] }>();

  for (const m of memories) {
    const { key, title } = dateBucket(m.createdAt, now);
    let g = groups.get(key);
    if (!g) {
      g = { title, items: [] };
      groups.set(key, g);
      order.push(key);
    }
    g.items.push(m);
  }

  return order.map((key, idx) => {
    const g = groups.get(key)!;
    return { key, title: g.title, count: g.items.length, data: buildRows(g.items, opts, idx) };
  });
}
