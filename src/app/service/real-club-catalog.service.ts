import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, shareReplay } from 'rxjs';

import { createRealClubIndex, RealClub, RealClubIndex } from '../models/real-club';

const REAL_CLUBS_URL = '/assets/data/teams.json';

@Injectable({ providedIn: 'root' })
export class RealClubCatalogService {
  readonly clubs$: Observable<readonly RealClub[]> = this.http.get<unknown>(REAL_CLUBS_URL).pipe(
    map(validateRealClubCatalog),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  readonly index$: Observable<RealClubIndex> = this.clubs$.pipe(map(createRealClubIndex));

  constructor(private readonly http: HttpClient) {}
}

export function validateRealClubCatalog(value: unknown): readonly RealClub[] {
  if (!Array.isArray(value)) throw new Error('Real club catalog must be an array');

  const keys = new Set<string>();
  const externalIds = new Set<string>();

  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`Real club at index ${index} must be an object`);
    const key = requireString(item, 'key', index);
    const name = requireString(item, 'name', index);
    const logo = optionalString(item, 'logo', index);
    if (!Array.isArray(item['ids']) || item['ids'].length === 0) {
      throw new Error(`Real club "${key}" must contain at least one external id`);
    }
    const ids = item['ids'].map((id, idIndex) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error(`Real club "${key}" has invalid id at index ${idIndex}`);
      }
      return id.trim();
    });

    if (keys.has(key)) throw new Error(`Duplicate real club key "${key}"`);
    keys.add(key);
    ids.forEach(id => {
      if (externalIds.has(id)) throw new Error(`Duplicate real club external id "${id}"`);
      externalIds.add(id);
    });

    return { key, ids, name, logo };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requireString(item: Record<string, unknown>, field: string, index: number): string {
  const value = item[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Real club at index ${index} has invalid ${field}`);
  }
  return value.trim();
}

function optionalString(item: Record<string, unknown>, field: string, index: number): string {
  const value = item[field];
  if (typeof value !== 'string') {
    throw new Error(`Real club at index ${index} has invalid ${field}`);
  }
  return value.trim();
}
