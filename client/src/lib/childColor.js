// Per-child accent color for filter chips, timeline dots, and avatars.
// A child's explicit `color` always wins. Defaults come from a per-gender
// palette, and same-gender siblings get DIFFERENT shades of that gender so they
// stay distinguishable.

const GENDER_PALETTES = {
  male: ['#3b82f6', '#0ea5e9', '#6366f1', '#06b6d4', '#1d4ed8'],
  female: ['#f43f74', '#ff7eb6', '#c026d3', '#fb7185', '#be123c'],
};
const NEUTRAL = ['#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#eab308', '#14b8a6'];

// Swatches offered in the color picker (all gender families + neutrals).
export const PICKER_PALETTE = [...GENDER_PALETTES.female, ...GENDER_PALETTES.male, ...NEUTRAL];

function paletteFor(gender) {
  return GENDER_PALETTES[gender] || NEUTRAL;
}

const genderKey = (gender) => gender || 'other';

/** First color of a gender's palette — the simple, no-sibling-context default. */
export function genderColor(gender) {
  return paletteFor(gender)[0];
}

/** Single-child color with no sibling context: explicit color or gender base. */
export function childColor(child) {
  return child?.color || genderColor(child?.gender);
}

/**
 * Resolve a distinct color for every child in a family. Explicit `color` wins;
 * otherwise the next unused color from that child's gender palette (so a second
 * girl/boy gets a different shade of the same family).
 * Returns a { [childId]: hex } map.
 */
export function resolveChildColors(children = []) {
  const usedByGender = {};
  const use = (g) => (usedByGender[g] = usedByGender[g] || new Set());
  // Seed with explicit colors first so auto-assignment avoids them.
  for (const c of children) {
    if (c.color) use(genderKey(c.gender)).add(c.color.toLowerCase());
  }
  const map = {};
  for (const c of children) {
    if (c.color) { map[c.id] = c.color; continue; }
    const used = use(genderKey(c.gender));
    const palette = paletteFor(c.gender);
    let pick = palette.find((col) => !used.has(col.toLowerCase())) || palette[used.size % palette.length];
    used.add(pick.toLowerCase());
    map[c.id] = pick;
  }
  return map;
}

/** Smart default for a NEW child of `gender`, avoiding colors already in use by
 *  same-gender siblings. */
export function nextColorForGender(gender, existing = []) {
  const resolved = resolveChildColors(existing);
  const gk = genderKey(gender);
  const used = new Set(
    existing.filter((c) => genderKey(c.gender) === gk).map((c) => (resolved[c.id] || '').toLowerCase()).filter(Boolean),
  );
  const palette = paletteFor(gender);
  return palette.find((col) => !used.has(col.toLowerCase())) || palette[used.size % palette.length];
}
