import { AchievementPlace, AchievementTitleType } from './achievement';
import { TournamentKind, TournamentStatus } from './tournament-catalog';

export type ParticipantHistoryCoverage = 'full' | 'identity';

export interface ParticipantTournamentStats {
  place?: number;
  fantasyPlace?: number;
  totalScore: number;
  averageScore: number;
  maxScore: number;
  minScore: number;
  toursPlayed: number;
  matchesPlayed?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  points?: number;
  scoreFor?: number;
  scoreAgainst?: number;
  scoreDifference?: number;
}

export interface ParticipantAccount {
  profileId: string;
  name?: string;
  nick?: string;
  telegram?: string;
  url?: string;
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

export interface ParticipantSponsorPrizeVictory {
  id: string;
  prizeId: number;
  name: string;
  icon: string;
  author?: string;
  reward?: string;
  tournamentId: string;
  tournamentTitle: string;
  period: string;
  yearStart: number;
  route: string;
}

export interface ParticipantSponsorPrizeVictorySource extends ParticipantSponsorPrizeVictory {
  profileId: string;
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
  profileUrl?: string;
  teamUrl?: string;
  teamName?: string;
  logo?: string;
  includeInTeamHistory: boolean;
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
  tournamentCodes: string[];
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
  accounts: ParticipantAccount[];
  currentTeam?: ParticipantTournamentHistory;
  teamVersions: ParticipantTeamVersion[];
  tournaments: ParticipantTournamentHistory[];
  sponsorPrizeVictories: ParticipantSponsorPrizeVictory[];
  summary: ParticipantProfileSummary;
}

export interface SponsorPrizeWinnersRegistry {
  version: 1;
  tournaments: Record<string, Record<string, string[]>>;
}

export interface ParticipantHistorySource {
  tournamentId: string;
  profileId: string;
  participantName: string;
  participantId?: string;
  teamName?: string;
  logo?: string;
  profileUrl?: string;
  profileNick?: string;
  profileTelegram?: string;
  teamUrl?: string;
  includeInTeamHistory?: boolean;
  stats?: ParticipantTournamentStats;
}
