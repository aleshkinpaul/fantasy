import { ParticipantDirectoryEntry } from '../models/participant-directory';
import { matchesPersonalizedParticipant } from './personalized-participant.directive';

describe('matchesPersonalizedParticipant', () => {
  const participant: ParticipantDirectoryEntry = {
    participantId: 'pavel-aleshkin',
    name: 'Павел Алешкин',
    profileIds: ['73116796', '1116311743'],
  };

  it('matches the canonical participant id', () => {
    expect(matchesPersonalizedParticipant(participant, 'pavel-aleshkin')).toBeTrue();
  });

  it('matches any historical profile id', () => {
    expect(matchesPersonalizedParticipant(participant, '73116796')).toBeTrue();
    expect(matchesPersonalizedParticipant(participant, 1116311743)).toBeTrue();
  });

  it('matches a selected member inside a team', () => {
    expect(matchesPersonalizedParticipant(participant, ['other', '1116311743'])).toBeTrue();
  });

  it('does not match guest state, missing values, or another participant', () => {
    expect(matchesPersonalizedParticipant(null, '73116796')).toBeFalse();
    expect(matchesPersonalizedParticipant(participant, [null, undefined, ''])).toBeFalse();
    expect(matchesPersonalizedParticipant(participant, 'other')).toBeFalse();
  });
});
