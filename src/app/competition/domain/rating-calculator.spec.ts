import { getLegacyMedian } from './rating-calculator';

describe('rating calculator', () => {
  it('preserves the 2025-26 median semantics for string API scores', () => {
    expect(getLegacyMedian(['10', '20'])).toBe(1005);
  });

  it('returns the middle score for an odd number of values', () => {
    expect(getLegacyMedian(['10', '30', '20'])).toBe('20');
  });
});
