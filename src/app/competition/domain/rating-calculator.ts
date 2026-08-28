import {
  FantasyFullInfoResponse,
  FantasyTourResult,
} from '../models/competition.models';

interface TourRange {
  max: FantasyTourResult['tour_score'];
  med: FantasyTourResult['tour_score'] | number;
  min: FantasyTourResult['tour_score'];
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

  const ratedTours: Array<{ tour: number; range: TourRange }> = [];
  for (let tour = lastTour; tour >= 1 && ratedTours.length < RATING_COEFFICIENTS.length; tour--) {
    const range = getTourRange(squads, tour);
    if (isUsableRatingRange(range)) {
      ratedTours.push({ tour, range });
    }
  }

  const ratingMedian = -RATING_COEFFICIENTS.reduce((sum, coefficient) => sum + coefficient, 0);
  const maxResultValue = ratedTours.reduce((sum, { range }, index) =>
    sum + (Number(range.max) - Number(range.med)) / Number(range.med) * RATING_COEFFICIENTS[index], 0) - ratingMedian;

  const ratings: number[] = [];
  Object.values(squads.data.players).forEach(player => {
    const rawRating = ratedTours.reduce((sum, { tour, range }, index) =>
      sum + (Number(player.team.results_by_tour[tour].tour_score) - Number(range.med))
        / Number(range.med) * RATING_COEFFICIENTS[index], 0);
    player.team.rating = Math.round((rawRating - ratingMedian) / maxResultValue * 1000) / 100;
    ratings.push(player.team.rating);
  });

  return ratings.sort((left, right) => left - right);
}

function isUsableRatingRange(range: TourRange): boolean {
  const values = [range.max, range.med, range.min].map(Number);
  return values.every(Number.isFinite) && Number(range.med) !== 0;
}

function getTourRange(squads: FantasyFullInfoResponse, tour: string | number): TourRange {
  const scores: FantasyTourResult['tour_score'][] = Object.values(squads.data.players)
    .map(player => player.team.results_by_tour[tour.toString()].tour_score)
    .sort((left, right) => Number(right) - Number(left));

  return {
    max: scores[0],
    med: getLegacyMedian(scores),
    min: scores[scores.length - 1],
  };
}

export function getLegacyMedian(
  values: FantasyTourResult['tour_score'][],
): FantasyTourResult['tour_score'] | number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => Number(right) - Number(left));
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) return sorted[middle];

  // API scores are strings; concatenation before division is part of the 2025-26 formula.
  return Number(sorted[middle - 1] + sorted[middle]) / 2;
}
