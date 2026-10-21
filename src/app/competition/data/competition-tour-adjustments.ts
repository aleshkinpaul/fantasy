import type {
  FantasyFullInfoResponse,
  FantasyRoster,
  FantasyTourResult,
  FantasyTourStatsResponse,
} from '../models/competition.models';

/**
 * Maps a sequential API tour to the competition calendar after zero-score
 * cancelled tours have been inserted.
 */
export function sourceTourToCompetitionTour(
  sourceTour: number,
  cancelledTours: number[] = [],
): number {
  let competitionTour = sourceTour;
  for (const cancelledTour of normalizedCancelledTours(cancelledTours)) {
    if (cancelledTour <= competitionTour) competitionTour++;
  }
  return competitionTour;
}

/** Returns no source tour for a cancelled competition tour. */
export function competitionTourToSourceTour(
  competitionTour: number,
  cancelledTours: number[] = [],
): number | undefined {
  const cancelled = normalizedCancelledTours(cancelledTours);
  if (cancelled.includes(competitionTour)) return undefined;
  return competitionTour - cancelled.filter(tour => tour < competitionTour).length;
}

export function applyCancelledToursToFullInfo(
  response: FantasyFullInfoResponse,
  cancelledTours: number[] = [],
): FantasyFullInfoResponse {
  const cancelled = normalizedCancelledTours(cancelledTours);
  const normalized = clone(response);
  if (!cancelled.length) return normalized;

  normalized.data.tours = remapRecord(normalized.data.tours, cancelled, tour => ({
    ...tour,
    number: sourceTourToCompetitionTour(Number(tour.number), cancelled).toString(),
  }));

  const lastLoadedTour = Math.max(0, ...Object.keys(normalized.data.tours).map(Number));
  cancelled
    .filter(tour => tour <= lastLoadedTour)
    .forEach(tour => {
      normalized.data.tours[tour] = { number: tour.toString(), start: '', end: '' };
    });

  Object.values(normalized.data.players).forEach(participant => {
    const results = remapRecord(
      participant.team.results_by_tour,
      cancelled,
      result => result,
    );
    const rosters = remapRecord(
      participant.team.rosters_by_tour,
      cancelled,
      roster => roster,
    );

    cancelled
      .filter(tour => tour <= lastLoadedTour)
      .forEach(tour => {
        results[tour] = createZeroResult(results, tour);
        rosters[tour] = createCancelledRoster(rosters, tour);
      });

    participant.team.results_by_tour = sortNumericRecord(results);
    participant.team.rosters_by_tour = sortNumericRecord(rosters);
  });

  normalized.data.tours = sortNumericRecord(normalized.data.tours);
  return normalized;
}

export function remapTourStatsResponse(
  response: FantasyTourStatsResponse,
  sourceTour: number,
  competitionTour: number,
): FantasyTourStatsResponse {
  const normalized = clone(response);
  Object.values(normalized.data.players).forEach(player => {
    const sourceStat = player.stat_by_tours?.[sourceTour];
    player.stat_by_tours = sourceStat
      ? { [competitionTour]: sourceStat }
      : {};
  });
  return normalized;
}

export function createZeroTourStatsResponse(
  template: FantasyTourStatsResponse,
  competitionTour: number,
): FantasyTourStatsResponse {
  const response = clone(template);
  Object.values(response.data.players).forEach(player => {
    player.stat_by_tours = {
      [competitionTour]: { score: 0, match_time: 0 },
    };
  });
  return response;
}

function remapRecord<T>(
  source: Record<string, T>,
  cancelledTours: number[],
  mapValue: (value: T) => T,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(source).map(([sourceTour, value]) => [
      sourceTourToCompetitionTour(Number(sourceTour), cancelledTours).toString(),
      mapValue(value),
    ]),
  );
}

function createZeroResult(
  results: Record<string, FantasyTourResult>,
  tour: number,
): FantasyTourResult {
  const previous = findNearestValue(results, tour, -1);
  return {
    total_score: previous?.total_score ?? '0',
    tour_score: '0',
    total_place: previous?.total_place ?? '0',
    tour_place: '1',
  };
}

function createCancelledRoster(
  rosters: Record<string, FantasyRoster>,
  tour: number,
): FantasyRoster {
  const adjacent = findNearestValue(rosters, tour, -1)
    ?? findNearestValue(rosters, tour, 1);
  if (!adjacent) {
    return {
      id: '',
      captain_id: '',
      vice_captain_id: '',
      team_cost: 0,
      players_stat: [],
      players: { base: [], bench: [] },
    };
  }

  return {
    ...clone(adjacent),
    players_stat: [],
  };
}

function findNearestValue<T>(
  values: Record<string, T>,
  tour: number,
  direction: -1 | 1,
): T | undefined {
  const tours = Object.keys(values).map(Number);
  const candidates = tours.filter(item => direction < 0 ? item < tour : item > tour);
  if (!candidates.length) return undefined;
  const nearestTour = direction < 0 ? Math.max(...candidates) : Math.min(...candidates);
  return values[nearestTour];
}

function normalizedCancelledTours(tours: number[]): number[] {
  return [...new Set(tours)]
    .filter(tour => Number.isInteger(tour) && tour > 0)
    .sort((left, right) => left - right);
}

function sortNumericRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => Number(left) - Number(right)),
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
