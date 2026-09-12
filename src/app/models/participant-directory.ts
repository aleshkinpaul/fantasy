export interface ParticipantDirectoryEntry {
  participantId: string;
  name: string;
  profileIds: string[];
}

export interface ParticipantDirectoryRegistry {
  version: 1;
  participants: ParticipantDirectoryEntry[];
}
