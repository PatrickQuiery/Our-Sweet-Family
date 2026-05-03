const { calculateAgeLabel } = require('../../lib/ageLabel');

describe('calculateAgeLabel', () => {
  it('returns null when photo is taken before birth', () => {
    expect(calculateAgeLabel('2023-06-15', '2023-06-14')).toBeNull();
  });

  it('returns null when photo is taken on birth date (same instant)', () => {
    // cap < dob is false when equal, so 0 days
    expect(calculateAgeLabel('2023-06-15', '2023-06-15')).toBe('0 days');
  });

  it('returns "1 day" for one day after birth', () => {
    expect(calculateAgeLabel('2023-06-15', '2023-06-16')).toBe('1 day');
  });

  it('returns days for less than one month', () => {
    expect(calculateAgeLabel('2023-06-01', '2023-06-15')).toBe('14 days');
  });

  it('returns "1 month" at exactly one month', () => {
    expect(calculateAgeLabel('2023-01-15', '2023-02-15')).toBe('1 month');
  });

  it('returns months for multiple months', () => {
    expect(calculateAgeLabel('2023-01-15', '2023-04-15')).toBe('3 months');
  });

  it('returns "1 year" at exactly one year', () => {
    expect(calculateAgeLabel('2022-04-15', '2023-04-15')).toBe('1 year');
  });

  it('returns years only when months is 0', () => {
    expect(calculateAgeLabel('2020-04-15', '2023-04-15')).toBe('3 years');
  });

  it('returns years and months combined', () => {
    expect(calculateAgeLabel('2020-01-15', '2023-04-15')).toBe('3 years, 3 months');
  });

  it('handles year rollover (born Dec, photo in Jan)', () => {
    // Born Dec 15, photo Jan 20 next year = 1 month, 5 days → returns "1 month"
    expect(calculateAgeLabel('2022-12-15', '2023-01-20')).toBe('1 month');
  });

  it('handles year rollover with month subtraction (born Dec 20, photo Jan 5)', () => {
    // Dec 20 to Jan 5: months = 1-12 = -11 → years-=1, months = 1 → then day 5 < 20 → months-=1 = 0 → days
    const result = calculateAgeLabel('2022-12-20', '2023-01-05');
    expect(result).toBe('16 days');
  });

  // ---- BUG #3: Day-of-month not considered in month calculation ----
  // Born Jan 31, photo on Mar 1: only 29 days past Jan 31 (Feb has 28 days in 2023).
  // Correct age: 1 month (the 2-month anniversary is Mar 31, not yet reached).
  // Bug: returns "2 months" because it does months = 3 - 1 = 2 without day adjustment.
  it('BUG: correctly handles day-of-month boundary (born Jan 31, photo Mar 1)', () => {
    expect(calculateAgeLabel('2023-01-31', '2023-03-01')).toBe('1 month');
  });

  it('BUG: correctly handles day-of-month boundary (born Mar 31, photo May 30)', () => {
    // Mar 31 + 2 months = May 31 (not yet reached on May 30)
    expect(calculateAgeLabel('2023-03-31', '2023-05-30')).toBe('1 month');
  });

  it('correctly handles when photo day exceeds birth day (no adjustment needed)', () => {
    // Born Jan 15, photo Mar 20: day 20 >= 15, months = 2 → "2 months"
    expect(calculateAgeLabel('2023-01-15', '2023-03-20')).toBe('2 months');
  });
});
