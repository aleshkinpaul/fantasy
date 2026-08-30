import { validateArchiveCupRegistry } from './archive-cup.service';

describe('ArchiveCupService domain', () => {
  it('validates aggregate scores and the final champion', () => {
    const registry = validateArchiveCupRegistry(validRegistry());

    expect(registry.tournaments[0].rounds[0].matches[0].firstTotal).toBe(21);
    expect(registry.tournaments[0].championProfileId).toBe('a');
  });

  it('rejects an aggregate score that differs from its legs', () => {
    const value = validRegistry();
    value.tournaments[0].rounds[0].matches[0].firstTotal = 20;

    expect(() => validateArchiveCupRegistry(value)).toThrowError(/invalid aggregate score/);
  });

  it('rejects a champion different from the final winner', () => {
    const value = validRegistry();
    value.tournaments[0].championProfileId = 'b';

    expect(() => validateArchiveCupRegistry(value)).toThrowError(/champion must match/);
  });
});

function validRegistry(): any {
  return {
    version: 1,
    tournaments: [{
      id: 'cup',
      title: 'Cup',
      period: '2024–25',
      yearStart: 2024,
      format: 'knockout',
      description: 'Description',
      sourceDocument: 'docs/cup.md',
      championProfileId: 'a',
      rounds: [{
        id: 'final',
        title: 'Final',
        tours: [30, 32],
        matches: [{
          id: 'final-1',
          first: team('a'),
          second: team('b'),
          legs: [
            { tour: 30, homeProfileId: 'a', awayProfileId: 'b', homeScore: 10, awayScore: 9 },
            { tour: 32, homeProfileId: 'b', awayProfileId: 'a', homeScore: 8, awayScore: 11 },
          ],
          firstTotal: 21,
          secondTotal: 17,
          winnerProfileId: 'a',
        }],
      }],
    }],
  };
}

function team(profileId: string) {
  return {
    profileId,
    participantName: `Participant ${profileId}`,
    teamName: `Team ${profileId}`,
    logo: `assets/${profileId}.png`,
  };
}
