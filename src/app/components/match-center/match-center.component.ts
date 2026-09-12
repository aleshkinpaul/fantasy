import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterModule } from '@angular/router';
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
import { IProfileDetails, IRosterPlayerMatchStat } from '../../models/domain';
import { buildMatchCenterTeam } from '../../match-center/match-center.builder';
import {
  MatchCenterPlayer,
  MatchCenterStatItem,
  MatchCenterTeam,
  MatchForecastView,
} from '../../match-center/match-center.models';
import { RealClubIndex } from '../../models/real-club';
import { PersonalizedParticipantDirective } from '../../directives/personalized-participant.directive';

@Component({
  selector: 'app-match-center',
  standalone: true,
  imports: [CommonModule, RouterModule, PersonalizedParticipantDirective],
  templateUrl: './match-center.component.html',
  styleUrls: ['./match-center.component.scss']
})
export class MatchCenterComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() match!: CompetitionMatch;
  @Input() tour = 1;
  @Input() tourEndsAt?: string;
  @Input() lastTour = 1;
  @Input() realClubIndex: RealClubIndex = new Map();
  @Input() profiles: IProfileDetails[] = [];
  @Input() sportPlayers: SportPlayer[] = [];
  @Input() forecast: MatchForecastView | null = null;
  @Input() forecastLoading = false;

  @Output() closed = new EventEmitter<void>();

  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;

  teams: MatchCenterTeam[] = [];
  expandedPlayerKey: string | null = null;
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
      buildMatchCenterTeam(home, this.tour, this.sportPlayers, this.isCompleted()),
      buildMatchCenterTeam(away, this.tour, this.sportPlayers, this.isCompleted()),
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

  togglePlayerDetails(teamIndex: number, playerId: string): void {
    const key = this.getPlayerKey(teamIndex, playerId);
    this.expandedPlayerKey = this.expandedPlayerKey === key ? null : key;
  }

  isPlayerExpanded(teamIndex: number, playerId: string): boolean {
    return this.expandedPlayerKey === this.getPlayerKey(teamIndex, playerId);
  }

  getPlayerDetailsId(teamIndex: number, playerId: string): string {
    return `player-details-${teamIndex}-${playerId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }

  handlePlayerKeydown(event: KeyboardEvent, teamIndex: number, playerId: string): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.togglePlayerDetails(teamIndex, playerId);
  }

  getTotalStatItems(player: MatchCenterPlayer): MatchCenterStatItem[] {
    const stats = player.stats;
    return this.nonZeroStats([
      { label: 'Матчей', value: stats.matchRecords },
      { label: 'Игровое время', value: player.playedMinutesLabel },
      { label: 'В старте', value: stats.starts },
      { label: 'Выходов с лавки', value: stats.substituteAppearances },
      { label: 'Полных матчей', value: stats.fullMatches },
      { label: 'Матчей 60+ минут', value: stats.sixtyMinuteMatches },
      { label: 'Голов', value: stats.goals },
      { label: 'Передач всего', value: stats.assists + stats.fantasyAssists },
      { label: 'Жёлтых карточек', value: stats.yellowCards },
      { label: 'Красных карточек', value: stats.redCards },
      { label: 'Сухих матчей', value: player.positionId === '12' ? 0 : stats.cleanSheets },
      { label: 'Сейвов', value: stats.shotSaves },
      { label: 'Отбитых пенальти', value: stats.penaltySaves },
      { label: 'Незабитых пенальти', value: stats.penaltiesMissed },
      { label: 'Заработанных пенальти', value: stats.penaltiesWon },
      { label: 'Привезённых пенальти', value: stats.penaltiesConceded },
      { label: 'Возвратов мяча', value: stats.ballRecoveries },
      { label: 'Пропущенных голов', value: stats.goalsAgainst },
      { label: 'Автоголов', value: stats.ownGoals },
    ]);
  }

  getMatchStatItems(player: MatchCenterPlayer, stat: IRosterPlayerMatchStat): MatchCenterStatItem[] {
    return this.nonZeroStats([
      { label: 'Минут', value: stat.match_time },
      { label: 'Голов', value: stat.goals },
      { label: 'Голевых передач', value: stat.assists },
      { label: 'Фэнтези-передач', value: stat.fantasy_assists },
      { label: 'Жёлтых карточек', value: stat.yellow_cards },
      { label: 'Красных карточек', value: stat.red_cards },
      { label: 'Сухой матч', value: player.positionId === '12' ? 0 : stat.clean_sheet },
      { label: 'Сейвов', value: stat.shot_saves },
      { label: 'Отбитых пенальти', value: stat.penalty_saves },
      { label: 'Незабитых пенальти', value: stat.penalty_missed },
      { label: 'Заработанных пенальти', value: stat.penalty_force },
      { label: 'Привезённых пенальти', value: stat.penalty_conceded },
      { label: 'Возвратов мяча', value: stat.ball_recovery },
      { label: 'Пропущенных голов', value: stat.goal_against },
      { label: 'Автоголов', value: stat.own_goals },
    ]);
  }

  getMatchAppearanceLabel(stat: IRosterPlayerMatchStat): string {
    const labels: string[] = [];
    if (stat.in_start_list) labels.push('в старте');
    if (stat.from_reserve) labels.push('вышел с лавки');
    if (stat.was_replaced) labels.push('заменён');
    if (stat.full_match) labels.push('полный матч');
    return labels.join(' · ') || 'без выхода на поле';
  }

  isCompleted(): boolean {
    if (this.tour > this.lastTour
      || this.match.home_score === undefined
      || this.match.away_score === undefined) return false;
    if (!this.tourEndsAt) return true;

    const endTimestamp = Date.parse(this.tourEndsAt.replace(' ', 'T'));
    return !Number.isFinite(endTimestamp) || Date.now() >= endTimestamp;
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

  getClubLogo(realTeamId?: string): string {
    return realTeamId ? this.realClubIndex.get(realTeamId)?.logo || '' : '';
  }

  hideMissingClubLogo(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
  }

  getPlayerStatusLabel(player: MatchCenterTeam['base'][number]): string {
    if (player.isAutoSubbedIn) return 'автозамена · в зачёте';
    if (player.isPlayed && player.isCounted) return 'сыграл · в зачёте';
    if (player.isPlayed) return 'сыграл · остался в запасе';
    if (player.participation === 'not-played') return 'не сыграл';
    if (player.participation === 'pending') return 'ожидает матча';
    return 'нет данных об участии';
  }

  private getPlayerKey(teamIndex: number, playerId: string): string {
    return `${teamIndex}:${playerId}`;
  }

  private nonZeroStats(items: MatchCenterStatItem[]): MatchCenterStatItem[] {
    return items.filter(item => typeof item.value === 'number'
      ? item.value > 0
      : item.value.trim().length > 0);
  }
}
