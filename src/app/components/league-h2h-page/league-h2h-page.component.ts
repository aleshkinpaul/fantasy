// @ts-nocheck
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../service/data.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { ISquadDetails, IProfileDetails } from '../../models/domain';
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
import { calculateSquadRatings } from '../../competition/domain/rating-calculator';
import {
  applySquadEligibility,
  applyTourPlayerStats,
} from '../../competition/domain/player-stats-calculator';

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

  public lastTour: number = 1;

  private playersArr: string[] = [];
  public playersRatingArr: number[] = [];
  private drawGap = 0;
  private playOffToursArr: number[] = [];

  public isLoading$?: Observable<boolean>;
  constructor(
    public service: DataService, 
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
      next: ({ profiles, config, squads, latestPlayerStats, playerStatsByTour }) => {
              this.profiles = profiles;
              this.consts = config;
              this.competitionType = config.type;
              this.drawGap = config.drawGap || 0;
              this.playOffToursArr = config.cup?.matchesTours || [];
              this.squads = squads;
              
              this.lastTour = Object.keys(this.squads.data.tours).length;
              
              this.updateTabs();

              this.playersArr = Object.values(this.squads.data.players).map(player => player.id);
              
              this.playersRatingArr = calculateSquadRatings(this.squads, this.lastTour);
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
                    name: squadInfo.team.title,
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

            const profilesByScore = Object.assign(
              [],
              this.profilesDetails
                .map(profile => ({ id: profile.squadDetails.id, score: +profile.squadDetails.score }))
                .sort(this.sortByScore),
            );
            this.profilesDetails.forEach(profile => {
              const profileIndex = profilesByScore.findIndex(item => item.id === profile.id);
              if (!profile.place_in_league) profile.place_in_league = {};
              profile.place_in_league['ByScore'] = profileIndex + 1;
            });

            applySquadEligibility(this.profilesDetails, latestPlayerStats, this.lastTour);

            if (this.route.snapshot.url[0].path ===  'spain') this.updatePrizes();
            if (this.route.snapshot.url[0].path ===  'champions-league') this.updatePrizesCL();
            if (this.route.snapshot.url[0].path ===  'world-cup') this.updatePrizesWC();

            applyTourPlayerStats(this.profilesDetails, playerStatsByTour, this.lastTour);
            if (this.route.snapshot.url[0].path ===  'world-cup') this.updatePrizesWC();
            

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

  sortByScore(a, b): number {
    return b.score - a.score;
  }

}
