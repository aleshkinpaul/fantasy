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

  it('sorts only the starting lineup by position and preserves the API bench order', () => {
    const input = profile();
    input.team.rosters_by_tour[1].players = {
      base: ['forward', 'goalkeeper', 'midfielder', 'defender', 'forward-2'],
      bench: ['bench-forward', 'bench-goalkeeper'],
    };
    const players = [
      player('forward', '12'),
      player('goalkeeper', '9'),
      player('midfielder', '11'),
      player('defender', '10'),
      player('forward-2', '12'),
      player('bench-forward', '12'),
      player('bench-goalkeeper', '9'),
    ];

    const team = buildMatchCenterTeam(input, 1, players);

    expect(team.base.map(item => item.id)).toEqual([
      'goalkeeper', 'defender', 'midfielder', 'forward', 'forward-2',
    ]);
    expect(team.base.map(item => item.startsPositionGroup)).toEqual([
      false, true, true, true, false,
    ]);
    expect(team.bench.map(item => item.id)).toEqual(['bench-forward', 'bench-goalkeeper']);
  });

  it('marks players absent from both parts of the previous tour roster as new', () => {
    const input = profile();
    input.team.rosters_by_tour[1].players = {
      base: ['stays-in-base'],
      bench: ['moves-to-base'],
    };
    input.team.rosters_by_tour[2] = {
      team_cost: 100,
      total_score: 0,
      captain_id: 'moves-to-base',
      players: {
        base: ['moves-to-base', 'new-in-base'],
        bench: ['stays-in-base', 'new-on-bench'],
      },
    };
    const players = [
      player('stays-in-base', '10'),
      player('moves-to-base', '11'),
      player('new-in-base', '12'),
      player('new-on-bench', '9'),
    ];

    const team = buildMatchCenterTeam(input, 2, players);

    expect(team.base.find(item => item.id === 'moves-to-base')?.isNewToSquad).toBeFalse();
    expect(team.base.find(item => item.id === 'new-in-base')?.isNewToSquad).toBeTrue();
    expect(team.bench.find(item => item.id === 'stays-in-base')?.isNewToSquad).toBeFalse();
    expect(team.bench.find(item => item.id === 'new-on-bench')?.isNewToSquad).toBeTrue();
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
