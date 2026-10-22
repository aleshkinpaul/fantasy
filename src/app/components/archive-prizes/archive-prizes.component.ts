import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';

import { IPrizeNominee, IRuntimePrize } from '../../models/domain';
import {
  ArchiveSponsorPrizeVictory,
  SponsorPrizeWinnersRegistry,
} from '../../models/participant-profile';
import { PrizesListComponent } from '../league-h2h-page/prizes-list.component';

interface ArchiveProfile {
  id: string;
  name: string;
  logo: string;
}

interface ArchiveProfilesRegistry {
  [year: string]: ArchiveProfile[];
}

@Component({
  selector: 'app-archive-prizes',
  standalone: true,
  imports: [CommonModule, PrizesListComponent],
  template: `
    <div class="archive-prizes-state" *ngIf="loading">Загружаем итоги призов…</div>
    <div class="archive-prizes-state error" *ngIf="loadError">Не удалось загрузить архивные призы.</div>
    <app-prizes-list *ngIf="!loading && prizes.length" [prizes]="prizes" [archived]="true"></app-prizes-list>
    <div class="archive-prizes-state" *ngIf="!loading && !loadError && !prizes.length">Для турнира нет сохранённых призов.</div>
  `,
  styles: [`
    :host { display: block; }
    .archive-prizes-state {
      margin: 18px 0;
      padding: 18px;
      color: var(--color-text-muted, #6d7280);
      text-align: center;
      border-radius: 12px;
      background: var(--color-surface, #fff);
    }
    .archive-prizes-state.error { color: #b23a3a; }
  `],
})
export class ArchivePrizesComponent implements OnInit {
  @Input({ required: true }) tournamentId = '';
  prizes: IRuntimePrize[] = [];
  loading = true;
  loadError = false;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    forkJoin({
      registry: this.http.get<SponsorPrizeWinnersRegistry>('/assets/data/sponsor-prize-winners.json'),
      profiles: this.http.get<ArchiveProfilesRegistry>('/assets/data/profiles.json'),
    }).subscribe({
      next: ({ registry, profiles }) => {
        this.prizes = buildArchiveRuntimePrizes(
          registry.archiveVictories ?? [],
          Object.values(profiles).flat(),
          this.tournamentId,
        );
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }
}

export function buildArchiveRuntimePrizes(
  victories: ArchiveSponsorPrizeVictory[],
  profiles: ArchiveProfile[],
  tournamentId: string,
): IRuntimePrize[] {
  const profilesById = new Map(profiles.map(profile => [profile.id, profile]));
  return victories
    .filter(victory => victory.tournamentId === tournamentId)
    .map(victory => {
      const profile = profilesById.get(victory.profileId);
      const nominee: IPrizeNominee = {
        id: victory.profileId,
        name: profile?.name || `Участник #${victory.profileId}`,
        logo: profile?.logo || 'assets/logos/default.png',
        team: { title: victory.winnerTeamName || 'Команда сезона' },
        prizes: {
          [victory.prizeId]: {
            value: victory.result ?? 'Победитель',
            sortParam: victory.result ?? 0,
          },
        },
        results: { subsCoef: 100 },
      };
      return {
        id: victory.prizeId,
        name: victory.name,
        icon: victory.icon,
        author: victory.author,
        condition: victory.condition,
        reward: victory.reward,
        nomineesArr: [nominee],
        activeLeaders: [nominee],
        state: 1,
      };
    });
}
