const { effectivePlan } = require('../../lib/plan');

const future = new Date(Date.now() + 60 * 1000).toISOString();
const past = new Date(Date.now() - 60 * 1000).toISOString();

describe('effectivePlan', () => {
  it('returns the base plan when there is no boost', () => {
    expect(effectivePlan({ plan: 'free', planBoostUntil: null })).toBe('free');
    expect(effectivePlan({ plan: 'plus' })).toBe('plus');
  });

  it('upgrades a free user to plus while the boost is active', () => {
    expect(effectivePlan({ plan: 'free', planBoostUntil: future })).toBe('plus');
  });

  it('ignores an expired boost', () => {
    expect(effectivePlan({ plan: 'free', planBoostUntil: past })).toBe('free');
  });

  it('never downgrades a higher base plan', () => {
    expect(effectivePlan({ plan: 'premium', planBoostUntil: future })).toBe('premium');
  });

  it('is safe on missing/undefined input', () => {
    expect(effectivePlan(null)).toBe('free');
    expect(effectivePlan({})).toBe('free');
  });
});
