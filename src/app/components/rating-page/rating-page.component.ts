import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';

import { ParticipantRatingCell, ParticipantRatingRow, PowerRating, RatingTournamentColumn } from '../../rating/rating.models';
import { RatingService } from '../../rating/rating.service';
import { DataService } from '../../service/data.service';
import { PersonalizedParticipantDirective } from '../../directives/personalized-participant.directive';
import { InternalRouteHrefPipe } from '../../pipes/internal-route-href.pipe';

@Component({
  selector: 'app-rating-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PersonalizedParticipantDirective, InternalRouteHrefPipe],
  templateUrl: './rating-page.component.html',
  styleUrls: ['./rating-page.component.scss'],
})
export class RatingPageComponent implements OnInit {
  rating?: PowerRating;
  includeLive = true;
  search = '';
  loading = true;
  loadError = false;
  private readonly failedImages = new Set<string>();

  constructor(
    private readonly ratingService: RatingService,
    private readonly dataService: DataService,
    private readonly destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    this.dataService.setUrlName('rating');
    this.load();
  }

  get filteredRows(): ParticipantRatingRow[] {
    const query = this.search.trim().toLocaleLowerCase('ru-RU');
    if (!query) return this.rating?.rows ?? [];
    return (this.rating?.rows ?? []).filter(row =>
      row.name.toLocaleLowerCase('ru-RU').includes(query)
      || row.teamName?.toLocaleLowerCase('ru-RU').includes(query));
  }

  setIncludeLive(includeLive: boolean): void {
    if (this.includeLive === includeLive) return;
    this.includeLive = includeLive;
    this.load();
  }

  cellTitle(cell: ParticipantRatingCell, column: RatingTournamentColumn): string {
    const parts = [column.title];
    if (cell.totalScore !== undefined) parts.push(`ФО: ${this.formatScore(cell.totalScore)}`);
    if (cell.fantasyRank !== undefined) parts.push(`место по ФО: ${cell.fantasyRank}`);
    if (cell.officialPlace !== undefined) parts.push(`итоговое место: ${cell.officialPlace}`);
    if (cell.tournamentPower !== undefined) parts.push(`сила в турнире: ${this.formatRating(cell.tournamentPower * 10)}`);
    parts.push(`вес турнира: ${this.formatScore(column.kindWeight)}`);
    if (column.included) parts.push(`вес сезона: ${this.formatScore(column.seasonWeight)}`);
    if (!cell.included && column.isLive) parts.push('live-результат не включён в рейтинг');
    return parts.join(' · ');
  }

  formatScore(value: number): string {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value);
  }

  formatRating(value: number): string {
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(value);
  }

  hasFailedImage(profileId: string): boolean {
    return this.failedImages.has(profileId);
  }

  failImage(profileId: string): void {
    this.failedImages.add(profileId);
  }

  initials(value: string): string {
    return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0)).join('').toLocaleUpperCase('ru-RU');
  }

  trackRow(_index: number, row: ParticipantRatingRow): string {
    return row.participantId;
  }

  trackColumn(_index: number, column: RatingTournamentColumn): string {
    return column.id;
  }

  private load(): void {
    this.loading = true;
    this.loadError = false;
    this.ratingService.loadRating(this.includeLive)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: rating => {
          this.rating = rating;
          this.loading = false;
        },
        error: error => {
          console.error('Failed to build rating', error);
          this.loading = false;
          this.loadError = true;
        },
      });
  }
}
