import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from 'src/app/service/data.service';
import { LoaderService } from 'src/app/service/loader.service';
import { Observable } from 'rxjs';
import { CompetitionMatch } from '../../competition/models/competition.models';
import { IProfileDetails } from '../../models/domain';

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

  getOpponentTeamId(matchesArr: CompetitionMatch[], profileId: string): string {
    const match = this.requireMatch(matchesArr, profileId);
    const opponentId = match.home === profileId ? match.away : match.home;
    return this.requireProfile(opponentId).team.id;
  }

  getOpponentTeamLogo(matchesArr: CompetitionMatch[], profileId: string): string {
    const match = this.requireMatch(matchesArr, profileId);
    const opponentId = match.home === profileId ? match.away : match.home;
    return this.requireProfile(opponentId).logo;
  }

  getOpponentTeamTitle(matchesArr: CompetitionMatch[], profileId: string): string {
    const match = this.requireMatch(matchesArr, profileId);
    const opponentId = match.home === profileId ? match.away : match.home;
    return this.requireProfile(opponentId).team.title;
  }

  private requireProfile(profileId: string): IProfileDetails {
    const profile = this.profilesArr.find(item => item.id === profileId);
    if (!profile) throw new Error(`Не найден профиль ${profileId}`);
    return profile;
  }

  private requireMatch(matches: CompetitionMatch[], profileId: string): CompetitionMatch {
    const match = matches.find(item => item.home === profileId || item.away === profileId);
    if (!match) throw new Error(`Не найден матч профиля ${profileId}`);
    return match;
  }
}

