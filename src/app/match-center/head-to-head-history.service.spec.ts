import { CompetitionMatch, CompetitionStage } from '../competition/models/competition.models';
import { HeadToHeadHistoryService } from './head-to-head-history.service';

describe('HeadToHeadHistoryService', () => {
  const service = new HeadToHeadHistoryService();
  const stages: CompetitionStage[] = [
    { name: 'Апертура', firstTour: 1, lastTour: 2, leagues: [] },
    { name: 'Клаусура', firstTour: 3, lastTour: 4, leagues: [] },
  ];

  it('aggregates meetings in both home/away orientations before the target tour', () => {
    const history = service.calculate({
      firstProfileId: 'a',
      secondProfileId: 'b',
      targetTour: 5,
      stages,
      matchesByTour: {
        1: [match('a', 'b', 80, 60, 1)],
        2: [match('b', 'a', 70, 70, 0)],
        3: [match('b', 'a', 90, 50, 1)],
        5: [match('a', 'b', 500, 0, 1)],
      },
    });

    expect(history.matches).toBe(3);
    expect([history.firstWins, history.draws, history.secondWins]).toEqual([1, 1, 1]);
    expect([history.firstTotalScore, history.secondTotalScore]).toEqual([200, 220]);
    expect(history.recentMeetings.map(meeting => meeting.tour)).toEqual([3, 2, 1]);
    expect(history.biggestWin?.tour).toBe(3);
    expect(history.stages).toEqual([
      jasmine.objectContaining({ stage: 'Апертура', matches: 2 }),
      jasmine.objectContaining({ stage: 'Клаусура', matches: 1 }),
    ]);
  });

  it('returns an empty summary for teams that have not met', () => {
    const history = service.calculate({
      firstProfileId: 'a',
      secondProfileId: 'b',
      targetTour: 2,
      matchesByTour: { 1: [match('a', 'c', 80, 60, 1)] },
    });

    expect(history.matches).toBe(0);
    expect(history.biggestWin).toBeUndefined();
    expect(history.recentMeetings).toEqual([]);
  });

  it('joins changed profile ids through participant identity and orders all tournaments by date', () => {
    const history = service.calculate({
      firstProfileId: 'a-new',
      secondProfileId: 'b-new',
      targetTour: 3,
      targetStartsAt: '2026-09-20 20:00:00',
      matchesByTour: {},
      historyIndex: {
        participantIdByProfileId: {
          'a-old': 'participant-a',
          'a-new': 'participant-a',
          'b-old': 'participant-b',
          'b-new': 'participant-b',
        },
        seasons: ['2026–27', '2025–26'],
        records: [
          historicalMatch('ucl-old', '2025-10-01T20:00:00+03:00', 'a-old', 'b-old', 60, 50, '2025–26'),
          historicalMatch('laliga-new', '2026-09-01T22:00:00+03:00', 'b-new', 'a-new', 70, 75, '2026–27'),
          historicalMatch('future', '2026-10-01T20:00:00+03:00', 'a-new', 'b-new', 500, 0, '2026–27'),
        ],
      },
    });

    expect(history.matches).toBe(2);
    expect(history.firstWins).toBe(2);
    expect(history.recentMeetings.map(meeting => meeting.id)).toEqual(['laliga-new', 'ucl-old']);
    expect(history.recentMeetings[0]).toEqual(jasmine.objectContaining({
      tournamentIcon: 'assets/icons/leagues/ucl.png',
      season: '2026–27',
      firstTeamTitle: 'A team',
      secondTeamTitle: 'B team',
    }));
  });
});

function match(
  home: string,
  away: string,
  homeScore: number,
  awayScore: number,
  result: 0 | 1 | 2,
): CompetitionMatch {
  return { home, away, home_score: homeScore, away_score: awayScore, result };
}

function historicalMatch(
  id: string,
  startsAt: string,
  homeProfileId: string,
  awayProfileId: string,
  homeScore: number,
  awayScore: number,
  season: string,
) {
  const participant = (profileId: string) => profileId.startsWith('a-') ? 'participant-a' : 'participant-b';
  const teamTitle = (profileId: string) => profileId.startsWith('a-') ? 'A team' : 'B team';
  return {
    id,
    tournamentId: id,
    tournamentTitle: id,
    tournamentIcon: 'assets/icons/leagues/ucl.png',
    season,
    stage: 'Общий этап',
    tour: 1,
    startsAt,
    startsAtTimestamp: Date.parse(startsAt),
    home: {
      participantId: participant(homeProfileId),
      profileId: homeProfileId,
      teamTitle: teamTitle(homeProfileId),
      logo: 'assets/home.png',
    },
    away: {
      participantId: participant(awayProfileId),
      profileId: awayProfileId,
      teamTitle: teamTitle(awayProfileId),
      logo: 'assets/away.png',
    },
    homeScore,
    awayScore,
    result: homeScore === awayScore ? 0 as const : homeScore > awayScore ? 1 as const : 2 as const,
  };
}
