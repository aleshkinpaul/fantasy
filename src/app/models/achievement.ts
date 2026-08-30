import { TournamentTimelineItem } from './tournament-catalog';

export type AchievementTitleType =
  | 'la-liga-primera'
  | 'la-liga-segunda'
  | 'cup'
  | 'champions-league'
  | 'world-cup'
  | 'club-world-cup'
  | 'euro';

export type AchievementPlace = 1 | 2 | 3;

export interface AchievementParticipant {
  id: string;
  name: string;
  profileIds: string[];
}

export interface AchievementMemberReference {
  participantId: string;
  profileId: string;
}

export interface AchievementRecipientSnapshot {
  id: string;
  type: 'participant' | 'team';
  label: string;
  logo: string;
  members: AchievementMemberReference[];
}

export interface TournamentPlacement {
  tournamentId: string;
  stageId: string;
  stageTitle: string;
  titleType: AchievementTitleType;
  place: AchievementPlace;
  recipient: AchievementRecipientSnapshot;
}

export interface AchievementRegistry {
  version: 1;
  participants: AchievementParticipant[];
  placements: TournamentPlacement[];
}

export interface HallPlacement extends TournamentPlacement {
  displayName: string;
  teamName: string;
  memberNames: string[];
}

export interface HallStage {
  id: string;
  title: string;
  titleType: AchievementTitleType;
  titleTypeLabel: string;
  trophyIcon: string;
  placements: HallPlacement[];
}

export interface HallTrophy {
  id: string;
  titleType: AchievementTitleType;
  label: string;
  icon: string;
}

export interface HallTournament {
  tournament: TournamentTimelineItem;
  stages: HallStage[];
}

export interface HallSeason {
  period: string;
  yearStart: number;
  tournaments: HallTournament[];
}

export interface HallLeader {
  participantId: string;
  name: string;
  championships: number;
  finals: number;
  podiums: number;
  trophies: HallTrophy[];
}

export interface HallChampion {
  titleType: AchievementTitleType;
  titleTypeLabel: string;
  period: string;
  tournamentTitle: string;
  tournamentRoute: string;
  trophyIcon: string;
  placement: HallPlacement;
}

export interface HallSummary {
  competitions: number;
  champions: number;
  podiumEntries: number;
  participants: number;
}

export interface HallOfFame {
  seasons: HallSeason[];
  leaders: HallLeader[];
  currentChampions: HallChampion[];
  summary: HallSummary;
  periods: string[];
}
