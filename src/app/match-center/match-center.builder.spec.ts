import { IProfileDetails } from '../models/domain';
import { SportPlayer } from '../competition/models/competition.models';
import { buildMatchCenterTeam } from './match-center.builder';

describe('buildMatchCenterTeam', () => {
  it('splits the starting lineup and bench and marks captains', () => {
    const team = buildMatchCenterTeam(profile(), 1, [player('one', '9'), player('two', '12')]);

    expect(team.hasRoster).toBeTrue();
    expect(team.base[0]).toEqual(jasmine.objectContaining({
      id: 'one', position: 'ВР', isCaptain: true, isBench: false,
    }));
    expect(team.bench[0]).toEqual(jasmine.objectContaining({
      id: 'two', position: 'НП', isViceCaptain: true, isBench: true,
    }));
  });

  it('returns an explicit empty state when a future roster is absent', () => {
    const team = buildMatchCenterTeam(profile(), 2, []);

    expect(team.hasRoster).toBeFalse();
    expect(team.base).toEqual([]);
  });
});

function profile(): IProfileDetails {
  return {
    id: 'profile', name: 'Участник', nick: '', url: '', logo: '', score: 0, prizes: {},
    results: {} as IProfileDetails['results'],
    team: {
      id: 'team', title: 'Команда', results_by_tour: {},
      rosters_by_tour: {
        1: {
          team_cost: 99,
          total_score: 0,
          captain_id: 'one',
          vice_captain_id: 'two',
          players: { base: ['one'], bench: ['two'] },
        },
      },
    },
  };
}

function player(id: string, ampluaId: string): SportPlayer {
  return { id, name: id, amplua_id: ampluaId, team_id: 'club', cost: 5, stat_by_tours: {} };
}
