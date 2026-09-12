import { AchievementRegistry } from '../models/achievement';
import { TournamentTimelineGroup, TournamentTimelineItem } from '../models/tournament-catalog';
import { buildHallOfFame, validateAchievementRegistry } from './achievement.service';

describe('AchievementService domain', () => {
  it('supports joint bronze places and credits team achievements to every member', () => {
    const hall = buildHallOfFame(registry(), timeline());

    expect(hall.summary).toEqual({
      competitions: 2,
      champions: 2,
      podiumEntries: 7,
      participants: 5
    });
    expect(hall.currentChampions.map(champion => champion.titleType)).toEqual([
      'champions-league',
      'club-world-cup'
    ]);
    expect(hall.seasons[0].tournaments[0].stages[0].placements.filter(item => item.place === 3).length)
      .toBe(2);

    const leader = hall.leaders.find(item => item.participantId === 'a');
    expect(leader).toEqual({
      participantId: 'a',
      name: 'Participant A',
      championships: 2,
      finals: 2,
      podiums: 2,
      trophies: [
        {
          id: 'ucl-play-off-a',
          titleType: 'champions-league',
          label: 'Лига чемпионов',
          icon: 'assets/icons/trophies/champions-league.png'
        },
        {
          id: 'team-cup-team-play-off-a',
          titleType: 'club-world-cup',
          label: 'Клубный чемпионат мира',
          icon: 'assets/icons/trophies/club-world-cup.png'
        }
      ]
    });
  });

  it('rejects a profile assigned to multiple canonical participants', () => {
    const value = registry();
    value.participants[1].profileIds = ['1'];

    expect(() => validateAchievementRegistry(value, tournaments()))
      .toThrowError(/belongs to both/);
  });

  it('rejects placements for unfinished tournaments', () => {
    const items = tournaments();
    items[0] = { ...items[0], status: 'active', isArchive: false };

    expect(() => validateAchievementRegistry(registry(), items))
      .toThrowError(/unfinished tournament/);
  });

  it('requires every completed catalog tournament to be represented', () => {
    const value = registry();
    value.placements = value.placements.filter(placement => placement.tournamentId !== 'team-cup');

    expect(() => validateAchievementRegistry(value, tournaments()))
      .toThrowError(/no placements.*team-cup/);
  });
});

function registry(): AchievementRegistry {
  return {
    version: 1,
    participants: ['a', 'b', 'c', 'd', 'e'].map((id, index) => ({
      id,
      name: `Participant ${id.toUpperCase()}`,
      profileIds: [`${index + 1}`]
    })),
    placements: [
      placement('ucl', 1, 'a', '1'),
      placement('ucl', 2, 'b', '2'),
      placement('ucl', 3, 'c', '3'),
      placement('ucl', 3, 'd', '4'),
      teamPlacement(1, ['a', 'e'], ['1', '5']),
      teamPlacement(2, ['b'], ['2']),
      teamPlacement(3, ['c'], ['3'])
    ]
  };
}

function placement(
  tournamentId: string,
  place: 1 | 2 | 3,
  participantId: string,
  profileId: string
) {
  return {
    tournamentId,
    stageId: 'play-off',
    stageTitle: 'Play-off',
    titleType: 'champions-league' as const,
    place,
    recipient: {
      id: `${tournamentId}-${place}-${participantId}`,
      type: 'participant' as const,
      label: `Team ${participantId}`,
      logo: 'assets/logo.png',
      members: [{ participantId, profileId }]
    }
  };
}

function teamPlacement(place: 1 | 2 | 3, participantIds: string[], profileIds: string[]) {
  return {
    tournamentId: 'team-cup',
    stageId: 'team-play-off',
    stageTitle: 'Team play-off',
    titleType: 'club-world-cup' as const,
    place,
    recipient: {
      id: `team-${place}`,
      type: 'team' as const,
      label: `Team ${place}`,
      logo: 'assets/team.png',
      members: participantIds.map((participantId, index) => ({ participantId, profileId: profileIds[index] }))
    }
  };
}

function timeline(): TournamentTimelineGroup[] {
  return [{ period: '2025–26', yearStart: 2025, tournaments: tournaments() }];
}

function tournaments(): TournamentTimelineItem[] {
  return [
    tournament({ id: 'ucl', kind: 'champions-league', title: 'UCL' }),
    tournament({ id: 'team-cup', kind: 'summer', title: 'Team cup' })
  ];
}

function tournament(overrides: Partial<TournamentTimelineItem>): TournamentTimelineItem {
  return {
    id: 'tournament',
    period: '2025–26',
    yearStart: 2025,
    kind: 'la-liga',
    theme: 'laliga',
    icon: 'assets/icons/leagues/laliga.png',
    title: 'Tournament',
    route: '/tournament',
    status: 'completed',
    kindLabel: 'Tournament',
    shortLabel: 'T',
    statusLabel: 'Completed',
    isArchive: true,
    ...overrides
  };
}
