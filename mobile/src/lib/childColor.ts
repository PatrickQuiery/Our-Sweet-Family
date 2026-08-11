import type { Child } from './types';

// Per-child accent color for filter chips. Explicit `color` wins; otherwise a
// per-gender palette where same-gender siblings get DIFFERENT shades. Mirrors
// the web helper.
const GENDER_PALETTES: Record<string, string[]> = {
  male: ['#3b82f6', '#0ea5e9', '#6366f1', '#06b6d4', '#1d4ed8'],
  female: ['#f43f74', '#ff7eb6', '#c026d3', '#fb7185', '#be123c'],
};
const NEUTRAL = ['#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#eab308', '#14b8a6'];

function paletteFor(gender?: string | null): string[] {
  return (gender && GENDER_PALETTES[gender]) || NEUTRAL;
}
const genderKey = (g?: string | null) => g || 'other';

export function genderColor(gender?: string | null): string {
  return paletteFor(gender)[0];
}

export function childColor(child?: Pick<Child, 'color' | 'gender'> | null): string {
  return child?.color || genderColor(child?.gender);
}

/** Distinct color per child (same-gender siblings differ). Returns { [id]: hex }. */
export function resolveChildColors(children: Array<Pick<Child, 'id' | 'color' | 'gender'>> = []): Record<string, string> {
  const usedByGender: Record<string, Set<string>> = {};
  const use = (g: string) => (usedByGender[g] = usedByGender[g] || new Set<string>());
  for (const c of children) if (c.color) use(genderKey(c.gender)).add(c.color.toLowerCase());
  const map: Record<string, string> = {};
  for (const c of children) {
    if (c.color) { map[c.id] = c.color; continue; }
    const used = use(genderKey(c.gender));
    const palette = paletteFor(c.gender);
    const pick = palette.find((col) => !used.has(col.toLowerCase())) || palette[used.size % palette.length];
    used.add(pick.toLowerCase());
    map[c.id] = pick;
  }
  return map;
}
