import { IProfileDetails, ITeamData } from '../../models/domain';
import { LeagueH2HDataService } from './league-h2h-data.service';

describe('LeagueH2HDataService', () => {
  const service = new LeagueH2HDataService();

  it('treats the draw gap boundary as a draw', () => {
    expect(service.calculateMatchResult(100, 97, 3)).toEqual({
      homeScore: 100,
      awayScore: 97,
      result: 0,
    });
  });

  it('selects the winner outside the draw gap', () => {
    expect(service.calculateMatchResult(96, 100, 3).result).toBe(2);
    expect(service.calculateMatchResult(100, 96, 3).result).toBe(1);
  });

  it('counts replacements between consecutive active squads', () => {
    const firstSquad = Array.from({ length: 15 }, (_, index) => `player-${index + 1}`);
    const secondSquad = [...firstSquad.slice(0, 12), 'player-16', 'player-17', 'player-18'];
    const rosters: ITeamData['rosters_by_tour'] = {
      1: createRoster(firstSquad),
      2: createRoster(secondSquad),
    };

    expect(service.countSquadChanges(rosters, 2)).toBe(3);
  });

  it('counts the largest losing difference from the configured first tour', () => {
    const home = createStrikeProfile();
    const away = createStrikeProfile();

    service.updateStrikes(home, away, 1, 100, 70, 30, 0, 1);

    expect(away.results.prizeMaxLosedDiff).toBe(30);
  });

  it('preserves the legacy third-tour threshold when configured', () => {
    const home = createStrikeProfile();
    const away = createStrikeProfile();

    service.updateStrikes(home, away, 1, 100, 70, 30, 0, 3);
    expect(away.results.prizeMaxLosedDiff).toBe(0);

    service.updateStrikes(home, away, 1, 90, 70, 20, 2, 3);
    expect(away.results.prizeMaxLosedDiff).toBe(20);
  });

  it('tracks league-only prize metrics for the winner', () => {
    const hunter = createStrikeProfile('hunter');
    const turtle = createStrikeProfile('turtle');

    service.updateLeaguePrizeMetrics(hunter, turtle, 1, 25, 175, 'turtle');

    expect(hunter.results.prizeMaxWinDiffAgainstTarget).toBe(25);
    expect(hunter.results.prizeMaxWinningMatchTotalFo).toBe(175);
  });

  it('does not track prize metrics for a draw', () => {
    const home = createStrikeProfile('home');
    const away = createStrikeProfile('away');

    service.updateLeaguePrizeMetrics(home, away, 0, 3, 197, 'away');

    expect(home.results.prizeMaxWinDiffAgainstTarget).toBe(0);
    expect(home.results.prizeMaxWinningMatchTotalFo).toBe(0);
  });
});

function createRoster(players: string[]): ITeamData['rosters_by_tour'][number] {
  return {
    team_cost: 100,
    total_score: 0,
    captain_id: players[0],
    players: {
      base: players.slice(0, 11),
      bench: players.slice(11),
    },
  };
}

function createStrikeProfile(id = 'profile'): IProfileDetails {
  return {
    id,
    results: {
      prizeCurrentWinStrike: 0,
      prizeMaxWinStrike: 0,
      prizeCurrentNoLoseStrike: 0,
      prizeMaxNoLoseStrike: 0,
      prizeMaxStoppedNoLoseStrike: 0,
      prizeMinWins: 0,
      prizeMaxLosedDiff: 0,
      prizeMaxWinDiffAgainstTarget: 0,
      prizeMaxWinningMatchTotalFo: 0,
      selectedPlayerPoints: {},
    },
  } as IProfileDetails;
}
