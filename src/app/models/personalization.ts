import { ParticipantDirectoryEntry } from './participant-directory';

export type PersonalizationMode =
  | 'loading'
  | 'unselected'
  | 'participant'
  | 'guest'
  | 'skipped';

export interface PersonalizationState {
  mode: PersonalizationMode;
  participants: ParticipantDirectoryEntry[];
  selectedParticipant: ParticipantDirectoryEntry | null;
  pickerOpen: boolean;
  directoryError: boolean;
}

export type StoredPersonalization =
  | { version: 1; choice: 'guest' }
  | { version: 1; choice: 'participant'; participantId: string };
