// @ts-nocheck
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IPlayers } from '../../models/model';
import { DataService } from '../../service/data.service';
import { BehaviorSubject, forkJoin, Observable } from 'rxjs';
import { ISquadDetails, IProfileDetails, IContsConfig } from '../../models/domain';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { LoaderService } from 'src/app/service/loader.service';
import { logger } from '../../utils/logger';
import { StandingsComponent } from '../standings/standings.component';
import { ScheduleComponent } from '../schedule/schedule.component';
import { MatchesComponent } from '../matches/matches.component';
import { HeaderComponent } from '../header/header.component';
import { DefaultLoaderComponent } from '../loader/default-loader.component';
import { PrizesListComponent } from './prizes-list.component';
import { LeagueH2HDataService } from './league-h2h-data.service';
import { CompetitionDataLoaderService } from '../../competition/data/competition-data-loader.service';
import { CompetitionType } from '../../competition/models/competition.models';
import { calculateCup } from '../../competition/domain/cup-calculator';
import {
  calculateChampionsLeaguePrizes,
  calculateSpainPrizes,
  calculateWorldCupPrizes,
} from '../../competition/domain/prize-calculator';
import {
  buildLeagueRatings,
  compareByFantasyScore,
  compareStandings,
  getPlaceAfterTour as calculatePlaceAfterTour,
  getSeasonMedals,
} from '../../competition/domain/standings-calculator';

@Component({
  selector: 'app-league-h2h-page',
  templateUrl: './league-h2h-page.component.html',
  styleUrls: ['./league-h2h-page.component.scss'],
  standalone: true,
  imports: [CommonModule, StandingsComponent, ScheduleComponent, MatchesComponent, HeaderComponent, DefaultLoaderComponent, PrizesListComponent],
  providers: [LeagueH2HDataService]
})
export class LeagueH2HPageComponent implements OnInit {
  private data;
  public profiles;
  public consts;
  public squads;
  public teams;
  // public tours;
  // public squadsDetails = [];
	public squadsDetails = new BehaviorSubject<ISquadDetails[]>([])
  public squadsDetails$ = this.squadsDetails.asObservable();
	public tours = new BehaviorSubject<any[]>([])
  public tours$ = this.tours.asObservable();
  public activeTabs = {
    tabId: 1,
    confId: 0,
    confTabId: 1,
    tourId: 1,
    cupTourId: 1
  }

  public isOnlyActivePrizes = true;
  public isShowAllPrizes = true;
  public isShowUnitedTableByPoints = false;
  public prizesToShow = [];
  public unitedProfiles = [];
  public profilesDetails: IProfileDetails[] = [];
  public currentLeagueMatches: any[] = [];
  public leaguesRatings: Record<string, IProfileDetails[]> = {};
  public chosenStage = 'common';
  public chosenLeague = '';
  public tabId;
  public confId;
  public competitionType;

  public testInd: number = 0;

  public teamsArr: IPlayers[] = [];
  public allSquads: string[] = [];
  public lastTour: number = 1;

  private playersArr: string[] = [];
  private ratingMax: number = 0;
  private ratingMed: number = 0;
  private ratingKoefs = [19, 15, 12, 10, 9];
  private lastToursDetails = [];
  private maxResultValue = 1;
  private minResultValue = 1;
  public playersRatingArr: number[] = [];
  private drawGap = 0;
  private playOffToursArr: number[] = [];

  public tabooTeams: string[] = ["7655", "7654"];
  public tabooPlayers: string[] = ["213875"];
  public tabooPlayersForWC: string[] = [
    "230526", "230534", "230542", "230546", "230544"
    , "230553", "230633", "230860", "230861", "230862"
    , "230868", "230874", "230875", "230879", "230880"
    , "230882", "230884", "231768", "231111", "231139"
    , "231194", "231274", "231473", "231480", "231500"
  ];
  public larinId: string = "230935";

