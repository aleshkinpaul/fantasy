import { drawChampionsLeague, formatCompetitionMatches } from './champions-league-draw';

describe('drawChampionsLeague', () => {
  it('gives every team eight unique opponents and two from each pot', () => {
    const pots = makePots();
    const potByProfile = new Map<string, number>();
    pots.forEach((pot, potIndex) => pot.forEach(profileId => potByProfile.set(profileId, potIndex)));

    for (let seed = 1; seed <= 30; seed++) {
      const result = drawChampionsLeague(pots, seededRandom(seed));

      expect(result.rounds.length).toBe(8);
      result.rounds.forEach(round => {
        expect(round.matches.length).toBe(24);
        const participants = round.matches.flatMap(match => [match.home, match.away]);
        expect(new Set(participants).size).toBe(48);

        const potPairs = new Set(round.matches.map(match => {
          const firstPot = potByProfile.get(match.home)!;
          const secondPot = potByProfile.get(match.away)!;
          return firstPot <= secondPot ? `${firstPot}-${secondPot}` : `${secondPot}-${firstPot}`;
        }));
        expect(potPairs.size).toBeGreaterThan(1);
      });

      Object.entries(result.opponentsByProfile).forEach(([profileId, opponents]) => {
        expect(opponents.length).toBe(8);
        expect(new Set(opponents).size).toBe(8);
        const counts = [0, 0, 0, 0];
        opponents.forEach(opponentId => counts[potByProfile.get(opponentId)!]++);
        expect(counts).toEqual([2, 2, 2, 2], profileId);
      });
    }
  });

  it('rejects malformed pots', () => {
    expect(() => drawChampionsLeague(makePots().slice(0, 3))).toThrowError(/четыре корзины/);

    const duplicate = makePots();
    duplicate[1][0] = duplicate[0][0];
    expect(() => drawChampionsLeague(duplicate)).toThrowError(/нескольких корзинах/);
  });

  it('formats the result for the season matches config', () => {
    const result = drawChampionsLeague(makePots(), seededRandom(42));
    const value = JSON.parse(formatCompetitionMatches(result));

    expect(Object.keys(value)).toEqual(['matches']);
    expect(Object.keys(value.matches)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(value.matches['1']).toEqual(result.rounds[0].matches);
    expect(value.matches['8']).toEqual(result.rounds[7].matches);
  });
});

function makePots(): string[][] {
  return Array.from({ length: 4 }, (_, potIndex) =>
    Array.from({ length: 12 }, (_, teamIndex) => `pot-${potIndex + 1}-team-${teamIndex + 1}`)
  );
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
