// @ts-nocheck
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Apollo } from 'apollo-angular';
import { IPlayers } from '../../models/model';
import { DataService } from '../../service/data.service';
import { Observable } from '@apollo/client';
import { BehaviorSubject, forkJoin } from 'rxjs';
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
import { logMissingFieldErrors } from '@apollo/client/core/ObservableQuery';

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

  public tabooTeams: string[] = ["7655", "7654"];
  public tabooPlayers: string[] = ["213875"];

  public isLoading$?: Observable<boolean>;
  public windowWidth: number = 1400;

  constructor(
    private readonly apollo: Apollo, 
    public service: DataService, 
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    public loader: LoaderService,
    private dataService: LeagueH2HDataService
  ) {}

  ngOnInit() {
    const yearParam = +this.route.snapshot.queryParams?.year || '';
    
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
        this.profiles = Object.values(profiles[yearParam][this.route.snapshot.url[0].path]);
        this.consts = consts;
        this.consts = this.consts.league.find(x =>
          x.type === this.route.snapshot.url[0].path
          && ( x.yearStart === yearParam || !yearParam )
        );
        this.competitionType = this.consts.type;
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
              this.squads_2 = squads_2;
              console.log('sources',squads,squads_2);
              
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
                console.log('squads', this.squads, this.lastTour);
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

              for (let i = 0; i < this.lastTour; i++) {  
                const currentStage = this.dataService.getCurrentStage(i + 1, this.consts.stages[0].lastTour);
                this.processMatchesForTour(i, profilesDetails, matches, currentStage);
                this.profilesDetails = Object.assign([], profilesDetails.sort(this.sortStandings.bind(this)))
              }

              if (!!this.consts.cup)
                this.updateCupMatches();

              // общий зачет в баллах
              this.profilesDetails.forEach(profile => {
                this.consts.stages.forEach((stage, stageInd) => {
                  stage.leagues.forEach(league => {
                    if (!profile.leagues) profile.leagues = [];

                    if (league.profiles.includes(profile.id))
                      profile.leagues[stageInd === 0 ? 'apertura' : 'clausura'] = league.name;
                  })
                })
              });

              // рейтинг по лигам
              const tempChosenStage = this.chosenStage;
              this.consts.stages.forEach((stage, stageInd) => {
                this.chosenStage = stage.name.toLowerCase();

                stage.leagues.forEach(league => {
                  let profilesForLeague = this.profilesDetails
                    .filter(x => !!x.leagues[this.chosenStage] && x.leagues[this.chosenStage] === league.name)
                  
                  profilesForLeague.sort(this.sortStandings.bind(this));

                  this.leaguesRatings[league.name] = profilesForLeague;
                })
              });

              let profilesForLeague = this.profilesDetails.map(profile => Object.assign({}, profile));
              this.chosenStage = 'common';
              profilesForLeague.sort(this.sortStandings.bind(this));
              this.leaguesRatings['Common'] = profilesForLeague;

              profilesForLeague = this.profilesDetails.map(profile => Object.assign({}, profile));
              this.chosenStage = 'apertura';
              profilesForLeague.sort(this.sortStandings.bind(this));
              this.leaguesRatings['Apertura'] = profilesForLeague;

              profilesForLeague = this.profilesDetails.map(profile => Object.assign({}, profile));
              this.chosenStage = 'common';
              profilesForLeague.sort(this.sortStandingsByFO.bind(this));
              this.leaguesRatings['CommonFO'] = profilesForLeague;

              this.chosenStage = tempChosenStage;

              // фиксация мест в каждой лиге у команд
              this.consts.stages.forEach((stage, stageInd) => {
                const stageName = stage.name.toLowerCase();

                stage.leagues.forEach(league => {
                  this.leaguesRatings[league.name].forEach((profile, ind) => {
                    if (!profile.place_in_league) profile.place_in_league = {};
                    profile.place_in_league[league.name] = ind + 1;
                  })
                })
              });

              if (!!this.leaguesRatings['Common'])
                this.leaguesRatings['Common'].forEach((profile, ind) => {
                  const pr = this.profilesDetails.find(p => p.id === profile.id);
                  if (!pr.place_in_league) pr.place_in_league = {};
                  pr.place_in_league['Common'] = ind + 1;
                })

              if (!!this.leaguesRatings['Apertura'])
                this.leaguesRatings['Apertura'].forEach((profile, ind) => {
                  const pr = this.profilesDetails.find(p => p.id === profile.id); 
                  if (!pr.place_in_league) pr.place_in_league = {};
                  pr.place_in_league['Apertura'] = ind + 1;
                })

              if (!!this.leaguesRatings['CommonFO'])
                this.leaguesRatings['CommonFO'].forEach((profile, ind) => {
                  const pr = this.profilesDetails.find(p => p.id === profile.id); 
                  if (!pr.place_in_league) pr.place_in_league = {};
                  pr.place_in_league['CommonFO'] = ind + 1;
                })
              
              this.playersArr.map(playerId => {
                const profile = this.profiles.find(profile => profile.id === playerId);
                
                if (!!profile) {
                  const squadInfo = this.squads.data.players[profile.id];
                  const objMedals = this.getMedalsInSeason(profile.id);

                  profile.squadDetails = {
                    id: squadInfo?.id,
                    name: squadInfo?.team.title || this.squads_2?.data.players[profile.id].team.title,
                    score: squadInfo?.team.results_by_tour[this.lastTour].total_score,
                    diff: this.lastTour > 1 ?
                      this.getPlaceAfterTour(profile.id, this.lastTour - 1) - this.getPlaceAfterTour(profile.id, this.lastTour)
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
                  }
                });

                logger.debug('Игроки, сорт. по кол-ву пиков: ', players.sort(this.sortByCount));

                if (this.route.snapshot.url[0].path ===  'spain') this.updatePrizes();
                if (this.route.snapshot.url[0].path ===  'champions-league') this.updatePrizesCL();
              },
              error: err => {

              }  
            });
              
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
    }});
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

  /**
   * Process all matches for a given tour
   * Delegates to service for all calculations
   */
  private processMatchesForTour(
    tourIndex: number,
    profilesDetails: any[],
    matches: any,
    currentStage: string
  ): void {
    matches[tourIndex + 1].forEach(match => {
      // Calculate match result
      const matchResult = this.dataService.calculateMatchResult(
        +this.squads.data.players[match.home].team.results_by_tour[tourIndex + 1].tour_score,
        +this.squads.data.players[match.away].team.results_by_tour[tourIndex + 1].tour_score,
        this.drawGap
      );

      match.home_score = matchResult.homeScore;
      match.away_score = matchResult.awayScore;
      match.result = matchResult.result;

      const homeProfile = profilesDetails.find(x => x.id === match.home);
      const awayProfile = profilesDetails.find(x => x.id === match.away);
      const matchDiffFo = Math.abs(matchResult.homeScore - matchResult.awayScore);

      // Update FO (fantasy objectives)
      this.dataService.updateFO(homeProfile, awayProfile, matchResult, currentStage);
      
      // Update match counts (wins/draws/losses)
      homeProfile.results.matchesPlayed += 1;
      awayProfile.results.matchesPlayed += 1;
      this.dataService.updateMatchCounts(homeProfile, awayProfile, matchResult.result, currentStage);

      // Update strikes
      this.dataService.updateStrikes(
        homeProfile,
        awayProfile,
        matchResult.result,
        matchResult.homeScore,
        matchResult.awayScore,
        matchDiffFo,
        tourIndex
      );

      // Update FO records
      this.dataService.updateMaxFoInTour(homeProfile, awayProfile, matchResult.homeScore, matchResult.awayScore);
      this.dataService.updateMaxFoInLosedTour(homeProfile, awayProfile, matchResult.homeScore, matchResult.awayScore, matchResult.result);

      // Update team cost
      this.dataService.updateTeamCostAvg(
        homeProfile,
        awayProfile,
        homeProfile.team.rosters_by_tour[tourIndex + 1].team_cost,
        awayProfile.team.rosters_by_tour[tourIndex + 1].team_cost
      );

      // Update substitutions
      const homeActSquad = this.dataService.getActiveSquad(homeProfile.team.rosters_by_tour, tourIndex + 1);
      const homePrevSquad = tourIndex > 0 ? this.dataService.getActiveSquad(homeProfile.team.rosters_by_tour, tourIndex) : [];
      const awayActSquad = this.dataService.getActiveSquad(awayProfile.team.rosters_by_tour, tourIndex + 1);
      const awayPrevSquad = tourIndex > 0 ? this.dataService.getActiveSquad(awayProfile.team.rosters_by_tour, tourIndex) : [];

      this.dataService.updateSubs(homeProfile, awayProfile, tourIndex, homeActSquad, homePrevSquad, awayActSquad, awayPrevSquad);

      // Update common results
      this.dataService.updateCommonResults(homeProfile);
      this.dataService.updateCommonResults(awayProfile);
    });
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
    const actualCupTour = Math.max(
      ...this.consts.cup.matchesTours.filter(val => val <= this.lastTour)
    );
    const indOfActualCupTour = this.consts.cup.matchesTours.indexOf(actualCupTour) + 1;

    this.profilesDetails.forEach(profile => {
      profile.results.cup = {
        fo: 0,
        missed_fo: 0,
        diff_fo: 0,
        matchesPlayed: 0,
        avg_diff_fo: 0,
        diff_fo_arr: [],
        standings: [],
        lowest_winning_pos_diff: null
      };
    });

    for (let i = 0; i < indOfActualCupTour; i++) {  
      this.consts.cup.matches[i].forEach(match => {
        const tour = this.consts.cup.matchesTours[i];

        match.home_score = +this.squads.data.players[match.home].team.results_by_tour[tour].tour_score;
        match.away_score = +this.squads.data.players[match.away].team.results_by_tour[tour].tour_score;
        match.result = Math.abs(match.home_score - match.away_score) === 0 ? 0 :
          match.home_score > match.away_score ? 1 : 2;

        const homeProfile = this.profilesDetails.find(x => x.id === match.home);
        const awayProfile = this.profilesDetails.find(x => x.id === match.away);

        homeProfile.results.cup.fo += match.home_score;
        homeProfile.results.cup.missed_fo += match.away_score;
        homeProfile.results.cup.diff_fo = homeProfile.results.cup.fo - homeProfile.results.cup.missed_fo;
        homeProfile.results.cup.diff_fo_arr.push(match.home_score - match.away_score);
        homeProfile.results.cup.matchesPlayed += 1;
        homeProfile.results.cup.standings.push(this.getPlaceAfterTour(homeProfile.id, tour));
        if (homeProfile.results.cup.matchesPlayed > 3) homeProfile.results.cup.avg_diff_fo = Math.round(homeProfile.results.cup.diff_fo / homeProfile.results.cup.matchesPlayed * 100) / 100;

        awayProfile.results.cup.fo += match.away_score;
        awayProfile.results.cup.missed_fo += match.home_score;
        awayProfile.results.cup.diff_fo = awayProfile.results.cup.fo - awayProfile.results.cup.missed_fo;
        awayProfile.results.cup.diff_fo_arr.push(match.away_score - match.home_score);
        awayProfile.results.cup.matchesPlayed += 1;
        awayProfile.results.cup.standings.push(this.getPlaceAfterTour(awayProfile.id, tour));
        if (awayProfile.results.cup.matchesPlayed > 3) awayProfile.results.cup.avg_diff_fo = Math.round(awayProfile.results.cup.diff_fo / awayProfile.results.cup.matchesPlayed * 100) / 100;
      
        if (match.result === 1) {
          const curDiff = this.getPlaceAfterTour(homeProfile.id, tour) - this.getPlaceAfterTour(awayProfile.id, tour);

          if (homeProfile.results.cup.lowest_winning_pos_diff === null) homeProfile.results.cup.lowest_winning_pos_diff = curDiff;
          homeProfile.results.cup.lowest_winning_pos_diff = Math.max(homeProfile.results.cup.lowest_winning_pos_diff, curDiff);
        }

        if (match.result === 2) {
          const curDiff = this.getPlaceAfterTour(awayProfile.id, tour) - this.getPlaceAfterTour(homeProfile.id, tour);


          if (awayProfile.results.cup.lowest_winning_pos_diff === null) awayProfile.results.cup.lowest_winning_pos_diff = curDiff;
          awayProfile.results.cup.lowest_winning_pos_diff = Math.max(awayProfile.results.cup.lowest_winning_pos_diff, curDiff);
        }
      })
    }
  }

  toggleUnitedRating() {
    this.isShowUnitedTableByPoints = !this.isShowUnitedTableByPoints;
    this.updateProfilesByStage();
  }

  countPrizeNominees(profiles, prizeInd, keyId = "") {
    const prizesObj = this.consts.prizes.find(prize => prize.id === prizeInd);
    const valueSortCoef = +[1,2,3,9,10].includes(prizeInd);
    const paramSortCoef = +[18].includes(prizeInd)

    const placeVal2Prize = this.profilesDetails.find(profile => profile.id === '1115308799').place_in_league['Primera'];
    const placeVal3Prize = this.profilesDetails.find(profile => profile.id === '1113412675').place_in_league['Primera'];
    const placeVal10Prize = this.profilesDetails.find(profile => profile.id === '1116311079').place_in_league['Primera'];

    profiles.forEach(profile => {
      const profileResult = prizesObj.nomineesArr.find(nominee => nominee.profileId === profile.id);
      
      if (prizeInd === 7 && ["1028890564", "1116311743", "154819672"].includes(profile.id))
        {
          profile.prizes = {};
          profile.team = {};
          profile.results = {};
          profile.team.title = "BallBoy17";
          profile.results.subsCoef = 100;
          profile.results.points = 0;
        }

      profile.prizes[prizeInd] = {
        value: 
          prizeInd === 1 ?
            (!profile.place_in_league['Primera'] || profile.place_in_league['Primera'] < 4 ? 0 : profile.place_in_league['Primera'])
          : prizeInd === 2 ?
            (
              !(placeVal2Prize === 10) ?
                ( !profile.place_in_league['Primera'] || profile.place_in_league['Primera'] < 10 ? 0 : profile.place_in_league['Primera'])
                : ( !profile.place_in_league['Segunda'] || profile.place_in_league['Segunda'] < 10 ? 0 : profile.place_in_league['Segunda'])
              
            )
          : prizeInd === 3 ?
            (
              !(placeVal3Prize === 13) ?
                (!profile.place_in_league['Primera'] || profile.place_in_league['Primera'] < 13 ? 0 : profile.place_in_league['Primera'])
                : (!profile.place_in_league['Segunda'] || profile.place_in_league['Segunda'] < 13 ? 0 : profile.place_in_league['Segunda'])
            )
          : prizeInd === 4 ?
            (!profile.place_in_league['Primera'] || +profile.sex === 1 ? 0 : profile.results.points['clausura'])
          : prizeInd === 5 ?
            (!profile.place_in_league['Segunda'] || +profile.sex === 1 ? 0 : profile.results.points['clausura'])
          : prizeInd === 6 ?
            (profile.isMartin === 1 ? profile.results.fo['common'] : 0)
          : prizeInd === 7 ?
            (!!profileResult ? profileResult.points : 0)
          : prizeInd === 8 ?
            Object.values(profile.team.rosters_by_tour).reduce((a, b) => {
              return a + b.players.base.includes(keyId) + b.players.bench.includes(keyId);
            }, 0)
          : prizeInd === 9 ?
            profile.results.teamCostAvg
          : prizeInd === 10 ?
            (!profile.place_in_league['Primera'] || profile.place_in_league['Primera'] <= placeVal10Prize ? 0 : profile.place_in_league['Primera'])
          : prizeInd === 11 ?
            Object.values(profile.team.rosters_by_tour).reduce((a, b) => {
              return a + +(b.captain_id === keyId);
            }, 0)
          : prizeInd === 12 ?
            profile.place_in_league['Apertura'] - profile.place_in_league['Common']
          : prizeInd === 13 ?
            profile.results.prizeMinWins
          : prizeInd === 15 ?
            profile.results.prizeMaxFoInTour
          : prizeInd === 16 ?
            profile.results.prizeMaxWinStrike
          : prizeInd === 17 ?
            profile.results.prizeMaxFoInLosedTour
          : prizeInd === 18 ?
            profile.results.prizeMaxStoppedNoLoseStrike
          : prizeInd === 19 ?
            profile.results.prizeMaxLosedDiff
          : prizeInd === 20 ?
            profile.results.cup.lowest_winning_pos_diff || 0
          : prizeInd === 21 ?
            profile.results.cup.avg_diff_fo
          : '-',

        sortParam: 
          prizeInd === 7 ?
            (!!profileResult ? profileResult.points : 0)
            : profile.results.points
      }
    })

    prizesObj.nomineesArr = this.profiles
      .filter(profile => 
        prizeInd !== 14
        && (
          prizeInd === 7 && profile.id === "1028890564"
          || !["1028890564", "1116311743", "154819672"].includes(profile.id) && profile.prizes[prizeInd]?.value !== 0
        )
      )
      .sort(
        (a, b) =>
          a.prizes[prizeInd].value === b.prizes[prizeInd].value ? 
            (1 - 2 * paramSortCoef) * (b.prizes[prizeInd].sortParam - a.prizes[prizeInd].sortParam) : 
            (1 - 2 * valueSortCoef) * (b.prizes[prizeInd].value - a.prizes[prizeInd].value)
      )
    
    prizesObj.activeLeaders = prizesObj.nomineesArr.filter(nominee => {
      return ( !prizesObj.excluded
          || !!prizesObj.excluded && !prizesObj.excluded.includes(nominee.id)
        ) &&
        ( !prizesObj.isActivity
          || !!prizesObj.isActivity && nominee.results.subsCoef > 50
        ) &&
        ( prizeInd !== 11 
          || prizeInd === 11 && nominee.prizes[prizeInd].value >= 3
        )
    });
  }

  updatePrizes() {
    this.consts.prizes.forEach(prize =>
      this.countPrizeNominees(
        prize.id === 7 ?
          this.profiles
          : this.profiles.filter(profile => !["1028890564", "1116311743", "154819672"].includes(profile.id))
        , prize.id
        , prize.id === 8 ? 
          "213955"
          : prize.id === 11 ?
            "213946"
            : ""
      )
    )

    this.consts.prizes.forEach((prize) => {
      if (!!prize.isFinalStage) prize.state = 2;
      if (!!prize.nomineesArr.length) prize.state = 1;
      if (!prize.state && !prize.nomineesArr.length) prize.state = 3;
    });

    const prizeWinners = this.consts.prizes.map(prize => !!prize.activeLeaders[0] ? prize.activeLeaders[0].id : '');
    ["1063076888", "1116843193"].forEach(id => prizeWinners.push(id));

    const profilesExceptWinners = this.profilesDetails.filter(profile => !prizeWinners.includes(profile.id));
    const activeProfilesExceptWinners = profilesExceptWinners.filter(profile => profile.results.subsCoef > 50 && !this.consts.prizes[13].excluded.includes(profile.id));

    this.consts.prizes[13].nomineesArr = activeProfilesExceptWinners;
    this.consts.prizes[13].activeLeaders.push(activeProfilesExceptWinners[Math.floor(Math.random() * activeProfilesExceptWinners.length)]);
    this.consts.prizes[13].state = 1;

    this.prizesToShow = this.consts.prizes;

    logger.debug('this.prizesToShow', this.prizesToShow);
  }

  updatePrizesCL() {
    this.consts.prizes.forEach((prize, prizeInd) => {
      const valueSortCoef = +[].includes(prizeInd);
      const paramSortCoef = +[].includes(prizeInd);
console.log('prize', prize);

      this.profilesDetails.forEach(profile => {
        profile.prizes[prize.id] = {
          value: 
            prize.id === 1 ?
              (profile.place_in_league['CommonFO'] < 7 ? 0 : profile.results.fo['common'])
            : prize.id === 2 ?
              (profile.squadDetails.max_medals_in_a_row < 2 ? 0 : profile.squadDetails.max_medals_in_a_row)
            : prize.id === 3 ?
              !!prize.nomineesArr && prize.nomineesArr[0] === profile.id ? 1 : 0
            : prize.id === 4 ?
              !!prize.nomineesArr && prize.nomineesArr[0] === profile.id ? 1 : 0
            : 0,

          sortParam: profile.results.points
        }
      })

      prize.nomineesArr = this.profilesDetails
        .filter(profile => profile.prizes[prize.id].value > 0)
        .sort(
          (a, b) =>
            a.prizes[prize.id].value === b.prizes[prize.id].value ? 
              (1 - 2 * paramSortCoef) * (b.prizes[prize.id].sortParam - a.prizes[prize.id].sortParam) : 
              (1 - 2 * valueSortCoef) * (b.prizes[prize.id].value - a.prizes[prize.id].value)
        )
    
      prize.activeLeaders = prize.nomineesArr.filter(nominee => {
        return ( !prize.excluded
            || !!prize.excluded && !prize.excluded.includes(nominee.id)
          ) &&
          ( !prize.isActivity
            || !!prize.isActivity && nominee.results.subsCoef > 50
          ) &&
          ( prizeInd !== 11 
            || prizeInd === 11 && nominee.prizes[prizeInd].value >= 3
          )
      });
    });

    this.consts.prizes.forEach((prize) => {
      if (!!prize.isFinalStage) prize.state = 2;
      if (!!prize.nomineesArr.length) prize.state = 1;
      if (!prize.state && !prize.nomineesArr.length) prize.state = 3;
    });
    
    this.prizesToShow = this.consts.prizes;
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
    if (a.results.points[this.chosenStage] > b.results.points[this.chosenStage]) return -1;
    if (a.results.points[this.chosenStage] < b.results.points[this.chosenStage]) return 1;
    
    if (a.results.diff_fo[this.chosenStage] > b.results.diff_fo[this.chosenStage]) return -1;
    if (a.results.diff_fo[this.chosenStage] < b.results.diff_fo[this.chosenStage]) return 1;
    
    if (a.results.fo[this.chosenStage] > b.results.fo[this.chosenStage]) return -1;
    if (a.results.fo[this.chosenStage] < b.results.fo[this.chosenStage]) return 1;

    return 0;
  }

  sortStandingsByFO(a, b) {
    if (a.score > b.score) return -1;
    if (a.score < b.score) return 1;

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

  getMedalsInSeason(id) {
    const obj = {
      gold: 0,
      silver: 0,
      bronze: 0,
      medalsArr: [],
      curMedalsInARow: 0,
      maxMedalsInARow: 0
    }

    for (let i = 1; i <= this.lastTour; i++) {
      
      const placeInTour = this.getPlaceInTour(id, i);

      obj.gold += +(placeInTour === 1);
      obj.silver += +(placeInTour === 2);
      obj.bronze += +(placeInTour === 3);

      obj.medalsArr.push(placeInTour <= 3 ? placeInTour : 0);

      if (placeInTour <= 3) {
        obj.curMedalsInARow += 1;
        obj.maxMedalsInARow = Math.max(obj.maxMedalsInARow, obj.curMedalsInARow);
      } else {
        obj.curMedalsInARow = 0;
      }
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
            standingsArr[ind-1].position < 3 ?
              standingsArr[ind-1].position + 1 :
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

  sortByScore(a, b): number {
    return b.score - a.score;
  }

  sortCustom(a, b): number {
    return (b - a);
  }
}
