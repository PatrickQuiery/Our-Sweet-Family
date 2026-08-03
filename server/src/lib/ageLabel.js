/**
 * Calculate age label from dateOfBirth to capturedAt date.
 * Returns e.g. "2 years, 3 months" or "4 months" or "1 year"
 */
function calculateAgeLabel(dateOfBirth, capturedAt) {
  const dob = new Date(dateOfBirth);
  const cap = new Date(capturedAt);

  if (cap < dob) return null;

  // Read the date parts in UTC. Date-only values (e.g. "2023-01-31") are parsed
  // as UTC midnight, so using local getters would shift the day/month backward in
  // negative-offset timezones and produce the wrong age near month boundaries.
  let years = cap.getUTCFullYear() - dob.getUTCFullYear();
  let months = cap.getUTCMonth() - dob.getUTCMonth();

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  // If the photo was taken before the birth-day-of-month in this month,
  // the child hasn't yet completed that month (e.g. born Jan 31, photo Mar 1
  // is only ~29 days past the 1-month mark, not 2 months).
  if (cap.getUTCDate() < dob.getUTCDate()) {
    months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }
  }

  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  if (parts.length === 0) {
    const days = Math.floor((cap - dob) / (1000 * 60 * 60 * 24));
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }

  return parts.join(', ');
}

module.exports = { calculateAgeLabel };
