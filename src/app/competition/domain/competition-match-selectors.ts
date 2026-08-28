import { CompetitionMatch } from '../models/competition.models';

interface IdentifiableProfile {
  id: string;
}

export function findProfile<TProfile extends IdentifiableProfile>(
  profiles: TProfile[],
  profileId: string,
): TProfile | undefined {
  return profiles.find(profile => profile.id === profileId);
}

export function requireProfile<TProfile extends IdentifiableProfile>(
  profiles: TProfile[],
  profileId: string,
): TProfile {
  const profile = findProfile(profiles, profileId);
  if (!profile) throw new Error(`Не найден профиль ${profileId}`);
  return profile;
}

export function requireMatchForProfile(
  matches: CompetitionMatch[],
  profileId: string,
): CompetitionMatch {
  const match = matches.find(item => item.home === profileId || item.away === profileId);
  if (!match) throw new Error(`Не найден матч профиля ${profileId}`);
  return match;
}

export function getMatchResultForProfile(
  matches: CompetitionMatch[],
  profileId: string,
): 0 | 1 | 2 {
  const match = requireMatchForProfile(matches, profileId);
  if (match.result === 0) return 0;
  if (match.home === profileId) return match.result === 1 ? 1 : 2;
  return match.result === 2 ? 1 : 2;
}

export function getOpponentProfileId(
  matches: CompetitionMatch[],
  profileId: string,
): string {
  const match = requireMatchForProfile(matches, profileId);
  return match.home === profileId ? match.away : match.home;
}
