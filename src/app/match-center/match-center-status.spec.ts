import { resolveMatchCenterStatus } from './match-center-status';

describe('resolveMatchCenterStatus', () => {
  const start = '2026-09-11 22:00:00';
  const end = '2026-09-14 22:00:00';

  it('recognizes a live tour while its API scores are updating', () => {
    expect(resolveMatchCenterStatus({
      tour: 5,
      lastTour: 5,
      tourStartsAt: start,
      tourEndsAt: end,
      homeScore: 51,
      awayScore: 49,
      now: Date.parse('2026-09-13T12:00:00'),
    })).toBe('live');
  });

  it('keeps a tour upcoming before its start', () => {
    expect(resolveMatchCenterStatus({
      tour: 5,
      lastTour: 5,
      tourStartsAt: start,
      tourEndsAt: end,
      homeScore: 0,
      awayScore: 0,
      now: Date.parse('2026-09-10T12:00:00'),
    })).toBe('upcoming');
  });

  it('recognizes a completed tour after its deadline', () => {
    expect(resolveMatchCenterStatus({
      tour: 5,
      lastTour: 5,
      tourStartsAt: start,
      tourEndsAt: end,
      homeScore: 61,
      awayScore: 55,
      now: Date.parse('2026-09-15T12:00:00'),
    })).toBe('completed');
  });
});
