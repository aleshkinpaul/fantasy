import { IProfileDetails, IRoster } from '../models/domain';

export interface RosterSelection {
  roster: IRoster;
  all: string[];
  base: string[];
  bench: string[];
  captainId?: string;
}

export interface RosterChanges {
  added: string[];
  dropped: string[];
}

export function getRosterSelection(
  profile: Pick<IProfileDetails, 'team'>,
  tour: number,
): RosterSelection | undefined {
  const roster = profile.team.rosters_by_tour[tour];
  if (!roster) return undefined;

  const base = unique(roster.players.base);
  const bench = unique(roster.players.bench);
  return {
    roster,
    all: unique([...base, ...bench]),
    base,
    bench,
    captainId: roster.captain_id || undefined,
  };
}

export function getRosterChanges(
  profile: Pick<IProfileDetails, 'team'>,
  tour: number,
): RosterChanges | undefined {
  const current = getRosterSelection(profile, tour);
  const previous = getRosterSelection(profile, tour - 1);
  if (!current || !previous) return undefined;

  const currentIds = new Set(current.all);
  const previousIds = new Set(previous.all);
  return {
    added: current.all.filter(playerId => !previousIds.has(playerId)),
    dropped: previous.all.filter(playerId => !currentIds.has(playerId)),
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
