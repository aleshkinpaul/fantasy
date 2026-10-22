import { CompetitionCup, FantasyFullInfoResponse, SportPlayer } from '../models/competition.models';
import { calculateCup, calculateTieBreak, getDoubleElimination48RoundTemplate } from './cup-calculator';

describe('calculateTieBreak', () => {
  it('uses the vice-captain when the captain did not play and applies the configured metrics', () => {
    const base = ['gk', 'cap', 'vice', 'd3', 'd4', 'm1', 'm2', 'm3', 'm4', 'f1', 'f2'];
    const bench = ['gk2', 'd5', 'm5', 'f3'];
    const positions: Record<string, string> = {
      gk: '9', gk2: '9',
      cap: '10', vice: '10', d3: '10', d4: '10', d5: '10',
      m1: '11', m2: '11', m3: '11', m4: '11', m5: '11',
      f1: '12', f2: '12', f3: '12',
    };
    const scores: Record<string, number> = {
      gk: 2, gk2: 0,
      cap: 12, vice: 7, d3: 3, d4: 4, d5: 3,
      m1: 5, m2: 4, m3: 6, m4: 2, m5: -1,
      f1: 9, f2: 4, f3: 0,
    };
    const notPlayed = new Set(['cap', 'gk2', 'f3']);
    const sportPlayers = new Map<string, SportPlayer>(
      [...base, ...bench].map(id => [id, {
        id,
        name: id,
        amplua_id: positions[id],
        team_id: 'club',
        cost: 1,
        stat_by_tours: {
          10: { score: scores[id], match_time: notPlayed.has(id) ? 0 : 90 },
        },
      }]),
    );
    const squads = {
      data: {
        players: {
          profile: {
            team: {
              rosters_by_tour: {
                10: {
                  captain_id: 'cap',
                  vice_captain_id: 'vice',
                  players: { base, bench },
                },
              },
            },
          },
        },
      },
    } as unknown as FantasyFullInfoResponse;

    expect(calculateTieBreak('profile', 10, squads, sportPlayers)).toEqual({
      captain: 14,
      topNonCaptain: 9,
      startingPlayers: 10,
      bench: 2,
    });
  });
});

describe('double-elimination-48-v1', () => {
  it('publishes the qualification draw before tour 10 starts', () => {
    const qualificationPairs = Array.from({ length: 16 }, (_, index) => ({
      home: `home-${index}`,
      away: `away-${index}`,
    }));
    const cup = {
      bracketFormat: 'double-elimination-48-v1',
      matchesTours: [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36],
      matches: Array.from({ length: 12 }, () => []),
      draw: { qualificationPairs },
    } as unknown as CompetitionCup;

    calculateCup({
      cup,
      profiles: [],
      squads: {} as FantasyFullInfoResponse,
      lastTour: 9,
    });

    expect(cup.matches[0]).toEqual(qualificationPairs.map(match => ({ ...match, type: 'up' })));
  });

  it('repeats the 2025/26 round sizes and crossover pattern', () => {
    expect([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      .map(round => getDoubleElimination48RoundTemplate(round)?.length))
      .toEqual([16, 16, 8, 8, 4, 4, 2, 2, 1, 1]);

    expect(getDoubleElimination48RoundTemplate(2)?.[0]).toEqual({
      home: { round: 0, match: 15, outcome: 'loser' },
      away: { round: 1, match: 0, outcome: 'loser' },
      type: 'down',
    });
    expect(getDoubleElimination48RoundTemplate(4)?.[0]).toEqual({
      home: { round: 3, match: 1, outcome: 'loser' },
      away: { round: 3, match: 8, outcome: 'winner' },
      type: 'down',
    });
    expect(getDoubleElimination48RoundTemplate(11)?.[0]).toEqual({
      home: { round: 9, match: 0, outcome: 'winner' },
      away: { round: 10, match: 0, outcome: 'winner' },
      type: 'up',
    });
  });
});
