// @ts-nocheck
import { Component, OnInit } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { IPlayers } from '../../models/model';
import { DataService } from '../../service/data.service';
import { Observable } from '@apollo/client';
import { BehaviorSubject, forkJoin } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { LoaderService } from 'src/app/service/loader.service';

@Component({
  selector: 'app-league-h2h-page',
  templateUrl: './league-h2h-page.component.html',
  styleUrls: ['./league-h2h-page.component.scss']
})
export class LeagueH2HPageComponent implements OnInit {
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
  public activeTabs = {
    tabId: 1,
    confId: 0,
    confTabId: 1,
    tourId: 1
  }

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
  private drawGap = 0;

  public isLoading$?: Observable<boolean>;
  public windowWidth: number = 1400;

  constructor(
    private readonly apollo: Apollo, 
    public service: DataService, 
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    public loader: LoaderService
  ) {}

  ngOnInit() {
    const yearParam = +this.route.snapshot.queryParams?.year || '';
    // console.log('snapshot: ', this.route.snapshot);
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
        this.profiles = Object.values(profiles[yearParam]);
        this.consts = consts;
        this.consts = this.consts.league.find(x =>
          x.type === this.route.snapshot.url[0].path
          && ( x.yearStart === yearParam || !yearParam )
        );
        this.drawGap = this.consts.drawGap || 0; 
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

              this.lastTour = Object.keys(this.squads.data.tours).length;
              
              this.updateTabs();

              this.playersArr = Object.values(this.squads.data.players).map(player => player.id);
              
              console.log('this.squads.data.tours', this.squads.data.tours, this.lastTour);

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

              const squadDetailsValue = [];

              this.consts.stages.forEach((stage, stageInd) => {
                const stageSquadsObj = [];

                if (this.lastTour >= stage.firstTour)
                  stage.leagues.forEach((league, leagueInd) => {
                    const profiles = league.profiles;
                    league.profilesDetails = profiles.map(x => {
                      const profileInfo = this.profiles.find(profile => profile.id === x);
                      profileInfo.team = this.squads.data.players[x].team;
                      profileInfo.results = {
                        wins: 0,
                        draws: 0,
                        loses: 0,
                        points: 0,
                        fo: 0,
                        missed_fo: 0
                      };
                      return profileInfo;
                    });

                    const matches = league.matches;
                    league.matchesByTours = [];
                    for (let i = 0; i < Object.keys(matches).length; i++) {
                      league.matchesByTours.push(matches[i + 1])
                    }

                    console.log('league.profilesDetails', league.profilesDetails);
                    for (let i = 0; i < this.lastTour; i++) {  
                      matches[i + 1].forEach(match => {
                        match.home_score = +this.squads.data.players[match.home].team.results_by_tour[i + 1].tour_score;
                        match.away_score = +this.squads.data.players[match.away].team.results_by_tour[i + 1].tour_score;
                        match.result = Math.abs(match.home_score - match.away_score) <= this.drawGap ? 0 :
                          match.home_score > match.away_score ? 1 : 2

                        const homeProfile = league.profilesDetails.find(x => x.id === match.home);
                        const awayProfile = league.profilesDetails.find(x => x.id === match.away);
                        
                        homeProfile.results.fo += match.home_score;
                        homeProfile.results.missed_fo += match.away_score;
                        homeProfile.results.diff_fo = homeProfile.results.fo - homeProfile.results.missed_fo;
                        
                        awayProfile.results.fo += match.away_score;
                        awayProfile.results.missed_fo += match.home_score;
                        awayProfile.results.diff_fo = awayProfile.results.fo - awayProfile.results.missed_fo;

                        if (match.result === 0) {
                          homeProfile.results.draws += 1
                          awayProfile.results.draws += 1

                          homeProfile.results.points += 1
                          awayProfile.results.points += 1
                        }

                        if (match.result === 1) {
                          homeProfile.results.wins += 1
                          awayProfile.results.loses += 1

                          homeProfile.results.points += 3
                        }

                        if (match.result === 2) {
                          awayProfile.results.wins += 1
                          homeProfile.results.loses += 1

                          awayProfile.results.points += 3
                        }
                      })

                      console.log('sorted', league.profilesDetails.sort(this.sortStandings));
                      
                      league.profilesDetails = Object.assign([], league.profilesDetails.sort(this.sortStandings))
                    }

                    console.log(leagueInd, league)
                  });
              });

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
                    
                    if (element.team.id === "340148") {
                      console.log('ind:', i, 'newSquad', newSquad);

                      if (i > 1)
                        console.log('newPlayers', newSquad
                          .filter(n => obj.squads[i-2].indexOf(n) === -1), newSquad
                          .filter(n => obj.squads[i-2].indexOf(n) === -1).length);
                    }

                    if (i > 1) obj.transfers_count += (
                      newSquad
                        // .map(squad => squad.)
                        .filter(n => obj.squads[i-2].indexOf(n) === -1)
                    ).length;
                }
                
