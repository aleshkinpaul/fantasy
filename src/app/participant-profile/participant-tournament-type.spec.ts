import { ParticipantTournamentHistory } from '../models/participant-profile';
import {
  buildParticipantTournamentOptions,
  getParticipantTournamentType,
  matchesParticipantTournamentFilters,
} from './participant-tournament-type';

describe('participant tournament type filters', () => {
  const laLiga2025 = tournament('la-liga-2025-26', 2025, 'la-liga');
  const laLiga2026 = tournament('la-liga-2026-27', 2026, 'la-liga');
  const championsLeague2026 = tournament('champions-league-2026-27', 2026, 'champions-league');

  it('builds tournament options by type without season suffixes or duplicates', () => {
    const options = buildParticipantTournamentOptions([
      laLiga2025,
      laLiga2026,
      championsLeague2026,
    ]);

    expect(options.map(option => ({ id: option.id, label: option.label }))).toEqual([
      { id: 'la-liga', label: 'Ла Лига' },
      { id: 'champions-league', label: 'Лига чемпионов' },
    ]);
  });

  it('combines season and tournament type as independent filters', () => {
    expect(matchesParticipantTournamentFilters(laLiga2026, 2026, 'la-liga')).toBeTrue();
    expect(matchesParticipantTournamentFilters(laLiga2025, 2026, 'la-liga')).toBeFalse();
    expect(matchesParticipantTournamentFilters(championsLeague2026, 2026, 'la-liga')).toBeFalse();
  });

  it('selects the same tournament type across every season', () => {
    expect([laLiga2025, laLiga2026, championsLeague2026]
      .filter(item => matchesParticipantTournamentFilters(item, 'all', 'la-liga')))
      .toEqual([laLiga2025, laLiga2026]);
  });

  it('distinguishes every summer tournament type', () => {
    expect(getParticipantTournamentType(tournament('world-cup-2026', 2025, 'summer')).id).toBe('world-cup');
    expect(getParticipantTournamentType(tournament('euro-2024', 2023, 'summer')).id).toBe('euro');
    expect(getParticipantTournamentType(tournament('club-world-cup-2025', 2024, 'summer')).id)
      .toBe('club-world-cup');
  });
});

function tournament(
  tournamentId: string,
  yearStart: number,
  kind: ParticipantTournamentHistory['kind'],
): ParticipantTournamentHistory {
  return {
    tournamentId,
    title: tournamentId,
    period: String(yearStart),
    yearStart,
    kind,
    kindLabel: tournamentId,
    route: `/${tournamentId}`,
    status: 'completed',
    statusLabel: 'Завершён',
    profileId: 'profile',
    includeInTeamHistory: true,
    coverage: 'identity',
    achievements: [],
  };
}