    // {
    // "8155" - Англия
    // "230526" рэшфорд
    // 
    // "8156" - Аргентина
    // "230534" - Муссо
    // "230542" - Молина
    // "230546" - Альмада
    // "230544" - Симеоне
    // "230553" - Альварес
    // 
    // "8159" - Бразилия
    // "230633" - Рафинья
    // 
    // "8168" - Испания
    // "230860" - Пубиль
    // "230861" - Жоан Гарсия
    // "230862" - Кубарси
    // "230868" - Льоренте
    // "230874" - Баэна
    // "230875" - Гави
    // "230879" - Ольмо
    // "230880" - Педри
    // "230882" - Ферран
    // "230884" - Ямаль
    // "231768" - Эрик Гарсия
    // 
    // "8176" - Мексика
    // "231111" - Варгас
    // 
    // "8177" - Нидерланды
    // "231139" - де Йонг
    // 
    // "8179" - Норвегия
    // "231194" - Серлот
    // 
    // "8182" - Португалия
    // "231274" - Жоау Конселу
    // 
    // "8189" - Уругвай
    // "231473" - Араухо
    // "231480" - Хименес
    // 
    // "8190" - Франция
    // "231500" - Кунде
    // }

  public isLoading$?: Observable<boolean>;
  constructor(
    public service: DataService, 
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    public loader: LoaderService,
    private dataService: LeagueH2HDataService,
    private competitionLoader: CompetitionDataLoaderService
  ) {}

