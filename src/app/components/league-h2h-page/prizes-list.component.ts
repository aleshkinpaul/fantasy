import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IPrizeNominee, IRuntimePrize } from '../../models/domain';
import { PersonalizedParticipantDirective } from '../../directives/personalized-participant.directive';

const MEDAL_IMAGES = [
  'assets/icons/prizes/gold-medal.png',
  'assets/icons/prizes/silver-medal.png',
  'assets/icons/prizes/bronze-medal.png',
] as const;
const DEFAULT_MEDAL_IMAGE = 'assets/icons/prizes/medal.png';

@Component({
  selector: 'app-prizes-list',
  templateUrl: './prizes-list.component.html',
  styleUrls: ['./prizes-list.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, PersonalizedParticipantDirective]
})
export class PrizesListComponent {
  @Input() prizes: IRuntimePrize[] = [];

  toggleShowAllNominees(prize: IRuntimePrize): void {
    prize.isShowAll = !prize.isShowAll;
  }

  shouldDisplay(
    isShowAll: boolean,
    index: number,
  ): boolean {
    if (isShowAll) return true;
    if (index >= 5) return false;
    return true;
  }

  getMedalImage(index: number): string {
    return MEDAL_IMAGES[index] ?? DEFAULT_MEDAL_IMAGE;
  }

  getPrizeImage(icon?: string): string {
    return icon || DEFAULT_MEDAL_IMAGE;
  }

  isUnusuitableItem(
    nominee: IPrizeNominee,
    activeLeaders: IPrizeNominee[],
    isShowAll: boolean,
  ): boolean {
    return isShowAll && !activeLeaders.includes(nominee);
  }

  getActivityBadgeClass(subsCoef: number): string {
    return subsCoef > 50 ? 'green-bg' : 'red-bg';
  }
}