                this.teamsArr.push(obj);
            });

            console.log('Команды, сорт. по трансферам: ', this.teamsArr.sort(this.sortByTransfersCount));
            console.log('Команды, сорт. по очкам: ', this.teamsArr.sort(this.sortByPointsCount));

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

                  console.log('Игроки, сорт. по кол-ву пиков: ', players.sort(this.sortByCount));
                }       
              ); 
          },
          error: err => {
            console.error('Ошибка при получении данных:', err);
          }
        });
    }});
  }

  setTabId(ind) {
    this.activeTabs.tabId = ind;
    this.setQueryParam({ tabId: ind })
  }

  setConfId(ind) {
    this.activeTabs.confId = ind;
    this.setQueryParam({ confId: ind })
  }

  setConfTabId(ind) {
    this.activeTabs.confTabId = ind;
    this.setQueryParam({ confTabId: ind })
  }

  setTourId(ind) {
    this.activeTabs.tourId = ind;
    this.setQueryParam({ tourId: ind })
  }

  updateTabs() {    
    const tabIdParam = +this.route.snapshot.queryParams?.tabId || '';
    const confIdParam = +this.route.snapshot.queryParams?.confId || '';
    const confTabIdParam = +this.route.snapshot.queryParams?.confTabId || '';
    const activeTourIdParam = +this.route.snapshot.queryParams?.tourId || '';

    if (!!confIdParam) this.activeTabs.confId = confIdParam;
    if (!!confTabIdParam) this.activeTabs.confTabId = confTabIdParam;
    if (!!tabIdParam) this.activeTabs.tabId = tabIdParam;
    this.activeTabs.tourId = !!activeTourIdParam ? activeTourIdParam : this.lastTour;
  }

  sortStandings(a, b) {
    if (a.results.points > b.results.points) return -1;
    if (a.results.points < b.results.points) return 1;
    
    if (a.results.diff_fo > b.results.diff_fo) return -1;
    if (a.results.diff_fo < b.results.diff_fo) return 1;
    
    if (a.results.fo > b.results.fo) return -1;
    if (a.results.fo < b.results.fo) return 1;

    return 0;
  }

  getProfileRating(profileId) {
    const profile = this.squadsDetails.value.find(x => x.id === profileId);
    return profile.rating;
  }

  setQueryParam(newParam) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: newParam,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  getTeamLogo(profileId) {
    return this.profiles.find(profile => profile.id === profileId).logo;
  }

  getTeamTitle(profileId) {
    return this.profiles.find(profile => profile.id === profileId).team.title;
  }

  getProfileInfo(profileId) {
    return this.profiles.find(profile => profile.id === profileId);
  }

  getOpponentTeamLogo(matchesArr, profileId) {
    const match = matchesArr.find(match => match.home === profileId || match.away === profileId);
    const opponentId = match.home === profileId ? match.away : match.home;
    return this.profiles.find(profile => profile.id === opponentId).logo;
  }

  getOpponentTeamTitle(matchesArr, profileId) {
    const match = matchesArr.find(match => match.home === profileId || match.away === profileId);
    const opponentId = match.home === profileId ? match.away : match.home;
    return this.profiles.find(profile => profile.id === opponentId).team.title;
  }

  getMatchResult(matchesArr, profileId) {
    const match = matchesArr.find(match => match.home === profileId || match.away === profileId);
    const opponentId = match.home === profileId ? match.away : match.home;
    return match.result === 0 ? 0 :
      match.home === profileId ?
        (match.result === 1 ? 1 : 2) :
        (match.result === 2 ? 1 : 2)
  }

  sortByTransfersCount(obj1, obj2) {
    return obj2.transfers_count - obj1.transfers_count;
  }

  sortByPointsCount(obj1, obj2) {
    return +obj2.points - +obj1.points;
  }

  sortByCount(obj1, obj2) {
    return obj2.count - obj1.count;
  }       

  calcRating() {
    this.lastToursDetails = [];

    for (let i = 0; i < this.lastTour; i++) {
      if (i > 4) break;
      this.lastToursDetails.push(this.getMinMaxInTour(this.lastTour - i));
    }

    this.ratingMed = -this.ratingKoefs.reduce((acc, cur) => acc + cur, 0);

    this.maxResultValue = this.lastToursDetails.reduce((acc, cur, ind) =>
      acc + (cur.max - cur.med)/cur.med * this.ratingKoefs[ind]
    , 0) - this.ratingMed;

    this.minResultValue = this.lastToursDetails.reduce((acc, cur, ind) =>
      acc + (cur.min - cur.med)/cur.med * this.ratingKoefs[ind]
    , 0) - this.ratingMed;

    Object.values(this.squads.data.players).forEach(player => {
      const lastPlayerToursDetails = [];

      for (let i = 0; i < this.lastTour; i++) {
        if (i > 4) break;
        lastPlayerToursDetails.push(this.squads.data.players[player.id].team.results_by_tour[this.lastTour - i].tour_score);
      }
  
      const playersRating = this.lastToursDetails.reduce((acc, cur, ind) =>
        acc + (lastPlayerToursDetails[ind] - cur.med)/cur.med * this.ratingKoefs[ind]
      , 0);
  
      this.squads.data.players[player.id].team.rating = Math.round((playersRating - this.ratingMed)/this.maxResultValue*1000)/100;
      this.playersRatingArr.push(this.squads.data.players[player.id].team.rating);
    });

    this.playersRatingArr.sort((a, b) => a - b);
  }

  calcPlayerRating(id) {
    const lastPlayerToursDetails = [];

      for (let i = 0; i < this.lastTour; i++) {
        if (i > 4) break;
        lastPlayerToursDetails.push(this.squads.data.players[id].team.results_by_tour[this.lastTour - i].tour_score);
      }

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
      .map(player => player.team.results_by_tour[tourNum.toString()].tour_score);

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
