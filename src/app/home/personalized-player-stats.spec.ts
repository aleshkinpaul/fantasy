import { SportPlayer } from '../competition/models/competition.models';
import { IProfileDetails, IRoster } from '../models/domain';
import { calculatePersonalizedPlayerStats } from './personalized-player-stats';

describe('personalized player stats', () => {
  it('counts only played footballers included in the effective lineup', () => {
    const profile = createProfile({
      1: roster(['captain', 'regular', 'unused'], [], 'captain'),
      2: roster(['captain', 'regular', 'unused'], [], 'captain'),
    });
    const stats = calculatePersonalizedPlayerStats(profile, 2, {
      1: [player('captain', 'Captain', 5, 90), player('regular', 'Regular', 7, 90), player('unused', 'Unused', 9, 0)],
      2: [player('captain', 'Captain', 4, 90), player('regular', 'Regular', 3, 90), player('unused', 'Unused', 8, 0)],
    });

    expect(stats.countedTours).toBe(2);
    expect(stats.mostUsed.map(item => [item.name, item.appearances])).toEqual([
      ['Captain', 2],
      ['Regular', 2],
    ]);
    expect(stats.topScorers.map(item => [item.name, item.fantasyPoints])).toEqual([
      ['Captain', 18],
      ['Regular', 10],
    ]);
  });

  function createProfile(rosters: Record<number, IRoster>): IProfileDetails {
    return {
      id: 'profile', name: 'Participant', nick: '', url: '', logo: '', score: 0, prizes: {},
      team: {
        id: 'team', title: 'Team', rosters_by_tour: rosters,
        results_by_tour: { 1: { tour_score: 0, total_score: 0, total_place: 1 }, 2: { tour_score: 0, total_score: 0, total_place: 1 } },
      },
      results: {
        wins: {}, draws: {}, loses: {}, points: {}, fo: {}, missed_fo: {}, diff_fo: {},
        matchesPlayed: 0, teamCostTotal: 0, teamCostAvg: 0, subsUsedCount: 0,
        subsTotalCount: 0, subsCoef: 0, uniqueUsedPlayers: [], portugezePoints: 0,
        larinPoints: 0, prizeMinWins: 0, prizeMaxFoInTour: 0, prizeMaxFoInLosedTour: 0,
        prizeCurrentWinStrike: 0, prizeMaxWinStrike: 0, prizeCurrentNoLoseStrike: 0,
        prizeMaxNoLoseStrike: 0, prizeMaxStoppedNoLoseStrike: 0, prizeMaxLosedDiff: 0,
      },
    };
  }

  function roster(base: string[], bench: string[], captainId: string): IRoster {
    return { team_cost: 100, total_score: 0, captain_id: captainId, players: { base, bench } };
  }

  function player(id: string, name: string, score: number, minutes: number): SportPlayer {
    return {
      id, name, amplua_id: id === 'captain' ? '11' : '10', team_id: 'club', cost: 10,
      stat_by_tours: { 1: { score, match_time: minutes }, 2: { score, match_time: minutes } },
    };
  }
});
