import { ITeamData } from '../../models/domain';
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
