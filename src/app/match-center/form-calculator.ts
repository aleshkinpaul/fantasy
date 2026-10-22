import { calculateFormRatings, getRatingTourNumbers } from '../competition/domain/rating-calculator';
import type { CompetitionMatch } from '../competition/models/competition.models';
import type { IProfileDetails } from '../models/domain';
import type {
  MatchCenterFormResult,
  MatchCenterOutcome,
  MatchCenterStability,
  MatchCenterTeamForm,
} from './match-center.models';

const RECENT_FORM_LENGTH = 5;

export interface TeamFormCalculationInput {
  profileId: string;
  targetTour: number;
  matchesByTour: Record<string | number, CompetitionMatch[]>;
  profiles: Array<Pick<IProfileDetails, 'id' | 'team'>>;
}

/** Calculates pre-match form. The target tour and future tours are never included. */
export function calculateTeamForm(input: TeamFormCalculationInput): MatchCenterTeamForm {
  const allResults = getCompletedResults(input.matchesByTour, input.profileId, input.targetTour);
  const recentResults = allResults.slice(-RECENT_FORM_LENGTH).reverse();
  const scores = recentResults.map(result => result.scored);
  const normalizedScores = recentResults
    .map(result => normalizeAgainstTourMaximum(result, input.profiles))
    .filter((score): score is number => score !== undefined);
  const averageScored = average(scores);
  const averageConceded = average(recentResults.map(result => result.conceded));
  const normalizedVariationPercent = normalizedScores.length > 1
    ? coefficientOfVariation(normalizedScores, average(normalizedScores))
    : undefined;
  const ratings = calculateFormRatings(input.profiles, input.targetTour - 1);
  const currentRatingTours = getRatingTourNumbers(input.profiles, input.targetTour - 1);
  const previousRatingTours = getRatingTourNumbers(input.profiles, input.targetTour - 2);
  const previousRatings = previousRatingTours.length
    ? calculateFormRatings(input.profiles, input.targetTour - 2)
    : undefined;

  return {
    profileId: input.profileId,
    recentResults,
    matchesCount: recentResults.length,
    wins: countOutcome(recentResults, 'win'),
    draws: countOutcome(recentResults, 'draw'),
    losses: countOutcome(recentResults, 'loss'),
    averageScored: roundOne(averageScored),
    averageConceded: roundOne(averageConceded),
    winStreak: currentStreak(allResults, result => result.outcome === 'win'),
    unbeatenStreak: currentStreak(allResults, result => result.outcome !== 'loss'),
    rating: currentRatingTours.length ? ratings[input.profileId] ?? 5 : 5,
    ratingChange: previousRatings
      ? roundTwo((ratings[input.profileId] ?? 5) - (previousRatings[input.profileId] ?? 5))
      : undefined,
    stability: normalizedVariationPercent === undefined
      ? 'unavailable'
      : getStability(normalizedVariationPercent),
    normalizedVariationPercent,
  };
}

export function getCompletedResults(
  matchesByTour: Record<string | number, CompetitionMatch[]>,
  profileId: string,
  targetTour: number,
): MatchCenterFormResult[] {
  return Object.entries(matchesByTour)
    .map(([tour, matches]) => ({ tour: Number(tour), matches }))
    .filter(item => Number.isFinite(item.tour) && item.tour < targetTour)
    .sort((left, right) => left.tour - right.tour)
    .flatMap(({ tour, matches }) => matches
      .filter(match => match.home === profileId || match.away === profileId)
      .filter(isCompletedMatch)
      .map(match => toFormResult(match, profileId, tour)));
}

export function getOutcome(
  scored: number,
  conceded: number,
  matchResult: CompetitionMatch['result'],
  isHome: boolean,
): MatchCenterOutcome {
  if (matchResult === 0) return 'draw';
  if (matchResult === 1) return isHome ? 'win' : 'loss';
  if (matchResult === 2) return isHome ? 'loss' : 'win';
  if (scored === conceded) return 'draw';
  return scored > conceded ? 'win' : 'loss';
}

export function isCompletedMatch(match: CompetitionMatch): boolean {
  return Number.isFinite(match.home_score)
    && Number.isFinite(match.away_score)
    && (match.result === 0 || match.result === 1 || match.result === 2);
}

function toFormResult(match: CompetitionMatch, profileId: string, tour: number): MatchCenterFormResult {
  const isHome = match.home === profileId;
  const scored = Number(isHome ? match.home_score : match.away_score);
  const conceded = Number(isHome ? match.away_score : match.home_score);
  return {
    tour,
    opponentId: isHome ? match.away : match.home,
    scored,
    conceded,
    outcome: getOutcome(scored, conceded, match.result, isHome),
  };
}

function countOutcome(results: MatchCenterFormResult[], outcome: MatchCenterOutcome): number {
  return results.filter(result => result.outcome === outcome).length;
}

function currentStreak(
  results: MatchCenterFormResult[],
  predicate: (result: MatchCenterFormResult) => boolean,
): number {
  let length = 0;
  for (let index = results.length - 1; index >= 0 && predicate(results[index]); index--) length += 1;
  return length;
}

function coefficientOfVariation(scores: number[], mean: number): number {
  if (scores.length < 2 || mean === 0) return 0;
  const variance = scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length;
  return Math.round(Math.sqrt(variance) / Math.abs(mean) * 100);
}

function normalizeAgainstTourMaximum(
  result: MatchCenterFormResult,
  profiles: TeamFormCalculationInput['profiles'],
): number | undefined {
  const scores = profiles
    .map(profile => Number(profile.team.results_by_tour[result.tour]?.tour_score))
    .filter(score => Number.isFinite(score));
  if (!scores.length) return undefined;
  const maximum = Math.max(...scores);
  if (maximum <= 0) return undefined;
  return result.scored / maximum * 100;
}

function getStability(variationPercent: number): Exclude<MatchCenterStability, 'unavailable'> {
  if (variationPercent <= 8) return 'high';
  if (variationPercent <= 16) return 'medium';
  return 'low';
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
