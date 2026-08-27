import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, map, Observable, switchMap, throwError } from 'rxjs';
import {
  CompetitionConfigFile,
  CompetitionType,
  FantasyFullInfoResponse,
  LoadedCompetitionData,
  LocalProfile,
  ProfilesFile,
  RealTeamReference,
  SeasonCompetitionConfig,
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

    return forkJoin({
      profilesFile: this.http.get<ProfilesFile>('/assets/data/profiles.json'),
      configFile: this.http.get<CompetitionConfigFile>('/assets/data/consts.json'),
      teams: this.http.get<RealTeamReference[]>('/assets/data/teams.json'),
    }).pipe(
      map(({ profilesFile, configFile, teams }) => ({
        profiles: this.selectProfiles(profilesFile, type, yearStart),
        config: this.selectConfig(configFile, type, yearStart),
        teams,
      })),
      switchMap(({ profiles, config, teams }) => {
        const requests: Record<string, Observable<FantasyFullInfoResponse>> = {
          squads: this.http.get<FantasyFullInfoResponse>(config.squad_link),
        };
        if (config.squad_link_2) {
          requests['squads2'] = this.http.get<FantasyFullInfoResponse>(config.squad_link_2);
        }

        return forkJoin(requests).pipe(
          map(responses => {
            const data: LoadedCompetitionData = {
              profiles,
              config,
              teams,
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
      })
    );
  }

  private selectProfiles(file: ProfilesFile, type: CompetitionType, yearStart: number): LocalProfile[] {
    const season = file[String(yearStart)];
    if (!season || Array.isArray(season)) {
      throw new Error(`Профили сезона ${yearStart} имеют устаревший или отсутствующий формат`);
    }
    const profiles = season[type];
    if (!profiles) throw new Error(`Не найдены профили ${type} для сезона ${yearStart}`);
    return profiles;
  }

  private selectConfig(file: CompetitionConfigFile, type: CompetitionType, yearStart: number): SeasonCompetitionConfig {
    const config = file.league.find(candidate =>
      candidate['type'] === type && candidate['yearStart'] === yearStart
    );
    if (!config) throw new Error(`Не найдена конфигурация ${type} для сезона ${yearStart}`);
    return config as unknown as SeasonCompetitionConfig;
  }
}
