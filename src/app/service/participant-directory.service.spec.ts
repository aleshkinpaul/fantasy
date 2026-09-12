import { ParticipantDirectoryEntry } from '../models/participant-directory';
import {
  participantSurname,
  sortParticipantsBySurname,
  validateParticipantDirectory,
} from './participant-directory.service';

describe('participant directory', () => {
  it('sorts participants by surname and then by full name', () => {
    const participants: ParticipantDirectoryEntry[] = [
      participant('veronika', 'Вероника Вуйченко'),
      participant('ramiz', 'Рамиз Алиев'),
      participant('pavel', 'Павел Алешкин'),
    ];

    expect(sortParticipantsBySurname(participants).map(item => item.participantId))
      .toEqual(['pavel', 'ramiz', 'veronika']);
    expect(participantSurname('Павел Алешкин')).toBe('Алешкин');
  });

  it('rejects a profile id assigned to several participants', () => {
    const registry = {
      version: 1,
      participants: [
        participant('first', 'Первый Участник', 'shared'),
        participant('second', 'Второй Участник', 'shared'),
      ],
    };

    expect(() => validateParticipantDirectory(registry)).toThrowError('Duplicate profileId "shared"');
  });

  it('returns a validated versioned registry', () => {
    const registry = validateParticipantDirectory({
      version: 1,
      participants: [participant('pavel', 'Павел Алешкин', '73116796')],
    });

    expect(registry.participants[0]).toEqual({
      participantId: 'pavel',
      name: 'Павел Алешкин',
      profileIds: ['73116796'],
    });
  });
});

function participant(
  participantId: string,
  name: string,
  profileId = participantId,
): ParticipantDirectoryEntry {
  return { participantId, name, profileIds: [profileId] };
}
