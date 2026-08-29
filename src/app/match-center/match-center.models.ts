import { CompetitionMatch, SportPlayer } from '../competition/models/competition.models';
import { IProfileDetails } from '../models/domain';

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
  isCaptain: boolean;
  isViceCaptain: boolean;
  isBench: boolean;
}

export interface MatchCenterTeam {
  profile: IProfileDetails;
  teamCost?: number;
  base: MatchCenterPlayer[];
  bench: MatchCenterPlayer[];
  hasRoster: boolean;
}

export type ForecastConfidence = 'low' | 'medium' | 'high';
export type ForecastState = 'fixed' | 'preview' | 'unavailable';

export interface MatchForecast {
  homeProfileId: string;
  awayProfileId: string;
  homeWinProbability: number;
  drawProbability: number;
  awayWinProbability: number;
  expectedHomeScore: number;
  expectedAwayScore: number;
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
