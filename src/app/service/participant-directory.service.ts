import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';

import {
  ParticipantDirectoryEntry,
  ParticipantDirectoryRegistry,
} from '../models/participant-directory';

const PARTICIPANTS_URL = '/assets/data/participants.json';
const participantCollator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });

@Injectable({ providedIn: 'root' })
export class ParticipantDirectoryService {
  private readonly participants$: Observable<ParticipantDirectoryEntry[]>;

  constructor(http: HttpClient) {
    this.participants$ = http.get<unknown>(PARTICIPANTS_URL).pipe(
      map(value => validateParticipantDirectory(value).participants),
      map(participants => sortParticipantsBySurname(participants)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  loadParticipants(): Observable<ParticipantDirectoryEntry[]> {
    return this.participants$;
  }
}

export function validateParticipantDirectory(value: unknown): ParticipantDirectoryRegistry {
  if (!isRecord(value) || value['version'] !== 1 || !Array.isArray(value['participants'])) {
    throw new Error('Participant directory must be an object with version 1 and participants');
  }

  const participantIds = new Set<string>();
  const profileIds = new Set<string>();
  const participants = value['participants'].map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`Participant directory entry ${index} must be an object`);
    const participantId = requiredString(entry['participantId'], `participant ${index} participantId`);
    const name = requiredString(entry['name'], `participant ${index} name`);
    if (participantIds.has(participantId)) throw new Error(`Duplicate participantId "${participantId}"`);
    participantIds.add(participantId);

    if (!Array.isArray(entry['profileIds']) || entry['profileIds'].length === 0) {
      throw new Error(`Participant "${participantId}" must have profileIds`);
    }
    const entryProfileIds = entry['profileIds'].map((profileId, profileIndex) =>
      requiredString(profileId, `participant ${participantId} profileIds[${profileIndex}]`));
    entryProfileIds.forEach(profileId => {
      if (profileIds.has(profileId)) throw new Error(`Duplicate profileId "${profileId}"`);
      profileIds.add(profileId);
    });

    return { participantId, name, profileIds: entryProfileIds };
  });

  return { version: 1, participants };
}

export function sortParticipantsBySurname(
  participants: readonly ParticipantDirectoryEntry[],
): ParticipantDirectoryEntry[] {
  return [...participants].sort((left, right) =>
    participantCollator.compare(participantSurname(left.name), participantSurname(right.name))
    || participantCollator.compare(left.name, right.name)
    || left.participantId.localeCompare(right.participantId));
}

export function participantSurname(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).at(-1) ?? name;
}

export function formatParticipantNameSurnameFirst(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? '';
  return [parts.at(-1), ...parts.slice(0, -1)].join(' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is invalid`);
  return value.trim();
}
