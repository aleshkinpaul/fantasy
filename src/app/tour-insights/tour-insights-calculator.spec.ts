import { IProfileDetails, IRoster } from '../models/domain';
import { ForecastSnapshotFile } from '../match-center/match-center.models';
import { calculateTourInsights } from './tour-insights-calculator';
import { TourInsightsInput } from './tour-insights.models';

describe('calculateTourInsights', () => {
  it('calculates team and match rankings only inside the selected league', () => {
    const insights = calculateTourInsights(createInput());

    expect(insights.status).toBe('ready');
    expect(insights.context.matchesCount).toBe(2);
    expect(insights.teams.topScores.map(item => item.team.profileId)).toEqual(['c', 'a', 'b', 'd']);
    expect(insights.teams.medianScore).toBe(49);
    expect(insights.teams.aboveMedian.map(item => item.delta)).toEqual([31, 1]);
    expect(insights.teams.belowMedian.map(item => item.delta)).toEqual([-29, -1]);
    expect(insights.matches.mostProductive[0].match.home).toBe('c');
    expect(insights.matches.closest[0].difference).toBe(2);
    expect(insights.matches.biggestWins[0].difference).toBe(60);
    expect(insights.teams.highestScoringLoser?.team.profileId).toBe('d');
    expect(insights.teams.lowestScoringWinner?.team.profileId).toBe('c');
  });

  it('calculates roster popularity, transfers and participant style', () => {
    const insights = calculateTourInsights(createInput());

    expect(insights.coverage.loadedRosters).toBe(4);
    expect(insights.coverage.comparableRosters).toBe(4);
    expect(insights.players.mostPopular[0].player.id).toBe('p1');
    expect(insights.players.mostPopular[0].count).toBe(4);
    expect(insights.players.mostPopular[0].share).toBe(100);
    expect(insights.players.mostPopularCaptains[0].player.id).toBe('p1');
    expect(insights.players.mostAdded.map(item => item.player.id)).toContain('p2');
    expect(insights.players.mostDropped.map(item => item.player.id)).toContain('old-a');
    expect(insights.players.popularClubs.map(item => item.share)).toEqual([58.3, 41.7]);
    expect(insights.participants.mostActive[0].value).toBe(2);
    expect(insights.participants.mostUniquePicks[0].value).toBe(1);
  });

  it('uses only a published forecast for the upset ranking', () => {
    const reconstructed = calculateTourInsights(createInput({
      forecast: createForecast('reconstructed'),
    }));
    const published = calculateTourInsights(createInput({
      forecast: createForecast('published'),
    }));

    expect(reconstructed.matches.biggestUpsets).toEqual([]);
    expect(published.matches.biggestUpsets[0].match.home).toBe('c');
    expect(published.matches.biggestUpsets[0].winnerProbability).toBe(20);
  });

  it('does not create statistics for a future tour', () => {
    const insights = calculateTourInsights(createInput({ tour: 3, lastTour: 2 }));

    expect(insights.status).toBe('upcoming');
    expect(insights.teams.topScores).toEqual([]);
    expect(insights.players.mostPopular).toEqual([]);
  });

  it('aggregates team scores, matches, rosters and captains across the season', () => {
    const input = createInput({ period: 'season', scope: 'competition' });
    const firstTourScores: Record<string, number> = { a: 10, b: 20, c: 30, d: 40 };
    input.profiles.filter(profile => profile.id !== 'outsider').forEach(profile => {
      const score = firstTourScores[profile.id];
      profile.team.results_by_tour[1] = {
        tour_score: score,
        total_score: score,
        total_place: 1,
      };
    });
    input.tourData = [
      {
        tour: 1,
        matches: [{ home: 'a', away: 'b' }, { home: 'c', away: 'd' }],
        sportPlayers: input.sportPlayers,
      },
      {
        tour: 2,
        matches: input.matches,
        sportPlayers: input.sportPlayers,
      },
    ];

    const insights = calculateTourInsights(input);

    expect(insights.context.toursCount).toBe(2);
    expect(insights.coverage.scoredTeams).toBe(8);
    expect(insights.coverage.loadedRosters).toBe(8);
    expect(insights.teams.topScores[0]).toEqual(jasmine.objectContaining({ value: 110 }));
    expect(insights.matches.mostProductive[0].tour).toBe(2);
    expect(insights.players.mostPopularCaptains.map(item => item.count)).toEqual([4, 4]);
  });
});

function createInput(overrides: Partial<TourInsightsInput> = {}): TourInsightsInput {
  const profiles = [
    profile('a', 50, roster(['p1', 'p2', 'unique-a'], 'p1'), roster(['p1', 'old-a'], 'p1')),
    profile('b', 48, roster(['p1', 'p2', 'p3'], 'p1'), roster(['p1', 'p2', 'old-b'], 'p1')),
    profile('c', 80, roster(['p1', 'p2', 'p3'], 'p2'), roster(['p1', 'p2', 'old-c'], 'p2')),
    profile('d', 20, roster(['p1', 'p2', 'p3'], 'p2'), roster(['p1', 'p2', 'old-d'], 'p2')),
    profile('outsider', 999, roster(['p9'], 'p9'), roster(['p9'], 'p9')),
  ];
  return {
    tournamentId: 'la-liga-2026-27',
    tour: 2,
    lastTour: 2,
    stageName: 'Первый этап',
    leagueName: 'Конференция',
    profileIds: ['a', 'b', 'c', 'd'],
    matches: [
      { home: 'a', away: 'b' },
      { home: 'c', away: 'd' },
      { home: 'a', away: 'outsider' },
    ],
    profiles,
    sportPlayers: ['p1', 'p2', 'p3', 'unique-a', 'old-a', 'old-b', 'old-c', 'old-d']
      .map((id, index) => ({
        id,
        name: id,
        amplua_id: String(9 + index % 4),
        team_id: `club-${index % 2}`,
        cost: 5,
        stat_by_tours: {},
      })),
    drawGap: 3,
    ...overrides,
  };
}

function profile(
  id: string,
  score: number,
  currentRoster: IRoster,
  previousRoster: IRoster,
): IProfileDetails {
  return {
    id,
    name: `Участник ${id}`,
    nick: id,
    url: '',
    logo: `${id}.png`,
    team: {
      id: `team-${id}`,
      title: `Команда ${id}`,
      results_by_tour: { 2: { tour_score: score, total_score: score, total_place: 1 } },
      rosters_by_tour: { 1: previousRoster, 2: currentRoster },
    },
    score: 0,
    prizes: {},
    results: {} as IProfileDetails['results'],
  };
}

function roster(players: string[], captainId: string): IRoster {
  return {
    id: '',
    team_cost: 100,
    total_score: 0,
    captain_id: captainId,
    vice_captain_id: players[1],
    players: { base: players, bench: [] },
  };
}

function createForecast(
  provenance: ForecastSnapshotFile['provenance'],
): ForecastSnapshotFile {
  return {
    tournamentId: 'la-liga-2026-27',
    tour: 2,
    generatedAt: '2026-08-20T00:00:00.000Z',
    algorithmVersion: 'test',
    inputLastTour: 1,
    provenance,
    forecasts: [
      {
        homeProfileId: 'c',
        awayProfileId: 'd',
        homeWinProbability: 20,
        drawProbability: 10,
        awayWinProbability: 70,
        homeForm: 2,
        awayForm: 8,
        basedOnTours: [1],
        confidence: 'low',
      },
    ],
  };
}
