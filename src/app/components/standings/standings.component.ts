import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from 'src/app/service/data.service';
import { FantasyFullInfoResponse } from '../../competition/models/competition.models';
import { IProfileDetails, ISquadDetails } from '../../models/domain';

interface StandingPlayer {
  id: string;
  score: string;
  position: number;
}

@Component({
  selector: 'app-standings',
  templateUrl: './standings.component.html',
  styleUrls: ['./standings.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class StandingsComponent {
  @Input() profilesArr: IProfileDetails[] = [];
  @Input() playersRatingArr: number[] = [];
  @Input() lastTour = 1;
  @Input() squadsDetails: ISquadDetails[] = [];
  @Input() squads!: FantasyFullInfoResponse;
  @Input() chosenStage = '';
  @Input() chosenLeague = '';
  @Input() isShowUnitedTableByPoints = false;

  constructor(
    public service: DataService
  ) {}

  getSquadDetails(profileId: string): ISquadDetails | undefined {
    return this.squadsDetails.find(squad => squad.id === profileId);
  }

  getPlaceInTour(id: string, tour: string | number): number | undefined {
    const players = Object.values(this.squads.data.players);
    const standingsArr: StandingPlayer[] = players.map(player => {
      return {
        id: player.id,
        score: player.team.results_by_tour[tour].tour_score,
        position: 0
      }
    });

    standingsArr.sort((left, right) => Number(right.score) - Number(left.score));
    standingsArr.forEach((player, ind) => {
      player.position =
        ind === 0 ? 
          1 :
          standingsArr[ind-1].score === player.score ? 
            standingsArr[ind-1].position : 
            standingsArr[ind-1].position + 1;
    });

    return standingsArr.find(player => player.id === id)?.position;
  }
}
