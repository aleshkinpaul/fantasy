import { SponsorPrizeWinnersRegistry } from '../models/participant-profile';
import { SeasonCompetitionConfig } from '../competition/models/competition.models';
import { TournamentTimelineGroup, TournamentTimelineItem } from '../models/tournament-catalog';
import { buildSponsorPrizeVictorySources, resolveSeasonStageResult } from './participant-profile.service';

describe('buildSponsorPrizeVictorySources', () => {
  it('loads explicitly recorded victories from completed archive tournaments', () => {
    const registry: SponsorPrizeWinnersRegistry = {
      version: 2,
      tournaments: {},
      archiveVictories: [{
        id: 'archive-prize',
        prizeId: 24001,
        tournamentId: 'archive',
        profileId: 'winner',
        name: 'Архивный приз',
        author: 'Организаторы',
        condition: 'Историческое условие',
        result: 33,
        winnerTeamName: 'Команда сезона',
      }],
    };

    const [victory] = buildSponsorPrizeVictorySources(registry, timeline(), []);

    expect(victory).toEqual(jasmine.objectContaining({
      id: 'archive-prize',
      profileId: 'winner',
      tournamentTitle: 'Архивный турнир',
      period: '2024–25',
      result: 33,
      winnerTeamName: 'Команда сезона',
      icon: 'assets/icons/prizes/medal.png',
      route: '/archive?year=2024&tabId=3',
    }));
  });
});

describe('resolveSeasonStageResult', () => {
  const config = {
    cup: {
      matchesTours: [9, 10, 11],
      matchesToursNames: ['1/16.1', '1/16.2', '1/8.1'],
      matches: [
        [{ home: 'player', away: 'one' }],
        [{ home: 'one', away: 'player' }],
        [{ home: 'player', away: 'two' }],
      ],
    },
  } as SeasonCompetitionConfig;

  it('returns the furthest knockout stage reached by a Champions League participant', () => {
    expect(resolveSeasonStageResult(config, 'champions-league-2025-26', 'player'))
      .toEqual({ label: '1/8', rank: 30 });
  });

  it('uses the league stage when the participant has not reached the playoffs', () => {
    expect(resolveSeasonStageResult(config, 'champions-league-2025-26', 'group-only'))
      .toEqual({ label: 'Общий этап', rank: 10 });
  });
});

function timeline(): TournamentTimelineGroup[] {
  const tournament: TournamentTimelineItem = {
    id: 'archive',
    period: '2024–25',
    yearStart: 2024,
    kind: 'la-liga',
    kindLabel: 'Ла Лига',
    shortLabel: 'ЛЛ',
    theme: 'laliga',
    icon: 'assets/icons/leagues/laliga.png',
    title: 'Архивный турнир',
    route: '/archive?year=2024',
    status: 'completed',
    statusLabel: 'Завершён',
    isArchive: true,
  };
  return [{ period: tournament.period, yearStart: tournament.yearStart, tournaments: [tournament] }];
}
