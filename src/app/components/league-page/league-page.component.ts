// @ts-nocheck
import { Component, OnInit } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { IPlayers } from '../../models/model';
import { DataService } from '../../service/data.service';
import { Observable } from '@apollo/client';
import { BehaviorSubject, forkJoin } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { LoaderService } from 'src/app/service/loader.service';

@Component({
  selector: 'app-league-page',
  templateUrl: './league-page.component.html',
  styleUrls: ['./league-page.component.scss']
})
export class LeaguePageComponent implements OnInit {
  private data;
  public profiles;
  public consts;
  public squads;
  public teams;
  // public tours;
  // public squadsDetails = [];
	public squadsDetails = new BehaviorSubject<any[]>([])
  public squadsDetails$ = this.squadsDetails.asObservable();
	public tours = new BehaviorSubject<any[]>([])
  public tours$ = this.tours.asObservable();

  public teamsArr = [];
  public allSquads = [];
  public lastTour: number = 1;

  private playersArr = [];
  private ratingMax: number = 0;
  private ratingMed: number = 0;
  private ratingKoefs = [19, 15, 12, 10, 9];
  private lastToursDetails = [];
  private maxResultValue = 1;
  private minResultValue = 1;
  public playersRatingArr = [];

  public isLoading$?: Observable<boolean>;
  public windowWidth: number = 1400;

  constructor(
    private readonly apollo: Apollo, 
    public service: DataService, 
    private http: HttpClient,
    private route: ActivatedRoute,
    public loader: LoaderService
  ) {}

