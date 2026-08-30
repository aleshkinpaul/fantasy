import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { isHistoricalMartinLeagueMember } from '../../competition/config/martin-league.registry';
import { ArchiveCupLeg, ArchiveCupMatch, ArchiveCupRound, ArchiveCupTeam, ArchiveCupTournament } from '../../models/archive-cup';
import { ArchiveCupService } from '../../service/archive-cup.service';

@Component({
  selector: 'app-cup-page',
  templateUrl: './cup-page.component.html',
  styleUrls: ['./cup-page.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterLink],
})
export class CupPageComponent implements OnInit {
  tournament?: ArchiveCupTournament;
  loading = true;
  loadError = false;
  activeRoundId = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly archiveCupService: ArchiveCupService,
  ) {}

  ngOnInit(): void {
    const yearStart = Number(this.route.snapshot.queryParamMap.get('year') ?? 2024);
    this.archiveCupService.loadByYear(yearStart).subscribe({
      next: tournament => {
        this.tournament = tournament;
        this.activeRoundId = tournament?.rounds.at(-1)?.id ?? '';
        this.loading = false;
        this.loadError = !tournament;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  activeRound(tournament: ArchiveCupTournament): ArchiveCupRound | undefined {
    return tournament.rounds.find(round => round.id === this.activeRoundId)
      ?? tournament.rounds.at(-1);
  }

  selectRound(roundId: string): void {
    this.activeRoundId = roundId;
  }

  matchesCount(tournament: ArchiveCupTournament): number {
    return tournament.rounds.reduce((sum, round) => sum + round.matches.length, 0);
  }

  scoreFor(match: ArchiveCupMatch, team: ArchiveCupTeam): number {
    return team.profileId === match.first.profileId ? match.firstTotal : match.secondTotal;
  }

  legScoreFor(leg: ArchiveCupLeg, team: ArchiveCupTeam): number {
    return leg.homeProfileId === team.profileId ? leg.homeScore : leg.awayScore;
  }

  isWinner(match: ArchiveCupMatch, team: ArchiveCupTeam): boolean {
    return match.winnerProfileId === team.profileId;
  }

  isMartinLeagueMember(tournament: ArchiveCupTournament, team: ArchiveCupTeam): boolean {
    return isHistoricalMartinLeagueMember(tournament.yearStart, team.teamName);
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }
}
