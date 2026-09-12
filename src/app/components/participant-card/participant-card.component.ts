import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { RouterModule } from '@angular/router';

import { IProfileDetails } from '../../models/domain';
import { PersonalizedParticipantDirective } from '../../directives/personalized-participant.directive';

@Component({
  selector: 'app-participant-card',
  standalone: true,
  imports: [CommonModule, RouterModule, PersonalizedParticipantDirective],
  templateUrl: './participant-card.component.html',
  styleUrls: ['./participant-card.component.scss']
})
export class ParticipantCardComponent implements OnChanges {
  @Input() profile!: IProfileDetails;
  @Input() competitionType = 'spain';

  imageFailed = false;

  ngOnChanges(): void {
    this.imageFailed = false;
  }

  onImageError(): void {
    this.imageFailed = true;
  }

  getInitials(): string {
    const source = this.profile?.team?.title || this.profile?.name || '?';
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toLocaleUpperCase('ru');
  }

  getTeamUrl(): string {
    if (this.profile?.team?.id) {
      return `https://www.sports.ru/fantasy/football/${this.competitionType}/${this.profile.team.id}`;
    }
    return this.profile?.url || '#';
  }
}
