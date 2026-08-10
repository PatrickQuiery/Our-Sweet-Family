// Web port of the mobile timeline mosaic (see mobile/src/lib/mosaic.ts).
// Groups memories into date sections, then packs each section into rows of
// varying tile shapes for an editorial, not-all-the-same-size rhythm. The layout
// is deterministic (driven only by position), so paging in more never reflows
// what's already on screen. Sizing is done in CSS via per-row aspect-ratio +
// flex weights, so no pixel measurement is needed.

// Row templates: column weight arrays + a height factor (× row width).
const TEMPLATES = [
  { cols: [1], h: 0.62 },       // full-width hero (landscape)
  { cols: [1, 1], h: 0.5 },     // two squares
  { cols: [2, 1], h: 0.52 },    // big left + tall right
  { cols: [1, 1, 1], h: 0.36 }, // trio
  { cols: [1, 2], h: 0.52 },    // tall left + big right
];

function fallbackTemplate(remaining) {
  if (remaining <= 1) return { cols: [1], h: 0.62 };
  if (remaining === 2) return { cols: [1, 1], h: 0.5 };
  return { cols: [1, 1, 1], h: 0.36 };
}

/** Pack an ordered list of memories into mosaic rows. `seed` varies the opening shape per section. */
export function buildRows(memories, seed = 0) {
  const rows = [];
  let i = 0;
  let t = seed;
  while (i < memories.length) {
    const remaining = memories.length - i;
    let template = TEMPLATES[t % TEMPLATES.length];
    if (template.cols.length > remaining) template = fallbackTemplate(remaining);
    const tiles = template.cols.map((weight, ci) => ({ memory: memories[i + ci], weight }));
    rows.push({ key: tiles.map((x) => x.memory.id).join('-'), h: template.h, tiles });
    i += template.cols.length;
    t += 1;
  }
  return rows;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Human date bucket for a memory relative to `now`. */
export function dateBucket(iso, now) {
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

/** memories (newest-first) → date sections → mosaic rows. */
export function buildTimeline(memories, now = new Date()) {
  const order = [];
  const groups = new Map();
  for (const m of memories) {
    const { key, title } = dateBucket(m.capturedAt ?? m.createdAt, now);
    let g = groups.get(key);
    if (!g) {
      g = { title, items: [] };
      groups.set(key, g);
      order.push(key);
    }
    g.items.push(m);
  }
  return order.map((key, idx) => {
    const g = groups.get(key);
    return { key, title: g.title, count: g.items.length, rows: buildRows(g.items, idx) };
  });
}
