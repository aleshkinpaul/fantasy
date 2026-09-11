import { AchievementRegistry } from '../models/achievement';
import { ParticipantHistorySource } from '../models/participant-profile';
import { TournamentTimelineGroup, TournamentTimelineItem } from '../models/tournament-catalog';
import { buildParticipantProfiles } from './participant-profile.builder';

describe('participant profile builder', () => {
  it('merges several external accounts into one participant history', () => {
    const profiles = buildParticipantProfiles(registry(), timeline(), [
      source('old-account', 'old', 'retro', 5, 100),
      source('new-account', 'new', 'current')
    ]);

    expect(profiles.length).toBe(1);
    expect(profiles[0].participantId).toBe('person');
    expect(profiles[0].profileIds).toEqual(['old-account', 'new-account']);
    expect(profiles[0].primaryProfileId).toBe('new-account');
    expect(profiles[0].tournaments.map(item => item.tournamentId)).toEqual(['current', 'retro']);
  });

  it('keeps missing historical metrics unknown instead of turning them into zeroes', () => {
    const [profile] = buildParticipantProfiles(registry(), timeline(), [
      source('old-account', 'old', 'retro', 5, 100),
      source('new-account', 'new', 'current')
    ]);

    expect(profile.summary.knownTotalScore).toBe(100);
    expect(profile.summary.scoredTournaments).toBe(1);
    expect(profile.tournaments.find(item => item.tournamentId === 'current')?.stats).toBeUndefined();
  });

  it('keeps Sports.ru account and fantasy-team links for each tournament', () => {
    const current = {
      ...source('new-account', 'new', 'current'),
      profileUrl: 'https://www.sports.ru/profile/new-account/',
      profileNick: 'nickname',
      profileTelegram: '@nickname',
      teamUrl: 'https://www.sports.ru/fantasy/football/spain/team-id',
    };
    const [profile] = buildParticipantProfiles(registry(), timeline(), [current]);

    expect(profile.accounts.find(account => account.profileId === 'new-account')).toEqual(jasmine.objectContaining({
      nick: 'nickname',
      telegram: '@nickname',
      url: 'https://www.sports.ru/profile/new-account/',
    }));
    expect(profile.tournaments[0].teamUrl)
      .toBe('https://www.sports.ru/fantasy/football/spain/team-id');
  });

  it('groups team history by season and logo while ignoring name casing', () => {
    const history = timeline();
    history[0].tournaments.push(
      tournament('current-cup', 2025, 'completed', 'cup'),
      tournament('current-ucl', 2025, 'completed', 'champions-league'),
      tournament('world-cup-2026', 2025, 'completed', 'summer'),
    );
    const [profile] = buildParticipantProfiles(registry(), history, [
      source('new-account', 'DUCKS', 'current'),
      source('old-account', 'ducks', 'current-cup'),
      source('old-account', 'ducks', 'current-ucl'),
      { ...source('old-account', 'Ducks', 'world-cup-2026'), logo: 'assets/germany.png' },
      source('old-account', 'ducks', 'retro'),
    ]);

    expect(profile.teamVersions.length).toBe(3);
    expect(profile.teamVersions[0]).toEqual(jasmine.objectContaining({
      teamName: 'ducks',
      tournaments: 3,
      tournamentCodes: ['ЛЛ', 'КК', 'ЛЧ'],
      lastPeriod: '2025',
      logo: 'assets/DUCKS.png',
    }));
    expect(profile.teamVersions[1]).toEqual(jasmine.objectContaining({
      teamName: 'ducks',
      tournaments: 1,
      tournamentCodes: ['ЧМ'],
      lastPeriod: '2025',
      logo: 'assets/germany.png',
    }));
    expect(profile.teamVersions[2]).toEqual(jasmine.objectContaining({
      teamName: 'ducks',
      tournaments: 1,
      tournamentCodes: ['ЛЛ'],
      lastPeriod: '2023',
      logo: 'assets/ducks.png',
    }));
  });

  it('does not merge accounts by name without an explicit alias', () => {
    const profiles = buildParticipantProfiles({ version: 1, participants: [], placements: [] }, timeline(), [
      source('first-id', 'first', 'retro'),
      source('second-id', 'second', 'current')
    ]);

    expect(profiles.length).toBe(2);
    expect(profiles.map(profile => profile.participantId)).toContain('profile-first-id');
    expect(profiles.map(profile => profile.participantId)).toContain('profile-second-id');
  });

  it('keeps collective tournament participation out of personal team history', () => {
    const [profile] = buildParticipantProfiles(registry(), timeline(), [
      source('new-account', 'ducks', 'current'),
      { ...source('old-account', 'Collective team', 'retro'), includeInTeamHistory: false },
    ]);

    expect(profile.tournaments.map(item => item.tournamentId)).toContain('retro');
    expect(profile.teamVersions.map(item => item.teamName)).toEqual(['ducks']);
  });

  it('adds individual and team achievements to the participant', () => {
    const value = registry();
    value.placements = [{
      tournamentId: 'retro',
      stageId: 'final',
      stageTitle: 'Финал',
      titleType: 'la-liga-primera',
      place: 1,
      recipient: {
        id: 'winner',
        type: 'participant',
        label: 'Old Team',
        logo: 'assets/old.png',
        members: [{ participantId: 'person', profileId: 'old-account' }]
      }
    }];

    const [profile] = buildParticipantProfiles(value, timeline(), [source('old-account', 'old', 'retro', 1, 120)]);

    expect(profile.summary.championships).toBe(1);
    expect(profile.summary.podiums).toBe(1);
    expect(profile.tournaments[0].achievements[0].stageTitle).toBe('Финал');
  });
});

function registry(): AchievementRegistry {
  return {
    version: 1,
    participants: [{ id: 'person', name: 'One Person', profileIds: ['old-account', 'new-account'] }],
    placements: []
  };
}

function timeline(): TournamentTimelineGroup[] {
  return [{ period: '2025–26', yearStart: 2025, tournaments: [
    tournament('current', 2025, 'active'),
    tournament('retro', 2023, 'completed')
  ] }];
}

function tournament(
  id: string,
  yearStart: number,
  status: 'active' | 'completed',
  kind: TournamentTimelineItem['kind'] = 'la-liga',
): TournamentTimelineItem {
  const labels = {
    'la-liga': { long: 'Ла Лига', short: 'ЛЛ' },
    cup: { long: 'Кубок', short: 'КК' },
    'champions-league': { long: 'Лига чемпионов', short: 'ЛЧ' },
    summer: { long: 'Летний турнир', short: 'ЛТ' },
  }[kind];
  return {
    id,
    period: `${yearStart}`,
    yearStart,
    kind,
    title: id,
    route: `/${id}`,
    status,
    kindLabel: labels.long,
    shortLabel: labels.short,
    statusLabel: status,
    isArchive: status === 'completed'
  };
}

function source(
  profileId: string,
  teamName: string,
  tournamentId: string,
  place?: number,
  totalScore?: number
): ParticipantHistorySource {
  return {
    tournamentId,
    profileId,
    participantName: 'One Person',
    teamName,
    logo: `assets/${teamName}.png`,
    ...(place && totalScore ? {
      stats: { place, totalScore, averageScore: 50, maxScore: 60, minScore: 40, toursPlayed: 2 }
    } : {})
  };
}
