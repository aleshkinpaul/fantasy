import type {
  FantasyFullInfoResponse,
  FantasyTourResult,
} from '../models/competition.models';

interface TourRange {
  max: RatingScore;
  med: RatingScore;
  min: RatingScore;
}

type RatingScore = FantasyTourResult['tour_score'] | number | null;

export interface FormRatingProfile {
  id: string;
  team: {
    results_by_tour: Record<string | number, { tour_score: RatingScore }>;
  };
}

const RATING_COEFFICIENTS = [19, 15, 12, 10, 9];

export function calculateSquadRatings(
  squads: FantasyFullInfoResponse,
  lastTour: number,
): number[] {
  const profiles: FormRatingProfile[] = Object.entries(squads.data.players)
    .map(([id, player]) => ({ id, team: player.team }));

  Object.values(squads.data.tours).forEach(tour => {
    const range = getTourRange(profiles, tour.number);
    tour.max = range.max;
    tour.med = range.med;
    tour.min = range.min;
  });

  const ratingsByProfile = calculateFormRatings(profiles, lastTour);
  Object.entries(squads.data.players).forEach(([id, player]) => {
    player.team.rating = ratingsByProfile[id];
  });

  return Object.values(ratingsByProfile).sort((left, right) => left - right);
}

export function calculateFormRatings(
  profiles: FormRatingProfile[],
  lastTour: number,
): Record<string, number> {
  const ratedTours: Array<{ tour: number; range: TourRange }> = [];
  for (let tour = lastTour; tour >= 1 && ratedTours.length < RATING_COEFFICIENTS.length; tour--) {
    const range = getTourRange(profiles, tour);
    if (isUsableRatingRange(range)) {
      ratedTours.push({ tour, range });
    }
  }

  const maxResultValue = calculateWeightedResult(ratedTours, ({ range }) => Number(range.max));
  const minResultValue = calculateWeightedResult(ratedTours, ({ range }) => Number(range.min));
  const resultRange = maxResultValue - minResultValue;

  return Object.fromEntries(profiles.map(profile => {
    const rawRating = calculateWeightedResult(
      ratedTours,
      ({ tour, range }) => {
        const result = profile.team.results_by_tour[tour];
        return Number(result === undefined ? range.med : result.tour_score);
      },
    );
    const normalizedRating = resultRange === 0
      ? 5
      : (rawRating - minResultValue) / resultRange * 10;
    const rating = Math.round(Math.max(0, Math.min(10, normalizedRating)) * 100) / 100;
    return [profile.id, rating];
  }));
}

export function getRatingTourNumbers(
  profiles: FormRatingProfile[],
  lastTour: number,
): number[] {
  const tours: number[] = [];
  for (let tour = lastTour; tour >= 1 && tours.length < RATING_COEFFICIENTS.length; tour--) {
    if (isUsableRatingRange(getTourRange(profiles, tour))) tours.push(tour);
  }
  return tours.sort((left, right) => left - right);
}

function calculateWeightedResult(
  ratedTours: Array<{ tour: number; range: TourRange }>,
  getScore: (tour: { tour: number; range: TourRange }) => number,
): number {
  return ratedTours.reduce((sum, ratedTour, index) =>
    sum + (getScore(ratedTour) - Number(ratedTour.range.med))
      / Number(ratedTour.range.med) * RATING_COEFFICIENTS[index], 0);
}

function isUsableRatingRange(range: TourRange): boolean {
  const values = [range.max, range.med, range.min].map(Number);
  return values.every(Number.isFinite) && Number(range.med) !== 0;
}

function getTourRange(profiles: FormRatingProfile[], tour: string | number): TourRange {
  const scores: RatingScore[] = profiles
    .map(profile => profile.team.results_by_tour[tour.toString()]?.tour_score)
    .filter((score): score is FantasyTourResult['tour_score'] => score !== undefined)
    .sort((left, right) => Number(right) - Number(left));

  return {
    max: scores[0],
    med: getTourMedian(scores),
    min: scores[scores.length - 1],
  };
}

export function getTourMedian(
  values: RatingScore[],
): RatingScore {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => Number(right) - Number(left));
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) return sorted[middle];

  return (Number(sorted[middle - 1]) + Number(sorted[middle])) / 2;
}
