export interface ParticipantDirectoryEntry {
  participantId: string;
  name: string;
  profileIds: string[];
  logo?: string;
  isActive?: boolean;
}

export interface ParticipantDirectoryRegistry {
  version: 1;
  participants: ParticipantDirectoryEntry[];
}
