import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterModule } from '@angular/router';

import {
  AchievementTitleType,
  HallOfFame,
  HallPlacement,
  HallSeason,
  HallTournament
} from '../../models/achievement';
import { AchievementService, TITLE_TYPE_LABELS } from '../../service/achievement.service';
import { DataService } from '../../service/data.service';
import { tournamentTimelineTopDownOrder } from '../../service/tournament-catalog.service';
import { PersonalizedParticipantDirective } from '../../directives/personalized-participant.directive';
import { InternalRouteHrefPipe } from '../../pipes/internal-route-href.pipe';

type HallTitleFilter = AchievementTitleType | 'all';

@Component({
  selector: 'app-hall-of-fame',
  standalone: true,
  imports: [CommonModule, RouterModule, PersonalizedParticipantDirective, InternalRouteHrefPipe],
  templateUrl: './hall-of-fame.component.html',
  styleUrls: ['./hall-of-fame.component.scss']
})
export class HallOfFameComponent implements OnInit {
  readonly titleFilters: { value: HallTitleFilter; label: string }[] = [
    { value: 'all', label: 'Все турниры' },
    ...Object.entries(TITLE_TYPE_LABELS).map(([value, label]) => ({
      value: value as AchievementTitleType,
      label
    }))
  ];

  hall?: HallOfFame;
  filteredSeasons: HallSeason[] = [];
  activeTitle: HallTitleFilter = 'all';
  activePeriod = 'all';
  loading = true;
  loadError = false;
  showAllLeaders = false;

  constructor(
    private readonly achievementService: AchievementService,
    private readonly dataService: DataService,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    this.dataService.setUrlName('hall-of-fame');
    this.achievementService.loadHallOfFame()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: hall => {
          this.hall = hall;
          this.loading = false;
          this.applyFilters();
        },
        error: error => {
          console.error('Failed to load Hall of Fame', error);
          this.loading = false;
          this.loadError = true;
        }
      });
  }

  selectTitle(title: HallTitleFilter): void {
    this.activeTitle = title;
    this.applyFilters();
  }

  selectPeriod(event: Event): void {
    this.activePeriod = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  openTournament(event: MouseEvent, route: string): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void this.router.navigateByUrl(route);
  }

  placeLabel(place: number): string {
    return place === 1 ? 'Чемпион' : place === 2 ? 'Финалист' : 'Бронза';
  }

  hideBrokenIcon(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
  }

  trackSeason(_index: number, season: HallSeason): string {
    return season.period;
  }

  trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  tournamentTimelineOrder(result: HallTournament): number {
    return tournamentTimelineTopDownOrder(result.tournament.kind);
  }

  placementReferences(placement: HallPlacement): string[] {
    return placement.recipient.members.flatMap(member => [member.participantId, member.profileId]);
  }

  private applyFilters(): void {
    if (!this.hall) return;

    this.filteredSeasons = this.hall.seasons
      .filter(season => this.activePeriod === 'all' || season.period === this.activePeriod)
      .map(season => ({
        ...season,
        tournaments: season.tournaments
          .map(tournament => ({
            ...tournament,
            stages: tournament.stages.filter(stage =>
              this.activeTitle === 'all' || stage.titleType === this.activeTitle
            )
          }))
          .filter(tournament => tournament.stages.length > 0)
          .sort((left, right) =>
            this.tournamentTimelineOrder(left) - this.tournamentTimelineOrder(right)
            || left.tournament.title.localeCompare(right.tournament.title, 'ru')
          )
      }))
      .filter(season => season.tournaments.length > 0);
  }
}
