import {
  FantasyPlayerParticipation,
  FantasyPlayerStatTotals,
} from '../competition/domain/fantasy-lineup-resolver';
import type { CompetitionMatch, SportPlayer } from '../competition/models/competition.models';
import type { IProfileDetails, IRosterPlayerMatchStat } from '../models/domain';

export type MatchCenterEventTone = 'default' | 'assist' | 'warning' | 'danger' | 'success';

export interface MatchCenterPlayerEvent {
  key: string;
  iconPath: string;
  label: string;
  count: number;
  tone: MatchCenterEventTone;
  marker?: string;
}

export interface MatchCenterStatItem {
  label: string;
  value: string | number;
}

export interface MatchCenterSelection {
  match: CompetitionMatch;
  tour: number;
}

export interface MatchCenterPlayer {
  id: string;
  name: string;
  position: string;
  positionId?: string;
  startsPositionGroup: boolean;
  cost?: number;
  realTeamId?: string;
  isNewToSquad: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isBench: boolean;
  participation: FantasyPlayerParticipation;
  isPlayed: boolean;
  isCounted: boolean;
  isAutoSubbedIn: boolean;
  isEffectiveCaptain: boolean;
  fantasyScore?: number;
  displayFantasyScore?: number;
  scoreMultiplier: 1 | 2;
  playedMinutes?: number;
  playedMinutesLabel: string;
  redCards: number;
  stats: FantasyPlayerStatTotals;
  matchStats: IRosterPlayerMatchStat[];
  events: MatchCenterPlayerEvent[];
  statSummary: string;
}

export interface MatchCenterTeam {
  profile: IProfileDetails;
  teamCost?: number;
  base: MatchCenterPlayer[];
  bench: MatchCenterPlayer[];
  hasRoster: boolean;
  countedPlayersCount: number;
  autoSubstitutionsCount: number;
  hasParticipationData: boolean;
  isLineupFinal: boolean;
}

export type ForecastConfidence = 'low' | 'medium' | 'high';
export type ForecastState = 'fixed' | 'calculated' | 'preview' | 'unavailable';

export interface MatchForecast {
  homeProfileId: string;
  awayProfileId: string;
  homeWinProbability: number;
  drawProbability: number;
  awayWinProbability: number;
  homeForm: number;
  awayForm: number;
  basedOnTours: number[];
  confidence: ForecastConfidence;
}

export interface MatchForecastView {
  state: ForecastState;
  forecast?: MatchForecast;
  generatedAt?: string;
  algorithmVersion?: string;
  message?: string;
}

export interface ForecastSnapshotFile {
  tournamentId: string;
  tour: number;
  generatedAt: string;
  algorithmVersion: string;
  inputLastTour: number;
  calculationLastTour?: number;
  inputHash?: string;
  provenance?: 'published' | 'reconstructed';
  forecasts: MatchForecast[];
}

export interface ForecastManifestEntry {
  tournamentId: string;
  tour: number;
  path: string;
}

export interface ForecastManifest {
  snapshots: ForecastManifestEntry[];
}

export interface MatchCenterOpenContext {
  selection: MatchCenterSelection;
  profiles: IProfileDetails[];
  sportPlayers: SportPlayer[];
}

export type MatchCenterOutcome = 'win' | 'draw' | 'loss';
export type MatchCenterStability = 'high' | 'medium' | 'low' | 'unavailable';

export interface MatchCenterFormResult {
  tour: number;
  opponentId: string;
  scored: number;
  conceded: number;
  outcome: MatchCenterOutcome;
}

export interface MatchCenterTeamForm {
  profileId: string;
  recentResults: MatchCenterFormResult[];
  matchesCount: number;
  wins: number;
  draws: number;
  losses: number;
  averageScored: number;
  averageConceded: number;
  winStreak: number;
  unbeatenStreak: number;
  rating: number;
  ratingChange?: number;
  stability: MatchCenterStability;
  normalizedVariationPercent?: number;
}

export interface MatchCenterHeadToHeadMeeting {
  id: string;
  tour: number;
  stage: string;
  tournamentId: string;
  tournamentTitle: string;
  tournamentIcon: string;
  season: string;
  startsAt: string;
  homeProfileId: string;
  awayProfileId: string;
  homeTeamTitle: string;
  awayTeamTitle: string;
  homeTeamLogo: string;
  awayTeamLogo: string;
  firstTeamTitle: string;
  secondTeamTitle: string;
  homeScore: number;
  awayScore: number;
  firstScore: number;
  secondScore: number;
  firstOutcome: MatchCenterOutcome;
  result: 0 | 1 | 2;
}

export interface MatchCenterHeadToHeadStage {
  stage: string;
  matches: number;
  firstWins: number;
  draws: number;
  secondWins: number;
}

export interface MatchCenterHeadToHead {
  firstProfileId: string;
  secondProfileId: string;
  matches: number;
  firstWins: number;
  draws: number;
  secondWins: number;
  firstTotalScore: number;
  secondTotalScore: number;
  firstAverageScore: number;
  secondAverageScore: number;
  biggestWin?: MatchCenterHeadToHeadMeeting;
  recentMeetings: MatchCenterHeadToHeadMeeting[];
  stages: MatchCenterHeadToHeadStage[];
}

export interface MatchCenterHistory {
  forms: [MatchCenterTeamForm, MatchCenterTeamForm];
  headToHead: MatchCenterHeadToHead;
}

export interface HistoricalMatchTeam {
  participantId: string;
  profileId: string;
  teamTitle: string;
  logo: string;
}

export interface HistoricalMatchRecord {
  id: string;
  tournamentId: string;
  tournamentTitle: string;
  tournamentIcon: string;
  season: string;
  stage: string;
  tour: number;
  startsAt: string;
  startsAtTimestamp: number;
  home: HistoricalMatchTeam;
  away: HistoricalMatchTeam;
  homeScore: number;
  awayScore: number;
  result: 0 | 1 | 2;
}

export interface MatchHistoryIndex {
  records: HistoricalMatchRecord[];
  participantIdByProfileId: Record<string, string>;
  seasons: string[];
}
