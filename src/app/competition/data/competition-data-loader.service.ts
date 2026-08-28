import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, map, Observable, switchMap, throwError } from 'rxjs';
import {
  CompetitionType,
  FantasyFullInfoResponse,
  FantasyTourStatsResponse,
  LoadedCompetitionData,
  SeasonCompetitionFile,
} from '../models/competition.models';
import { validateCompetitionData } from '../config/competition-data.validator';
import { mergeCompetitionStages } from './competition-stages.merger';

@Injectable({ providedIn: 'root' })
export class CompetitionDataLoaderService {
  constructor(private readonly http: HttpClient) {}

  load(type: CompetitionType, yearStart: number): Observable<LoadedCompetitionData> {
    if (!yearStart) {
      return throwError(() => new Error(`Не указан год начала сезона для турнира ${type}`));
    }

    const seasonFileUrl = getSeasonCompetitionFileUrl(type, yearStart);
    return this.http.get<SeasonCompetitionFile>(seasonFileUrl).pipe(
      map(file => this.validateSeasonFile(file, type, yearStart)),
      switchMap(({ profiles, config }) => {
        const requests: Record<string, Observable<FantasyFullInfoResponse>> = {
          squads: this.http.get<FantasyFullInfoResponse>(config.squad_link),
        };
        if (config.squad_link_2) {
          requests['squads2'] = this.http.get<FantasyFullInfoResponse>(config.squad_link_2);
        }

        return forkJoin(requests).pipe(
          map(responses => {
            const data = {
              profiles,
              config,
              squads: responses['squads'],
              squads2: responses['squads2'],
            };
            validateCompetitionData(data);
            return {
              ...data,
              squads: mergeCompetitionStages(data.squads, data.squads2),
            };
          })
        );
      }),
      switchMap(data => {
        const lastTour = Object.keys(data.squads.data.tours).length;
        const firstStageTours = Math.max(...Object.keys(data.squads.data.matches).map(Number));
        const firstStageLastTour = data.config.tour_link_2 && lastTour > firstStageTours
          ? firstStageTours
          : lastTour;
        const secondStageLastTour = data.config.tour_link_2 && lastTour > firstStageTours
          ? lastTour - firstStageTours
          : 0;

        const latestRequests = [
          this.http.get<FantasyTourStatsResponse>(`${data.config.tour_link}${firstStageLastTour}`),
        ];
        if (secondStageLastTour && data.config.tour_link_2) {
          latestRequests.push(
            this.http.get<FantasyTourStatsResponse>(`${data.config.tour_link_2}${secondStageLastTour}`),
          );
        }

        const tourRequests = Array.from({ length: lastTour }, (_, index) =>
          this.http.get<FantasyTourStatsResponse>(`${data.config.tour_link}${index + 1}`));

        return forkJoin({
          latestPlayerStats: forkJoin(latestRequests),
          playerStatsByTour: forkJoin(tourRequests),
        }).pipe(
          map(stats => ({ ...data, ...stats }) as LoadedCompetitionData)
        );
      })
    );
  }

  private validateSeasonFile(
    file: SeasonCompetitionFile,
    type: CompetitionType,
    yearStart: number,
  ): SeasonCompetitionFile {
    if (!file?.config || !Array.isArray(file.profiles)) {
      throw new Error(`Некорректный файл данных ${type} для сезона ${yearStart}`);
    }
    if (file.config.type !== type || file.config.yearStart !== yearStart) {
      throw new Error(`Файл данных не соответствует турниру ${type} сезона ${yearStart}`);
    }
    return file;
  }
}

export function getSeasonCompetitionFileUrl(type: CompetitionType, yearStart: number): string {
  const yearEnd = String(yearStart + 1).slice(-2);
  return `/assets/data/seasons/${yearStart}-${yearEnd}/${type}.json`;
}
