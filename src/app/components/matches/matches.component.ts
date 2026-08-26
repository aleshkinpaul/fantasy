import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from 'src/app/service/data.service';
import { LoaderService } from 'src/app/service/loader.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-matches',
  templateUrl: './matches.component.html',
  styleUrls: ['./matches.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class MatchesComponent {
  @Input() profilesArr = [];
  @Input() currentLeagueMatches = [];
  @Input() lastTour = 1;
  @Input() firstTour = 1;
  @Input() activeTabs;
  @Input() matchesTours = [];

  public readonly isLoading$: Observable<boolean>;

  constructor(
    public readonly service: DataService,
    private readonly loader: LoaderService
  ) {
    this.isLoading$ = this.loader.isLoading$;
  }

  getMatchResult(matchesArr, profileId) {
    const match = matchesArr.find(match => match.home === profileId || match.away === profileId);
    return match.result === 0 ? 0 :
      match.home === profileId ?
        (match.result === 1 ? 1 : 2) :
        (match.result === 2 ? 1 : 2)
  }

  getProfileInfo(profileId) {
    return this.profilesArr.find(profile => profile.id === profileId);
  }

  getTeamId(profileId) {
    return this.profilesArr.find(profile => profile.id === profileId).team.id;
  }

  getTeamLogo(profileId) {
    return this.profilesArr.find(profile => profile.id === profileId).logo;
  }

  getTeamTitle(profileId) {
    return this.profilesArr.find(profile => profile.id === profileId).team.title;
  }
}

