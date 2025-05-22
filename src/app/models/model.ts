export interface ISquad {
  id: string,
  name: string,
  score: number,
  user: IUser,
  seasonScoreInfo: ISeasonScoreInfo,
  leagues: [ILeagueDetails]
}

export interface ISeasonScoreInfo {
  place: string,
  score: number,
  totalPlaces: number
}

export interface ILeagueDetails {
  league: ILeague,
  place: string,
  totalPlaces: number,
  placeDiff?: number,
  topPercent?: string
}

export interface ILeague {
  id: string,
  name: string
}

export interface IUser {
  id: string,
  nick: string,
  url: string,
  firstName: string,
  middleName: string,
  lastName: string
}

export interface IProfile {
  id: string,
  name: string,
  nick: string,
  url: string,
  logo: string
}

export interface IConsts {
  league?: IConstLeague
}

export interface IConstLeague {
  id: string,
  type: string,
  typeId: string,
  yearStart: number,
  yearEnd: number,
  tours: ITour[]
}

export interface ITour {
  id: string,
  name: string
}

export interface IPlayers {
  points?: number,
  transfers_count?: number,
  team_title?: string,
  name?: string,
  team_id?: string,
  total_place?: number,
  squads?: []
}
