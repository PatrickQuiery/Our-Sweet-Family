import { formatAge } from '../age';

describe('formatAge', () => {
  const now = new Date('2026-08-05T12:00:00Z');

  it('returns months for under a year', () => {
    expect(formatAge('2026-05-05', now)).toBe('3 mo');
  });

  it('returns whole years on a birthday boundary', () => {
    expect(formatAge('2024-08-05', now)).toBe('2 yr');
  });

  it('returns years and months', () => {
    expect(formatAge('2023-04-05', now)).toBe('3 yr 4 mo');
  });

  it('is empty for missing or invalid input', () => {
    expect(formatAge(null, now)).toBe('');
    expect(formatAge('not-a-date', now)).toBe('');
  });

  it('never goes negative for a future date', () => {
    expect(formatAge('2027-01-01', now)).toBe('0 mo');
  });
});
