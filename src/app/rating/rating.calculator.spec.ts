import { ParticipantProfile, ParticipantTournamentHistory } from '../models/participant-profile';
import { TournamentStatus, TournamentTimelineGroup, TournamentTimelineItem } from '../models/tournament-catalog';
import { calculatePowerRating } from './rating.calculator';

describe('calculatePowerRating', () => {
  it('gives the official result more weight than the fantasy-points rank', () => {
    const tournament = makeTournament('league-2025', 2025, 'completed');
    const profiles = [
      makeProfile('winner', 'Победитель', [makeHistory(tournament, 90, 1)]),
      makeProfile('score-leader', 'Лидер по ФО', [makeHistory(tournament, 100, 2)]),
    ];

    const rating = calculatePowerRating(profiles, makeTimeline(tournament), true);

    expect(rating.rows.map(row => row.participantId)).toEqual(['winner', 'score-leader']);
    expect(rating.rows[0].rating).toBe(6);
    expect(rating.rows[1].rating).toBe(4);
  });

  it('keeps live columns visible but removes their contribution when live is disabled', () => {
    const completed = makeTournament('league-2025', 2025, 'completed');
    const active = makeTournament('league-2026', 2026, 'active');
    const profiles = [
      makeProfile('past-winner', 'Победитель прошлого сезона', [
        makeHistory(completed, 100, 1),
        makeHistory(active, 10, 2),
      ]),
      makeProfile('live-leader', 'Лидер live', [
        makeHistory(completed, 90, 2),
        makeHistory(active, 20, 1),
      ]),
    ];
    const timeline = makeTimeline(active, completed);

    const withLive = calculatePowerRating(profiles, timeline, true);
    const withoutLive = calculatePowerRating(profiles, timeline, false);

    expect(withLive.rows[0].participantId).toBe('live-leader');
    expect(withLive.rows.every(row => row.consistencyBonus === 0.4)).toBeTrue();
    expect(withoutLive.rows[0].participantId).toBe('past-winner');
    expect(withoutLive.columns.find(column => column.id === active.id)?.included).toBeFalse();
    expect(withoutLive.columns.find(column => column.id === active.id)?.isLive).toBeTrue();
    expect(withoutLive.rows.find(row => row.participantId === 'past-winner')?.rating).toBe(10);
  });

  it('uses decreasing season weights with a floor of 0.5', () => {
    const tournaments = Array.from({ length: 7 }, (_, index) =>
      makeTournament(`league-${2020 + index}`, 2020 + index, 'completed'));
    const profile = makeProfile('regular', 'Постоянный участник', tournaments.map(tournament =>
      makeHistory(tournament, 100, 1)));

    const rating = calculatePowerRating([profile], makeTimeline(...tournaments), true);

    expect(rating.columns.map(column => column.seasonWeight)).toEqual([1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.5]);
    expect(rating.rows[0].consistencyBonus).toBe(0.4);
  });
});

function makeTimeline(...tournaments: TournamentTimelineItem[]): TournamentTimelineGroup[] {
  const groups = new Map<number, TournamentTimelineGroup>();
  tournaments.forEach(tournament => {
    const group = groups.get(tournament.yearStart) ?? {
      period: tournament.period,
      yearStart: tournament.yearStart,
      tournaments: [],
    };
    group.tournaments.push(tournament);
    groups.set(tournament.yearStart, group);
  });
  return Array.from(groups.values());
}

function makeTournament(id: string, yearStart: number, status: TournamentStatus): TournamentTimelineItem {
  return {
    id,
    period: `${yearStart}–${String(yearStart + 1).slice(-2)}`,
    yearStart,
    kind: 'la-liga',
    kindLabel: 'Ла Лига',
    shortLabel: 'ЛЛ',
    title: `Ла Лига ${yearStart}`,
    route: `/retro/${id}`,
    status,
    statusLabel: status,
    isArchive: status === 'completed',
  };
}

function makeHistory(
  tournament: TournamentTimelineItem,
  totalScore: number,
  place: number,
): ParticipantTournamentHistory {
  return {
    tournamentId: tournament.id,
    title: tournament.title,
    period: tournament.period,
    yearStart: tournament.yearStart,
    kind: tournament.kind,
    kindLabel: tournament.kindLabel,
    route: tournament.route,
    status: tournament.status,
    statusLabel: tournament.statusLabel,
    profileId: tournament.id,
    includeInTeamHistory: true,
    coverage: 'full',
    achievements: [],
    stats: {
      place,
      totalScore,
      averageScore: totalScore,
      maxScore: totalScore,
      minScore: totalScore,
      toursPlayed: 1,
    },
  };
}

function makeProfile(
  participantId: string,
  name: string,
  tournaments: ParticipantTournamentHistory[],
): ParticipantProfile {
  return {
    participantId,
    name,
    primaryProfileId: participantId,
    profileIds: [participantId],
    accounts: [],
    currentTeam: tournaments.at(-1),
    teamVersions: [],
    tournaments,
    summary: {
      tournaments: tournaments.length,
      completedTournaments: tournaments.filter(tournament => tournament.status === 'completed').length,
      championships: 0,
      podiums: 0,
      knownTotalScore: tournaments.reduce((sum, tournament) => sum + (tournament.stats?.totalScore ?? 0), 0),
      scoredTournaments: tournaments.length,
    },
  };
}
