import { IProfileDetails } from '../../models/domain';
import { FantasyTourStatsResponse, SpecialPlayerRules } from '../models/competition.models';
import { applyTourPlayerStats } from './player-stats-calculator';

describe('applyTourPlayerStats', () => {
  it('counts all selected players and doubles the captain', () => {
    const profile = {
      team: {
        rosters_by_tour: {
          1: {
            captain_id: 'captain',
            players: { base: ['captain'], bench: ['bench'] },
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

    expect(profile.results.selectedPlayerPoints).toEqual({ captain: 10, bench: 3 });
  });
});

function createStats(): FantasyTourStatsResponse {
  return {
    result: 1,
    data: {
      tournament: { id: 'test', title: 'test', season: '26' },
      players: {
        captain: {
          id: 'captain',
          name: 'Captain',
          amplua_id: '11',
          team_id: 'club',
          cost: 5,
          stat_by_tours: { 1: { score: 5, match_time: 0 } },
        },
        bench: {
          id: 'bench',
          name: 'Bench',
          amplua_id: '12',
          team_id: 'club',
          cost: 4,
          stat_by_tours: { 1: { score: 3, match_time: 0 } },
        },
      },
    },
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