  ngOnInit() {
    const yearParam = +this.route.snapshot.queryParams?.year || '';
    
    this.service.setUrlName(this.route.snapshot.url[0].path);
    this.isLoading$ = this.loader.isLoading$;

    const competitionType = this.route.snapshot.url[0].path as CompetitionType;
    this.competitionLoader.load(competitionType, yearParam).subscribe({
      next: ({ profiles, config, teams, squads, squads2 }) => {
              this.profiles = profiles;
              this.consts = config;
              this.competitionType = config.type;
              this.drawGap = config.drawGap || 0;
              this.playOffToursArr = config.cup?.matchesTours || [];
              this.teams = teams;
              this.squads = squads;
              this.squads_2 = squads2;
              
              this.lastTour = Object.keys(this.squads.data.tours).length;

              if (!!this.squads_2) {
                let firstToursCount = 0;
                Object.values(this.squads.data.players).forEach(player => {
                  const player2 = Object.values(this.squads_2.data.players).find(player2 => player2.id === player.id);
                  
                  firstToursCount = Object.keys(player.team.results_by_tour).length;
                  
                  const firstToursPoints = player.team.results_by_tour[firstToursCount].total_score;

                  Object.values(player2.team.results_by_tour).forEach((match2,ind2) => {
                    match2.total_score = (+match2.total_score + +firstToursPoints).toString();
                    player.team.results_by_tour[firstToursCount + ind2 + 1] = match2;
                  })
                  
                  Object.values(player2.team.rosters_by_tour).forEach((match2,ind2) => {
                    player.team.rosters_by_tour[firstToursCount + ind2 + 1] = match2;
                  })
                })

                Object.values(this.squads_2.data.tours).forEach(tour => {
                  tour.number = (+tour.number + firstToursCount).toString();
                  this.squads.data.tours[tour.number] = tour;
                });

                this.lastTour += Object.keys(this.squads_2.data.tours).length
              }
              
              this.updateTabs();

              this.playersArr = Object.values(this.squads.data.players).map(player => player.id);
              
              Object.values(this.squads.data.tours)
              .forEach((tour, ind) => {
                const objMaxMin = this.getMinMaxInTour(tour.number);
                tour.max = objMaxMin.max;
                tour.med = objMaxMin.med;
                tour.min = objMaxMin.min;
              });

              this.calcRating();
              const squadDetailsValue = [];

              const matches = this.consts.matches;
              let profilesDetails = this.consts.profiles.map(x => {
                const profileInfo = this.profiles.find(profile => profile.id === x);
                profileInfo.team = JSON.parse(JSON.stringify(this.squads.data.players[x].team));
                profileInfo.score = +this.squads.data.players[x].team.results_by_tour[this.lastTour].total_score;
                profileInfo.prizes = {};
                profileInfo.results = {
                  wins: {
                    'apertura': 0,
                    'clausura': 0,
                    'common': 0
                  },
                  draws: {
                    'apertura': 0,
                    'clausura': 0,
                    'common': 0
                  },
                  loses: {
                    'apertura': 0,
                    'clausura': 0,
                    'common': 0
                  },
                  points: {
                    'apertura': 0,
                    'clausura': 0,
                    'common': 0
                  },
                  fo: {
                    'apertura': 0,
                    'clausura': 0,
                    'common': 0
                  },
                  missed_fo: {
                    'apertura': 0,
                    'clausura': 0,
                    'common': 0
                  },
                  diff_fo: {
                    'apertura': 0,
                    'clausura': 0,
                    'common': 0
                  },

                  matchesPlayed: 0,
                  
                  teamCostTotal: 0,
                  teamCostAvg: 0,
                  
                  subsUsedCount: 0,
                  subsTotalCount: 0,
                  subsCoef: 0,
                  uniqueUsedPlayers: [],

                  portugezePoints: 0,
                  larinPoints: 0,
                  
                  prizeMinWins: 0,
                  
                  prizeMaxFoInTour: 0,
                  prizeMaxFoInLosedTour: 0,
                  
                  prizeCurrentWinStrike: 0,
                  prizeMaxWinStrike: 0,
                  
                  prizeCurrentNoLoseStrike: 0,
                  prizeMaxNoLoseStrike: 0,
                  prizeMaxStoppedNoLoseStrike: 0,

                  prizeMaxLosedDiff: 0
                };
                return profileInfo;
              });

              console.log('this.lastTour', this.lastTour);
              
              for (let i = 0; i < this.lastTour; i++) {  
                const currentStage = this.dataService.getCurrentStage(i + 1, this.consts.stages[0].lastTour);
                this.dataService.processTour({
                  tourIndex: i,
                  currentStage,
                  profiles: profilesDetails,
                  matches: matches[i + 1],
                  squads: this.squads,
                  drawGap: this.drawGap,
                  competitionType: this.competitionType,
                  playOffTours: this.playOffToursArr,
                });
                this.profilesDetails = Object.assign(
                  [],
                  profilesDetails.sort((left, right) => compareStandings(left, right, this.chosenStage)),
                );
              }

              if (!!this.consts.cup)
                this.updateCupMatches();

              this.leaguesRatings = buildLeagueRatings(this.profilesDetails, this.consts.stages);
              
              this.playersArr.map(playerId => {
                const profile = this.profiles.find(profile => profile.id === playerId);
                
                if (!!profile) {
                  const squadInfo = this.squads.data.players[profile.id];
                  const objMedals = getSeasonMedals(this.squads, profile.id, this.lastTour);

                  profile.squadDetails = {
                    id: squadInfo?.id,
                    name: squadInfo?.team.title || this.squads_2?.data.players[profile.id].team.title,
                    score: squadInfo?.team.results_by_tour[this.lastTour].total_score,
                    diff: this.lastTour > 1 ?
                      calculatePlaceAfterTour(this.squads, profile.id, this.lastTour - 1)
                      - calculatePlaceAfterTour(this.squads, profile.id, this.lastTour)
                      : 0,
                    rating_of_prize_positions: objMedals.gold * 3 + objMedals.silver * 2 + objMedals.bronze,
                    gold_medals: objMedals.gold,
                    silver_medals: objMedals.silver,
                    bronze_medals: objMedals.bronze,
                    medals_count: objMedals.gold + objMedals.silver + objMedals.bronze,
                    medals_arr: objMedals.medalsArr,
                    max_medals_in_a_row: objMedals.maxMedalsInARow,
                    cur_medals_in_a_row: objMedals.curMedalsInARow,
                    totalPlaces: squadInfo?.team.results_by_tour[this.lastTour].total_place,
                    profile: profile,
                    team_id: squadInfo?.team.id,
                    info: squadInfo,
                    rating: this.squads.data.players[playerId].team.rating
                  };

                  this.squadsDetails.next([...this.squadsDetails.value, profile.squadDetails]);
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

                    if (i > 1) obj.transfers_count += (
                      newSquad
                        // .map(squad => squad.)
                        .filter(n => obj.squads[i-2].indexOf(n) === -1)
                    ).length;
                }
                
                this.teamsArr.push(obj);
            });

            // Игроки
            const playersLinksArr = [];
            const firstStageMaxTours = Math.max(...Object.keys(squads.data.matches));
            const firstLastTour = !!this.consts.tour_link_2 && this.lastTour > firstStageMaxTours ? firstStageMaxTours : this.lastTour;
            const secondLastTour = !!this.consts.tour_link_2 && this.lastTour > firstStageMaxTours ? this.lastTour - firstStageMaxTours : 0;

            playersLinksArr.push(this.http.get(`${this.consts.tour_link + firstLastTour}`));

            if (!!secondLastTour) playersLinksArr.push(this.http.get(`${this.consts.tour_link_2 + secondLastTour}`));

            forkJoin([
              ...playersLinksArr
            ])
            .subscribe({
              next: ([objPlayers, objPlayers_2]) => {
                logger.debug('Игроки: ', objPlayers, objPlayers_2);
                
                if (!!objPlayers_2) {
                  Object.values(objPlayers_2.data.players).forEach(player => {
                    if (Object.keys(objPlayers.data.players).indexOf(player.id) < 0)
                      objPlayers.data.players[player.id] = player;
                  });
                }

                // objPlayers.data.players = [...new Set([...objPlayers.data.players, ...objPlayers_2.data.players])];
                const players = [];

                this.profilesDetails.forEach((profile, ind) => {
                  for (let i = 1; i <= this.lastTour; i++) {
                    const newSquad = (
                      profile.team.rosters_by_tour[i.toString()].players.base
                      .concat(profile.team.rosters_by_tour[i.toString()].players.bench)
                    );

                    this.allSquads = this.allSquads.concat(newSquad);
                  }
                })

                this.allSquads.forEach(pl => {
                  const currentObj = players.find(elem => elem.id === pl);
                  
                  // console.log(pl);
                  
                  if (!!currentObj) currentObj.count += 1
                  else players.push({
                    count: 1,
                    amplua: this.getPosition(objPlayers.data.players[pl].amplua_id),
                    name: objPlayers.data.players[pl].name,
                    team_name: this.getClubName(objPlayers.data.players[pl].team_id),
                    id: pl,
                    team_id: objPlayers.data.players[pl].team_id,
                  })

                  if (!!this.tabooTeams.includes(objPlayers.data.players[pl].team_id)) {
                    this.tabooPlayers.push(pl);
                  }
                });

                this.tabooPlayers = [...new Set(this.tabooPlayers)];

                this.profilesDetails.forEach((profile, ind) => {
                  profile.isMartin = 1;
                  profile.isMartinWC = 1;

                  for (let i = 1; i <= this.lastTour; i++) {
                    const newSquad = (
                      profile.team.rosters_by_tour[i.toString()].players.base
                      .concat(profile.team.rosters_by_tour[i.toString()].players.bench)
                    );

                    if (profile.isMartin === 1) {
                      if (newSquad.filter(playerId => this.tabooPlayers.includes(playerId)).length > 0) {
                        profile.isMartin = 0;
                      }
                    }

                    if (profile.isMartinWC === 1) {
                      if (newSquad.filter(playerId => this.tabooPlayersForWC.includes(playerId)).length > 0) {
                        profile.isMartinWC = 0;
                      }
                    }
                  }
                });

                logger.debug('Игроки, сорт. по кол-ву пиков: ', players.sort(this.sortByCount));

                if (this.route.snapshot.url[0].path ===  'spain') this.updatePrizes();
                if (this.route.snapshot.url[0].path ===  'champions-league') this.updatePrizesCL();
                if (this.route.snapshot.url[0].path ===  'world-cup') this.updatePrizesWC();
              },
              error: err => {

              }  
            });

            const sourcesPlayersStats = [];
            for (let i = 0; i < this.lastTour; i++) {
              sourcesPlayersStats.push(this.http.get(`${this.consts.tour_link + (i+1)}`));
            }

            console.log(sourcesPlayersStats);

            forkJoin([
              ...sourcesPlayersStats
            ])
            .subscribe({
              next: (dataPlayersStats) => {
                console.log('dataPlayersStats', dataPlayersStats);

                const playersPointsByTour = [];
                
                Object.values(dataPlayersStats[0].data.players).forEach(pl => playersPointsByTour.push(JSON.parse(JSON.stringify(pl))));
                console.log(
                  dataPlayersStats[0].data.players[this.larinId]
                  , dataPlayersStats[1].data.players[this.larinId]
                  , dataPlayersStats[2].data.players[this.larinId]
                  , dataPlayersStats[3].data.players[this.larinId]
                );
                
                for (let i = 1; i < dataPlayersStats.length; i++) {
                  playersPointsByTour.forEach(pl => {
                    const statByTour = Object.values(dataPlayersStats[i].data.players)
                        .find(dt => dt.id === pl.id)
                        .stat_by_tours[i+1];

                    pl.stat_by_tours[(i+1).toString()] = statByTour;
                    }
                  );
                }

                console.log('playersPointsByTour', playersPointsByTour, playersPointsByTour.filter(pl => pl.team_id === "8170"));

                this.profilesDetails.forEach((profile, ind) => {
                  for (let i = 1; i <= this.lastTour; i++) {
                    const newSquad = (
                      profile.team.rosters_by_tour[i.toString()].players.base
                      .concat(profile.team.rosters_by_tour[i.toString()].players.bench)
                    );

                    // console.log('profile', profile.results.portugezePoints, playersPointsByTour
                    //   .filter(pl => pl.team_id === "8182" && profile.team.rosters_by_tour[i.toString()].players.base.includes(pl.id)));

                    profile.results.portugezePoints += playersPointsByTour
                      .filter(pl => pl.team_id === "8182" && profile.team.rosters_by_tour[i.toString()].players.base.includes(pl.id))
                      .reduce((a, b) => a + b.stat_by_tours[i].score, 0);

                    const larinObj = playersPointsByTour
                      .find(pl => pl.id === this.larinId
                        && (
                          profile.team.rosters_by_tour[i.toString()].players.base
                          .concat(profile.team.rosters_by_tour[i.toString()].players.bench)
                        ).includes(pl.id));
                    const isLarinCap = profile.team.rosters_by_tour[i.toString()].captain_id === this.larinId;
                    profile.results.larinPoints += !larinObj ? 0 : larinObj.stat_by_tours[i].score * (1 + +isLarinCap);
                    
                    profile.results.uniqueUsedPlayers = [...profile.results.uniqueUsedPlayers, ...newSquad.filter(sq => !profile.results.uniqueUsedPlayers.includes(sq))];
                  }
                })


                if (this.route.snapshot.url[0].path ===  'world-cup') this.updatePrizesWC();
              },
              error: err => {

              }  
            });
            

            const profilesByScore = Object.assign([], this.profilesDetails.map(profile => ({ id: profile.squadDetails.id, score: +profile.squadDetails.score })).sort(this.sortByScore));
            
            this.profilesDetails.forEach((profile, ind) => {
              const prInd = profilesByScore.findIndex(p => p.id === profile.id); 
              if (!profile.place_in_league) profile.place_in_league = {};
              profile.place_in_league['ByScore'] = prInd + 1;
            })
              
            this.unitedProfiles = this.profilesDetails;

            logger.debug('this.unitedProfiles', this.unitedProfiles);

            this.setTabId(this.activeTabs.tabId);
            this.setConfId(this.activeTabs.confId);
            this.setConfTabId(this.activeTabs.confTabId);

            this.getMatchesForLeague();
      },
      error: err => {
            logger.error('Ошибка при получении данных:', err);
      }
    });
  }

