import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { MatchCenterSelection } from '../../match-center/match-center.models';
import {
  RankedMatchInsight,
  RankedPlayerInsight,
  InsightsPeriod,
  InsightsScope,
  TourInsights,
} from '../../tour-insights/tour-insights.models';
import { RealClubIndex } from '../../models/real-club';

@Component({
  selector: 'app-tour-insights',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tour-insights.component.html',
  styleUrls: ['./tour-insights.component.scss'],
})
export class TourInsightsComponent {
  @Input({ required: true }) insights!: TourInsights;
  @Input() scope: InsightsScope = 'league';
  @Input() period: InsightsPeriod = 'tour';
  @Input() realClubIndex: RealClubIndex = new Map();
  @Output() matchOpen = new EventEmitter<MatchCenterSelection>();
  @Output() scopeChange = new EventEmitter<InsightsScope>();
  @Output() periodChange = new EventEmitter<InsightsPeriod>();
  readonly expandedPlayerLists = new Set<string>();

  openMatch(item: RankedMatchInsight): void {
    this.matchOpen.emit({ match: item.match, tour: item.tour });
  }

  setScope(scope: InsightsScope): void {
    if (this.scope === scope) return;
    this.expandedPlayerLists.clear();
    this.scopeChange.emit(scope);
  }

  setPeriod(period: InsightsPeriod): void {
    if (this.period === period) return;
    this.expandedPlayerLists.clear();
    this.periodChange.emit(period);
  }

  get expectedObservations(): number {
    return this.insights.context.teamsCount * this.insights.context.toursCount;
  }

  get isSeason(): boolean {
    return this.insights.context.period === 'season';
  }

  visiblePlayerItems(items: RankedPlayerInsight[], key: string): RankedPlayerInsight[] {
    return this.expandedPlayerLists.has(key) ? items : items.slice(0, 5);
  }

  togglePlayerList(key: string): void {
    this.expandedPlayerLists.has(key)
      ? this.expandedPlayerLists.delete(key)
      : this.expandedPlayerLists.add(key);
  }

  getPositionLabel(positionId?: string): string {
    return ({ '9': 'ВР', '10': 'ЗЩ', '11': 'ПЗ', '12': 'НП' } as Record<string, string>)[positionId || ''] || '—';
  }

  getRealClubLogo(realTeamId?: string): string {
    return realTeamId ? this.realClubIndex.get(realTeamId)?.logo || '' : '';
  }

  getRealClubName(realTeamId: string): string {
    return this.realClubIndex.get(realTeamId)?.name || `Клуб #${realTeamId}`;
  }

  hideBrokenImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.style.display = 'none';
  }
}
