import { of, throwError } from 'rxjs';

import { ParticipantDirectoryEntry } from '../models/participant-directory';
import { ParticipantDirectoryService } from './participant-directory.service';
import {
  PERSONALIZATION_STORAGE_KEY,
  PersonalizationService,
} from './personalization.service';

describe('PersonalizationService', () => {
  const participants: ParticipantDirectoryEntry[] = [
    { participantId: 'pavel-aleshkin', name: 'Павел Алешкин', profileIds: ['73116796'] },
    { participantId: 'ramiz-aliev', name: 'Рамиз Алиев', profileIds: ['100'] },
  ];

  it('opens the picker when no preference is stored', () => {
    const service = createService(new MemoryStorage());

    expect(service.snapshot.mode).toBe('unselected');
    expect(service.snapshot.pickerOpen).toBeTrue();
    expect(service.snapshot.participants).toEqual(participants);
  });

  it('restores a known participant', () => {
    const storage = new MemoryStorage();
    storage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify({
      version: 1,
      choice: 'participant',
      participantId: 'pavel-aleshkin',
    }));

    const service = createService(storage);

    expect(service.snapshot.mode).toBe('participant');
    expect(service.snapshot.selectedParticipant?.participantId).toBe('pavel-aleshkin');
    expect(service.snapshot.pickerOpen).toBeFalse();
  });

  it('restores the persisted guest choice', () => {
    const storage = new MemoryStorage();
    storage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify({ version: 1, choice: 'guest' }));

    const service = createService(storage);

    expect(service.snapshot.mode).toBe('guest');
    expect(service.snapshot.pickerOpen).toBeFalse();
  });

  it('removes a stale participant id and asks again', () => {
    const storage = new MemoryStorage();
    storage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify({
      version: 1,
      choice: 'participant',
      participantId: 'missing',
    }));

    const service = createService(storage);

    expect(service.snapshot.mode).toBe('unselected');
    expect(service.snapshot.pickerOpen).toBeTrue();
    expect(storage.getItem(PERSONALIZATION_STORAGE_KEY)).toBeNull();
  });

  it('persists a participant selection', () => {
    const storage = new MemoryStorage();
    const service = createService(storage);

    service.selectParticipant('ramiz-aliev');

    expect(service.snapshot.selectedParticipant?.name).toBe('Рамиз Алиев');
    expect(JSON.parse(storage.getItem(PERSONALIZATION_STORAGE_KEY) ?? '{}')).toEqual({
      version: 1,
      choice: 'participant',
      participantId: 'ramiz-aliev',
    });
  });

  it('does not persist a skipped first-run picker', () => {
    const storage = new MemoryStorage();
    const service = createService(storage);

    service.skip();

    expect(service.snapshot.mode).toBe('skipped');
    expect(service.snapshot.pickerOpen).toBeFalse();
    expect(storage.getItem(PERSONALIZATION_STORAGE_KEY)).toBeNull();

    service.openPicker();
    service.cancelPicker();
    expect(service.snapshot.pickerOpen).toBeFalse();
  });

  it('keeps the session usable if storage throws', () => {
    const service = createService(new ThrowingStorage());

    service.selectGuest();

    expect(service.snapshot.mode).toBe('guest');
    expect(service.snapshot.pickerOpen).toBeFalse();
  });

  it('still offers guest mode when the directory cannot be loaded', () => {
    const directory = {
      loadParticipants: () => throwError(() => new Error('failed')),
    } as unknown as ParticipantDirectoryService;
    const service = new PersonalizationService(directory, new MemoryStorage());

    expect(service.snapshot.directoryError).toBeTrue();
    expect(service.snapshot.pickerOpen).toBeTrue();

    service.selectGuest();
    expect(service.snapshot.mode).toBe('guest');
  });

  it('does not reopen the picker for a stored guest if the directory fails', () => {
    const storage = new MemoryStorage();
    storage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify({ version: 1, choice: 'guest' }));
    const directory = {
      loadParticipants: () => throwError(() => new Error('failed')),
    } as unknown as ParticipantDirectoryService;

    const service = new PersonalizationService(directory, storage);

    expect(service.snapshot.mode).toBe('guest');
    expect(service.snapshot.pickerOpen).toBeFalse();
    expect(service.snapshot.directoryError).toBeTrue();
  });

  function createService(storage: Storage): PersonalizationService {
    const directory = {
      loadParticipants: () => of(participants),
    } as ParticipantDirectoryService;
    return new PersonalizationService(directory, storage);
  }
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

class ThrowingStorage extends MemoryStorage {
  override getItem(_key: string): string | null { throw new Error('storage unavailable'); }
  override removeItem(_key: string): void { throw new Error('storage unavailable'); }
  override setItem(_key: string, _value: string): void { throw new Error('storage unavailable'); }
}