  ngOnInit() {
    this.service.setUrlName(this.route.snapshot.url[0].path);
    this.isLoading$ = this.loader.isLoading$;

    this.windowWidth = window.innerWidth;
    window.addEventListener('resize', (e) => this.windowWidth = e.target.innerWidth);

    forkJoin([
      this.service.getData('/assets/data/profiles.json'),
      this.service.getData('/assets/data/consts.json'),
      this.service.getData('/assets/data/teams.json'),
    ])
    .subscribe({
      next: ([profiles, consts, teams]) => {
        this.profiles = Object.values(profiles);
        this.consts = consts;
        this.consts = this.consts.league.find(x => x.type === this.route.snapshot.url[0].path);
        this.teams = teams;

        const sources = [];

        sources.push(this.http.get(this.consts.squad_link));
        if (!!this.consts.squad_link_2) sources.push(this.http.get(this.consts.squad_link_2));

        forkJoin([
          ...sources
        ])
        .subscribe({
          next: ([squads, squads_2]) => {
              this.squads = squads;
              if (!!squads_2) console.log('squads_2: ', squads_2);

              this.lastTour = Object.keys(this.squads.data.tours).length;

              this.playersArr = Object.values(this.squads.data.players).map(player => player.id);

              if (!!squads_2) {
                Object.values(this.squads.data.players)
                .forEach(player => {
                  // results
                  Object.values(player.team.results_by_tour)
                  .forEach((result, ind) => {
                    const tourCount = Object.keys(squads_2.data.players[player.id].team.results_by_tour).length;
                    result.total_score = (+result.total_score + +squads_2.data.players[player.id].team.results_by_tour[tourCount.toString()].total_score).toString();
                    player.team.results_by_tour[this.lastTour+ind+1] = result;
                  });
                  
                  Object.values(squads_2.data.players[player.id].team.results_by_tour)
                  .forEach((result, ind) => {
                    player.team.results_by_tour[ind+1] = result;
                  });
                  
                  // rosters
                  Object.values(player.team.rosters_by_tour)
                  .forEach((roster, ind) => {
                    const tourCount = Object.keys(squads_2.data.players[player.id].team.rosters_by_tour).length;
                    roster.total_score = (+roster.total_score + +squads_2.data.players[player.id].team.rosters_by_tour[tourCount.toString()].total_score).toString();
                    player.team.rosters_by_tour[this.lastTour+ind+1] = roster;
                  });
                  
                  Object.values(squads_2.data.players[player.id].team.rosters_by_tour)
                  .forEach((roster, ind) => {
                    player.team.rosters_by_tour[ind+1] = roster;
                  });
                });

                // tours
                Object.values(this.squads.data.tours)
                .forEach((tour, ind) => {
                  this.squads.data.tours[this.lastTour+ind+1] = {
                    ...tour,
                    number: (this.lastTour+ind+1).toString(),
                  }
                  
                  Object.values(squads_2.data.tours)
                  .forEach((tour, ind) => {
                    this.squads.data.tours[ind+1] = tour;
                  });
                });

                Object.values(squads_2.data.players)
                  .filter(player => !this.playersArr.includes(player.id))
                  .map(player => {
                    console.log('=== OLD:', player);
                    const resultsObj = {};

                    Object.values(player.team.results_by_tour).forEach((result, ind) => {
                      resultsObj[this.lastTour+ind+1] = result;
                    })                    

                    console.log('resultsObj', resultsObj);
                    
                    
                    this.squads.data.players.push(resultsObj);
                  });
                  
                this.playersArr = Object.values(this.squads.data.players).map(player => player.id);
                console.log('this.playersArr: ', this.playersArr);
              }

              this.lastTour = Object.keys(this.squads.data.tours).length;
              
              Object.values(this.squads.data.tours)
              .forEach((tour, ind) => {
                const objMaxMin = this.getMinMaxInTour(tour.number);
                tour.max = objMaxMin.max;
                tour.med = objMaxMin.med;
                tour.min = objMaxMin.min;
              });

              console.log('CHECK: ', this.squads.data.tours, this.lastTour);
              
              console.log('profiles', this.profiles);
              console.log('consts', this.consts);
              console.log('squads', this.squads);
              console.log('teams', this.teams);

              console.log('lastTour', this.lastTour);
              console.log(this.playersArr);

              console.log('calcRating()');

              this.calcRating();
              console.log('squads!!!', this.squads);

              this.playersArr.map(playerId => {
                const profile = this.profiles.find(profile => profile.id === playerId);
                
                if (!!profile) {
                  const squadInfo = this.squads.data.players[profile.id];
                  const objMedals = this.getMedalsInSeason(profile.id);

                  this.squadsDetails.next([...this.squadsDetails.value, {
                    id: squadInfo?.id,
                    name: squadInfo?.team.title || squads_2?.data.players[profile.id].team.title,
                    score: squadInfo?.team.results_by_tour[this.lastTour].total_score,
                    diff: this.lastTour > 1 ?
                      this.getPlaceAfterTour(profile.id, this.lastTour - 1) - this.getPlaceAfterTour(profile.id, this.lastTour)
                      : 0,
                    rating_of_prize_positions: objMedals.gold * 3 + objMedals.silver * 2 + objMedals.bronze,
                    gold_medals: objMedals.gold,
                    silver_medals: objMedals.silver,
                    bronze_medals: objMedals.bronze,
                    medals_count: objMedals.gold + objMedals.silver + objMedals.bronze,
                    totalPlaces: squadInfo?.team.results_by_tour[this.lastTour].total_place,
                    profile: profile,
                    team_id: squadInfo?.team.id,
                    info: squadInfo,
                    rating: this.squads.data.players[playerId].team.rating
                  }]);
                }
              })

              this.squadsDetails.next([...this.squadsDetails.value.sort(this.sortByScore)]);
              
              // Замены
              Object.values(this.squads.data.players).forEach((element, ind) => {
                const obj: IPlayers = {
                  points: 0,
                  transfers_count: 0,
                  team_title: '',
                  name: '',
                  team_id: '',
                  total_place: 0,
                  squads: []
                };
                
                obj.points = element.team.results_by_tour[this.lastTour.toString()].total_score;
                obj.team_title = element.team.title;
                obj.name = element.name;
                obj.team_id = element.team.id;
                obj.total_place = element.team.results_by_tour[this.lastTour].total_place;

                for (let i = 1; i <= this.lastTour; i++) {
                    const newSquad = (element.team.rosters_by_tour[i.toString()].players.base
                        .concat(element.team.rosters_by_tour[i.toString()].players.bench)
                    ).sort();
                    obj.squads.push(newSquad);
                    if (i > 1) obj.transfers_count += (newSquad.filter(n => obj.squads[i-2].indexOf(n) === -1)).length;
                }
                
                this.teamsArr.push(obj);
            });

            console.log('Команды, сорт. по трансферам: ', this.teamsArr.sort(sortByTransfersCount));
            console.log('Команды, сорт. по очкам: ', this.teamsArr.sort(sortByPointsCount));

            // Игроки
            Object.values(this.squads.data.players).forEach((element, ind) => {

                for (let i = 1; i <= this.lastTour; i++) {
                    const newSquad = (
                        element.team.rosters_by_tour[i.toString()].players.base
                        .concat(element.team.rosters_by_tour[i.toString()].players.bench)
                    );

                    // console.log('==:', allSquads, newSquad);

                    this.allSquads = this.allSquads.concat(newSquad);
                }
            });

            this.service.getData(`${this.consts.tour_link + this.lastTour}`)
              .subscribe(
                objPlayers => {
                  console.log('Игроки: ', objPlayers);
                  const players = [];
                  this.allSquads.forEach(pl => {
                    const currentObj = players.find(elem => elem.id === pl);
                    
                    if (!!currentObj) currentObj.count += 1
                    else players.push({
                        count: 1,
                        amplua: this.getPosition(objPlayers.data.players[pl].amplua_id),
                        name: objPlayers.data.players[pl].name,
                        team_name: this.getClubName(objPlayers.data.players[pl].team_id),
                        id: pl,
                        team_id: objPlayers.data.players[pl].team_id,
                    })
                  });

                  console.log('Игроки, сорт. по кол-ву пиков: ', players.sort(sortByCount));
                }       
              );

            function sortByTransfersCount(obj1, obj2) {
              return obj2.transfers_count - obj1.transfers_count;
            }

            function sortByPointsCount(obj1, obj2) {
              return obj2.points - obj1.points;
            }

            function sortByCount(obj1, obj2) {
              return obj2.count - obj1.count;
            }        
          },
          error: err => {
            console.error('Ошибка при получении данных:', err);
          }
        });
    }});
  }

