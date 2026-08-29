import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from 'src/app/service/data.service';
import { LoaderService } from 'src/app/service/loader.service';
import { Observable } from 'rxjs';
import { CompetitionMatch } from '../../competition/models/competition.models';
import { IProfileDetails } from '../../models/domain';
import {
  getMatchResultForProfile,
  getOpponentProfileId,
  requireProfile,
} from '../../competition/domain/competition-match-selectors';
import { MatchCenterSelection } from '../../match-center/match-center.models';

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class ScheduleComponent {
  @Input() profilesArr: IProfileDetails[] = [];
  @Input() currentLeagueMatches: CompetitionMatch[][] = [];
  @Input() lastTour = 1;
  @Input() firstTour = 1;
  @Output() matchOpen = new EventEmitter<MatchCenterSelection>();

  public readonly isLoading$: Observable<boolean>;

  constructor(
    public readonly service: DataService,
    private readonly loader: LoaderService
  ) {
    this.isLoading$ = this.loader.isLoading$;
  }

  getMatchResult(matchesArr: CompetitionMatch[], profileId: string): 0 | 1 | 2 {
    return getMatchResultForProfile(matchesArr, profileId);
  }

  getOpponentTeamId(matchesArr: CompetitionMatch[], profileId: string): string {
    const opponentId = getOpponentProfileId(matchesArr, profileId);
    return this.requireProfile(opponentId).team.id;
  }

  getOpponentTeamLogo(matchesArr: CompetitionMatch[], profileId: string): string {
    const opponentId = getOpponentProfileId(matchesArr, profileId);
    return this.requireProfile(opponentId).logo;
  }

  getOpponentTeamTitle(matchesArr: CompetitionMatch[], profileId: string): string {
    const opponentId = getOpponentProfileId(matchesArr, profileId);
    return this.requireProfile(opponentId).team.title;
  }

  openMatch(matches: CompetitionMatch[], profileId: string, tourIndex: number): void {
    const match = matches.find(item => item.home === profileId || item.away === profileId);
    if (!match) return;
    this.matchOpen.emit({ match, tour: this.firstTour + tourIndex });
  }

  private requireProfile(profileId: string): IProfileDetails {
    return requireProfile(this.profilesArr, profileId);
  }
}

