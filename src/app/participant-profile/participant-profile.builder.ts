import {
  AchievementParticipant,
  AchievementRegistry
} from '../models/achievement';
import {
  ParticipantHistorySource,
  ParticipantProfile,
  ParticipantTeamVersion,
  ParticipantTournamentHistory
} from '../models/participant-profile';
import { TournamentTimelineGroup, TournamentTimelineItem } from '../models/tournament-catalog';
import { TITLE_TYPE_LABELS, TROPHY_ICONS } from '../service/achievement.service';

const KIND_ORDER = new Map([
  ['la-liga', 0],
  ['cup', 1],
  ['champions-league', 2],
  ['summer', 3]
]);

interface MutableParticipant extends AchievementParticipant {
  primaryProfileId: string;
  tournaments: Map<string, ParticipantTournamentHistory>;
}

export function buildParticipantProfiles(
  registry: AchievementRegistry,
  timeline: TournamentTimelineGroup[],
  sources: ParticipantHistorySource[]
): ParticipantProfile[] {
  const tournamentMap = new Map(
    timeline.flatMap(group => group.tournaments).map(tournament => [tournament.id, tournament])
  );
  const participants = new Map<string, MutableParticipant>();
  const profileOwners = new Map<string, MutableParticipant>();

  registry.participants.forEach(participant => {
    const mutable: MutableParticipant = {
      ...participant,
      profileIds: [...participant.profileIds],
      primaryProfileId: participant.profileIds.at(-1)!,
      tournaments: new Map()
    };
    participants.set(mutable.id, mutable);
    mutable.profileIds.forEach(profileId => profileOwners.set(profileId, mutable));
  });

  sources.forEach(source => {
    const tournament = tournamentMap.get(source.tournamentId);
    if (!tournament) return;
    const participant = resolveParticipant(source, participants, profileOwners);
    participant.primaryProfileId = pickLatestProfileId(participant, source, tournament, tournamentMap);
    mergeTournament(participant, source, tournament);
  });

  registry.placements.forEach(placement => {
    const tournament = tournamentMap.get(placement.tournamentId);
    if (!tournament) return;

    placement.recipient.members.forEach(member => {
      const participant = participants.get(member.participantId);
      if (!participant) return;
      if (!participant.profileIds.includes(member.profileId)) participant.profileIds.push(member.profileId);
      profileOwners.set(member.profileId, participant);

      const history = participant.tournaments.get(tournament.id) ?? createHistory(
        tournament,
        member.profileId,
        placement.recipient.type === 'participant' ? placement.recipient.label : placement.recipient.label,
        placement.recipient.logo
      );
      if (placement.recipient.type === 'participant') {
        history.teamName ||= placement.recipient.label;
        history.logo ||= placement.recipient.logo;
      }
      history.achievements.push({
        id: `${placement.tournamentId}-${placement.stageId}-${placement.place}-${placement.recipient.id}`,
        stageTitle: placement.stageTitle,
        titleType: placement.titleType,
        titleTypeLabel: TITLE_TYPE_LABELS[placement.titleType],
        place: placement.place,
        recipientLabel: placement.recipient.label,
        isTeamAchievement: placement.recipient.type === 'team',
        trophyIcon: TROPHY_ICONS[placement.titleType]
      });
      participant.tournaments.set(tournament.id, history);
    });
  });

  return Array.from(participants.values())
    .filter(participant => participant.tournaments.size > 0)
    .map(toParticipantProfile)
    .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
}

function resolveParticipant(
  source: ParticipantHistorySource,
  participants: Map<string, MutableParticipant>,
  profileOwners: Map<string, MutableParticipant>
): MutableParticipant {
  const existing = profileOwners.get(source.profileId)
    ?? (source.participantId ? participants.get(source.participantId) : undefined);
  if (existing) {
    if (!existing.profileIds.includes(source.profileId)) existing.profileIds.push(source.profileId);
    profileOwners.set(source.profileId, existing);
    return existing;
  }

  const baseId = source.participantId || `profile-${source.profileId}`;
  let id = baseId;
  let suffix = 2;
  while (participants.has(id)) id = `${baseId}-${suffix++}`;
  const participant: MutableParticipant = {
    id,
    name: source.participantName,
    profileIds: [source.profileId],
    primaryProfileId: source.profileId,
    tournaments: new Map()
  };
  participants.set(id, participant);
  profileOwners.set(source.profileId, participant);
  return participant;
}

