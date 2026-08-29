import { buildTournamentTimeline } from './tournament-catalog.service';

describe('TournamentCatalogService', () => {
  it('groups tournaments by season from newest to oldest', () => {
    const timeline = buildTournamentTimeline([
      item({ id: 'old', period: '2024–25', yearStart: 2024 }),
      item({ id: 'new', period: '2026–27', yearStart: 2026 })
    ]);

    expect(timeline.map(group => group.period)).toEqual(['2026–27', '2024–25']);
  });

  it('orders every season as La Liga, cup, Champions League and summer tournament', () => {
    const timeline = buildTournamentTimeline([
      item({ id: 'summer', kind: 'summer' }),
      item({ id: 'ucl', kind: 'champions-league' }),
      item({ id: 'cup', kind: 'cup' }),
      item({ id: 'league', kind: 'la-liga' })
    ]);

    expect(timeline[0].tournaments.map(tournament => tournament.kind)).toEqual([
      'la-liga',
      'cup',
      'champions-league',
      'summer'
    ]);
  });

  it('marks only completed tournaments as archived', () => {
    const timeline = buildTournamentTimeline([
      item({ id: 'completed', status: 'completed' }),
      item({ id: 'active', status: 'active' }),
      item({ id: 'scheduled', status: 'scheduled' })
    ]);
    const tournaments = timeline[0].tournaments;

    expect(tournaments.find(item => item.id === 'completed')?.isArchive).toBeTrue();
    expect(tournaments.find(item => item.id === 'completed')?.statusLabel).toBe('Завершён');
    expect(tournaments.find(item => item.id === 'active')?.isArchive).toBeFalse();
    expect(tournaments.find(item => item.id === 'scheduled')?.isArchive).toBeFalse();
  });

  it('rejects duplicate identifiers', () => {
    expect(() => buildTournamentTimeline([item({ id: 'same' }), item({ id: 'same' })]))
      .toThrowError(/duplicate id/);
  });

  it('rejects unsupported kinds, statuses and external routes', () => {
    expect(() => buildTournamentTimeline([item({ kind: 'friendly' })])).toThrowError(/invalid kind/);
    expect(() => buildTournamentTimeline([item({ status: 'paused' })])).toThrowError(/invalid status/);
    expect(() => buildTournamentTimeline([item({ route: 'https:\/\/example.com' })])).toThrowError(/must start/);
  });
});

function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'tournament',
    period: '2025–26',
    yearStart: 2025,
    kind: 'la-liga',
    title: 'Tournament',
    route: '/tournament',
    status: 'active',
    ...overrides
  };
}
