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

  it('does not merge accounts by name without an explicit alias', () => {
    const profiles = buildParticipantProfiles({ version: 1, participants: [], placements: [] }, timeline(), [
      source('first-id', 'first', 'retro'),
      source('second-id', 'second', 'current')
    ]);

    expect(profiles.length).toBe(2);
    expect(profiles.map(profile => profile.participantId)).toContain('profile-first-id');
    expect(profiles.map(profile => profile.participantId)).toContain('profile-second-id');
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

function tournament(id: string, yearStart: number, status: 'active' | 'completed'): TournamentTimelineItem {
  return {
    id,
    period: `${yearStart}`,
    yearStart,
    kind: 'la-liga',
    title: id,
    route: `/${id}`,
    status,
    kindLabel: 'Ла Лига',
    shortLabel: 'ЛЛ',
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