  getMatchesForLeague() {
    this.currentLeagueMatches = [];

    if (!!this.consts.stages[this.activeTabs.tabId-1]) {
      const stageInfo = this.consts.stages[this.activeTabs.tabId-1];
      const leagueProfiles = stageInfo.leagues[this.activeTabs.confId].profiles;
      const matches = this.consts.matches;

      for (let i = stageInfo.firstTour - 1; i < stageInfo.lastTour; i++) {
        if (!!matches[i+1])
          this.currentLeagueMatches.push(Object.values(matches[i+1].filter(match => {
            return leagueProfiles.includes(match.home) || leagueProfiles.includes(match.away);
          })));
      }
    }
  }

  updateProfilesByStage(stageType = '', leagueType = '') {
    if (!!stageType) this.chosenStage = stageType;
    this.unitedProfiles = this.chosenStage === 'common' ? this.profilesDetails
      : this.profilesDetails.filter(x => x.leagues[this.chosenStage] === leagueType);
    this.unitedProfiles.sort(!!this.isShowUnitedTableByPoints && this.chosenStage === 'common' ? this.sortStandingsByFO.bind(this) : this.sortStandings.bind(this));
  }

  updateStageTypeByTabId() {
    if (this.activeTabs.tabId === 1) {
      this.chosenStage = 'apertura';
      return;
    }
    if (this.activeTabs.tabId === 2) {
      this.chosenStage = 'clausura';
      return;
    }
    if (this.activeTabs.tabId === 100) {
      this.chosenStage = 'common';
      return;
    }
    this.chosenStage = '';
  };