  calcRating() {
    this.lastToursDetails = [
      this.getMinMaxInTour(this.lastTour),
      this.getMinMaxInTour(this.lastTour-1),
      this.getMinMaxInTour(this.lastTour-2),
      this.getMinMaxInTour(this.lastTour-3),
      this.getMinMaxInTour(this.lastTour-4),
    ];

    this.ratingMed = -this.ratingKoefs.reduce((acc, cur) => acc + cur, 0);

    this.maxResultValue = this.lastToursDetails.reduce((acc, cur, ind) =>
      acc + (cur.max - cur.med)/cur.med * this.ratingKoefs[ind]
    , 0) - this.ratingMed;

    this.minResultValue = this.lastToursDetails.reduce((acc, cur, ind) =>
      acc + (cur.min - cur.med)/cur.med * this.ratingKoefs[ind]
    , 0) - this.ratingMed;

    Object.values(this.squads.data.players).forEach(player => {
      const lastPlayerToursDetails = [
        this.squads.data.players[player.id].team.results_by_tour[this.lastTour].tour_score,
        this.squads.data.players[player.id].team.results_by_tour[this.lastTour-1].tour_score,
        this.squads.data.players[player.id].team.results_by_tour[this.lastTour-2].tour_score,
        this.squads.data.players[player.id].team.results_by_tour[this.lastTour-3].tour_score,
        this.squads.data.players[player.id].team.results_by_tour[this.lastTour-4].tour_score,
      ];
  
      const playersRating = this.lastToursDetails.reduce((acc, cur, ind) =>
        acc + (lastPlayerToursDetails[ind] - cur.med)/cur.med * this.ratingKoefs[ind]
      , 0);
  
      this.squads.data.players[player.id].team.rating = Math.round((playersRating - this.ratingMed)/this.maxResultValue*1000)/100;
      this.playersRatingArr.push(this.squads.data.players[player.id].team.rating);
    });

    this.playersRatingArr.sort((a, b) => a - b);
  }

  calcPlayerRating(id) {
    const lastPlayerToursDetails = [
      this.squads.data.players[id].team.results_by_tour[this.lastTour].tour_score,
      this.squads.data.players[id].team.results_by_tour[this.lastTour-1].tour_score,
      this.squads.data.players[id].team.results_by_tour[this.lastTour-2].tour_score,
      this.squads.data.players[id].team.results_by_tour[this.lastTour-3].tour_score,
      this.squads.data.players[id].team.results_by_tour[this.lastTour-4].tour_score,
    ];

    const playersRating = this.lastToursDetails.reduce((acc, cur, ind) =>
      acc + (lastPlayerToursDetails[ind] - cur.med)/cur.med * this.ratingKoefs[ind]
    , 0);

    

    return Math.round((playersRating - this.ratingMed)/this.maxResultValue*1000)/100;
  }

