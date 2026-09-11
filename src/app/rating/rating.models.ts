import { TournamentKind, TournamentStatus } from '../models/tournament-catalog';

export interface RatingTournamentColumn {
  id: string;
  title: string;
  shortLabel: string;
  period: string;
  yearStart: number;
  kind: TournamentKind;
  route: string;
  status: TournamentStatus;
  isLive: boolean;
  included: boolean;
  seasonWeight: number;
  participantCount: number;
}

export interface RatingSeasonGroup {
  period: string;
  yearStart: number;
  columns: RatingTournamentColumn[];
}

export interface ParticipantRatingCell {
  tournamentId: string;
  totalScore?: number;
  officialPlace?: number;
  fantasyRank?: number;
  fantasyIndex?: number;
  placeIndex?: number;
  tournamentPower?: number;
  included: boolean;
}

export interface ParticipantRatingRow {
  rank: number;
  participantId: string;
  profileId: string;
  name: string;
  teamName?: string;
  logo?: string;
  rating: number;
  experienceFactor: number;
  consistencyBonus: number;
  countedTournaments: number;
  cells: Record<string, ParticipantRatingCell>;
}

export interface PowerRating {
  includeLive: boolean;
  columns: RatingTournamentColumn[];
  seasons: RatingSeasonGroup[];
  rows: ParticipantRatingRow[];
  countedTournaments: number;
  latestIncludedSeasons: number[];
}
