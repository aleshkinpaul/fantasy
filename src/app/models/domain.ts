// Extended type models for league and tournament data structures
import { IGroup } from './model';

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
  sex?: string;
}

export interface ITeamData {
  id: string;
  title: string;
  results_by_tour: Record<string | number, ITourResult>;
  rosters_by_tour: Record<string | number, IRoster>;
  rating?: number;
}

export interface ITourResult {
  tour_score: number;
  total_score: number;
  total_place: number;
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
  score: number;
  diff: number;
  rating_of_prize_positions: number;
  gold_medals: number;
  silver_medals: number;
  bronze_medals: number;
  medals_count: number;
  medals_arr?: number[];
  max_medals_in_a_row?: number;
  cur_medals_in_a_row?: number;
  totalPlaces: number;
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
  sortParam: number;
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
