import { FantasyFullInfoResponse } from '../models/competition.models';
import { calculateSquadRatings, getTourMedian } from './rating-calculator';

describe('rating calculator', () => {
  it('calculates a numeric median for string API scores', () => {
    expect(getTourMedian(['10', '20'])).toBe(15);
  });

  it('returns the middle score for an odd number of values', () => {
    expect(getTourMedian(['10', '30', '20'])).toBe('20');
  });

  it('skips a partially populated tour with a zero median', () => {
    const squads = createSquads([
      ['20', '30', '10'],
      ['10', '20', '0'],
      ['5', '10', '0'],
    ]);

    const ratings = calculateSquadRatings(squads, 3);

    expect(ratings.every(Number.isFinite)).toBeTrue();
    expect(squads.data.players['first'].team.rating).toBe(10);
    expect(squads.data.players['second'].team.rating).toBe(4.1);
    expect(squads.data.players['third'].team.rating).toBe(0);
    expect(ratings[0]).toBe(0);
    expect(ratings[ratings.length - 1]).toBe(10);
  });
});

function createSquads(scoresByPlayer: string[][]): FantasyFullInfoResponse {
  const ids = ['first', 'second', 'third'];
  const players = Object.fromEntries(ids.map((id, playerIndex) => [
    id,
    {
      id,
      name: id,
      logo: '',
      team: {
        id,
        title: id,
        rosters_by_tour: {},
        results_by_tour: Object.fromEntries(scoresByPlayer[playerIndex].map((score, tourIndex) => [
          String(tourIndex + 1),
          {
            tour_score: score,
            total_score: score,
            total_place: String(playerIndex + 1),
            tour_place: String(playerIndex + 1),
          },
        ])),
      },
    },
  ]));

  return {
    result: 1,
    data: {
      id: 'test',
      title: 'test',
      fantasy_tournament_name: 'test',
      season: 'test',
      tours: {
        1: { number: '1', start: '', end: '' },
        2: { number: '2', start: '', end: '' },
        3: { number: '3', start: '', end: '' },
      },
      players,
      matches: {},
    },
  };
}
