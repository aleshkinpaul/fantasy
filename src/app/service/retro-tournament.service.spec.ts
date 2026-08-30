import { validateRetroTournamentRegistry } from './retro-tournament.service';

describe('RetroTournamentService', () => {
  it('accepts a complete overall standings snapshot', () => {
    const registry = validateRetroTournamentRegistry({
      version: 1,
      tournaments: [{
        id: 'retro',
        title: 'Retro',
        period: '2023–24',
        kind: 'la-liga',
        format: 'overall',
        sourceFile: 'retro.csv',
        tourCount: 1,
        standings: [standing()]
      }]
    });

    expect(registry.tournaments[0].standings[0].totalScore).toBe(50);
  });

  it('rejects standings with gaps in places', () => {
    expect(() => validateRetroTournamentRegistry({
      version: 1,
      tournaments: [{
        id: 'retro',
        title: 'Retro',
        period: '2023–24',
        kind: 'la-liga',
        format: 'overall',
        sourceFile: 'retro.csv',
        tourCount: 1,
        standings: [standing({ place: 2 })]
      }]
    })).toThrowError(/without gaps/);
  });
});

function standing(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    place: 1,
    participantName: 'Участник',
    participantId: 'participant',
    profileId: 'profile',
    teamName: 'Команда',
    logo: 'assets/logos/default.png',
    matched: true,
    totalScore: 50,
    maxScore: 50,
    averageScore: 50,
    minScore: 50,
    tourScores: [50],
    ...overrides
  };
}
