import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { RetroStanding, RetroTournament } from '../../models/retro-tournament';
import { DataService } from '../../service/data.service';
import { RetroTournamentService } from '../../service/retro-tournament.service';

@Component({
  selector: 'app-retro-tournament-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './retro-tournament-page.component.html',
  styleUrls: ['./retro-tournament-page.component.scss']
})
export class RetroTournamentPageComponent implements OnInit {
  tournament?: RetroTournament;
  loading = true;
  loadError = false;
  expandedParticipantId?: string;

  get hasMedals(): boolean {
    return this.tournament?.standings.some(standing => !!standing.medals) ?? false;
  }

  constructor(
    private readonly route: ActivatedRoute,
    private readonly retroTournamentService: RetroTournamentService,
    private readonly dataService: DataService,
    private readonly destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    const tournamentId = this.route.snapshot.paramMap.get('tournamentId') ?? '';
    this.dataService.setUrlName(tournamentId);
    this.retroTournamentService.loadTournament(tournamentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: tournament => {
          this.tournament = tournament;
          this.loading = false;
          this.loadError = !tournament;
        },
        error: error => {
          console.error('Failed to load retro tournament', error);
          this.loading = false;
          this.loadError = true;
        }
      });
  }

  toggleTours(standing: RetroStanding): void {
    this.expandedParticipantId = this.expandedParticipantId === standing.participantId
      ? undefined
      : standing.participantId;
  }

  trackStanding(_index: number, standing: RetroStanding): string {
    return `${standing.place}-${standing.participantId}`;
  }
}
