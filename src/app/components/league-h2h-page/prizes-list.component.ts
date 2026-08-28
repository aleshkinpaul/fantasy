import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IPrizeNominee, IRuntimePrize } from '../../models/domain';

@Component({
  selector: 'app-prizes-list',
  templateUrl: './prizes-list.component.html',
  styleUrls: ['./prizes-list.component.scss'],
  standalone: true,
  imports: [CommonModule]
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
    if (index === 0) return 'assets/logos/2025/icons/gold-medal.png';
    if (index === 1) return 'assets/logos/2025/icons/silver-medal.png';
    if (index === 2) return 'assets/logos/2025/icons/bronze-medal.png';
    return 'assets/logos/2025/icons/medal.png';
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
