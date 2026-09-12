import { CompetitionViewModel } from '../competition/data/competition.facade';
import { IProfileDetails } from '../models/domain';
import { TournamentTimelineItem } from '../models/tournament-catalog';
import { buildPersonalizedHomeTournament } from './personalized-home';

describe('personalized home', () => {
  const tournament = {
    id: 'la-liga-2026-27',
    route: '/spain/new?year=2026',
  } as TournamentTimelineItem;

  it('finds a seasonal profile by any historical profile id', () => {
    const summary = buildPersonalizedHomeTournament(tournament, viewModel(), {
      participantId: 'participant-a',
      name: 'Participant A',
      profileIds: ['old-a', 'a'],
    });

    expect(summary?.profile.id).toBe('a');
    expect(summary?.place).toBe(5);
  });

  it('keeps up to three standings neighbors on each side', () => {
    const summary = buildPersonalizedHomeTournament(tournament, viewModel(), {
      participantId: 'participant-a',
      name: 'Participant A',
      profileIds: ['a'],
    });

    expect(summary?.standings.map(row => row.place)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(summary?.standings.find(row => row.isSelected)?.profile.id).toBe('a');
  });

  it('returns the current and first subsequent scheduled match with a deep link', () => {
    const summary = buildPersonalizedHomeTournament(tournament, viewModel(), {
      participantId: 'participant-a',
      name: 'Participant A',
      profileIds: ['a'],
    });

    expect(summary?.currentMatch?.tour).toBe(2);
    expect(summary?.currentMatch?.homeScore).toBe(71);
    expect(summary?.nextMatch?.tour).toBe(4);
    expect(summary?.nextMatch?.route).toContain('tabId=1');
    expect(summary?.nextMatch?.route).toContain('confId=0');
    expect(summary?.nextMatch?.route).toContain('tourId=4');
    expect(summary?.nextMatch?.route).toContain('matchHome=a');
  });

  it('uses null states when current or subsequent matches are unavailable', () => {
    const model = viewModel();
    model.lastTour = 8;

    const summary = buildPersonalizedHomeTournament(tournament, model, {
      participantId: 'participant-a',
      name: 'Participant A',
      profileIds: ['a'],
    });

    expect(summary?.currentMatch).toBeNull();
    expect(summary?.nextMatch).toBeNull();
  });

  function viewModel(): CompetitionViewModel {
    const profiles = Array.from({ length: 9 }, (_, index) => profile(
      index === 4 ? 'a' : `p${index + 1}`,
      `Team ${index + 1}`,
    ));
    const ids = profiles.map(item => item.id);

    return {
      config: {
        id: 'spain_2026_fr',
        type: 'spain',
        typeId: 'spain',
        yearStart: 2026,
        yearEnd: 2027,
        squad_link: '',
        tour_link: '',
        profiles: ids,
        prizes: [],
        stages: [{
          name: 'Apertura',
          firstTour: 1,
          lastTour: 8,
          leagues: [{ name: 'Conference', profiles: ids }],
        }],
        matches: {
          2: [{ home: 'a', away: 'p1', home_score: 71, away_score: 68 }],
          3: [{ home: 'p2', away: 'p3' }],
          4: [{ home: 'a', away: 'p2' }],
        },
      },
      profilesDetails: profiles,
      leaguesRatings: { Conference: profiles, Common: profiles },
      lastTour: 2,
      squads: {} as CompetitionViewModel['squads'],
      squadsDetails: [],
      playersRating: [],
      prizes: [],
      sportPlayersByTour: {},
    };
  }

  function profile(id: string, title: string): IProfileDetails {
    return {
      id,
      name: `${title} owner`,
      nick: title,
      url: '',
      logo: `${id}.png`,
      team: { id, title, results_by_tour: {}, rosters_by_tour: {} },
      score: 0,
      prizes: {},
      results: {
        wins: {}, draws: {}, loses: {}, points: {}, fo: {}, missed_fo: {}, diff_fo: {},
        matchesPlayed: 0, teamCostTotal: 0, teamCostAvg: 0, subsUsedCount: 0,
        subsTotalCount: 0, subsCoef: 0, uniqueUsedPlayers: [], portugezePoints: 0,
        larinPoints: 0, prizeMinWins: 0, prizeMaxFoInTour: 0, prizeMaxFoInLosedTour: 0,
        prizeCurrentWinStrike: 0, prizeMaxWinStrike: 0, prizeCurrentNoLoseStrike: 0,
        prizeMaxNoLoseStrike: 0, prizeMaxStoppedNoLoseStrike: 0, prizeMaxLosedDiff: 0,
      },
    };
  }
});
