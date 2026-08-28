import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from 'src/app/service/data.service';
import { LoaderService } from 'src/app/service/loader.service';
import { Observable } from 'rxjs';
import { CompetitionMatch } from '../../competition/models/competition.models';
import { IActiveCompetitionTabs, IProfileDetails } from '../../models/domain';

@Component({
  selector: 'app-matches',
  templateUrl: './matches.component.html',
  styleUrls: ['./matches.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class MatchesComponent {
  @Input() profilesArr: IProfileDetails[] = [];
  @Input() currentLeagueMatches: CompetitionMatch[][] = [];
  @Input() lastTour = 1;
  @Input() firstTour = 1;
  @Input() activeTabs!: IActiveCompetitionTabs;
  @Input() matchesTours: number[] = [];

  public readonly isLoading$: Observable<boolean>;

  constructor(
    public readonly service: DataService,
    private readonly loader: LoaderService
  ) {
    this.isLoading$ = this.loader.isLoading$;
  }

  getMatchResult(matchesArr: CompetitionMatch[], profileId: string): 0 | 1 | 2 {
    const match = this.requireMatch(matchesArr, profileId);
    return match.result === 0 ? 0 :
      match.home === profileId ?
        (match.result === 1 ? 1 : 2) :
        (match.result === 2 ? 1 : 2);
  }

  getProfileInfo(profileId: string): IProfileDetails | undefined {
    return this.profilesArr.find(profile => profile.id === profileId);
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

  private requireProfile(profileId: string): IProfileDetails {
    const profile = this.getProfileInfo(profileId);
    if (!profile) throw new Error(`Не найден профиль ${profileId}`);
    return profile;
  }

  private requireMatch(matches: CompetitionMatch[], profileId: string): CompetitionMatch {
    const match = matches.find(item => item.home === profileId || item.away === profileId);
    if (!match) throw new Error(`Не найден матч профиля ${profileId}`);
    return match;
  }
}

