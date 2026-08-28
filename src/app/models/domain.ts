// Extended type models for league and tournament data structures
import { IGroup } from './model';

export interface IActiveCompetitionTabs {
  tabId: number;
  confId: number;
  confTabId: number;
  tourId: number;
  cupTourId: number;
}

export interface IProfileDetails {
  id: string;
  name: string;
  nick: string;
  url: string;
  logo: string;
  team: ITeamData;
  score: number;
  prizes: Record<number, IPrizeInfo>;
  results: IProfileResults;
  squadDetails?: ISquadDetails;
  leagues?: Record<string, string>;
  place_in_league?: Record<string, number>;
  isMartin?: number;
  isMartinWC?: number;
  sex?: string | number;
}

export interface ITeamData {
  id: string;
  title: string;
  results_by_tour: Record<string | number, ITourResult>;
  rosters_by_tour: Record<string | number, IRoster>;
  rating?: number;
}

export interface ITourResult {
  tour_score: string | number;
  total_score: string | number;
  total_place: string | number;
}

export interface IRoster {
  team_cost: number;
  total_score: number;
  captain_id: string;
  players: {
    base: string[];
    bench: string[];
  };
}

export interface ISquadDetails {
  id: string;
  name: string;
  score: string | number;
  diff: number;
  rating_of_prize_positions: number;
  gold_medals: number;
  silver_medals: number;
  bronze_medals: number;
  medals_count: number;
  medals_arr?: number[];
  max_medals_in_a_row?: number;
  cur_medals_in_a_row?: number;
  totalPlaces: string | number;
  profile?: IProfileDetails;
  team_id: string;
  info?: ITeamData & { team: ITeamData }; // Nested for template access
  rating?: number;
}

export interface IProfileResults {
  wins: Record<string, number>;
  draws: Record<string, number>;
  loses: Record<string, number>;
  points: Record<string, number>;
  fo: Record<string, number>;
  missed_fo: Record<string, number>;
  diff_fo: Record<string, number>;
  matchesPlayed: number;
  teamCostTotal: number;
  teamCostAvg: number;
  subsUsedCount: number;
  subsTotalCount: number;
  subsCoef: number;
  uniqueUsedPlayers: string[];
  portugezePoints: number;
  larinPoints: number;
  prizeMinWins: number;
  prizeMaxFoInTour: number;
  prizeMaxFoInLosedTour: number;
  prizeCurrentWinStrike: number;
  prizeMaxWinStrike: number;
  prizeCurrentNoLoseStrike: number;
  prizeMaxNoLoseStrike: number;
  prizeMaxStoppedNoLoseStrike: number;
  prizeMaxLosedDiff: number;
  cup?: ICupResults;
}

export interface ICupResults {
  fo: number;
  missed_fo: number;
  diff_fo: number;
  matchesPlayed: number;
  avg_diff_fo: number;
  diff_fo_arr: number[];
  standings: number[];
  lowest_winning_pos_diff: number | null;
}

export interface IPrizeInfo {
  value: string | number;
  sortParam: number | Record<string, number>;
}

export interface IPrizeNominee {
  id: string;
  name: string;
  logo: string;
  team: { title: string };
  prizes: Record<number, IPrizeInfo>;
  results: { subsCoef: number };
}

export interface IRuntimePrize {
  id: number;
  name?: string;
  nomineesArr: IPrizeNominee[];
  activeLeaders: IPrizeNominee[];
  excluded?: string[];
  isActivity?: boolean;
  isFinalStage?: boolean;
  state?: number;
  author?: string;
  condition?: string;
  reward?: string;
  icon?: string;
  infoOnTour?: number;
  isSecret?: boolean;
  isShowAll?: boolean;
}

export interface IMatch {
  home: string;
  away: string;
  home_score?: number;
  away_score?: number;
  result?: number;
}

export interface IContsConfig {
  type: string;
  yearStart: number;
  squad_link: string;
  squad_link_2?: string;
  tour_link: string;
  drawGap?: number;
  profiles: string[];
  matches: Record<number, IMatch[]>;
  stages: IStage[];
  prizes?: IPrize[];
  cup?: ICup;
  groups?: IGroup[];
  tours?: ITourConfig[];
  teams?: ITeamConfig[];
}

export interface IStage {
  name: string;
  firstTour: number;
  lastTour: number;
  leagues: ILeague[];
}

export interface ILeague {
  name: string;
  profiles: string[];
}

export interface IPrize {
  id: number;
  name?: string;
  nomineesArr?: IProfileDetails[];
  activeLeaders?: IProfileDetails[];
  excluded?: string[];
  isActivity?: boolean;
  isFinalStage?: boolean;
  state?: number;
}

export interface ICup {
  matches: IMatch[][];
  matchesTours: number[];
}

export interface ITourConfig {
  tour: number;
  type: string;
  matches: IMatch[];
}

export interface ITeamConfig {
  id: string;
  name: string;
  profiles: string[];
}

export interface IMedalInfo {
  gold: number;
  silver: number;
  bronze: number;
  medalsArr: number[];
  curMedalsInARow: number;
  maxMedalsInARow: number;
}

export interface IMinMaxTour {
  max: number;
  med: number;
  min: number;
}
