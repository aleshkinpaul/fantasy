import { IProfileDetails } from '../../models/domain';
import { CompetitionPrizeConfig } from '../models/competition.models';
import { SPAIN_PRIZE_IDS } from '../config/spain-prize.ids';
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

  it('selects every woman who first reaches one hundred in the same eligible tour', () => {
    const first = createProfile('first', 0, 100);
    first.sex = 2;
    first.team.results_by_tour = { 4: tourResult(100), 5: tourResult(0) };
    const second = createProfile('second', 0, 100);
    second.sex = 2;
    second.team.results_by_tour = { 4: tourResult(105), 5: tourResult(0) };
    const later = createProfile('later', 0, 100);
    later.sex = 2;
    later.team.results_by_tour = { 4: tourResult(90), 5: tourResult(120) };

    const result = calculateSpainPrizes({
      prizes: [prize(SPAIN_PRIZE_IDS.FIRST_HUNDRED)],
      profiles: [],
      profilesDetails: [first, second, later],
      rules: {
        guestProfileIds: [],
        extraWinnerIds: [],
        firstHundredEligibleTours: [4, 5],
      },
    });

    expect(result[0].activeLeaders.map(profile => profile.id)).toEqual(['second', 'first']);
  });

  it('uses total score divided by constant cost to select the value player', () => {
    const leader = createProfile('leader', 0, 100);
    leader.results.selectedPlayerPoints = { efficient: 14, expensive: 30 };
    const runnerUp = createProfile('runner-up', 0, 100);
    runnerUp.results.selectedPlayerPoints = { efficient: 8, expensive: 40 };

    const result = calculateSpainPrizes({
      prizes: [prize(SPAIN_PRIZE_IDS.HANDY_HANDS)],
      profiles: [],
      profilesDetails: [leader, runnerUp],
      rules: { guestProfileIds: [], extraWinnerIds: [] },
      sportPlayers: [
        sportPlayer('efficient', '10', 5, 20),
        sportPlayer('expensive', '11', 7, 100),
        sportPlayer('second', '11', 5, 15),
        sportPlayer('third', '12', 5, 10),
        sportPlayer('fourth', '10', 5, 5),
        sportPlayer('fifth', '11', 5, 4),
        sportPlayer('sixth', '12', 5, 3),
      ],
    });

    expect(result[0].activeLeaders.map(profile => profile.id)).toEqual(['leader', 'runner-up']);
    expect(leader.prizes[SPAIN_PRIZE_IDS.HANDY_HANDS].value).toBe(14);
    expect(result[0].calculationInfo).toContain('1. efficient — 20 FO / 5 = 4');
    expect(result[0].calculationInfo).toContain('5. fifth — 4 FO / 5 = 0.8');
    expect(result[0].calculationInfo).not.toContain('sixth');
  });

  it('keeps a placeholder prize without calculated nominees', () => {
    const result = calculateSpainPrizes({
      prizes: [{ ...prize(SPAIN_PRIZE_IDS.SPICY_PEPE), isPlaceholder: true }],
      profiles: [],
      profilesDetails: [createProfile('profile', 0, 100)],
      rules: { guestProfileIds: [], extraWinnerIds: [] },
    });

    expect(result[0].nomineesArr).toEqual([]);
    expect(result[0].state).toBe(2);
  });
});

function prize(id: number): CompetitionPrizeConfig {
  return { id, nomineesArr: [], activeLeaders: [] };
}

function tourResult(score: number): { tour_score: number; total_score: number; total_place: number } {
  return { tour_score: score, total_score: score, total_place: 1 };
}

function sportPlayer(id: string, position: string, cost: number, score: number) {
  return {
    id,
    name: id,
    amplua_id: position,
    team_id: 'club',
    cost,
    stat_by_tours: { 1: { score, match_time: 90 } },
  };
}

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
