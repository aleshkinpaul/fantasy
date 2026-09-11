import { IProfileDetails, IRosterPlayerMatchStat } from '../../models/domain';
import { FantasyTourStatsResponse, SpecialPlayerRules } from '../models/competition.models';
import { applyTourPlayerStats } from './player-stats-calculator';

describe('applyTourPlayerStats', () => {
  it('counts only the effective XI, transfers the multiplier to the vice-captain and counts their red cards', () => {
    const base = ['gk', 'd1', 'd2', 'd3', 'm1', 'm2', 'm3', 'm4', 'f1', 'f2', 'f3'];
    const bench = ['gk2', 'm5', 'd4', 'd5'];
    const played = new Set([
      'gk', 'd2', 'd3', 'm1', 'm2', 'm3', 'm4', 'f1', 'f2', 'f3',
      'm5', 'd4',
    ]);
    const profile = {
      team: {
        rosters_by_tour: {
          1: {
            team_cost: 100,
            total_score: 42,
            captain_id: 'd1',
            vice_captain_id: 'm1',
            players: { base, bench },
            players_stat: Object.fromEntries([...base, ...bench].map(playerId => [
              playerId,
              [matchStat(played.has(playerId), ['m1', 'm5', 'd4'].includes(playerId) ? 1 : 0)],
            ])),
          },
        },
      },
      results: {
        portugezePoints: 0,
        larinPoints: 0,
        uniqueUsedPlayers: [],
      },
    } as unknown as IProfileDetails;

    applyTourPlayerStats([profile], [createStats()], 1, emptyRules(), true);

    expect(Object.keys(profile.results.selectedPlayerPoints ?? {})).toHaveSize(11);
    expect(profile.results.selectedPlayerPoints?.['m1']).toBe(8);
    expect(profile.results.selectedPlayerPoints?.['d4']).toBe(3);
    expect(profile.results.selectedPlayerPoints?.['d1']).toBeUndefined();
    expect(profile.results.selectedPlayerPoints?.['m5']).toBeUndefined();
    expect(profile.results.countedRedCards).toBe(2);
  });
});

function createStats(): FantasyTourStatsResponse {
  const positions: Record<string, string> = {
    gk: '9', gk2: '9',
    d1: '10', d2: '10', d3: '10', d4: '10', d5: '10',
    m1: '11', m2: '11', m3: '11', m4: '11', m5: '11',
    f1: '12', f2: '12', f3: '12',
  };
  const scores: Record<string, number> = {
    gk: 2, gk2: 2,
    d1: 5, d2: 2, d3: 2, d4: 3, d5: 2,
    m1: 4, m2: 3, m3: 3, m4: 3, m5: 10,
    f1: 4, f2: 4, f3: 4,
  };
  return {
    result: 1,
    data: {
      tournament: { id: 'test', title: 'test', season: '26' },
      players: Object.fromEntries(Object.keys(positions).map(playerId => [
        playerId,
        {
          id: playerId,
          name: playerId,
          amplua_id: positions[playerId],
          team_id: 'club',
          cost: 5,
          stat_by_tours: { 1: { score: scores[playerId], match_time: 90 } },
        },
      ])),
    },
  };
}

function matchStat(played: boolean, redCards: number): IRosterPlayerMatchStat {
  return {
    active_match: 1,
    in_start_list: played ? 1 : 0,
    from_reserve: 0,
    was_replaced: 0,
    full_match: played ? 1 : 0,
    '60min_match': played ? 1 : 0,
    match_time: played ? 90 : 0,
    goals: 0,
    assists: 0,
    fantasy_assists: 0,
    red_cards: redCards,
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

function emptyRules(): SpecialPlayerRules {
  return {
    forbiddenTeamIds: [],
    forbiddenPlayerIds: [],
    worldCupForbiddenPlayerIds: [],
    portugueseTeamId: '',
    larinPlayerId: '',
  };
}
