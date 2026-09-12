import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { LocalProfile, SeasonCompetitionFile } from '../../competition/models/competition.models';
import {
  ChampionsLeagueDrawResult,
  drawChampionsLeague,
  formatCompetitionMatches,
} from '../../draw/champions-league-draw';
import { DataService } from '../../service/data.service';
import { PersonalizedParticipantDirective } from '../../directives/personalized-participant.directive';

interface DrawSeasonOption {
  yearStart: number;
  label: string;
  dataUrl: string;
}

interface DrawTournamentOption {
  id: string;
  label: string;
  seasons: DrawSeasonOption[];
}

interface DrawOpponentView {
  profile: LocalProfile;
  potNumber: number;
}

interface DrawTeamView {
  profile: LocalProfile;
  opponents: DrawOpponentView[];
}

@Component({
  selector: 'app-draw-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PersonalizedParticipantDirective],
  templateUrl: './draw-page.component.html',
  styleUrls: ['./draw-page.component.scss'],
})
export class DrawPageComponent implements OnInit {
  readonly tournaments: DrawTournamentOption[] = [
    {
      id: 'champions-league',
      label: 'Лига чемпионов',
      seasons: [
        {
          yearStart: 2026,
          label: '2026/27',
          dataUrl: '/assets/data/seasons/2026-27/champions-league.json',
        },
      ],
    },
  ];

  selectedTournamentId = 'champions-league';
  selectedYear: number | null = 2026;
  pots: LocalProfile[][] = [];
  drawResult?: ChampionsLeagueDrawResult;
  teamResults: DrawTeamView[] = [];
  matchesJson = '';
  copyStatus = '';
  loading = false;
  loadError = '';
  drawError = '';

  private profileById = new Map<string, LocalProfile>();
  private potByProfileId = new Map<string, number>();
  private loadVersion = 0;

  constructor(
    private readonly http: HttpClient,
    private readonly destroyRef: DestroyRef,
    dataService: DataService,
  ) {
    dataService.setUrlName('champions-league');
  }

  ngOnInit(): void {
    this.onSeasonChange();
  }

  get seasons(): DrawSeasonOption[] {
    return this.tournaments.find(tournament => tournament.id === this.selectedTournamentId)?.seasons ?? [];
  }

  onTournamentChange(): void {
    this.selectedYear = null;
    this.clearDrawData();
  }

  onSeasonChange(): void {
    this.clearDrawData();
    const season = this.seasons.find(item => item.yearStart === this.selectedYear);
    if (!season) return;

    const currentLoad = ++this.loadVersion;
    this.loading = true;
    this.http.get<SeasonCompetitionFile>(season.dataUrl)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: file => {
          if (currentLoad !== this.loadVersion) return;
          try {
            this.applySeasonFile(file);
          } catch (error) {
            this.loadError = error instanceof Error ? error.message : 'Не удалось прочитать корзины турнира';
          } finally {
            this.loading = false;
          }
        },
        error: () => {
          if (currentLoad !== this.loadVersion) return;
          this.loading = false;
          this.loadError = 'Не удалось загрузить данные выбранного сезона';
        },
      });
  }

  runDraw(): void {
    this.drawError = '';
    try {
      this.drawResult = drawChampionsLeague(this.pots.map(pot => pot.map(profile => profile.id)));
      this.matchesJson = formatCompetitionMatches(this.drawResult);
      this.copyStatus = '';
      this.teamResults = this.pots.flat().map(profile => ({
        profile,
        opponents: this.drawResult!.opponentsByProfile[profile.id]
          .map(opponentId => ({
            profile: this.profileById.get(opponentId)!,
            potNumber: this.potNumber(opponentId),
          }))
          .sort((left, right) =>
            left.potNumber - right.potNumber || this.teamName(left.profile).localeCompare(this.teamName(right.profile), 'ru')
          ),
      }));
    } catch (error) {
      this.drawResult = undefined;
      this.teamResults = [];
      this.matchesJson = '';
      this.drawError = error instanceof Error ? error.message : 'Не удалось провести жеребьёвку';
    }
  }

  async copyMatchesJson(): Promise<void> {
    if (!this.matchesJson) return;
    try {
      await navigator.clipboard.writeText(this.matchesJson);
      this.copyStatus = 'Скопировано';
    } catch {
      this.copyStatus = 'Не удалось скопировать';
    }
  }

  profile(profileId: string): LocalProfile {
    return this.profileById.get(profileId)!;
  }

  teamName(profile: LocalProfile): string {
    return profile.teamName || profile.nick || profile.name;
  }

  potNumber(profileId: string): number {
    return this.potByProfileId.get(profileId)! + 1;
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith('/assets/logos/default.png')) image.src = 'assets/logos/default.png';
  }

  trackPot(index: number): number {
    return index;
  }

  trackProfile(_index: number, profile: LocalProfile): string {
    return profile.id;
  }

  trackTeamResult(_index: number, entry: DrawTeamView): string {
    return entry.profile.id;
  }

  trackRound(_index: number, round: { number: number }): number {
    return round.number;
  }

  trackMatch(_index: number, match: { home: string; away: string }): string {
    return `${match.home}-${match.away}`;
  }

  private applySeasonFile(file: SeasonCompetitionFile): void {
    const drawPots = file.config.drawPots;
    if (!drawPots?.length) throw new Error('Для выбранного сезона не настроены корзины жеребьёвки');

    this.profileById = new Map(file.profiles.map(profile => [profile.id, profile]));
    const missingProfiles = drawPots.flat().filter(profileId => !this.profileById.has(profileId));
    if (missingProfiles.length) {
      throw new Error(`Не найдены профили: ${missingProfiles.join(', ')}`);
    }

    this.pots = drawPots.map(pot => pot.map(profileId => this.profileById.get(profileId)!));
    this.potByProfileId = new Map();
    drawPots.forEach((pot, potIndex) => pot.forEach(profileId => this.potByProfileId.set(profileId, potIndex)));
  }

  private clearDrawData(): void {
    this.loadVersion++;
    this.pots = [];
    this.drawResult = undefined;
    this.teamResults = [];
    this.matchesJson = '';
    this.copyStatus = '';
    this.profileById.clear();
    this.potByProfileId.clear();
    this.loading = false;
    this.loadError = '';
    this.drawError = '';
  }
}