  updateLeagueTypeByConfId() {
    if (this.chosenStage === 'apertura') {
      if (this.activeTabs.confId === 0) {
        this.chosenLeague = this.competitionType === 'spain' ? 'Конференция Анчелотти' : 'Общий этап';
        return;
      }
      if (this.activeTabs.confId === 1) {
        this.chosenLeague = 'Конференция Муньоса';
        return;
      }
      if (this.activeTabs.confId === 2) {
        this.chosenLeague = 'Конференция Зидана';
        return;
      }
    }
    if (this.chosenStage === 'clausura') {
      if (this.activeTabs.confId === 0) {
        this.chosenLeague = 'Primera';
        return;
      }
      if (this.activeTabs.confId === 1) {
        this.chosenLeague = 'Segunda';
        return;
      }
    }
    this.chosenLeague = '';
  }

  updateCupMatches() {
    calculateCup({
      cup: this.consts.cup,
      profiles: this.profilesDetails,
      squads: this.squads,
      lastTour: this.lastTour,
    });
  }

  toggleUnitedRating() {
    this.isShowUnitedTableByPoints = !this.isShowUnitedTableByPoints;
    this.updateProfilesByStage();
  }

  updatePrizes() {
    this.prizesToShow = calculateSpainPrizes({
      prizes: this.consts.prizes,
      profiles: this.profiles,
      profilesDetails: this.profilesDetails,
    });

    logger.debug('this.prizesToShow', this.prizesToShow);
  }

