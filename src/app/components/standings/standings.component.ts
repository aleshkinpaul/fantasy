// @ts-nocheck
import { Component, OnInit, Input } from '@angular/core';
import { DataService } from 'src/app/service/data.service';

@Component({
  selector: 'app-standings',
  templateUrl: './standings.component.html',
  styleUrls: ['./standings.component.scss']
})
export class StandingsComponent implements OnInit {
  @Input() profilesArr = [];
  @Input() playersRatingArr = [];
  @Input() lastTour = 1;
  @Input() squadsDetails = [];
  @Input() squads;
  @Input() chosenStage = '';
  @Input() chosenLeague = '';
  @Input() isShowUnitedTableByPoints = false;

  public windowWidth = 1400;

  constructor(
    public service: DataService
  ) {}

  ngOnInit(): void {
    this.windowWidth = window.innerWidth;
    window.addEventListener('resize', (e) => this.windowWidth = e.target.innerWidth);
  }

  getSquadDetails(profileId) {
    return this.squadsDetails.find(squad => squad.id === profileId);
  }

  getPlaceInTour(id, tour) {
    const standingsArr = Object.values(this.squads.data.players).map(player => {
      return {
        id: player.id,
        score: player.team.results_by_tour[tour].tour_score
      }
    });

    standingsArr.sort(this.service.sortByScore);
    standingsArr.forEach((player, ind) => {
      player.position =
        ind === 0 ? 
          1 :
          standingsArr[ind-1].score === player.score ? 
            standingsArr[ind-1].position : 
            standingsArr[ind-1].position + 1;
    });

    return standingsArr.find(player => player.id === id).position;
  }
}
