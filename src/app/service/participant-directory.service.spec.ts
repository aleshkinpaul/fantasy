import { ParticipantDirectoryEntry } from '../models/participant-directory';
import {
  formatParticipantNameSurnameFirst,
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

  it('places current-season participants before historical participants', () => {
    const participants: ParticipantDirectoryEntry[] = [
      { ...participant('active', 'Яков Яшин'), isActive: true },
      participant('historical', 'Андрей Алексеев'),
    ];

    expect(sortParticipantsBySurname(participants).map(item => item.participantId))
      .toEqual(['active', 'historical']);
  });

  it('formats a participant name with the surname first', () => {
    expect(formatParticipantNameSurnameFirst('Павел Алешкин')).toBe('Алешкин Павел');
    expect(formatParticipantNameSurnameFirst('Мадонна')).toBe('Мадонна');
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

  it('keeps personalization logo and current-season marker', () => {
    const registry = validateParticipantDirectory({
      version: 1,
      participants: [{
        ...participant('pavel', 'Павел Алешкин', '73116796'),
        logo: 'assets/logos/ducks.png',
        isActive: true,
      }],
    });

    expect(registry.participants[0]).toEqual(jasmine.objectContaining({
      logo: 'assets/logos/ducks.png',
      isActive: true,
    }));
  });
});

function participant(
  participantId: string,
  name: string,
  profileId = participantId,
): ParticipantDirectoryEntry {
  return { participantId, name, profileIds: [profileId] };
}