  updatePrizesCL() {
    this.prizesToShow = calculateChampionsLeaguePrizes({
      prizes: this.consts.prizes,
      profiles: this.profiles,
      profilesDetails: this.profilesDetails,
    });
  }

  updatePrizesWC() {
    this.prizesToShow = calculateWorldCupPrizes({
      prizes: this.consts.prizes,
      profiles: this.profiles,
      profilesDetails: this.profilesDetails,
    });
  }

  getMedian(arr: number[]): number {
    // Delegate to service
    return this.dataService.getMedian(arr);
  }

  getCurrentStage(tourNumber: number): string {
    // Delegate to service
    return this.dataService.getCurrentStage(tourNumber, this.consts.stages[0].lastTour);
  }

  setTabId(ind) {
    this.activeTabs.tabId = ind;
    this.activeTabs.confId = 0;
    
    if (!!this.consts.stages[ind-1])
      this.activeTabs.tourId = Math.min(
        this.lastTour - this.consts.stages[ind-1].firstTour + 1
        , this.consts.stages[ind-1].lastTour
      );

    if (ind === 5) {
      const actualCupTour =
        this.consts.cup.matchesTours[0] <= this.lastTour ? 
          Math.max(
            ...this.consts.cup.matchesTours.filter(val => val <= this.lastTour)
          ) : this.consts.cup.matchesTours[0];
      const indOfActualCupTour = this.consts.cup.matchesTours.indexOf(actualCupTour) + 1;

      this.activeTabs.tourId = indOfActualCupTour;
      this.activeTabs.cupTourId = indOfActualCupTour;
    }

    this.setQueryParam(this.activeTabs);
    this.isShowUnitedTableByPoints = false;
    this.updateStageTypeByTabId(ind);
    this.updateLeagueTypeByConfId(0);
    
    this.updateProfilesByStage(this.chosenStage, this.chosenLeague);
    this.getMatchesForLeague();
  }

