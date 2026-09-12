import { Component, DestroyRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DataService } from 'src/app/service/data.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PersonalizationState } from 'src/app/models/personalization';
import { PersonalizationService } from 'src/app/service/personalization.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class HeaderComponent implements OnInit {
  public isMain: boolean = true;
  public subTitle: string = '';
  public name: string = '';

  constructor(
    private readonly service: DataService,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
    readonly personalization: PersonalizationService,
  ) {}

  ngOnInit(): void {
    this.service.urlName$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(name => {
      this.isMain = !name;
      this.name = name;
      this.subTitle = '';
      if (!this.isMain) {
        this.subTitle =
          name === 'spain'            ? 'Ла Лига'         :
          name === 'tournaments'      ? 'Турниры'         :
          name === 'champions-league' ? 'Лига Чемпионов'  :
          name === 'spain-cup'        ? 'Кубок Испании'   : 
          name === 'club-world-cup'   ? 'Клубный ЧМ'      :
          name === 'hall-of-fame'     ? 'Зал славы'       :
          name === 'rating'           ? 'Рейтинг'         :
          name === 'participant'      ? 'Участник'        : '';
      }
    });
  }
  
  goHome () {
    this.router.navigateByUrl('/');
    this.service.setUrlName('');
  };

  clearContext(): void {
    this.service.setUrlName('');
  }

  personalizationLabel(state: PersonalizationState): string {
    if (state.mode === 'participant') return state.selectedParticipant?.name ?? 'Выбрать участника';
    if (state.mode === 'guest') return 'Гость';
    return 'Выбрать участника';
  }
}
