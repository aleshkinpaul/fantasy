import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { MatchCenterSelection } from '../../match-center/match-center.models';
import {
  RankedMatchInsight,
  RankedPlayerInsight,
  TourInsights,
} from '../../tour-insights/tour-insights.models';

@Component({
  selector: 'app-tour-insights',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tour-insights.component.html',
  styleUrls: ['./tour-insights.component.scss'],
})
export class TourInsightsComponent {
  @Input({ required: true }) insights!: TourInsights;
  @Input() yearStart = 0;
  @Input() yearEnd = 0;
  @Output() matchOpen = new EventEmitter<MatchCenterSelection>();
  readonly expandedPlayerLists = new Set<string>();

  openMatch(item: RankedMatchInsight): void {
    this.matchOpen.emit({ match: item.match, tour: this.insights.context.tour });
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
    if (!realTeamId || !this.yearStart || !this.yearEnd) return '';
    return `assets/logos/real-clubs/${this.yearStart}-${String(this.yearEnd).slice(-2)}/${realTeamId}.png`;
  }

  hideBrokenImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.style.display = 'none';
  }
}
