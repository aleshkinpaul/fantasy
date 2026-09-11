import {
  FantasyPlayerParticipation,
  FantasyPlayerStatTotals,
} from '../competition/domain/fantasy-lineup-resolver';
import { CompetitionMatch, SportPlayer } from '../competition/models/competition.models';
import { IProfileDetails, IRosterPlayerMatchStat } from '../models/domain';

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
export type ForecastState = 'fixed' | 'reconstructed' | 'preview' | 'unavailable';

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
