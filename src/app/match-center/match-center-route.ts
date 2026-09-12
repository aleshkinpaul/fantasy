import { CompetitionMatch } from '../competition/models/competition.models';
import { MatchCenterSelection } from './match-center.models';

export const MATCH_CENTER_QUERY_KEYS = [
  'matchTour',
  'matchHome',
  'matchAway',
] as const;

export interface MatchCenterQueryValues {
  matchTour: string | null;
  matchHome: string | null;
  matchAway: string | null;
}

export function matchCenterQuery(
  selection: MatchCenterSelection,
): Record<(typeof MATCH_CENTER_QUERY_KEYS)[number], string | number> {
  return {
    matchTour: selection.tour,
    matchHome: selection.match.home,
    matchAway: selection.match.away,
  };
}

export function resolveMatchCenterQuery(
  matches: Record<string | number, CompetitionMatch[]>,
  query: MatchCenterQueryValues,
): MatchCenterSelection | null {
  const tour = Number(query.matchTour);
  if (!Number.isInteger(tour) || tour < 1 || !query.matchHome || !query.matchAway) return null;

  const match = matches[tour]?.find(item =>
    (item.home === query.matchHome && item.away === query.matchAway)
    || (item.home === query.matchAway && item.away === query.matchHome)
  );
  return match ? { match, tour } : null;
}
