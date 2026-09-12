import { ParticipantTournamentHistory } from '../models/participant-profile';
import { tournamentTimelineTopDownOrder } from '../service/tournament-catalog.service';

export interface ParticipantSeasonGroup {
  year: number;
  period: string;
  tournaments: ParticipantTournamentHistory[];
}

export function buildParticipantSeasonGroups(
  tournaments: ParticipantTournamentHistory[]
): ParticipantSeasonGroup[] {
  const groups = new Map<number, ParticipantSeasonGroup>();

  tournaments.forEach(tournament => {
    const group = groups.get(tournament.yearStart) ?? {
      year: tournament.yearStart,
      period: tournament.period,
      tournaments: [],
    };
    group.tournaments.push(tournament);
    groups.set(tournament.yearStart, group);
  });

  return Array.from(groups.values())
    .map(group => ({
      ...group,
      tournaments: [...group.tournaments].sort((left, right) =>
        participantTournamentTopDownOrder(left) - participantTournamentTopDownOrder(right)
        || left.title.localeCompare(right.title, 'ru')
      ),
    }))
    .sort((left, right) => right.year - left.year);
}

export function participantTournamentTopDownOrder(
  tournament: Pick<ParticipantTournamentHistory, 'kind'>
): number {
  return tournamentTimelineTopDownOrder(tournament.kind);
}
