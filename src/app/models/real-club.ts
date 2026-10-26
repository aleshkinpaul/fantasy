export interface RealClub {
  /** Stable application key, independent from identifiers returned by APIs. */
  key: string;
  /** Fantasy team IDs referenced by sport_players_tour_stat across tournaments. */
  ids: string[];
  /** Stable club IDs returned by /api/fnts_tournament/teams/{tournament}. */
  sourceIds?: string[];
  name: string;
  /** App-relative asset path. May be empty until an emblem is provided. */
  logo: string;
}

export type RealClubIndex = ReadonlyMap<string, RealClub>;

export function createRealClubIndex(clubs: readonly RealClub[]): RealClubIndex {
  return new Map(clubs.flatMap(club => club.ids.map(id => [id, club] as const)));
}

export function findRealClubByExternalId(
  clubs: readonly RealClub[],
  externalId: string | number | null | undefined,
): RealClub | undefined {
  if (externalId === null || externalId === undefined) return undefined;
  const normalizedId = String(externalId);
  return clubs.find(club => club.ids.includes(normalizedId));
}
