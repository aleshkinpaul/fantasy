export type TournamentKind = 'la-liga' | 'cup' | 'champions-league' | 'summer';

export type TournamentStatus = 'scheduled' | 'active' | 'completed';

export interface TournamentCatalogItem {
  id: string;
  period: string;
  yearStart: number;
  kind: TournamentKind;
  title: string;
  route: string;
  status: TournamentStatus;
  description?: string;
}

export interface TournamentTimelineItem extends TournamentCatalogItem {
  kindLabel: string;
  shortLabel: string;
  statusLabel: string;
  isArchive: boolean;
}

export interface TournamentTimelineGroup {
  period: string;
  yearStart: number;
  tournaments: TournamentTimelineItem[];
}
