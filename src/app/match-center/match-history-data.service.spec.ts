import type { CompetitionViewModel } from '../competition/data/competition.facade';
import type { SeasonCompetitionConfig } from '../competition/models/competition.models';
import type { ArchiveCupTournament } from '../models/archive-cup';
import type { TournamentCatalogItem } from '../models/tournament-catalog';
import { buildMatchHistoryIndex } from './match-history-data.service';

describe('buildMatchHistoryIndex', () => {
  it('combines current, previous-season and 2024/25 cup matches with tour dates', () => {
    const previous = view(
      config('champions-league-2025-26', 'champions-league', 2025, 2026),
      'old-a',
      'old-b',
      '2025-09-10 20:00:00',
      60,
      50,
    );
    const current = view(
      config('la-liga-2026-27', 'spain', 2026, 2027),
      'new-a',
      'new-b',
      '2026-08-20 22:00:00',
      70,
      65,
    );

    const index = buildMatchHistoryIndex({
      participants: [
        { participantId: 'a', name: 'A', profileIds: ['old-a', 'new-a'] },
        { participantId: 'b', name: 'B', profileIds: ['old-b', 'new-b'] },
      ],
      catalog: [
        catalog('champions-league-2025-26', '2025–26', 'assets/icons/leagues/ucl.png'),
        catalog('la-liga-2026-27', '2026–27', 'assets/icons/leagues/laliga.png'),
        catalog('la-liga-cup-2024-25', '2024–25', 'assets/icons/leagues/copa.png'),
      ],
      archiveViews: [previous],
      currentViews: [current],
      archiveCup: archiveCup(),
      legacySpainSquads: squads('2024-11-22 23:00:00'),
    });

    expect(index.records.length).toBe(3);
    expect(index.records.map(record => record.tournamentId)).toEqual([
      'la-liga-cup-2024-25',
      'champions-league-2025-26',
      'la-liga-2026-27',
    ]);
    expect(index.records[0]).toEqual(jasmine.objectContaining({
      startsAt: '2024-11-22T23:00:00+03:00',
      tournamentIcon: 'assets/icons/leagues/copa.png',
      season: '2024–25',
    }));
    expect(index.participantIdByProfileId['old-a']).toBe('a');
    expect(index.participantIdByProfileId['new-a']).toBe('a');
    expect(index.seasons).toEqual(['2026–27', '2025–26', '2024–25']);
  });
});

function config(
  tournamentId: string,
  type: SeasonCompetitionConfig['type'],
  yearStart: number,
  yearEnd: number,
): SeasonCompetitionConfig {
  return {
    id: tournamentId,
    type,
    typeId: '1',
    catalogTournamentIds: [tournamentId],
    yearStart,
    yearEnd,
    squad_link: '',
    tour_link: '',
    profiles: ['old-a', 'old-b', 'new-a', 'new-b'],
    matches: { 1: [] },
    stages: [{ name: 'Общий этап', firstTour: 1, lastTour: 1, leagues: [] }],
    prizes: [],
  };
}

function view(
  sourceConfig: SeasonCompetitionConfig,
  home: string,
  away: string,
  startsAt: string,
  homeScore: number,
  awayScore: number,
): CompetitionViewModel {
  sourceConfig.matches = {
    1: [{ home, away, home_score: homeScore, away_score: awayScore, result: 1 }],
  };
  const profile = (id: string) => ({ id, team: { title: id === home ? 'A team' : 'B team' } });
  return {
    config: sourceConfig,
    squads: squads(startsAt),
    profilesDetails: [profile(home), profile(away)] as CompetitionViewModel['profilesDetails'],
    leaguesRatings: {},
    squadsDetails: [],
    playersRating: [],
    prizes: [],
    lastTour: 1,
    sportPlayersByTour: {},
  };
}

function squads(startsAt: string): CompetitionViewModel['squads'] {
  return {
    result: 1,
    data: {
      id: '1',
      title: 'Tournament',
      fantasy_tournament_name: 'Tournament',
      season: '1',
      tours: { 1: { number: '1', start: startsAt, end: startsAt } },
      players: {},
      matches: {},
    },
  };
}

function catalog(id: string, period: string, icon: string): TournamentCatalogItem {
  return {
    id,
    period,
    yearStart: Number(period.slice(0, 4)),
    kind: id.includes('-cup-') ? 'cup' : id.includes('champions') ? 'champions-league' : 'la-liga',
    theme: id.includes('-cup-') ? 'copa' : id.includes('champions') ? 'ucl' : 'laliga',
    icon,
    title: id,
    route: '/',
    status: 'completed',
  };
}

function archiveCup(): ArchiveCupTournament {
  return {
    id: 'la-liga-cup-2024-25',
    title: 'Кубок Короля 2024/25',
    period: '2024–25',
    yearStart: 2024,
    format: 'knockout',
    description: 'test',
    sourceDocument: 'test',
    championProfileId: 'old-a',
    rounds: [{
      id: 'round',
      title: '1/16 финала',
      tours: [1],
      matches: [{
        id: 'match',
        first: { profileId: 'old-a', participantName: 'A', teamName: 'A cup', logo: 'assets/a.png' },
        second: { profileId: 'old-b', participantName: 'B', teamName: 'B cup', logo: 'assets/b.png' },
        legs: [{ tour: 1, homeProfileId: 'old-a', awayProfileId: 'old-b', homeScore: 55, awayScore: 45 }],
        firstTotal: 55,
        secondTotal: 45,
        winnerProfileId: 'old-a',
      }],
    }],
  };
}
