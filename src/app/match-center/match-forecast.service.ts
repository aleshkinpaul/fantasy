import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, switchMap } from 'rxjs';

import { IProfileDetails } from '../models/domain';
import { calculateMatchForecast, FORECAST_ALGORITHM_VERSION } from './forecast-calculator';
import {
  ForecastManifest,
  ForecastSnapshotFile,
  MatchCenterSelection,
  MatchForecast,
  MatchForecastView,
} from './match-center.models';
import { MatchCenterStatus } from './match-center-status';

const FORECAST_MANIFEST_URL = '/assets/data/forecasts/manifest.json';

@Injectable({ providedIn: 'root' })
export class MatchForecastService {
  private readonly manifest$: Observable<ForecastManifest>;

  constructor(private readonly http: HttpClient) {
    this.manifest$ = this.http.get<ForecastManifest>(FORECAST_MANIFEST_URL).pipe(
      catchError(() => of({ snapshots: [] })),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  resolve(input: {
    tournamentId: string;
    selection: MatchCenterSelection;
    profiles: IProfileDetails[];
    drawGap: number;
    matchStatus: MatchCenterStatus;
  }): Observable<MatchForecastView> {
    return this.loadTourSnapshot(input.tournamentId, input.selection.tour).pipe(
      map(snapshot => {
        const fixedForecast = snapshot
          ? this.getFixedForecast(snapshot, input.selection)
          : undefined;
        return fixedForecast || this.getFallback(input);
      }),
    );
  }

  loadTourSnapshot(
    tournamentId: string,
    tour: number,
  ): Observable<ForecastSnapshotFile | undefined> {
    return this.manifest$.pipe(
      switchMap(manifest => {
        const entry = manifest.snapshots.find(snapshot =>
          snapshot.tournamentId === tournamentId && snapshot.tour === tour,
        );
        if (!entry) return of(undefined);
        return this.http.get<ForecastSnapshotFile>(entry.path).pipe(
          catchError(() => of(undefined)),
        );
      }),
    );
  }

  private getFixedForecast(
    snapshot: ForecastSnapshotFile,
    selection: MatchCenterSelection,
  ): MatchForecastView | undefined {
    const forecast = findForecast(snapshot.forecasts, selection);
    if (!forecast) return undefined;

    return {
      state: snapshot.provenance === 'reconstructed' ? 'calculated' : 'fixed',
      forecast,
      generatedAt: snapshot.generatedAt,
      algorithmVersion: snapshot.algorithmVersion,
      message: snapshot.provenance === 'reconstructed'
        ? 'Вероятности рассчитаны по данным, которые были доступны до начала матча.'
        : undefined,
    };
  }

  private getFallback(input: {
    selection: MatchCenterSelection;
    profiles: IProfileDetails[];
    drawGap: number;
    matchStatus: MatchCenterStatus;
  }): MatchForecastView {
    const isCompleted = input.matchStatus === 'completed';

    return {
      state: isCompleted ? 'calculated' : 'preview',
      forecast: calculateMatchForecast({
        homeProfileId: input.selection.match.home,
        awayProfileId: input.selection.match.away,
        targetTour: input.selection.tour,
        drawGap: input.drawGap,
        profiles: input.profiles,
      }),
      generatedAt: new Date().toISOString(),
      algorithmVersion: FORECAST_ALGORITHM_VERSION,
      message: isCompleted
        ? 'Вероятности рассчитаны по результатам не более пяти туров до этого матча. Результат самого матча и последующие туры в расчёт не входят.'
        : input.matchStatus === 'live'
          ? 'Предматчевый прогноз рассчитан по предыдущим турам. Live-данные текущего матча в расчёт не входят.'
          : 'Предварительный расчёт изменяется вместе с новыми результатами до фиксации snapshot.',
    };
  }
}

export function getTournamentCatalogId(type: string, yearStart: number, yearEnd: number): string {
  const period = `${yearStart}-${String(yearEnd).slice(-2)}`;
  if (type === 'spain') return `la-liga-${period}`;
  if (type === 'champions-league') return `champions-league-${period}`;
  if (type === 'world-cup') return `world-cup-${yearEnd}`;
  return `${type}-${period}`;
}

function findForecast(
  forecasts: MatchForecast[],
  selection: MatchCenterSelection,
): MatchForecast | undefined {
  return forecasts.find(forecast =>
    forecast.homeProfileId === selection.match.home
    && forecast.awayProfileId === selection.match.away,
  );
}
