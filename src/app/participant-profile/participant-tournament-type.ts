import { ParticipantTournamentHistory } from '../models/participant-profile';

export type ParticipantTournamentTypeId =
  | 'la-liga'
  | 'king-cup'
  | 'champions-league'
  | 'world-cup'
  | 'euro'
  | 'club-world-cup'
  | 'summer';

export interface ParticipantTournamentType {
  id: ParticipantTournamentTypeId;
  label: string;
  code: string;
  order: number;
}

export type ParticipantSeasonFilter = number | 'all';
export type ParticipantTournamentFilter = ParticipantTournamentTypeId | 'all';

const TYPES: Record<ParticipantTournamentTypeId, ParticipantTournamentType> = {
  'la-liga': { id: 'la-liga', label: 'Ла Лига', code: 'ЛЛ', order: 0 },
  'king-cup': { id: 'king-cup', label: 'Кубок Короля', code: 'КК', order: 1 },
  'champions-league': { id: 'champions-league', label: 'Лига чемпионов', code: 'ЛЧ', order: 2 },
  'world-cup': { id: 'world-cup', label: 'Чемпионат мира', code: 'ЧМ', order: 3 },
  euro: { id: 'euro', label: 'Чемпионат Европы', code: 'ЧЕ', order: 4 },
  'club-world-cup': { id: 'club-world-cup', label: 'Клубный чемпионат мира', code: 'КЧМ', order: 5 },
  summer: { id: 'summer', label: 'Летний турнир', code: 'ЛТ', order: 6 },
};

export function getParticipantTournamentType(
  tournament: ParticipantTournamentHistory,
): ParticipantTournamentType {
  if (tournament.kind === 'la-liga') return TYPES['la-liga'];
  if (tournament.kind === 'cup') return TYPES['king-cup'];
  if (tournament.kind === 'champions-league') return TYPES['champions-league'];
  if (tournament.tournamentId.includes('club-world-cup')) return TYPES['club-world-cup'];
  if (tournament.tournamentId.includes('world-cup')) return TYPES['world-cup'];
  if (tournament.tournamentId.includes('euro')) return TYPES['euro'];
  return TYPES['summer'];
}

export function buildParticipantTournamentOptions(
  tournaments: ParticipantTournamentHistory[],
): ParticipantTournamentType[] {
  const types = new Map<ParticipantTournamentTypeId, ParticipantTournamentType>();
  tournaments.forEach(tournament => {
    const type = getParticipantTournamentType(tournament);
    types.set(type.id, type);
  });
  return Array.from(types.values()).sort((left, right) => left.order - right.order);
}

export function matchesParticipantTournamentFilters(
  tournament: ParticipantTournamentHistory,
  season: ParticipantSeasonFilter,
  type: ParticipantTournamentFilter,
): boolean {
  return (season === 'all' || tournament.yearStart === season)
    && (type === 'all' || getParticipantTournamentType(tournament).id === type);
}
