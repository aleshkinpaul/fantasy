// @ts-nocheck
import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from 'src/app/service/data.service';
import { LoaderService } from 'src/app/service/loader.service';

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.component.html',
  // styleUrls: ['./schedule.component.scss'],  // TODO: Fix corrupted SCSS files
  standalone: true,
  imports: [CommonModule]
})
export class ScheduleComponent implements OnInit {
  @Input() profilesArr = [];
  @Input() currentLeagueMatches = [];
  @Input() lastTour = 1;
  @Input() firstTour = 1;

  public windowWidth = 1400;
  public isLoading$?: Observable<boolean>;

  constructor(
    public service: DataService,
    public loader: LoaderService
  ) {}

  ngOnInit(): void {
    this.windowWidth = window.innerWidth;
    window.addEventListener('resize', (e) => this.windowWidth = e.target.innerWidth);

    this.isLoading$ = this.loader.isLoading$;
  }

  getMatchResult(matchesArr, profileId) {
    const match = matchesArr.find(match => match.home === profileId || match.away === profileId);
    const opponentId = match.home === profileId ? match.away : match.home;
    return match.result === 0 ? 0 :
      match.home === profileId ?
        (match.result === 1 ? 1 : 2) :
        (match.result === 2 ? 1 : 2)
  }

  getOpponentTeamId(matchesArr, profileId) {
    const match = matchesArr.find(match => match.home === profileId || match.away === profileId);
    const opponentId = match.home === profileId ? match.away : match.home;
    return this.profilesArr.find(profile => profile.id === opponentId).team.id;
  }

  getOpponentTeamLogo(matchesArr, profileId) {
    const match = matchesArr.find(match => match.home === profileId || match.away === profileId);
    const opponentId = match.home === profileId ? match.away : match.home;
    return this.profilesArr.find(profile => profile.id === opponentId).logo;
  }

  getOpponentTeamTitle(matchesArr, profileId) {
    const match = matchesArr.find(match => match.home === profileId || match.away === profileId);
    const opponentId = match.home === profileId ? match.away : match.home;
    return this.profilesArr.find(profile => profile.id === opponentId).team.title;
  }
}
