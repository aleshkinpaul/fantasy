export type MatchCenterStatus = 'upcoming' | 'live' | 'completed';

export interface MatchCenterStatusInput {
  tour: number;
  lastTour: number;
  tourStartsAt?: string;
  tourEndsAt?: string;
  homeScore?: number;
  awayScore?: number;
  now?: number;
}

export function resolveMatchCenterStatus(input: MatchCenterStatusInput): MatchCenterStatus {
  if (input.tour > input.lastTour
    || input.homeScore === undefined
    || input.awayScore === undefined) return 'upcoming';

  const now = input.now ?? Date.now();
  const startsAt = parseTourTimestamp(input.tourStartsAt);
  if (startsAt !== undefined && now < startsAt) return 'upcoming';

  const endsAt = parseTourTimestamp(input.tourEndsAt);
  if (endsAt === undefined || now >= endsAt) return 'completed';
  return 'live';
}

function parseTourTimestamp(value?: string): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value.replace(' ', 'T'));
  return Number.isFinite(timestamp) ? timestamp : undefined;
}
