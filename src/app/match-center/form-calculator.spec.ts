import { CompetitionMatch } from '../competition/models/competition.models';
import { IProfileDetails } from '../models/domain';
import { calculateTeamForm } from './form-calculator';

describe('calculateTeamForm', () => {
  it('uses only the five completed matches before the selected tour', () => {
    const matchesByTour = {
      1: [match('team', 'a', 50, 40, 1)],
      2: [match('b', 'team', 60, 55, 1)],
      3: [match('team', 'c', 70, 70, 0)],
      4: [match('team', 'd', 80, 50, 1)],
      5: [match('e', 'team', 40, 65, 2)],
      6: [match('team', 'f', 75, 70, 1)],
      7: [match('team', 'future', 500, 0, 1)],
    };

    const form = calculateTeamForm({
      profileId: 'team',
      targetTour: 7,
      matchesByTour,
      profiles: profilesFromMatches(matchesByTour),
    });

    expect(form.recentResults.map(result => result.tour)).toEqual([6, 5, 4, 3, 2]);
    expect(form.wins).toBe(3);
    expect(form.draws).toBe(1);
    expect(form.losses).toBe(1);
    expect(form.winStreak).toBe(3);
    expect(form.unbeatenStreak).toBe(4);
    expect(form.averageScored).toBe(69);
    expect(form.averageConceded).toBe(58);
  });

  it('returns a neutral empty form before the first match', () => {
    const profiles = [profile('team', []), profile('other', [])];
    const form = calculateTeamForm({
      profileId: 'team',
      targetTour: 1,
      matchesByTour: {},
      profiles,
    });

    expect(form.matchesCount).toBe(0);
    expect(form.rating).toBe(5);
    expect(form.ratingChange).toBeUndefined();
    expect(form.stability).toBe('unavailable');
    expect(form.normalizedVariationPercent).toBeUndefined();
  });

  it('calculates the result correctly when the team played away', () => {
    const matchesByTour = { 1: [match('home', 'team', 45, 60, 2)] };
    const form = calculateTeamForm({
      profileId: 'team',
      targetTour: 2,
      matchesByTour,
      profiles: [profile('home', [45]), profile('team', [60])],
    });

    expect(form.recentResults[0]).toEqual(jasmine.objectContaining({
      scored: 60,
      conceded: 45,
      outcome: 'win',
    }));
  });

  it('calculates stability from scores normalized against each tour maximum', () => {
    const matchesByTour = {
      1: [match('team', 'first-rival', 50, 40, 1), match('leader-1', 'other-1', 100, 30, 1)],
      2: [match('team', 'second-rival', 50, 40, 1), match('leader-2', 'other-2', 50, 30, 1)],
    };

    const form = calculateTeamForm({
      profileId: 'team',
      targetTour: 3,
      matchesByTour,
      profiles: profilesFromMatches(matchesByTour),
    });

    expect(form.averageScored).toBe(50);
    expect(form.normalizedVariationPercent).toBe(33);
    expect(form.stability).toBe('low');
  });
});

function match(
  home: string,
  away: string,
  homeScore: number,
  awayScore: number,
  result: 0 | 1 | 2,
): CompetitionMatch {
  return { home, away, home_score: homeScore, away_score: awayScore, result };
}

function profile(id: string, scores: Array<number | undefined>): Pick<IProfileDetails, 'id' | 'team'> {
  return {
    id,
    team: {
      id,
      title: id,
      rosters_by_tour: {},
      results_by_tour: Object.fromEntries(scores.flatMap((score, index) => score === undefined
        ? []
        : [[index + 1, { tour_score: score, total_score: score, total_place: 1 }]])),
    },
  };
}

function profilesFromMatches(
  matchesByTour: Record<number, CompetitionMatch[]>,
): Array<Pick<IProfileDetails, 'id' | 'team'>> {
  const scores = new Map<string, number[]>();
  Object.entries(matchesByTour).forEach(([tourValue, matches]) => {
    const tour = Number(tourValue);
    matches.forEach(item => {
      for (const [id, score] of [[item.home, item.home_score], [item.away, item.away_score]] as const) {
        const values = scores.get(id) || [];
        values[tour - 1] = Number(score);
        scores.set(id, values);
      }
    });
  });
  return [...scores.entries()].map(([id, values]) => profile(id, values));
}
