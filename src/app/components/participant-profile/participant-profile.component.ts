import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { switchMap } from 'rxjs';

import { ParticipantProfile, ParticipantTournamentHistory } from '../../models/participant-profile';
import { DataService } from '../../service/data.service';
import { ParticipantProfileService } from '../../service/participant-profile.service';

@Component({
  selector: 'app-participant-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './participant-profile.component.html',
  styleUrls: ['./participant-profile.component.scss']
})
export class ParticipantProfileComponent implements OnInit {
  profile?: ParticipantProfile;
  loading = true;
  loadError = false;
  missing = false;
  private readonly failedImages = new Set<string>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly participantService: ParticipantProfileService,
    private readonly dataService: DataService,
    private readonly destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    this.dataService.setUrlName('participant');
    this.route.paramMap.pipe(
      switchMap(params => this.participantService.loadParticipant(params.get('participantId') ?? '')),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: profile => {
        this.profile = profile;
        this.loading = false;
        this.missing = !profile;
      },
      error: error => {
        console.error('Failed to load participant profile', error);
        this.loading = false;
        this.loadError = true;
      }
    });
  }

  placeLabel(place: number): string {
    return place === 1 ? 'Чемпион' : place === 2 ? '2 место' : place === 3 ? '3 место' : `${place} место`;
  }

  openTournament(event: MouseEvent, route: string): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void this.router.navigateByUrl(route);
  }

  hasFailedImage(key: string): boolean {
    return this.failedImages.has(key);
  }

  failImage(key: string): void {
    this.failedImages.add(key);
  }

  initials(value?: string): string {
    return (value || '?').split(/\s+/).filter(Boolean).slice(0, 2)
      .map(part => part.charAt(0)).join('').toLocaleUpperCase('ru');
  }

  trackTournament(_index: number, tournament: ParticipantTournamentHistory): string {
    return tournament.tournamentId;
  }

  formatScore(value: number): string {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value);
  }
}
