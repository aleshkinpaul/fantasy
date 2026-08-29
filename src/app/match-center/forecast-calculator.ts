import type { IProfileDetails } from '../models/domain';
import type { MatchForecast } from './match-center.models';

export const FORECAST_ALGORITHM_VERSION = 'weighted-normal-v1';

const MAX_FORM_TOURS = 5;
const RECENCY_WEIGHTS = [5, 4, 3, 2, 1];
const DEFAULT_SCORE = 50;
const DEFAULT_DEVIATION = 14;

export interface ForecastCalculationInput {
  homeProfileId: string;
  awayProfileId: string;
  targetTour: number;
  drawGap: number;
  profiles: Array<Pick<IProfileDetails, 'id' | 'team'>>;
}

export function calculateMatchForecast(input: ForecastCalculationInput): MatchForecast {
  const home = requireProfile(input.profiles, input.homeProfileId);
  const away = requireProfile(input.profiles, input.awayProfileId);
  const basedOnTours = getAvailableTours(input.profiles, input.targetTour);
  const homeScores = getScores(home, basedOnTours);
  const awayScores = getScores(away, basedOnTours);
  const expectedHomeScore = weightedMean(homeScores);
  const expectedAwayScore = weightedMean(awayScores);
  const sampleStrength = Math.min(1, basedOnTours.length / MAX_FORM_TOURS);
  const meanDifference = (expectedHomeScore - expectedAwayScore) * sampleStrength;
  const deviation = Math.sqrt(
    square(stabilizedDeviation(homeScores)) + square(stabilizedDeviation(awayScores)),
  );

  const awayWinRaw = normalCdf((-Math.abs(input.drawGap) - meanDifference) / deviation);
  const homeWinRaw = 1 - normalCdf((Math.abs(input.drawGap) - meanDifference) / deviation);
  const drawRaw = Math.max(0, 1 - homeWinRaw - awayWinRaw);
  const probabilities = toPercentages(homeWinRaw, drawRaw, awayWinRaw);

  return {
    homeProfileId: input.homeProfileId,
    awayProfileId: input.awayProfileId,
    homeWinProbability: probabilities[0],
    drawProbability: probabilities[1],
    awayWinProbability: probabilities[2],
    expectedHomeScore: round(expectedHomeScore),
    expectedAwayScore: round(expectedAwayScore),
    homeForm: calculateNormalizedForm(home, input.profiles, basedOnTours),
    awayForm: calculateNormalizedForm(away, input.profiles, basedOnTours),
    basedOnTours: [...basedOnTours].sort((left, right) => left - right),
    confidence: getConfidence(basedOnTours.length),
  };
}

function getAvailableTours(
  profiles: ForecastCalculationInput['profiles'],
  targetTour: number,
): number[] {
  const tours = new Set<number>();
  profiles.forEach(profile => {
    Object.keys(profile.team.results_by_tour).forEach(rawTour => {
      const tour = Number(rawTour);
      if (Number.isInteger(tour) && tour > 0 && tour < targetTour) tours.add(tour);
    });
  });
  return Array.from(tours)
    .sort((left, right) => right - left)
    .slice(0, MAX_FORM_TOURS);
}

function getScores(
  profile: ForecastCalculationInput['profiles'][number],
  tours: number[],
): number[] {
  return tours.map(tour => {
    const score = Number(profile.team.results_by_tour[tour]?.tour_score);
    return Number.isFinite(score) ? score : DEFAULT_SCORE;
  });
}

function weightedMean(values: number[]): number {
  if (!values.length) return DEFAULT_SCORE;
  const weights = RECENCY_WEIGHTS.slice(0, values.length);
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  return values.reduce((sum, value, index) => sum + value * weights[index], 0) / weightSum;
}

function stabilizedDeviation(values: number[]): number {
  if (values.length < 2) return DEFAULT_DEVIATION;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + square(value - mean), 0) / values.length;
  return Math.max(8, Math.sqrt(variance));
}

function calculateNormalizedForm(
  profile: ForecastCalculationInput['profiles'][number],
  profiles: ForecastCalculationInput['profiles'],
  tours: number[],
): number {
  if (!tours.length) return 5;

  const values = tours.map(tour => {
    const allScores = profiles
      .map(item => Number(item.team.results_by_tour[tour]?.tour_score))
      .filter(Number.isFinite);
    const score = Number(profile.team.results_by_tour[tour]?.tour_score);
    if (!allScores.length || !Number.isFinite(score)) return 5;
    const min = Math.min(...allScores);
    const max = Math.max(...allScores);
    return max === min ? 5 : (score - min) / (max - min) * 10;
  });

  return round(weightedMean(values));
}

function getConfidence(tourCount: number): MatchForecast['confidence'] {
  if (tourCount >= 5) return 'high';
  if (tourCount >= 3) return 'medium';
  return 'low';
}

function toPercentages(home: number, draw: number, away: number): [number, number, number] {
  const total = home + draw + away || 1;
  const homePercent = Math.round(home / total * 100);
  const drawPercent = Math.round(draw / total * 100);
  return [homePercent, drawPercent, 100 - homePercent - drawPercent];
}

function normalCdf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const absolute = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * absolute);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * Math.exp(-absolute * absolute);
  return 0.5 * (1 + sign * erf);
}

function requireProfile(
  profiles: ForecastCalculationInput['profiles'],
  profileId: string,
): ForecastCalculationInput['profiles'][number] {
  const profile = profiles.find(item => item.id === profileId);
  if (!profile) throw new Error(`Не найден участник прогноза ${profileId}`);
  return profile;
}

function square(value: number): number {
  return value * value;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
