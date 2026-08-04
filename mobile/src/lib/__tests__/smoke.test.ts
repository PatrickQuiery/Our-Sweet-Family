import { sum } from '../smoke';

test('sum adds numbers', () => {
  expect(sum(2, 3)).toBe(5);
});
