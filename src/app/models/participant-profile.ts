import { AchievementPlace, AchievementTitleType } from './achievement';
import { TournamentKind, TournamentStatus } from './tournament-catalog';

export type ParticipantHistoryCoverage = 'full' | 'identity';

export interface ParticipantTournamentStats {
  place: number;
  totalScore: number;
  averageScore: number;
  maxScore: number;
  minScore: number;
  toursPlayed: number;
}

export interface ParticipantTournamentAchievement {
  id: string;
  stageTitle: string;
  titleType: AchievementTitleType;
  titleTypeLabel: string;
  place: AchievementPlace;
  recipientLabel: string;
  isTeamAchievement: boolean;
  trophyIcon: string;
}

export interface ParticipantTournamentHistory {
  tournamentId: string;
  title: string;
  period: string;
  yearStart: number;
  kind: TournamentKind;
  kindLabel: string;
  route: string;
  status: TournamentStatus;
  statusLabel: string;
  profileId: string;
  teamName?: string;
  logo?: string;
  coverage: ParticipantHistoryCoverage;
  stats?: ParticipantTournamentStats;
  achievements: ParticipantTournamentAchievement[];
}

export interface ParticipantTeamVersion {
  id: string;
  profileId: string;
  teamName?: string;
  logo?: string;
  firstPeriod: string;
  lastPeriod: string;
  tournaments: number;
}

export interface ParticipantProfileSummary {
  tournaments: number;
  completedTournaments: number;
  championships: number;
  podiums: number;
  knownTotalScore: number;
  scoredTournaments: number;
  bestOverallPlace?: number;
}

export interface ParticipantProfile {
  participantId: string;
  name: string;
  primaryProfileId: string;
  profileIds: string[];
  currentTeam?: ParticipantTournamentHistory;
  teamVersions: ParticipantTeamVersion[];
  tournaments: ParticipantTournamentHistory[];
  summary: ParticipantProfileSummary;
}

export interface ParticipantHistorySource {
  tournamentId: string;
  profileId: string;
  participantName: string;
  participantId?: string;
  teamName?: string;
  logo?: string;
  stats?: ParticipantTournamentStats;
}
