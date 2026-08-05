/** Compact age label from a date of birth, e.g. "3 mo", "1 yr", "2 yr 4 mo". */
export function formatAge(dobIso?: string | null, now: Date = new Date()): string {
  if (!dobIso) return '';
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return '';
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} mo`;
  if (rem === 0) return `${years} yr`;
  return `${years} yr ${rem} mo`;
}
