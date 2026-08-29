import type { IProfileDetails } from '../models/domain';
import {
  calculateFormRatings,
  getRatingTourNumbers,
} from '../competition/domain/rating-calculator';
import type { MatchForecast } from './match-center.models';

export const FORECAST_ALGORITHM_VERSION = 'rating-softmax-v2';

const MAX_FORM_TOURS = 5;

export interface RatingForecastCalibration {
  strengthScale: number;
  drawIntercept: number;
  drawDistancePenalty: number;
}

// Fitted on rolling pre-match ratings from the completed 2025/26 competitions.
export const RATING_FORECAST_CALIBRATION: RatingForecastCalibration = {
  strengthScale: 0.4,
  drawIntercept: -0.9,
  drawDistancePenalty: 0,
};

export interface ForecastCalculationInput {
  homeProfileId: string;
  awayProfileId: string;
  targetTour: number;
  drawGap: number;
  profiles: Array<Pick<IProfileDetails, 'id' | 'team'>>;
}

export function calculateMatchForecast(input: ForecastCalculationInput): MatchForecast {
  requireProfile(input.profiles, input.homeProfileId);
  requireProfile(input.profiles, input.awayProfileId);

  const ratingLastTour = input.targetTour - 1;
  const ratings = calculateFormRatings(input.profiles, ratingLastTour);
  const basedOnTours = getRatingTourNumbers(input.profiles, ratingLastTour);
  const homeForm = ratings[input.homeProfileId] ?? 5;
  const awayForm = ratings[input.awayProfileId] ?? 5;
  const probabilities = calculateRatingProbabilities(
    homeForm,
    awayForm,
    input.drawGap,
    basedOnTours.length,
  );

  return {
    homeProfileId: input.homeProfileId,
    awayProfileId: input.awayProfileId,
    homeWinProbability: probabilities[0],
    drawProbability: probabilities[1],
    awayWinProbability: probabilities[2],
    homeForm,
    awayForm,
    basedOnTours,
    confidence: getConfidence(basedOnTours.length),
  };
}

export function calculateRatingProbabilities(
  homeRating: number,
  awayRating: number,
  drawGap: number,
  ratedTourCount: number,
  calibration: RatingForecastCalibration = RATING_FORECAST_CALIBRATION,
): [number, number, number] {
  return toPercentages(calculateRatingProbabilityValues(
    homeRating,
    awayRating,
    drawGap,
    ratedTourCount,
    calibration,
  ));
}

export function calculateRatingProbabilityValues(
  homeRating: number,
  awayRating: number,
  drawGap: number,
  ratedTourCount: number,
  calibration: RatingForecastCalibration = RATING_FORECAST_CALIBRATION,
): [number, number, number] {
  const sampleStrength = Math.min(1, Math.max(0, ratedTourCount) / MAX_FORM_TOURS);
  const difference = (homeRating - awayRating) * sampleStrength;
  const drawGapScale = Math.log((2 * Math.abs(drawGap) + 1) / 7);
  const logits = [
    calibration.strengthScale * difference / 2,
    calibration.drawIntercept
      - calibration.drawDistancePenalty * Math.abs(difference)
      + drawGapScale,
    -calibration.strengthScale * difference / 2,
  ];
  const maxLogit = Math.max(...logits);
  const weights = logits.map(logit => Math.exp(logit - maxLogit));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map(value => value / total) as [number, number, number];
}

function getConfidence(tourCount: number): MatchForecast['confidence'] {
  if (tourCount >= 5) return 'high';
  if (tourCount >= 3) return 'medium';
  return 'low';
}

function toPercentages(probabilities: number[]): [number, number, number] {
  if (Math.abs(probabilities[0] - probabilities[2]) < 1e-12) {
    let drawPercent = Math.round(probabilities[1] * 100);
    if ((100 - drawPercent) % 2 !== 0) {
      const lowerEvenDraw = drawPercent - 1;
      const upperEvenDraw = drawPercent + 1;
      drawPercent = Math.abs(probabilities[1] * 100 - lowerEvenDraw)
        <= Math.abs(probabilities[1] * 100 - upperEvenDraw)
        ? lowerEvenDraw
        : upperEvenDraw;
    }
    const decisivePercent = (100 - drawPercent) / 2;
    return [decisivePercent, drawPercent, decisivePercent];
  }

  const homePercent = Math.round(probabilities[0] * 100);
  const drawPercent = Math.round(probabilities[1] * 100);
  return [homePercent, drawPercent, 100 - homePercent - drawPercent];
}

function requireProfile(
  profiles: ForecastCalculationInput['profiles'],
  profileId: string,
): ForecastCalculationInput['profiles'][number] {
  const profile = profiles.find(item => item.id === profileId);
  if (!profile) throw new Error(`Не найден участник прогноза ${profileId}`);
  return profile;
}
