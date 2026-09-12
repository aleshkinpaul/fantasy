import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';

import {
  TournamentCatalogItem,
  TournamentKind,
  TournamentStatus,
  TournamentTimelineGroup,
  TournamentTimelineItem
} from '../models/tournament-catalog';

const CATALOG_URL = '/assets/data/tournaments.json';

const KIND_ORDER: Record<TournamentKind, number> = {
  'la-liga': 0,
  cup: 1,
  'champions-league': 2,
  summer: 3
};

const KIND_LABELS: Record<TournamentKind, { label: string; short: string }> = {
  'la-liga': { label: 'Ла Лига', short: 'ЛЛ' },
  cup: { label: 'Кубок', short: 'К' },
  'champions-league': { label: 'Лига чемпионов', short: 'ЛЧ' },
  summer: { label: 'Летний турнир', short: 'ЛТ' }
};

const STATUS_LABELS: Record<TournamentStatus, string> = {
  scheduled: 'Скоро',
  active: 'Идёт сейчас',
  completed: 'Завершён'
};

@Injectable({ providedIn: 'root' })
export class TournamentCatalogService {
  private readonly timeline$: Observable<TournamentTimelineGroup[]>;

  constructor(http: HttpClient) {
    this.timeline$ = http.get<unknown>(CATALOG_URL).pipe(
      map(catalog => buildTournamentTimeline(catalog)),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  loadTimeline(): Observable<TournamentTimelineGroup[]> {
    return this.timeline$;
  }
}

export function buildTournamentTimeline(catalog: unknown): TournamentTimelineGroup[] {
  if (!Array.isArray(catalog)) {
    throw new Error('Tournament catalog must be an array');
  }

  const ids = new Set<string>();
  const items = catalog.map((value, index) => validateItem(value, index, ids));
  const groups = new Map<string, TournamentTimelineGroup>();

  items.forEach(item => {
    const group = groups.get(item.period) ?? {
      period: item.period,
      yearStart: item.yearStart,
      tournaments: []
    };

    if (group.yearStart !== item.yearStart) {
      throw new Error(`Tournament catalog period "${item.period}" has conflicting start years`);
    }

    group.tournaments.push(toTimelineItem(item));
    groups.set(item.period, group);
  });

  return Array.from(groups.values())
    .sort((left, right) => right.yearStart - left.yearStart)
    .map(group => ({
      ...group,
      tournaments: group.tournaments.sort((left, right) => {
        return KIND_ORDER[left.kind] - KIND_ORDER[right.kind] || left.title.localeCompare(right.title, 'ru');
      })
    }));
}

export function orderTimelineBottomUp(
  timeline: TournamentTimelineGroup[],
): TournamentTimelineGroup[] {
  return timeline.map(season => ({
    ...season,
    tournaments: [...season.tournaments].reverse(),
  }));
}

function validateItem(value: unknown, index: number, ids: Set<string>): TournamentCatalogItem {
  if (!isRecord(value)) {
    throw new Error(`Tournament catalog item ${index} must be an object`);
  }

  const id = requiredString(value['id'], index, 'id');
  if (ids.has(id)) {
    throw new Error(`Tournament catalog contains duplicate id "${id}"`);
  }
  ids.add(id);

  const period = requiredString(value['period'], index, 'period');
  const yearStart = value['yearStart'];
  if (!Number.isInteger(yearStart)) {
    throw new Error(`Tournament catalog item ${index} has invalid yearStart`);
  }

  const kind = requiredString(value['kind'], index, 'kind');
  if (!isTournamentKind(kind)) {
    throw new Error(`Tournament catalog item ${index} has invalid kind "${kind}"`);
  }

  const status = requiredString(value['status'], index, 'status');
  if (!isTournamentStatus(status)) {
    throw new Error(`Tournament catalog item ${index} has invalid status "${status}"`);
  }

  const route = requiredString(value['route'], index, 'route');
  if (!route.startsWith('/')) {
    throw new Error(`Tournament catalog item ${index} route must start with "/"`);
  }

  const description = optionalString(value['description'], index, 'description');

  return {
    id,
    period,
    yearStart: yearStart as number,
    kind,
    title: requiredString(value['title'], index, 'title'),
    route,
    status,
    ...(description ? { description } : {})
  };
}

function toTimelineItem(item: TournamentCatalogItem): TournamentTimelineItem {
  const labels = KIND_LABELS[item.kind];

  return {
    ...item,
    kindLabel: labels.label,
    shortLabel: labels.short,
    statusLabel: STATUS_LABELS[item.status],
    isArchive: item.status === 'completed'
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, index: number, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Tournament catalog item ${index} has invalid ${field}`);
  }
  return value.trim();
}

function optionalString(value: unknown, index: number, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requiredString(value, index, field);
}

function isTournamentKind(value: string): value is TournamentKind {
  return Object.prototype.hasOwnProperty.call(KIND_ORDER, value);
}

function isTournamentStatus(value: string): value is TournamentStatus {
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, value);
}