  setConfId(ind) {
    this.activeTabs.confId = ind;
    this.setQueryParam(this.activeTabs);
    this.updateLeagueTypeByConfId(ind);
    this.updateProfilesByStage(this.chosenStage, this.chosenLeague);
    this.getMatchesForLeague();
  }

  setConfTabId(ind) {
    this.activeTabs.confTabId = ind;
    this.setQueryParam(this.activeTabs)
  }

  setTourId(ind) {
    this.activeTabs.tourId = ind;
    this.setQueryParam(this.activeTabs)
  }

  setCupTourId(ind) {
    this.activeTabs.cupTourId = ind;
    this.setQueryParam(this.activeTabs)
  }

  updateTabs() {    
    const tabIdParam = +this.route.snapshot.queryParams?.tabId || '';
    const confIdParam = +this.route.snapshot.queryParams?.confId || '';
    const confTabIdParam = +this.route.snapshot.queryParams?.confTabId || '';
    const activeTourIdParam = +this.route.snapshot.queryParams?.tourId || '';

    if (!!tabIdParam) this.activeTabs.tabId = tabIdParam;
    if (!!confIdParam) this.activeTabs.confId = confIdParam;
    if (!!confTabIdParam) this.activeTabs.confTabId = confTabIdParam;

    this.activeTabs.tourId = !!activeTourIdParam ? activeTourIdParam : this.lastTour;
  }

  sortStandings(a, b) {
    return compareStandings(a, b, this.chosenStage);
  }

  sortStandingsByFO(a, b) {
    return compareByFantasyScore(a, b);
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

  getMinMaxInTour(tourNum): any {
    const tourResults = Object.values(this.squads.data.players)
      .map(player => player.team.results_by_tour[tourNum.toString()].tour_score);

    tourResults.sort(this.sortCustom);

    return {
      max: tourResults[0],
      med: this.getMedian(tourResults),
      min: tourResults[tourResults.length - 1]
    };
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

  sortByScore(a, b): number {
    return b.score - a.score;
  }

  sortCustom(a, b): number {
    return (b - a);
  }
}
