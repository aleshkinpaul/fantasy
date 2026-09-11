import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DataService } from 'src/app/service/data.service';
import { LoaderService } from 'src/app/service/loader.service';
import { Observable } from 'rxjs';
import { CompetitionMatch } from '../../competition/models/competition.models';
import { IActiveCompetitionTabs, IProfileDetails } from '../../models/domain';
import {
  findProfile,
  getMatchResultForProfile,
  requireProfile,
} from '../../competition/domain/competition-match-selectors';
import { MatchCenterSelection } from '../../match-center/match-center.models';

@Component({
  selector: 'app-matches',
  templateUrl: './matches.component.html',
  styleUrls: ['./matches.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class MatchesComponent {
  @Input() profilesArr: IProfileDetails[] = [];
  @Input() currentLeagueMatches: CompetitionMatch[][] = [];
  @Input() lastTour = 1;
  @Input() firstTour = 1;
  @Input() activeTabs!: IActiveCompetitionTabs;
  @Input() matchesTours: number[] = [];
  @Input() showMartinLeague = false;
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

  getProfileInfo(profileId: string): IProfileDetails | undefined {
    return findProfile(this.profilesArr, profileId);
  }

  getTeamId(profileId: string): string {
    return this.requireProfile(profileId).team.id;
  }

  getTeamLogo(profileId: string): string {
    return this.requireProfile(profileId).logo;
  }

  getTeamTitle(profileId: string): string {
    return this.requireProfile(profileId).team.title;
  }

  isMartinLeagueMember(profileId: string): boolean {
    return this.showMartinLeague && this.getProfileInfo(profileId)?.isMartin === 1;
  }

  openMatch(match: CompetitionMatch, tourIndex: number): void {
    const tour = this.matchesTours.length
      ? this.matchesTours[tourIndex]
      : this.firstTour + tourIndex;
    this.matchOpen.emit({ match, tour });
  }

  private requireProfile(profileId: string): IProfileDetails {
    return requireProfile(this.profilesArr, profileId);
  }
}