  getRgbForTour(score, max, min) {
    const value = (score - min)/(max - min);

    const colors = [
      { r: 183, g: 51, b: 42 }, // 0
      { r: 243, g: 169, b: 109 }, // 0.25
      { r: 255, g: 214, b: 102 }, // 0.5
      { r: 171, g: 201, b: 120 }, // 0.75
      { r: 55, g: 112, b: 82 }   // 1
    ];
    
    const lowerIndex = Math.floor(value * (colors.length - 1));
    const upperIndex = Math.min(lowerIndex + 1, colors.length - 1);
    const lowerColor = colors[lowerIndex];
    const upperColor = colors[upperIndex];
  
    const ratio = (value * (colors.length - 1)) - lowerIndex;
    const r = Math.round(lowerColor.r + (upperColor.r - lowerColor.r) * ratio);
    const g = Math.round(lowerColor.g + (upperColor.g - lowerColor.g) * ratio);
    const b = Math.round(lowerColor.b + (upperColor.b - lowerColor.b) * ratio);
  
    return `rgb(${r}, ${g}, ${b})`;
    // return `rgb(${Math.round(255 * (1 - value))}, ${Math.round(255 * value)}, ${0})`;
  }

  getMinMaxInTour(tourNum) {
    const tourResults = Object.values(this.squads.data.players)
      .map(player => player.team.results_by_tour[tourNum].tour_score);

    tourResults.sort(this.sortCustom);

    const resultObj = {
      max: tourResults[0],
      med: this.getMedian(tourResults),
      min: tourResults[tourResults.length - 1]
    };

    return resultObj; 
  }

  getMedalsInSeason(id) {
    const obj = {
      gold: 0,
      silver: 0,
      bronze: 0
    }

    for (let i = 1; i < this.lastTour + 1; i++) {
      const placeInTour = this.getPlaceInTour(id, i);

      obj.gold += +(placeInTour === 1);
      obj.silver += +(placeInTour === 2);
      obj.bronze += +(placeInTour === 3);
    }

    return obj;
  }

  getPlaceInTour(id, tour) {
    const standingsArr = Object.values(this.squads.data.players).map(player => {
      return {
        id: player.id,
        score: player.team.results_by_tour[tour].tour_score
      }
    });

    standingsArr.sort(this.sortByScore);
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

  getPlaceAfterTour(id, tour) {
    const standingsArr = Object.values(this.squads.data.players).map(player => {
      return {
        id: player.id,
        score: player.team.results_by_tour[tour].total_score
      }
    });

    standingsArr.sort(this.sortByScore);
    standingsArr.forEach((player, ind) => {
      player.position =
        ind === 0 ? 
          1 :
          standingsArr[ind-1].score === player.score ? 
            standingsArr[ind-1].position : 
            ind + 1;
    });

    return standingsArr.find(player => player.id === id).position;
  }

  getPosition(num) {
    if (num === "12") return 'нп';
    if (num === "11") return 'пз';
    if (num === "10") return 'зщ';
    if (num ===  "9") return 'вр';
    return '-';
  };

  getClubName(id) {
    const clubInfo = this.teams.find(team => team.id === id);
    return clubInfo?.name;
  }

  sortByScore(a,b) {
    return b.score - a.score;
  }

  sortCustom(a,b) {
    return (b - a);
  }
  
  getMedian(arr) {
    if (arr.length === 0) return 0; // Обработка пустого массива
  
    // Сортируем массив
    const sortedArr = arr.sort(this.sortCustom);
    const mid = Math.floor(sortedArr.length / 2);
  
    // Если длина массива нечетная, возвращаем средний элемент
    if (sortedArr.length % 2 !== 0) {
      return sortedArr[mid];
    }
  
    // Если длина массива четная, возвращаем среднее значение двух центральных элементов
    return (+sortedArr[mid - 1] + +sortedArr[mid]) / 2;
  }
}
