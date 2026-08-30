import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';

import {
  ArchiveCupLeg,
  ArchiveCupMatch,
  ArchiveCupRegistry,
  ArchiveCupRound,
  ArchiveCupTeam,
  ArchiveCupTournament,
} from '../models/archive-cup';

const ARCHIVE_CUPS_URL = '/assets/data/archive-cups.json';

@Injectable({ providedIn: 'root' })
export class ArchiveCupService {
  private readonly registry$: Observable<ArchiveCupRegistry>;

  constructor(http: HttpClient) {
    this.registry$ = http.get<unknown>(ARCHIVE_CUPS_URL).pipe(
      map(validateArchiveCupRegistry),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  loadByYear(yearStart: number): Observable<ArchiveCupTournament | undefined> {
    return this.registry$.pipe(
      map(registry => registry.tournaments.find(tournament => tournament.yearStart === yearStart)),
    );
  }
}

export function validateArchiveCupRegistry(value: unknown): ArchiveCupRegistry {
  if (!isRecord(value) || value['version'] !== 1 || !Array.isArray(value['tournaments'])) {
    throw new Error('Archive cup registry must contain version 1 and tournaments');
  }

  const tournamentIds = new Set<string>();
  const tournaments = value['tournaments'].map((item, index) => validateTournament(item, index, tournamentIds));
  return { version: 1, tournaments };
}

function validateTournament(value: unknown, index: number, ids: Set<string>): ArchiveCupTournament {
  if (!isRecord(value)) throw new Error(`Archive cup tournament ${index} must be an object`);
  const id = text(value['id'], `Archive cup tournament ${index} id`);
  if (ids.has(id)) throw new Error(`Duplicate archive cup tournament "${id}"`);
  ids.add(id);
  if (value['format'] !== 'knockout') throw new Error(`Archive cup tournament "${id}" has invalid format`);
  if (!Array.isArray(value['rounds']) || value['rounds'].length === 0) {
    throw new Error(`Archive cup tournament "${id}" must contain rounds`);
  }

  const roundIds = new Set<string>();
  const rounds = value['rounds'].map((round, roundIndex) => validateRound(round, id, roundIndex, roundIds));
  const championProfileId = text(value['championProfileId'], `Archive cup tournament "${id}" championProfileId`);
  const final = rounds.at(-1);
  if (final.matches.length !== 1 || final.matches[0].winnerProfileId !== championProfileId) {
    throw new Error(`Archive cup tournament "${id}" champion must match the final winner`);
  }

  return {
    id,
    title: text(value['title'], `Archive cup tournament "${id}" title`),
    period: text(value['period'], `Archive cup tournament "${id}" period`),
    yearStart: integer(value['yearStart'], `Archive cup tournament "${id}" yearStart`),
    format: 'knockout',
    description: text(value['description'], `Archive cup tournament "${id}" description`),
    sourceDocument: text(value['sourceDocument'], `Archive cup tournament "${id}" sourceDocument`),
    championProfileId,
    rounds,
  };
}

function validateRound(value: unknown, tournamentId: string, index: number, ids: Set<string>): ArchiveCupRound {
  if (!isRecord(value)) throw new Error(`Archive cup round ${index} must be an object`);
  const id = text(value['id'], `Archive cup round ${index} id`);
  if (ids.has(id)) throw new Error(`Duplicate archive cup round "${id}" in "${tournamentId}"`);
  ids.add(id);
  if (!Array.isArray(value['tours']) || value['tours'].length === 0 || !Array.isArray(value['matches'])) {
    throw new Error(`Archive cup round "${id}" must contain tours and matches`);
  }
  const tours = value['tours'].map((tour, tourIndex) => integer(tour, `Archive cup round "${id}" tour ${tourIndex}`));
  const matchIds = new Set<string>();
  const matches = value['matches'].map((match, matchIndex) => validateMatch(match, id, matchIndex, matchIds, tours));
  return { id, title: text(value['title'], `Archive cup round "${id}" title`), tours, matches };
}

function validateMatch(
  value: unknown,
  roundId: string,
  index: number,
  ids: Set<string>,
  roundTours: number[],
): ArchiveCupMatch {
  if (!isRecord(value)) throw new Error(`Archive cup match ${index} in "${roundId}" must be an object`);
  const id = text(value['id'], `Archive cup match ${index} id`);
  if (ids.has(id)) throw new Error(`Duplicate archive cup match "${id}"`);
  ids.add(id);
  const first = validateTeam(value['first'], `${id} first`);
  const second = validateTeam(value['second'], `${id} second`);
  if (first.profileId === second.profileId) throw new Error(`Archive cup match "${id}" has the same team twice`);
  if (!Array.isArray(value['legs']) || value['legs'].length === 0) throw new Error(`Archive cup match "${id}" must have legs`);
  const allowedProfiles = new Set([first.profileId, second.profileId]);
  const legs = value['legs'].map((leg, legIndex) => validateLeg(leg, id, legIndex, allowedProfiles, roundTours));
  const firstTotal = legs.reduce((sum, leg) => sum + scoreFor(leg, first.profileId), 0);
  const secondTotal = legs.reduce((sum, leg) => sum + scoreFor(leg, second.profileId), 0);
  if (value['firstTotal'] !== firstTotal || value['secondTotal'] !== secondTotal) {
    throw new Error(`Archive cup match "${id}" has invalid aggregate score`);
  }
  const winnerProfileId = text(value['winnerProfileId'], `Archive cup match "${id}" winnerProfileId`);
  const expectedWinner = firstTotal > secondTotal ? first.profileId : second.profileId;
  if (firstTotal === secondTotal || winnerProfileId !== expectedWinner) {
    throw new Error(`Archive cup match "${id}" has invalid winner`);
  }
  return { id, first, second, legs, firstTotal, secondTotal, winnerProfileId };
}

function validateTeam(value: unknown, label: string): ArchiveCupTeam {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const logo = text(value['logo'], `${label} logo`);
  if (!logo.startsWith('assets/')) throw new Error(`${label} logo must be a local asset`);
  return {
    profileId: text(value['profileId'], `${label} profileId`),
    participantName: text(value['participantName'], `${label} participantName`),
    teamName: text(value['teamName'], `${label} teamName`),
    logo,
  };
}

function validateLeg(
  value: unknown,
  matchId: string,
  index: number,
  profiles: Set<string>,
  roundTours: number[],
): ArchiveCupLeg {
  if (!isRecord(value)) throw new Error(`Archive cup leg ${index} in "${matchId}" must be an object`);
  const tour = integer(value['tour'], `Archive cup leg ${index} tour`);
  const homeProfileId = text(value['homeProfileId'], `Archive cup leg ${index} homeProfileId`);
  const awayProfileId = text(value['awayProfileId'], `Archive cup leg ${index} awayProfileId`);
  if (!roundTours.includes(tour) || !profiles.has(homeProfileId) || !profiles.has(awayProfileId) || homeProfileId === awayProfileId) {
    throw new Error(`Archive cup leg ${index} in "${matchId}" has invalid references`);
  }
  return {
    tour,
    homeProfileId,
    awayProfileId,
    homeScore: number(value['homeScore'], `Archive cup leg ${index} homeScore`),
    awayScore: number(value['awayScore'], `Archive cup leg ${index} awayScore`),
  };
}

function scoreFor(leg: ArchiveCupLeg, profileId: string): number {
  return leg.homeProfileId === profileId ? leg.homeScore : leg.awayScore;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`);
  return value;
}

function integer(value: unknown, label: string): number {
  if (!Number.isInteger(value)) throw new Error(`${label} must be an integer`);
  return value as number;
}

function number(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a number`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
