import { FantasyFullInfoResponse } from '../models/competition.models';

interface TourRange {
  max: any;
  med: any;
  min: any;
}

const RATING_COEFFICIENTS = [19, 15, 12, 10, 9];

export function calculateSquadRatings(
  squads: FantasyFullInfoResponse,
  lastTour: number,
): number[] {
  Object.values(squads.data.tours).forEach(tour => {
    const range = getTourRange(squads, tour.number);
    tour.max = range.max;
    tour.med = range.med;
    tour.min = range.min;
  });

  const recentTourRanges: TourRange[] = [];
  for (let offset = 0; offset < lastTour && offset < RATING_COEFFICIENTS.length; offset++) {
    recentTourRanges.push(getTourRange(squads, lastTour - offset));
  }

  const ratingMedian = -RATING_COEFFICIENTS.reduce((sum, coefficient) => sum + coefficient, 0);
  const maxResultValue = recentTourRanges.reduce((sum, range, index) =>
    sum + (range.max - range.med) / range.med * RATING_COEFFICIENTS[index], 0) - ratingMedian;

  const ratings: number[] = [];
  Object.values(squads.data.players).forEach(player => {
    const recentScores: any[] = [];
    for (let offset = 0; offset < lastTour && offset < RATING_COEFFICIENTS.length; offset++) {
      recentScores.push(player.team.results_by_tour[lastTour - offset].tour_score);
    }

    const rawRating = recentTourRanges.reduce((sum, range, index) =>
      sum + (recentScores[index] - range.med) / range.med * RATING_COEFFICIENTS[index], 0);
    player.team.rating = Math.round((rawRating - ratingMedian) / maxResultValue * 1000) / 100;
    ratings.push(player.team.rating);
  });

  return ratings.sort((left, right) => left - right);
}

function getTourRange(squads: FantasyFullInfoResponse, tour: string | number): TourRange {
  const scores: any[] = Object.values(squads.data.players)
    .map(player => player.team.results_by_tour[tour.toString()].tour_score)
    .sort((left, right) => (right as any) - (left as any));

  return {
    max: scores[0],
    med: getLegacyMedian(scores),
    min: scores[scores.length - 1],
  };
}

function getLegacyMedian(values: any[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => right - left);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) return sorted[middle];

  // API scores are strings; concatenation before division is part of the 2025-26 formula.
  return (sorted[middle - 1] + sorted[middle]) / 2;
}
