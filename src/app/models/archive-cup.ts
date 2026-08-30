export interface ArchiveCupRegistry {
  version: 1;
  tournaments: ArchiveCupTournament[];
}

export interface ArchiveCupTournament {
  id: string;
  title: string;
  period: string;
  yearStart: number;
  format: 'knockout';
  description: string;
  sourceDocument: string;
  championProfileId: string;
  rounds: ArchiveCupRound[];
}

export interface ArchiveCupRound {
  id: string;
  title: string;
  tours: number[];
  matches: ArchiveCupMatch[];
}

export interface ArchiveCupTeam {
  profileId: string;
  participantName: string;
  teamName: string;
  logo: string;
}

export interface ArchiveCupLeg {
  tour: number;
  homeProfileId: string;
  awayProfileId: string;
  homeScore: number;
  awayScore: number;
}

export interface ArchiveCupMatch {
  id: string;
  first: ArchiveCupTeam;
  second: ArchiveCupTeam;
  legs: ArchiveCupLeg[];
  firstTotal: number;
  secondTotal: number;
  winnerProfileId: string;
}
