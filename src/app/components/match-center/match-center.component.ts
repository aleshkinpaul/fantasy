import { CommonModule, DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';

import { CompetitionMatch, SportPlayer } from '../../competition/models/competition.models';
import { IProfileDetails } from '../../models/domain';
import { buildMatchCenterTeam } from '../../match-center/match-center.builder';
import { MatchCenterTeam, MatchForecastView } from '../../match-center/match-center.models';

@Component({
  selector: 'app-match-center',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './match-center.component.html',
  styleUrls: ['./match-center.component.scss']
})
export class MatchCenterComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() match!: CompetitionMatch;
  @Input() tour = 1;
  @Input() lastTour = 1;
  @Input() yearStart = 0;
  @Input() yearEnd = 0;
  @Input() profiles: IProfileDetails[] = [];
  @Input() sportPlayers: SportPlayer[] = [];
  @Input() forecast: MatchForecastView | null = null;
  @Input() forecastLoading = false;

  @Output() closed = new EventEmitter<void>();

  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;

  teams: MatchCenterTeam[] = [];
  private readonly previousActiveElement: HTMLElement | null;
  private readonly previousBodyOverflow: string;

  constructor(@Inject(DOCUMENT) private readonly document: Document) {
    this.previousActiveElement = document.activeElement as HTMLElement | null;
    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  ngOnChanges(): void {
    if (!this.match) return;
    const home = this.profiles.find(profile => profile.id === this.match.home);
    const away = this.profiles.find(profile => profile.id === this.match.away);
    if (!home || !away) {
      this.teams = [];
      return;
    }
    this.teams = [
      buildMatchCenterTeam(home, this.tour, this.sportPlayers),
      buildMatchCenterTeam(away, this.tour, this.sportPlayers),
    ];
  }

  ngAfterViewInit(): void {
    this.closeButton?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    this.document.body.style.overflow = this.previousBodyOverflow;
    this.previousActiveElement?.focus();
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.close();
  }

  closeFromBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  close(): void {
    this.closed.emit();
  }

  isCompleted(): boolean {
    return this.tour <= this.lastTour
      && this.match.home_score !== undefined
      && this.match.away_score !== undefined;
  }

  getConfidenceLabel(): string {
    const confidence = this.forecast?.forecast?.confidence;
    if (confidence === 'high') return 'высокая';
    if (confidence === 'medium') return 'средняя';
    return 'низкая';
  }

  getScoreClass(teamIndex: 0 | 1): string {
    if (!this.isCompleted() || this.match.result === undefined) return '';
    if (this.match.result === 0) return 'draw-score';
    const isWinner = (teamIndex === 0 && this.match.result === 1)
      || (teamIndex === 1 && this.match.result === 2);
    return isWinner ? 'winner-score' : 'loser-score';
  }

  getClubLogoPath(realTeamId?: string): string {
    const season = `${this.yearStart}-${String(this.yearEnd).slice(-2)}`;
    return `assets/logos/real-clubs/${season}/${realTeamId}.png`;
  }

  hideMissingClubLogo(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
  }
}
