export interface RealClub {
  /** Stable internal key. External API identifiers belong in ids instead. */
  key: string;
  /** IDs used by fantasy-h2h API across seasons and competitions. */
  ids: string[];
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
