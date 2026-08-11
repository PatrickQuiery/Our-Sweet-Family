// Per-child accent color used for filter chips, timeline dots, and avatars.
// A child's explicit `color` wins; otherwise a gender default; otherwise purple.

const GENDER = { male: '#3b82f6', female: '#f43f74' };

// Swatches offered in the color picker (gender defaults are included so the
// active default highlights correctly).
export const CHILD_PALETTE = ['#f43f74', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#0ea5e9', '#ef4444', '#14b8a6'];

export function genderColor(gender) {
  return GENDER[gender] || '#8b5cf6';
}

export function childColor(child) {
  return child?.color || genderColor(child?.gender);
}
