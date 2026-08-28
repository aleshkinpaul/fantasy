import { IProfileDetails } from '../../models/domain';
import { CompetitionPrizeConfig } from '../models/competition.models';
import { calculateSpainPrizes, calculateWorldCupPrizes } from './prize-calculator';

describe('prize calculator', () => {
  it('sorts nominees and applies the activity filter', () => {
    const inactiveLeader = createProfile('inactive', 3, 50);
    const activeRunnerUp = createProfile('active', 2, 60);
    const prizes: CompetitionPrizeConfig[] = [{
      id: 5,
      isActivity: true,
      nomineesArr: [],
      activeLeaders: [],
    }];

    const result = calculateWorldCupPrizes({
      prizes,
      profiles: [],
      profilesDetails: [inactiveLeader, activeRunnerUp],
    });

    expect(result[0].nomineesArr.map(profile => profile.id))
      .toEqual(['inactive', 'active']);
    expect(result[0].activeLeaders.map(profile => profile.id))
      .toEqual(['active']);
    expect(result[0].state).toBe(1);
  });

  it('calculates a partial Spain prize set without legacy-only rule ids', () => {
    const leader = createProfile('leader', 0, 60);
    leader.results.prizeMaxLosedDiff = 12;
    const runnerUp = createProfile('runner-up', 0, 60);
    runnerUp.results.prizeMaxLosedDiff = 8;
    const prizes: CompetitionPrizeConfig[] = [{
      id: 19,
      isActivity: true,
      nomineesArr: [],
      activeLeaders: [],
    }];

    const result = calculateSpainPrizes({
      prizes,
      profiles: [leader, runnerUp].map(profile => ({
        id: profile.id,
        name: profile.name,
        nick: profile.nick,
        url: profile.url,
        logo: profile.logo,
        sex: 1,
      })),
      profilesDetails: [leader, runnerUp],
      rules: { guestProfileIds: [], extraWinnerIds: [] },
    });

    expect(result[0].nomineesArr.map(profile => profile.id))
      .toEqual(['leader', 'runner-up']);
    expect(result[0].activeLeaders.map(profile => profile.id))
      .toEqual(['leader', 'runner-up']);
  });
});

function createProfile(id: string, uniquePlayers: number, subsCoef: number): IProfileDetails {
  return {
    id,
    name: id,
    nick: id,
    url: '',
    logo: '',
    score: 0,
    team: {
      id,
      title: id,
      results_by_tour: {},
      rosters_by_tour: {},
    },
    prizes: {},
    results: {
      wins: {},
      draws: {},
      loses: {},
      points: {},
      fo: {},
      missed_fo: {},
      diff_fo: {},
      matchesPlayed: 0,
      teamCostTotal: 0,
      teamCostAvg: 0,
      subsUsedCount: 0,
      subsTotalCount: 0,
      subsCoef,
      uniqueUsedPlayers: Array.from({ length: uniquePlayers }, (_, index) => String(index)),
      portugezePoints: 0,
      larinPoints: 0,
      prizeMinWins: 0,
      prizeMaxFoInTour: 0,
      prizeMaxFoInLosedTour: 0,
      prizeCurrentWinStrike: 0,
      prizeMaxWinStrike: 0,
      prizeCurrentNoLoseStrike: 0,
      prizeMaxNoLoseStrike: 0,
      prizeMaxStoppedNoLoseStrike: 0,
      prizeMaxLosedDiff: 0,
    },
  };
}
