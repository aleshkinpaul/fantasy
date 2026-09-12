import { Inject, InjectionToken, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, take } from 'rxjs';

import { ParticipantDirectoryEntry } from '../models/participant-directory';
import {
  PersonalizationState,
  StoredPersonalization,
} from '../models/personalization';
import { ParticipantDirectoryService } from './participant-directory.service';

export const PERSONALIZATION_STORAGE_KEY = 'fr-fantasy.personalization.v1';

export const PERSONALIZATION_STORAGE = new InjectionToken<Storage | null>(
  'Browser storage used for personalization',
  {
    providedIn: 'root',
    factory: () => {
      try {
        return typeof localStorage === 'undefined' ? null : localStorage;
      } catch {
        return null;
      }
    },
  },
);

const INITIAL_STATE: PersonalizationState = {
  mode: 'loading',
  participants: [],
  selectedParticipant: null,
  pickerOpen: true,
  directoryError: false,
};

@Injectable({ providedIn: 'root' })
export class PersonalizationService {
  private readonly stateSubject = new BehaviorSubject<PersonalizationState>(INITIAL_STATE);
  readonly state$: Observable<PersonalizationState> = this.stateSubject.asObservable();

  constructor(
    private readonly participantDirectory: ParticipantDirectoryService,
    @Inject(PERSONALIZATION_STORAGE)
    private readonly storage: Storage | null,
  ) {
    const storedSelection = this.readStoredSelection();
    this.participantDirectory.loadParticipants().pipe(take(1)).subscribe({
      next: participants => this.restoreSelection(participants, storedSelection),
      error: () => this.handleDirectoryError(storedSelection),
    });
  }

  get snapshot(): PersonalizationState {
    return this.stateSubject.value;
  }

  selectParticipant(participantId: string): void {
    const participant = this.snapshot.participants.find(item => item.participantId === participantId);
    if (!participant) return;

    this.persist({ version: 1, choice: 'participant', participantId });
    this.stateSubject.next({
      ...this.snapshot,
      mode: 'participant',
      selectedParticipant: participant,
      pickerOpen: false,
    });
  }

  selectGuest(): void {
    this.persist({ version: 1, choice: 'guest' });
    this.stateSubject.next({
      ...this.snapshot,
      mode: 'guest',
      selectedParticipant: null,
      pickerOpen: false,
    });
  }

  skip(): void {
    if (this.snapshot.mode !== 'unselected') return;

    this.stateSubject.next({
      ...this.snapshot,
      mode: 'skipped',
      selectedParticipant: null,
      pickerOpen: false,
    });
  }

  openPicker(): void {
    if (this.snapshot.mode === 'loading') return;
    this.stateSubject.next({ ...this.snapshot, pickerOpen: true });
  }

  cancelPicker(): void {
    if (
      this.snapshot.mode !== 'participant'
      && this.snapshot.mode !== 'guest'
      && this.snapshot.mode !== 'skipped'
    ) return;
    this.stateSubject.next({ ...this.snapshot, pickerOpen: false });
  }

  private restoreSelection(
    participants: ParticipantDirectoryEntry[],
    stored: StoredPersonalization | null,
  ): void {
    if (stored?.choice === 'guest') {
      this.stateSubject.next({
        mode: 'guest',
        participants,
        selectedParticipant: null,
        pickerOpen: false,
        directoryError: false,
      });
      return;
    }

    if (stored?.choice === 'participant') {
      const participant = participants.find(item => item.participantId === stored.participantId);
      if (participant) {
        this.stateSubject.next({
          mode: 'participant',
          participants,
          selectedParticipant: participant,
          pickerOpen: false,
          directoryError: false,
        });
        return;
      }
      this.removeStoredSelection();
    }

    this.stateSubject.next({
      mode: 'unselected',
      participants,
      selectedParticipant: null,
      pickerOpen: true,
      directoryError: false,
    });
  }

  private handleDirectoryError(stored: StoredPersonalization | null): void {
    if (stored?.choice === 'guest') {
      this.stateSubject.next({
        mode: 'guest',
        participants: [],
        selectedParticipant: null,
        pickerOpen: false,
        directoryError: true,
      });
      return;
    }

    this.stateSubject.next({
      mode: 'unselected',
      participants: [],
      selectedParticipant: null,
      pickerOpen: true,
      directoryError: true,
    });
  }

  private readStoredSelection(): StoredPersonalization | null {
    try {
      const rawValue = this.storage?.getItem(PERSONALIZATION_STORAGE_KEY);
      if (!rawValue) return null;

      const parsed = JSON.parse(rawValue) as unknown;
      if (!isStoredPersonalization(parsed)) {
        this.removeStoredSelection();
        return null;
      }
      return parsed;
    } catch {
      this.removeStoredSelection();
      return null;
    }
  }

  private persist(value: StoredPersonalization): void {
    try {
      this.storage?.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // The active session still keeps the choice when storage is unavailable.
    }
  }

  private removeStoredSelection(): void {
    try {
      this.storage?.removeItem(PERSONALIZATION_STORAGE_KEY);
    } catch {
      // An unavailable storage must not prevent the site from opening.
    }
  }
}

function isStoredPersonalization(value: unknown): value is StoredPersonalization {
  if (!isRecord(value) || value['version'] !== 1) return false;
  if (value['choice'] === 'guest') return true;
  return value['choice'] === 'participant'
    && typeof value['participantId'] === 'string'
    && Boolean(value['participantId'].trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