function mergeTournament(
  participant: MutableParticipant,
  source: ParticipantHistorySource,
  tournament: TournamentTimelineItem
): void {
  const history = participant.tournaments.get(tournament.id)
    ?? createHistory(tournament, source.profileId, source.teamName, source.logo);
  history.profileId = source.profileId;
  history.teamName = source.teamName || history.teamName;
  history.logo = source.logo || history.logo;
  if (source.stats) {
    history.stats = source.stats;
    history.coverage = 'full';
  }
  participant.tournaments.set(tournament.id, history);
}

function createHistory(
  tournament: TournamentTimelineItem,
  profileId: string,
  teamName?: string,
  logo?: string
): ParticipantTournamentHistory {
  return {
    tournamentId: tournament.id,
    title: tournament.title,
    period: tournament.period,
    yearStart: tournament.yearStart,
    kind: tournament.kind,
    kindLabel: tournament.kindLabel,
    route: tournament.route,
    status: tournament.status,
    statusLabel: tournament.statusLabel,
    profileId,
    teamName,
    logo,
    coverage: 'identity',
    achievements: []
  };
}

function toParticipantProfile(participant: MutableParticipant): ParticipantProfile {
  const tournaments = Array.from(participant.tournaments.values()).sort((left, right) =>
    right.yearStart - left.yearStart ||
    (KIND_ORDER.get(left.kind) ?? 99) - (KIND_ORDER.get(right.kind) ?? 99)
  );
  const scored = tournaments.filter(tournament => tournament.stats);
  const achievements = tournaments.flatMap(tournament => tournament.achievements);
  const currentTeam = tournaments.find(tournament => tournament.status === 'active')
    ?? tournaments.find(tournament => tournament.logo || tournament.teamName)
    ?? tournaments[0];

  return {
    participantId: participant.id,
    name: participant.name,
    primaryProfileId: participant.primaryProfileId,
    profileIds: participant.profileIds,
    currentTeam,
    teamVersions: buildTeamVersions(tournaments),
    tournaments,
    summary: {
      tournaments: tournaments.filter(tournament => tournament.status !== 'scheduled').length,
      completedTournaments: tournaments.filter(tournament => tournament.status === 'completed').length,
      championships: achievements.filter(achievement => achievement.place === 1).length,
      podiums: achievements.length,
      knownTotalScore: scored.reduce((sum, tournament) => sum + tournament.stats!.totalScore, 0),
      scoredTournaments: scored.length,
      bestOverallPlace: minOrUndefined(scored.map(tournament => tournament.stats!.place))
    }
  };
}

function buildTeamVersions(tournaments: ParticipantTournamentHistory[]): ParticipantTeamVersion[] {
  const versions = new Map<string, ParticipantTeamVersion>();
  [...tournaments].reverse().forEach(tournament => {
    if (!tournament.logo && !tournament.teamName) return;
    const key = `${tournament.profileId}|${tournament.teamName ?? ''}|${tournament.logo ?? ''}`;
    const version = versions.get(key);
    if (version) {
      version.lastPeriod = tournament.period;
      version.tournaments += 1;
    } else {
      versions.set(key, {
        id: key,
        profileId: tournament.profileId,
        teamName: tournament.teamName,
        logo: tournament.logo,
        firstPeriod: tournament.period,
        lastPeriod: tournament.period,
        tournaments: 1
      });
    }
  });
  return Array.from(versions.values()).reverse();
}

function pickLatestProfileId(
  participant: MutableParticipant,
  source: ParticipantHistorySource,
  tournament: TournamentTimelineItem,
  tournaments: Map<string, TournamentTimelineItem>
): string {
  const currentYear = Array.from(participant.tournaments.keys())
    .map(id => tournaments.get(id)?.yearStart ?? -1)
    .reduce((max, year) => Math.max(max, year), -1);
  return tournament.yearStart >= currentYear ? source.profileId : participant.primaryProfileId;
}

function minOrUndefined(values: number[]): number | undefined {
  return values.length ? Math.min(...values) : undefined;
}
