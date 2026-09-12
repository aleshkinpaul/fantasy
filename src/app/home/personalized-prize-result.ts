import { IPrizeNominee, IRuntimePrize } from '../models/domain';
import { ParticipantDirectoryEntry } from '../models/participant-directory';

export interface PersonalizedPrizeResult {
  nominee: IPrizeNominee;
  place: number;
  value: string | number | null;
}

export function selectPersonalizedPrizeResult(
  prize: IRuntimePrize,
  participant: ParticipantDirectoryEntry,
): PersonalizedPrizeResult | null {
  if (prize.state !== 1) return null;

  const profileIds = new Set([participant.participantId, ...participant.profileIds].map(String));
  const placeIndex = prize.activeLeaders.findIndex(nominee => profileIds.has(String(nominee.id)));
  if (placeIndex < 0) return null;

  const nominee = prize.activeLeaders[placeIndex];
  return {
    nominee,
    place: placeIndex + 1,
    value: prize.isSecret ? null : nominee.prizes[prize.id]?.value ?? null,
  };
}
