export type CompetitionType = 'spain' | 'champions-league' | 'world-cup';

export interface LocalProfile {
  id: string;
  name: string;
  nick: string;
  url: string;
  logo: string;
  sex?: number;
}

export interface FantasyTour {
  number: string;
  start: string;
  end: string;
  max?: string | number;
  med?: string | number;
  min?: string | number;
}

export interface FantasyTourResult {
  total_score: string;
  tour_score: string;
  total_place: string;
  tour_place: string;
}

export interface FantasyRoster {
  id: string;
  captain_id: string;
  vice_captain_id: string;
  team_cost?: number;
  total_score?: string;
  players: { base: string[]; bench: string[] };
}

export interface FantasyTeam {
  id: string;
  title: string;
  results_by_tour: Record<string, FantasyTourResult>;
  rosters_by_tour: Record<string, FantasyRoster>;
  rating?: number;
}

export interface FantasyParticipant {
  id: string;
  name: string;
  logo: string;
  team: FantasyTeam;
}

export interface FantasyH2HMatch {
  home_player: string;
  away_player: string;
  home_score: string;
  away_score: string;
}

export interface FantasyFullInfoResponse {
  result: number;
  data: {
    id: string;
    title: string;
    fantasy_tournament_name: string;
    season: string;
    tours: Record<string, FantasyTour>;
    players: Record<string, FantasyParticipant>;
    matches: Record<string, FantasyH2HMatch[]>;
  };
}

export interface SportPlayerTourStat { score: number; match_time: number }

export interface SportPlayer {
  id: string;
  name: string;
  amplua_id: string;
  team_id: string;
  cost: number;
  stat_by_tours: Record<string, SportPlayerTourStat>;
}

export interface FantasyTourStatsResponse {
  result: number;
  data: {
    tournament: { id: string; title: string; season: string };
    players: Record<string, SportPlayer>;
  };
}

export interface CompetitionMatch {
  home: string;
  away: string;
  type?: 'up' | 'down';
  home_score?: number;
  away_score?: number;
  result?: 0 | 1 | 2;
}

export interface CompetitionLeague {
  name: string;
  profiles: string[];
}

export interface CompetitionStage {
  name: string;
  teamsCount?: number;
  firstTour: number;
  lastTour: number;
  qualifiedPlaces?: number;
  leagues: CompetitionLeague[];
}

export interface CompetitionCup {
  name?: string;
  matchesTours: number[];
  matchesToursNames?: string[];
  matches: CompetitionMatch[][];
  prizes?: unknown[];
}

export interface CompetitionPrizeConfig {
  id: number;
  name?: string;
  icon?: string;
  author?: string;
  condition?: string;
  reward?: string;
  isFinalStage?: boolean;
  isActivity?: boolean;
  isManual?: boolean;
  isPlaceholder?: boolean;
  excluded?: string[];
  defaultNomineesArr?: string[];
  nomineesArr?: unknown[];
  activeLeaders?: unknown[];
  state?: number;
  infoOnTour?: number;
  isSecret?: boolean;
  isShowAll?: boolean;
  calculationInfo?: string;
  [key: string]: unknown;
}

export interface CompetitionPrizeReference {
  key: string;
  overrides?: {
    id?: never;
    excluded?: string[];
    [key: string]: unknown;
  };
}

export interface SpecialPlayerRules {
  forbiddenTeamIds: string[];
  forbiddenPlayerIds: string[];
  worldCupForbiddenPlayerIds: string[];
  portugueseTeamId: string;
  larinPlayerId: string;
}

export interface SpainPrizeRules {
  guestProfileIds: string[];
  extraWinnerIds: string[];
  specialGuestId?: string;
  frequentPlayerId?: string;
  frequentCaptainId?: string;
  randomPrizeIndex?: number;
  placeReferenceProfileIds?: {
    prize2?: string;
    prize3?: string;
    prize10?: string;
  };
  turtleTargetProfileId?: string;
  martinPlayerIds?: string[];
  firstHundredEligibleTours?: number[];
}

export interface SubstitutionRules {
  defaultLimit: number;
  limitsByTourIndex: Record<string, number>;
}

export interface PrizeMetricRules {
  maxLosingDifferenceFirstTour: number;
}

export interface CompetitionRuntimeRules {
  playerStats: SpecialPlayerRules;
  spainPrizes?: SpainPrizeRules;
  prizeMetrics: PrizeMetricRules;
  substitutions: Partial<Record<CompetitionType, SubstitutionRules>>;
}

export interface SeasonCompetitionConfig {
  id: string;
  type: CompetitionType;
  typeId: string;
  yearStart: number;
  yearEnd: number;
  squad_link: string;
  squad_link_2?: string;
  tour_link: string;
  tour_link_2?: string;
  special_pos?: number | null;
  drawGap?: number;
  rulesId?: string;
  format_img_link?: string;
  profiles: string[];
  matches: Record<string, CompetitionMatch[]>;
  stages: CompetitionStage[];
  prizes: CompetitionPrizeConfig[];
  prizeRefs?: CompetitionPrizeReference[];
  cup?: CompetitionCup;
}

export interface SeasonCompetitionFile {
  status?: 'draft' | 'published';
  config: SeasonCompetitionConfig;
  profiles: LocalProfile[];
}

export interface LoadedCompetitionData {
  profiles: LocalProfile[];
  config: SeasonCompetitionConfig;
  squads: FantasyFullInfoResponse;
  squads2?: FantasyFullInfoResponse;
  latestPlayerStats: FantasyTourStatsResponse[];
  playerStatsByTour: FantasyTourStatsResponse[];
}
