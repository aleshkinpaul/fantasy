import { ParticipantTournamentHistory } from '../models/participant-profile';
import { TournamentKind } from '../models/tournament-catalog';
import {
  buildParticipantSeasonGroups,
  participantTournamentTopDownOrder,
} from './participant-profile-timeline';

describe('participant profile timeline', () => {
  it('shows summer, Champions League, cup and La Liga from top to bottom', () => {
    const groups = buildParticipantSeasonGroups([
      tournament('league', 'la-liga'),
      tournament('cup', 'cup'),
      tournament('ucl', 'champions-league'),
      tournament('summer', 'summer'),
    ]);

    expect(groups[0].tournaments.map(item => item.kind)).toEqual([
      'summer',
      'champions-league',
      'cup',
      'la-liga',
    ]);
    expect(groups[0].tournaments.map(participantTournamentTopDownOrder)).toEqual([0, 1, 2, 3]);
  });
});

function tournament(tournamentId: string, kind: TournamentKind): ParticipantTournamentHistory {
  return {
    tournamentId,
    title: tournamentId,
    period: '2025–26',
    yearStart: 2025,
    kind,
    kindLabel: tournamentId,
    route: `/${tournamentId}`,
    status: 'completed',
    statusLabel: 'Завершён',
    profileId: '1',
    includeInTeamHistory: true,
    coverage: 'identity',
    achievements: [],
  };
}
