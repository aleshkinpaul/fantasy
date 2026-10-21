import {
  FantasyFullInfoResponse,
  FantasyTourStatsResponse,
} from '../models/competition.models';
import {
  applyCancelledToursToFullInfo,
  competitionTourToSourceTour,
  createZeroTourStatsResponse,
  remapTourStatsResponse,
  sourceTourToCompetitionTour,
} from './competition-tour-adjustments';
import { getSeasonMedals } from '../domain/standings-calculator';

describe('competition tour adjustments', () => {
  it('inserts the cancelled second tour into API numbering', () => {
    expect(sourceTourToCompetitionTour(1, [2])).toBe(1);
    expect(sourceTourToCompetitionTour(2, [2])).toBe(3);
    expect(sourceTourToCompetitionTour(3, [2])).toBe(4);
    expect(competitionTourToSourceTour(1, [2])).toBe(1);
    expect(competitionTourToSourceTour(2, [2])).toBeUndefined();
    expect(competitionTourToSourceTour(3, [2])).toBe(2);
  });

  it('moves API scores and rosters forward and creates a zero-score tour', () => {
    const source = fullInfo();
    const normalized = applyCancelledToursToFullInfo(source, [2]);
    const team = normalized.data.players['profile-1'].team;

    expect(Object.keys(normalized.data.tours)).toEqual(['1', '2', '3']);
    expect(normalized.data.tours['3'].number).toBe('3');
    expect(team.results_by_tour['1'].tour_score).toBe('85');
    expect(team.results_by_tour['2']).toEqual({
      total_score: '85',
      tour_score: '0',
      total_place: '10',
      tour_place: '1',
    });
    expect(team.results_by_tour['3'].tour_score).toBe('62');
    expect(team.results_by_tour['3'].total_score).toBe('147');
    expect(team.rosters_by_tour['2'].players).toEqual(team.rosters_by_tour['1'].players);
    expect(team.rosters_by_tour['2'].players_stat).toEqual([]);
    expect(team.rosters_by_tour['3'].id).toBe('roster-2');
    expect(source.data.players['profile-1'].team.results_by_tour['2'].tour_score).toBe('62');
  });

  it('aligns player stats with the adjusted competition tours', () => {
    const source = tourStats(2, 14);
    const remapped = remapTourStatsResponse(source, 2, 3);
    const zero = createZeroTourStatsResponse(source, 2);

    expect(remapped.data.players['player-1'].stat_by_tours).toEqual({
      3: { score: 14, match_time: 90 },
    });
    expect(zero.data.players['player-1'].stat_by_tours).toEqual({
      2: { score: 0, match_time: 0 },
    });
    expect(source.data.players['player-1'].stat_by_tours).toEqual({
      2: { score: 14, match_time: 90 },
    });
  });

  it('does not award tour medals for the cancelled zero-score tour', () => {
    const normalized = applyCancelledToursToFullInfo(fullInfo(), [2]);
    const medals = getSeasonMedals(normalized, 'profile-1', 3, new Set([2]));

    expect(medals.medalsArr[1]).toBe(0);
  });
});

function fullInfo(): FantasyFullInfoResponse {
  const roster = (id: string) => ({
    id,
    captain_id: 'player-1',
    vice_captain_id: 'player-2',
    team_cost: 100,
    players_stat: {},
    players: { base: ['player-1'], bench: ['player-2'] },
  });
  return {
    result: 1,
    data: {
      id: 'competition-1',
      title: 'Competition',
      fantasy_tournament_name: 'ucl_2026',
      season: '26',
      tours: {
        1: { number: '1', start: '2026-09-08 19:45:00', end: '2026-09-10 22:00:00' },
        2: { number: '2', start: '2026-10-20 19:45:00', end: '2026-10-21 22:00:00' },
      },
      players: {
        'profile-1': {
          id: 'profile-1',
          name: 'Manager',
          logo: '',
          team: {
            id: 'team-1',
            title: 'ducks',
            results_by_tour: {
              1: { total_score: '85', tour_score: '85', total_place: '10', tour_place: '10' },
              2: { total_score: '147', tour_score: '62', total_place: '5', tour_place: '3' },
            },
            rosters_by_tour: { 1: roster('roster-1'), 2: roster('roster-2') },
          },
        },
      },
      matches: { 1: [], 2: [], 3: [] },
    },
  };
}

function tourStats(tour: number, score: number): FantasyTourStatsResponse {
  return {
    result: 1,
    data: {
      tournament: { id: '347', title: 'Champions League', season: '26' },
      players: {
        'player-1': {
          id: 'player-1',
          name: 'Player',
          amplua_id: '10',
          team_id: 'club-1',
          cost: 7,
          stat_by_tours: { [tour]: { score, match_time: 90 } },
        },
      },
    },
  };
}
