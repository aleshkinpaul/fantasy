import { TournamentKind } from './tournament-catalog';

export interface RetroMedals {
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

export interface RetroStanding {
  place: number;
  participantName: string;
  participantId: string;
  profileId: string;
  teamName: string;
  telegram?: string;
  nickname?: string;
  logo: string;
  matched: boolean;
  totalScore: number;
  maxScore: number;
  averageScore: number;
  minScore: number;
  ratingPrizeMoney?: number;
  medals?: RetroMedals;
  tourScores: Array<number | null>;
}

export interface RetroTournament {
  id: string;
  title: string;
  period: string;
  kind: TournamentKind;
  format: 'overall';
  sourceFile: string;
  tourCount: number;
  standings: RetroStanding[];
}

export interface RetroTournamentRegistry {
  version: 1;
  tournaments: RetroTournament[];
}
