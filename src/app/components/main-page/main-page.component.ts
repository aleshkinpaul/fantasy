import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, of } from 'rxjs';

import { TournamentTimelineGroup, TournamentTimelineItem } from '../../models/tournament-catalog';
import { TournamentCatalogService } from '../../service/tournament-catalog.service';
import { DataService } from '../../service/data.service';

@Component({
  selector: 'app-main-page',
  templateUrl: './main-page.component.html',
  styleUrls: ['./main-page.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class MainPageComponent {
  readonly timeline$: Observable<TournamentTimelineGroup[]>;
  loadError = false;

  constructor(
    private readonly router: Router,
    catalogService: TournamentCatalogService,
    dataService: DataService
  ) {
    dataService.setUrlName('');
    this.timeline$ = catalogService.loadTimeline().pipe(
      catchError(error => {
        console.error('Failed to load tournament catalog', error);
        this.loadError = true;
        return of([]);
      })
    );
  }

  openTournament(event: MouseEvent, tournament: TournamentTimelineItem): void {
    if (tournament.status === 'scheduled') {
      event.preventDefault();
      return;
    }

    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    void this.router.navigateByUrl(tournament.route);
  }

  trackSeason(_index: number, season: TournamentTimelineGroup): string {
    return season.period;
  }

  trackTournament(_index: number, tournament: TournamentTimelineItem): string {
    return tournament.id;
  }
}
