/**
 * Calculate age label from dateOfBirth to capturedAt date.
 * Returns e.g. "2 years, 3 months" or "4 months" or "1 year"
 */
function calculateAgeLabel(dateOfBirth, capturedAt) {
  const dob = new Date(dateOfBirth);
  const cap = new Date(capturedAt);

  if (cap < dob) return null;

  let years = cap.getFullYear() - dob.getFullYear();
  let months = cap.getMonth() - dob.getMonth();

  if (months < 0) {
    years -= 1;
    months += 12;
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
