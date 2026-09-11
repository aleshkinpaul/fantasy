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

  it('uses the first played bench combination that preserves the minimum formation', () => {
    const input = fullProfile(
      ['gk', 'd1', 'd2', 'd3', 'm1', 'm2', 'm3', 'm4', 'f1', 'f2', 'f3'],
      ['gk2', 'm5', 'd4', 'd5'],
    );
    setPlayed(input, [
      'gk', 'd2', 'd3', 'm1', 'm2', 'm3', 'm4', 'f1', 'f2', 'f3',
      'm5', 'd4',
    ]);

    const team = buildMatchCenterTeam(input, 1, fullPlayers(), true);

    expect(team.countedPlayersCount).toBe(11);
    expect(team.autoSubstitutionsCount).toBe(1);
    expect(team.base.find(item => item.id === 'd1')).toEqual(jasmine.objectContaining({
      participation: 'not-played', isCounted: false,
    }));
    expect(team.bench.find(item => item.id === 'm5')).toEqual(jasmine.objectContaining({
      isPlayed: true, isCounted: false, isAutoSubbedIn: false,
    }));
    expect(team.bench.find(item => item.id === 'd4')).toEqual(jasmine.objectContaining({
      isPlayed: true, isCounted: true, isAutoSubbedIn: true,
    }));
  });

  it('allows an earlier bench player of another position when the resulting formation is valid', () => {
    const input = fullProfile(
      ['gk', 'd1', 'd2', 'd3', 'd4', 'm1', 'm2', 'm3', 'm4', 'f1', 'f2'],
      ['gk2', 'm5', 'd5', 'f3'],
    );
    setPlayed(input, [
      'gk', 'd2', 'd3', 'd4', 'm1', 'm2', 'm3', 'm4', 'f1', 'f2',
      'm5', 'd5', 'f3',
    ]);

    const team = buildMatchCenterTeam(input, 1, fullPlayers(), true);

    expect(team.bench.find(item => item.id === 'm5')?.isAutoSubbedIn).toBeTrue();
    expect(team.bench.find(item => item.id === 'd5')?.isAutoSubbedIn).toBeFalse();
    expect(team.countedPlayersCount).toBe(11);
  });

  it('replaces an absent goalkeeper only with the played reserve goalkeeper', () => {
    const input = fullProfile(
      ['gk', 'd1', 'd2', 'd3', 'm1', 'm2', 'm3', 'm4', 'f1', 'f2', 'f3'],
      ['m5', 'gk2', 'd4', 'd5'],
    );
    setPlayed(input, [
      'd1', 'd2', 'd3', 'm1', 'm2', 'm3', 'm4', 'f1', 'f2', 'f3',
      'm5', 'gk2',
    ]);

    const team = buildMatchCenterTeam(input, 1, fullPlayers(), true);

    expect(team.bench.find(item => item.id === 'gk2')?.isAutoSubbedIn).toBeTrue();
    expect(team.bench.find(item => item.id === 'm5')?.isAutoSubbedIn).toBeFalse();
    expect(team.countedPlayersCount).toBe(11);
  });

  it('treats a zero-point appearance as played and transfers captaincy to a counted vice-captain', () => {
    const input = fullProfile(
      ['gk', 'd1', 'd2', 'd3', 'm1', 'm2', 'm3', 'm4', 'f1', 'f2', 'f3'],
      ['gk2', 'm5', 'd4', 'd5'],
    );
    input.team.rosters_by_tour[1].captain_id = 'd1';
    input.team.rosters_by_tour[1].vice_captain_id = 'm1';
    setPlayed(input, ['gk', 'd2', 'd3', 'm1', 'm2', 'm3', 'm4', 'f1', 'f2', 'f3', 'd4']);
    input.team.rosters_by_tour[1].players_stat!['m1'] = [matchStat(0, true)];
    const players = fullPlayers();
    players.find(player => player.id === 'm1')!.stat_by_tours[1].score = 0;

    const team = buildMatchCenterTeam(input, 1, players, true);

    expect(team.base.find(item => item.id === 'm1')).toEqual(jasmine.objectContaining({
      isPlayed: true, fantasyScore: 0, isEffectiveCaptain: true,
    }));
    expect(team.base.find(item => item.id === 'd1')?.isEffectiveCaptain).toBeFalse();
  });

  it('exposes the doubled score for the player whose captain multiplier applies', () => {
    const input = fullProfile(
      ['gk', 'd1', 'd2', 'd3', 'm1', 'm2', 'm3', 'm4', 'f1', 'f2', 'f3'],
      ['gk2', 'm5', 'd4', 'd5'],
    );
    setPlayed(input, input.team.rosters_by_tour[1].players.base);
    const players = fullPlayers();
    players.find(player => player.id === 'd1')!.stat_by_tours[1].score = 5;

    const team = buildMatchCenterTeam(input, 1, players, true);

    expect(team.base.find(item => item.id === 'd1')).toEqual(jasmine.objectContaining({
      fantasyScore: 5,
      displayFantasyScore: 10,
      scoreMultiplier: 2,
      isEffectiveCaptain: true,
    }));
  });

  it('aggregates player events and preserves each real match record for details', () => {
    const input = fullProfile(
      ['gk', 'd1', 'd2', 'd3', 'm1', 'm2', 'm3', 'm4', 'f1', 'f2', 'f3'],
      ['gk2', 'm5', 'd4', 'd5'],
    );
    setPlayed(input, input.team.rosters_by_tour[1].players.base);
    const stats = input.team.rosters_by_tour[1].players_stat!;
    if (Array.isArray(stats)) throw new Error('Ожидался объект players_stat');
    stats['m1'] = [
      {
        ...matchStat(45, true),
        goals: 1,
        assists: 1,
        yellow_cards: 1,
        penalty_missed: 1,
        ball_recovery: 4,
      },
      {
        ...matchStat(30, false),
        from_reserve: 1,
        assists: 2,
        fantasy_assists: 1,
        red_cards: 1,
        shot_saves: 2,
      },
    ];
    stats['f1'] = [{ ...matchStat(90, true), clean_sheet: 1 }];

    const team = buildMatchCenterTeam(input, 1, fullPlayers(), true);
    const midfielder = team.base.find(item => item.id === 'm1')!;
    const forward = team.base.find(item => item.id === 'f1')!;

    expect(midfielder.playedMinutes).toBe(75);
    expect(midfielder.playedMinutesLabel).toBe('45+30 мин');
    expect(midfielder.stats).toEqual(jasmine.objectContaining({
      matchRecords: 2,
      starts: 1,
      substituteAppearances: 1,
      goals: 1,
      assists: 3,
      fantasyAssists: 1,
      yellowCards: 1,
      penaltiesMissed: 1,
      redCards: 1,
      shotSaves: 2,
      ballRecoveries: 4,
    }));
    expect(midfielder.events.map(event => event.key)).toEqual([
      'goals', 'penalty-missed', 'assists', 'yellow-cards', 'red-cards', 'shot-saves',
    ]);
    expect(midfielder.events.every(event =>
      event.iconPath.startsWith('assets/icons/match-stat/'))).toBeTrue();
    expect(midfielder.events.find(event => event.key === 'goals')?.iconPath)
      .toBe('assets/icons/match-stat/goal.png');
    expect(midfielder.events.find(event => event.key === 'penalty-missed')).toEqual(jasmine.objectContaining({
      iconPath: 'assets/icons/match-stat/goal.png',
      tone: 'danger',
    }));
    expect(midfielder.events.find(event => event.key === 'penalty-missed')?.marker).toBeUndefined();
    expect(midfielder.events.find(event => event.key === 'assists')?.count).toBe(4);
    expect(midfielder.statSummary).toContain('45+30 мин');
    expect(midfielder.statSummary).toContain('в старте: 1');
    expect(midfielder.matchStats).toHaveSize(2);
    expect(forward.stats.cleanSheets).toBe(1);
    expect(forward.events.some(event => event.key === 'clean-sheets')).toBeFalse();
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

function fullProfile(base: string[], bench: string[]): IProfileDetails {
  const input = profile();
  input.team.results_by_tour = {
    1: { tour_score: 42, total_score: 42, total_place: 1 },
  };
  input.team.rosters_by_tour[1] = {
    team_cost: 100,
    total_score: 42,
    captain_id: base[1],
    vice_captain_id: base[4],
    players: { base, bench },
    players_stat: Object.fromEntries([...base, ...bench].map(id => [id, []])),
  };
  return input;
}

function fullPlayers(): SportPlayer[] {
  return [
    playerWithScore('gk', '9', 2),
    playerWithScore('gk2', '9', 2),
    ...['d1', 'd2', 'd3', 'd4', 'd5'].map(id => playerWithScore(id, '10', id === 'd1' ? 0 : 2)),
    ...['m1', 'm2', 'm3', 'm4', 'm5'].map(id => playerWithScore(id, '11', 3)),
    ...['f1', 'f2', 'f3'].map(id => playerWithScore(id, '12', 4)),
  ];
}

function playerWithScore(id: string, ampluaId: string, score: number): SportPlayer {
  return {
    ...player(id, ampluaId),
    stat_by_tours: { 1: { score, match_time: score === 0 ? 0 : 90 } },
  };
}

function setPlayed(input: IProfileDetails, playedIds: string[]): void {
  const stats = input.team.rosters_by_tour[1].players_stat!;
  if (Array.isArray(stats)) throw new Error('Ожидался объект players_stat');
  playedIds.forEach(id => {
    stats[id] = [matchStat(90, true)];
  });
}

function matchStat(matchTime: number, inStartList: boolean) {
  return {
    active_match: 1 as const,
    in_start_list: Number(inStartList) as 0 | 1,
    from_reserve: 0 as const,
    was_replaced: 0 as const,
    full_match: Number(matchTime >= 90) as 0 | 1,
    '60min_match': Number(matchTime >= 60) as 0 | 1,
    match_time: matchTime,
    goals: 0,
    assists: 0,
    fantasy_assists: 0,
    red_cards: 0,
    yellow_cards: 0,
    clean_sheet: 0,
    penalty_saves: 0,
    shot_saves: 0,
    penalty_missed: 0,
    goal_against: 0,
    penalty_force: 0,
    ball_recovery: 0,
    own_goals: 0,
    penalty_conceded: 0,
  };
}
