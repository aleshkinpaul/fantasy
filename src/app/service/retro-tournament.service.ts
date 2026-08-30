import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';

import { RetroTournament, RetroTournamentRegistry } from '../models/retro-tournament';
import { TournamentKind } from '../models/tournament-catalog';

const RETRO_TOURNAMENTS_URL = '/assets/data/retro-tournaments.json';

@Injectable({ providedIn: 'root' })
export class RetroTournamentService {
  private readonly tournaments$: Observable<RetroTournament[]>;

  constructor(http: HttpClient) {
    this.tournaments$ = http.get<unknown>(RETRO_TOURNAMENTS_URL).pipe(
      map(validateRetroTournamentRegistry),
      map(registry => registry.tournaments),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  loadTournament(id: string): Observable<RetroTournament | undefined> {
    return this.tournaments$.pipe(map(tournaments => tournaments.find(tournament => tournament.id === id)));
  }
}

export function validateRetroTournamentRegistry(value: unknown): RetroTournamentRegistry {
  if (!isRecord(value) || value['version'] !== 1 || !Array.isArray(value['tournaments'])) {
    throw new Error('Retro tournament registry must be an object with version 1 and tournaments');
  }

  const ids = new Set<string>();
  const tournaments = value['tournaments'].map((item, index) => {
    if (!isRecord(item) || !Array.isArray(item['standings'])) {
      throw new Error(`Retro tournament ${index} is invalid`);
    }
    const id = requiredString(item['id'], `Retro tournament ${index} id`);
    if (ids.has(id)) throw new Error(`Retro tournament registry contains duplicate id "${id}"`);
    ids.add(id);
    const standings = item['standings'] as unknown[];
    const tourCount = requiredPositiveInteger(item['tourCount'], `Retro tournament "${id}" tourCount`);
    standings.forEach((standing, standingIndex) => validateStanding(standing, id, standingIndex, tourCount));
    const kind = requiredString(item['kind'], `Retro tournament "${id}" kind`);
    if (!isTournamentKind(kind)) throw new Error(`Retro tournament "${id}" has invalid kind`);
    if (item['format'] !== 'overall') throw new Error(`Retro tournament "${id}" must use overall format`);

    return {
      id,
      title: requiredString(item['title'], `Retro tournament "${id}" title`),
      period: requiredString(item['period'], `Retro tournament "${id}" period`),
      kind,
      format: 'overall' as const,
      sourceFile: requiredString(item['sourceFile'], `Retro tournament "${id}" sourceFile`),
      tourCount,
      standings: standings as RetroTournament['standings']
    };
  });

  return { version: 1, tournaments };
}

function validateStanding(value: unknown, tournamentId: string, index: number, tourCount: number): void {
  if (!isRecord(value)) throw new Error(`Retro tournament "${tournamentId}" standing ${index} is invalid`);
  if (value['place'] !== index + 1) {
    throw new Error(`Retro tournament "${tournamentId}" standings must be ordered without gaps`);
  }
  ['participantName', 'participantId', 'profileId', 'teamName', 'logo'].forEach(field =>
    requiredString(value[field], `Retro tournament "${tournamentId}" standing ${index} ${field}`)
  );
  if (!String(value['logo']).startsWith('assets/')) {
    throw new Error(`Retro tournament "${tournamentId}" standing ${index} logo must be an asset path`);
  }
  if (!Array.isArray(value['tourScores'])) {
    throw new Error(`Retro tournament "${tournamentId}" standing ${index} must contain tourScores`);
  }
  if (value['tourScores'].length !== tourCount || value['tourScores'].some(score => score !== null && !isFiniteNumber(score))) {
    throw new Error(`Retro tournament "${tournamentId}" standing ${index} has invalid tourScores`);
  }
  ['totalScore', 'maxScore', 'averageScore', 'minScore'].forEach(field => {
    if (!isFiniteNumber(value[field])) {
      throw new Error(`Retro tournament "${tournamentId}" standing ${index} ${field} is invalid`);
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${field} is invalid`);
  return value.trim();
}

function requiredPositiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) throw new Error(`${field} is invalid`);
  return value as number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTournamentKind(value: string): value is TournamentKind {
  return value === 'la-liga' || value === 'cup' || value === 'champions-league' || value === 'summer';
}
