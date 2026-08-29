import { CompetitionMatch, SportPlayer } from '../competition/models/competition.models';
import { IProfileDetails } from '../models/domain';
import { ForecastSnapshotFile } from '../match-center/match-center.models';

export type TourInsightsStatus = 'ready' | 'upcoming' | 'unavailable';

export interface InsightTeamRef {
  profileId: string;
  teamTitle: string;
  participantName: string;
  logo: string;
}

export interface RankedTeamInsight {
  rank: number;
  team: InsightTeamRef;
  value: number;
  delta?: number;
}

export interface RankedMatchInsight {
  rank: number;
  match: CompetitionMatch;
  home: InsightTeamRef;
  away: InsightTeamRef;
  homeScore: number;
  awayScore: number;
  combinedScore: number;
  difference: number;
  winnerProbability?: number;
}

export interface InsightPlayerRef {
  id: string;
  name: string;
  positionId?: string;
  realTeamId?: string;
}

export interface RankedPlayerInsight {
  rank: number;
  player: InsightPlayerRef;
  count: number;
  share: number;
  baseCount: number;
  captainCount: number;
}

export interface RankedClubInsight {
  rank: number;
  realTeamId: string;
  count: number;
  share: number;
  baseCount: number;
}

export interface RankedParticipantInsight {
  rank: number;
  team: InsightTeamRef;
  value: number;
}

export interface TourInsights {
  status: TourInsightsStatus;
  context: {
    tour: number;
    stageName: string;
    leagueName: string;
    teamsCount: number;
    matchesCount: number;
  };
  coverage: {
    scoredTeams: number;
    loadedRosters: number;
    comparableRosters: number;
    selectedPlayerSlots: number;
    identifiedPlayerSlots: number;
  };
  teams: {
    topScores: RankedTeamInsight[];
    aboveMedian: RankedTeamInsight[];
    belowMedian: RankedTeamInsight[];
    highestScoringLoser?: RankedTeamInsight;
    lowestScoringWinner?: RankedTeamInsight;
    medianScore?: number;
  };
  matches: {
    mostProductive: RankedMatchInsight[];
    closest: RankedMatchInsight[];
    biggestWins: RankedMatchInsight[];
    biggestUpsets: RankedMatchInsight[];
  };
  players: {
    mostPopular: RankedPlayerInsight[];
    mostPopularBase: RankedPlayerInsight[];
    mostPopularCaptains: RankedPlayerInsight[];
    mostAdded: RankedPlayerInsight[];
    mostDropped: RankedPlayerInsight[];
    popularClubs: RankedClubInsight[];
  };
  participants: {
    mostActive: RankedParticipantInsight[];
    mostStable: RankedParticipantInsight[];
    mostOriginal: RankedParticipantInsight[];
    mostTemplate: RankedParticipantInsight[];
    mostOriginalBase: RankedParticipantInsight[];
    mostUniquePicks: RankedParticipantInsight[];
  };
  capabilities: {
    playerScores: boolean;
    played: boolean;
  };
}

export interface TourInsightsInput {
  tournamentId: string;
  tour: number;
  lastTour: number;
  stageName: string;
  leagueName: string;
  profileIds: string[];
  matches: CompetitionMatch[];
  profiles: IProfileDetails[];
  sportPlayers: SportPlayer[];
  drawGap: number;
  forecast?: ForecastSnapshotFile;
  capabilities?: {
    playerScores: boolean;
    played: boolean;
  };
}
