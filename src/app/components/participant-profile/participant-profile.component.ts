import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';

import {
  ParticipantAccount,
  ParticipantProfile,
  ParticipantSponsorPrizeVictory,
  ParticipantTournamentHistory,
} from '../../models/participant-profile';
import { DataService } from '../../service/data.service';
import { ParticipantProfileService } from '../../service/participant-profile.service';
import {
  buildParticipantTournamentOptions,
  matchesParticipantTournamentFilters,
  ParticipantTournamentTypeId,
} from '../../participant-profile/participant-tournament-type';
import {
  buildParticipantSeasonGroups,
  participantTournamentTopDownOrder,
  ParticipantSeasonGroup,
} from '../../participant-profile/participant-profile-timeline';

interface ProfileTrophy {
  id: string;
  icon: string;
  title: string;
  tournamentTitle: string;
  period: string;
  route: string;
  teamLabel?: string;
}

@Component({
  selector: 'app-participant-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './participant-profile.component.html',
  styleUrls: ['./participant-profile.component.scss']
})
export class ParticipantProfileComponent implements OnInit {
  profile?: ParticipantProfile;
  loading = true;
  loadError = false;
  missing = false;
  seasonFilter: number | 'all' = 'all';
  tournamentFilter: ParticipantTournamentTypeId | 'all' = 'all';
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

  get seasonOptions(): Array<{ year: number; period: string }> {
    if (!this.profile) return [];
    const periods = new Map<number, string>();
    this.profile.tournaments.forEach(tournament => periods.set(tournament.yearStart, tournament.period));
    return Array.from(periods, ([year, period]) => ({ year, period }))
      .sort((left, right) => right.year - left.year);
  }

  get tournamentOptions(): Array<{ id: ParticipantTournamentTypeId; label: string; order: number }> {
    return buildParticipantTournamentOptions(this.profile?.tournaments ?? []);
  }

  get seasonGroups(): ParticipantSeasonGroup[] {
    if (!this.profile) return [];
    return buildParticipantSeasonGroups(this.profile.tournaments);
  }

  get trophyShelf(): ProfileTrophy[] {
    return (this.profile?.tournaments ?? []).flatMap(tournament =>
      tournament.achievements
        .filter(achievement => achievement.place === 1)
        .map(achievement => ({
          id: achievement.id,
          icon: achievement.trophyIcon,
          title: achievement.titleTypeLabel,
          tournamentTitle: tournament.title,
          period: tournament.period,
          route: tournament.route,
          teamLabel: achievement.isTeamAchievement ? achievement.recipientLabel : undefined,
        }))
    );
  }

  get sponsorPrizeShelf(): ParticipantSponsorPrizeVictory[] {
    return this.profile?.sponsorPrizeVictories ?? [];
  }

  tournamentTimelineOrder(tournament: ParticipantTournamentHistory): number {
    return participantTournamentTopDownOrder(tournament);
  }

  get filteredStats(): {
    tournaments: number;
    coveredTournaments: number;
    tours: number;
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    winRate: number;
    points: number;
    totalScore: number;
    averageScore: number;
    maxScore?: number;
    scoreFor: number;
    scoreAgainst: number;
    scoreDifference: number;
    bestPlace?: number;
    titles: number;
    podiums: number;
  } {
    const tournaments = (this.profile?.tournaments ?? []).filter(tournament =>
      matchesParticipantTournamentFilters(tournament, this.seasonFilter, this.tournamentFilter));
    const covered = tournaments.filter(tournament => tournament.stats);
    const stats = covered.map(tournament => tournament.stats!);
    const matches = stats.reduce((sum, item) => sum + (item.matchesPlayed ?? 0), 0);
    const wins = stats.reduce((sum, item) => sum + (item.wins ?? 0), 0);
    const tours = stats.reduce((sum, item) => sum + item.toursPlayed, 0);
    const totalScore = stats.reduce((sum, item) => sum + item.totalScore, 0);
    const places = stats.map(item => item.place).filter((place): place is number => place !== undefined);
    const achievements = tournaments.flatMap(tournament => tournament.achievements);
    return {
      tournaments: tournaments.length,
      coveredTournaments: covered.length,
      tours,
      matches,
      wins,
      draws: stats.reduce((sum, item) => sum + (item.draws ?? 0), 0),
      losses: stats.reduce((sum, item) => sum + (item.losses ?? 0), 0),
      winRate: matches ? Math.round(wins / matches * 1000) / 10 : 0,
      points: stats.reduce((sum, item) => sum + (item.points ?? 0), 0),
      totalScore,
      averageScore: tours ? Math.round(totalScore / tours * 10) / 10 : 0,
      maxScore: stats.length ? Math.max(...stats.map(item => item.maxScore)) : undefined,
      scoreFor: stats.reduce((sum, item) => sum + (item.scoreFor ?? 0), 0),
      scoreAgainst: stats.reduce((sum, item) => sum + (item.scoreAgainst ?? 0), 0),
      scoreDifference: stats.reduce((sum, item) => sum + (item.scoreDifference ?? 0), 0),
      bestPlace: places.length ? Math.min(...places) : undefined,
      titles: achievements.filter(achievement => achievement.place === 1).length,
      podiums: achievements.length,
    };
  }

  tournamentResultLabel(tournament: ParticipantTournamentHistory): string {
    const bestAchievement = [...tournament.achievements].sort((left, right) => left.place - right.place)[0];
    if (bestAchievement) {
      return `${this.placeLabel(bestAchievement.place)} · ${bestAchievement.stageTitle}`;
    }
    if (tournament.stats?.place) {
      return `${tournament.stats.place} место${tournament.status === 'active' ? ' сейчас' : ''}`;
    }
    return tournament.statusLabel;
  }

  accountUrl(account: ParticipantAccount): string | undefined {
    return account.url || (/^\d+$/.test(account.profileId)
      ? `https://www.sports.ru/profile/${account.profileId}/`
      : undefined);
  }

  telegramUrl(account: ParticipantAccount): string | undefined {
    const username = account.telegram?.trim().replace(/^@/, '');
    return username ? `https://t.me/${username}` : undefined;
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

  trackAccount(_index: number, account: ParticipantAccount): string {
    return account.profileId;
  }

  trackTrophy(_index: number, trophy: ProfileTrophy): string {
    return trophy.id;
  }

  trackSponsorPrize(_index: number, prize: ParticipantSponsorPrizeVictory): string {
    return prize.id;
  }

  formatScore(value: number): string {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value);
  }
}
