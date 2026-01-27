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
import { StandingsComponent } from '../standings/standings.component';

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

  public isOnlyActivePrizes = true;
  public isShowAllPrizes = true;
  public isShowUnitedTableByPoints = true;
  public prizesToShow = [];
  public unitedProfiles = [];
  public profilesDetails = [];
  public chosenStage = 'common';

  public testInd: number = 0;

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
              
              Object.values(this.squads.data.tours)
              .forEach((tour, ind) => {
                const objMaxMin = this.getMinMaxInTour(tour.number);
                tour.max = objMaxMin.max;
                tour.med = objMaxMin.med;
                tour.min = objMaxMin.min;
              });

              // console.log('profiles', this.profiles);
              console.log('consts', this.consts);
              // console.log('squads', this.squads);
              // console.log('teams', this.teams);

              // console.log('lastTour', this.lastTour);
              // console.log(this.playersArr);

              this.calcRating();
              const squadDetailsValue = [];

              console.log('matches: ', this.consts.matches);

              const matches = this.consts.matches;
              let profilesDetails = this.consts.profiles.map(x => {
                const profileInfo = this.profiles.find(profile => profile.id === x);
                profileInfo.team = this.squads.data.players[x].team;
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
              console.log('profilesDetails', profilesDetails, matches);
              
              for (let i = 0; i < this.lastTour; i++) {  
                matches[i + 1].forEach(match => {
                  const currentStage = this.getCurrentStage(i + 1);

                  match.home_score = +this.squads.data.players[match.home].team.results_by_tour[i + 1].tour_score;
                  match.away_score = +this.squads.data.players[match.away].team.results_by_tour[i + 1].tour_score;
                  match.result = Math.abs(match.home_score - match.away_score) <= this.drawGap ? 0 :
                    match.home_score > match.away_score ? 1 : 2

                  const homeProfile = profilesDetails.find(x => x.id === match.home);
                  const awayProfile = profilesDetails.find(x => x.id === match.away);
                  const matchDiffFo = Math.abs(match.home_score - match.away_score);

                  console.log(i, ': match :', match, homeProfile, awayProfile);
                  homeProfile.results.fo[currentStage] += match.home_score;
                  homeProfile.results.missed_fo[currentStage] += match.away_score;
                  homeProfile.results.diff_fo[currentStage] = homeProfile.results.fo[currentStage] - homeProfile.results.missed_fo[currentStage];
                  if (match.home === '1113514956' || match.away === '1113514956') console.log('AAAA', homeProfile, homeProfile.results, matchDiffFo, match);

                  awayProfile.results.fo[currentStage] += match.away_score;
                  awayProfile.results.missed_fo[currentStage] += match.home_score;
                  awayProfile.results.diff_fo[currentStage] = awayProfile.results.fo[currentStage] - awayProfile.results.missed_fo[currentStage];
                  if (match.result === 0) {
                    homeProfile.results.draws[currentStage] += 1
                    awayProfile.results.draws[currentStage] += 1

                    homeProfile.results.points[currentStage] += 1
                    awayProfile.results.points[currentStage] += 1

                    if (homeProfile.results.prizeCurrentWinStrike > homeProfile.results.prizeMaxWinStrike) homeProfile.results.prizeMaxWinStrike = homeProfile.results.prizeCurrentWinStrike;
                    if (awayProfile.results.prizeCurrentWinStrike > awayProfile.results.prizeMaxWinStrike) awayProfile.results.prizeMaxWinStrike = awayProfile.results.prizeCurrentWinStrike;
                    homeProfile.results.prizeCurrentWinStrike = 0;
                    awayProfile.results.prizeCurrentWinStrike = 0;

                    homeProfile.results.prizeCurrentNoLoseStrike += 1
                    awayProfile.results.prizeCurrentNoLoseStrike += 1

                    if (homeProfile.results.prizeCurrentNoLoseStrike > homeProfile.results.prizeMaxNoLoseStrike)
                      homeProfile.results.prizeMaxNoLoseStrike = homeProfile.results.prizeCurrentNoLoseStrike;

                    if (awayProfile.results.prizeCurrentNoLoseStrike > awayProfile.results.prizeMaxNoLoseStrike)
                      awayProfile.results.prizeMaxNoLoseStrike = awayProfile.results.prizeCurrentNoLoseStrike;
                  }

                  if (match.result === 1) {
                    homeProfile.results.wins[currentStage] += 1
                    awayProfile.results.loses[currentStage] += 1

                    homeProfile.results.points[currentStage] += 3

                    if (matchDiffFo <= 5) homeProfile.results.prizeMinWins += 1;
                    if (matchDiffFo > awayProfile.results.prizeMaxLosedDiff && i > 1) awayProfile.results.prizeMaxLosedDiff = matchDiffFo;

                    // strike
                    homeProfile.results.prizeCurrentWinStrike += 1;
                    if (homeProfile.results.prizeCurrentWinStrike > homeProfile.results.prizeMaxWinStrike) homeProfile.results.prizeMaxWinStrike = homeProfile.results.prizeCurrentWinStrike;
                    if (awayProfile.results.prizeCurrentWinStrike > awayProfile.results.prizeMaxWinStrike) awayProfile.results.prizeMaxWinStrike = awayProfile.results.prizeCurrentWinStrike;

                    awayProfile.results.prizeCurrentWinStrike = 0;
                    
                    // nolose strike
                    homeProfile.results.prizeCurrentNoLoseStrike += 1;
                    if (homeProfile.results.prizeCurrentNoLoseStrike > homeProfile.results.prizeMaxNoLoseStrike)
                      homeProfile.results.prizeMaxNoLoseStrike = homeProfile.results.prizeCurrentNoLoseStrike;

                    if (awayProfile.results.prizeCurrentWinStrike > homeProfile.results.prizeMaxStoppedNoLoseStrike) homeProfile.results.prizeMaxStoppedNoLoseStrike = awayProfile.results.prizeCurrentWinStrike;
                    
                    awayProfile.results.prizeCurrentNoLoseStrike = 0;
                  }

                  if (match.result === 2) {
                    awayProfile.results.wins[currentStage] += 1
                    homeProfile.results.loses[currentStage] += 1

                    awayProfile.results.points[currentStage] += 3

                    if (matchDiffFo <= 5) awayProfile.results.prizeMinWins += 1;
                    if (matchDiffFo > homeProfile.results.prizeMaxLosedDiff && i > 1) homeProfile.results.prizeMaxLosedDiff = matchDiffFo;
                    
                    // win strike
                    awayProfile.results.prizeCurrentWinStrike += 1;
                    if (homeProfile.results.prizeCurrentWinStrike > homeProfile.results.prizeMaxWinStrike) homeProfile.results.prizeMaxWinStrike = homeProfile.results.prizeCurrentWinStrike;
                    if (awayProfile.results.prizeCurrentWinStrike > awayProfile.results.prizeMaxWinStrike) awayProfile.results.prizeMaxWinStrike = awayProfile.results.prizeCurrentWinStrike;

                    homeProfile.results.prizeCurrentWinStrike = 0;
                    
                    // nolose strike
                    awayProfile.results.prizeCurrentNoLoseStrike += 1;
                    if (awayProfile.results.prizeCurrentNoLoseStrike > awayProfile.results.prizeMaxNoLoseStrike)
                      awayProfile.results.prizeMaxNoLoseStrike = awayProfile.results.prizeCurrentNoLoseStrike;

                    if (homeProfile.results.prizeCurrentNoLoseStrike > awayProfile.results.prizeMaxStoppedNoLoseStrike) awayProfile.results.prizeMaxStoppedNoLoseStrike = homeProfile.results.prizeCurrentNoLoseStrike;
                    
                    homeProfile.results.prizeCurrentNoLoseStrike = 0;
                  }

                  // max fo
                  if (match.home_score > homeProfile.results.prizeMaxFoInTour)
                    homeProfile.results.prizeMaxFoInTour = match.home_score;

                  if (match.away_score > awayProfile.results.prizeMaxFoInTour)
                    awayProfile.results.prizeMaxFoInTour = match.away_score;

                  // max fo losed
                  if (match.home_score > homeProfile.results.prizeMaxFoInLosedTour && match.result === 2)
                    homeProfile.results.prizeMaxFoInLosedTour = match.home_score;

                  if (match.away_score > awayProfile.results.prizeMaxFoInLosedTour && match.result === 1)
                    awayProfile.results.prizeMaxFoInLosedTour = match.away_score;

                  // teamCost
                  homeProfile.results.teamCostTotal += homeProfile.team.rosters_by_tour[i+1].team_cost;
                  homeProfile.results.teamCostAvg = Math.round(homeProfile.results.teamCostTotal / (i + 1) * 100) / 100;
                  
                  awayProfile.results.teamCostTotal += awayProfile.team.rosters_by_tour[i+1].team_cost;
                  awayProfile.results.teamCostAvg = Math.round(awayProfile.results.teamCostTotal / (i + 1) * 100) / 100;

                  // subs
                  homeProfile.results.subsTotalCount += i > 0 ? 3 : 0;
                  awayProfile.results.subsTotalCount += i > 0 ? 3 : 0;
                  
                  if (i > 0) {
                    const actHomeSquad = homeProfile.team.rosters_by_tour[i+1].players.base.concat(homeProfile.team.rosters_by_tour[i+1].players.bench);
                    const prevHomeSquad = homeProfile.team.rosters_by_tour[i].players.base.concat(homeProfile.team.rosters_by_tour[i].players.bench);

                    const crossHomeSquadLength = actHomeSquad.filter(playerId => prevHomeSquad.includes(playerId)).length || 0;

                    homeProfile.results.subsUsedCount += i > 0 ? i === 15 ? 15 : (15 - crossHomeSquadLength) : 0;
                    homeProfile.results.subsCoef = Math.round(homeProfile.results.subsUsedCount / homeProfile.results.subsTotalCount * 10000) / 100;

                    const actAwaySquad = awayProfile.team.rosters_by_tour[i+1].players.base.concat(awayProfile.team.rosters_by_tour[i+1].players.bench);
                    const prevAwaySquad = awayProfile.team.rosters_by_tour[i].players.base.concat(awayProfile.team.rosters_by_tour[i].players.bench);

                    const crossAwaySquadLength = actAwaySquad.filter(playerId => prevAwaySquad.includes(playerId)).length || 0;

                    awayProfile.results.subsUsedCount += i > 0 ? i === 15 ? 15 : (15 - crossAwaySquadLength) : 0;
                    awayProfile.results.subsCoef = Math.round(awayProfile.results.subsUsedCount / awayProfile.results.subsTotalCount * 10000) / 100;
                  }

                  this.updateProfileCommonResults(homeProfile);
                  this.updateProfileCommonResults(awayProfile);
                })

                this.profilesDetails = Object.assign([], profilesDetails.sort(this.sortStandings.bind(this)))
              }

              // общий зачет в баллах
              this.profilesDetails.forEach(profile => {
                this.consts.stages.forEach(stage => {
                  stage.leagues.forEach(league => {
                    if (!profile.leagues) profile.leagues = [];

                    if (league.profiles.includes(profile.id))
                      profile.leagues[stage.name.toLowerCase()] = league.name;
                  })
                })
              });

              console.log('profilesDetails', this.profilesDetails, matches);

              this.unitedProfiles = this.profilesDetails;
              console.log('unitedProfiles', this.route.snapshot.url[0].path, this.unitedProfiles.sort(this.sortStandings.bind(this)));
              
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

              this.squadsDetails.next([...this.squadsDetails.value.sort(this.sortByScore)])
              console.log('bbbbb: ', this.squadsDetails.value, this.playersRatingArr)
              
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

            // console.log('Команды, сорт. по трансферам: ', this.teamsArr.sort(this.sortByTransfersCount));
            // console.log('Команды, сорт. по очкам: ', this.teamsArr.sort(this.sortByPointsCount));

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
              
            // if (this.route.snapshot.url[0].path === 'spain') this.updatePrizes();
          },
          error: err => {
            console.error('Ошибка при получении данных:', err);
          }
        });
    }});
  }

  updateProfileCommonResults(profile) {
    profile.results.wins['common'] = profile.results.wins['apertura'] + profile.results.wins['clausura'];
    profile.results.draws['common'] = profile.results.draws['apertura'] + profile.results.draws['clausura'];
    profile.results.loses['common'] = profile.results.loses['apertura'] + profile.results.loses['clausura'];
    profile.results.points['common'] = profile.results.points['apertura'] + profile.results.points['clausura'];
    profile.results.fo['common'] = profile.results.fo['apertura'] + profile.results.fo['clausura'];
    profile.results.missed_fo['common'] = profile.results.missed_fo['apertura'] + profile.results.missed_fo['clausura'];
    profile.results.diff_fo['common'] = profile.results.diff_fo['apertura'] + profile.results.diff_fo['clausura'];
  }

  updateProfilesByStage(stageType, leagueType = '') {
    this.chosenStage = stageType;
    this.unitedProfiles = stageType === 'common' ? this.profilesDetails
      : this.profilesDetails.filter(x => x.leagues[stageType] === leagueType);
    this.unitedProfiles.sort(this.sortStandings.bind(this));
  }

  filterProfilesByStage(stageType)

  toggleUnitedRating() {
    this.isShowUnitedTableByPoints = !this.isShowUnitedTableByPoints;
  }

  toggleShowingAllPrizes() {
    this.isShowAllPrizes = !this.isShowAllPrizes;
    this.updateShowingPrizesList();
  }

  updateShowingPrizesList() {
    this.prizesToShow = this.consts.prizes.filter(prize => !!this.isShowAllPrizes ? true : prize.state === 1);
  }

  showAllNominees(prize) {
    prize.isShowAll = !prize.isShowAll;
  }

  countPrizeNominees(profiles, prizeInd, keyId = "") {
    const prizesObj = this.consts.prizes.find(prize => prize.id === prizeInd);
    const valueSortCoef = +[8].includes(prizeInd);
    const paramSortCoef = +[17].includes(prizeInd)

    profiles.forEach(profile => {
      const profileResult = prizesObj.nomineesArr.find(nominee => nominee.profileId === profile.id);
      
      // console.log('494: ', profile.id);

      if (prizeInd === 6 && ["1028890564", "1113514956", "1116311743", "154819672"].includes(profile.id))
        {
          profile.prizes = {};
          profile.team = {};
          profile.results = {};
          profile.team.title = profile.id === "1028890564" ? "BallBoy17" : "Skyters";
          profile.results.subsCoef = 100;
          profile.results.points = 0;
        }

      // console.log('506: ', prizeInd, profile.results);

      profile.prizes[prizeInd] = {
        value: 
          prizeInd === 6 ?
            (!!profileResult ? profileResult.points : 0)
          : prizeInd === 7 ?
            Object.values(profile.team.rosters_by_tour).reduce((a, b) => {
              return a + b.players.base.includes(keyId) + b.players.bench.includes(keyId);
            }, 0)
          : prizeInd === 8 ?
            profile.results.teamCostAvg
          : prizeInd === 10 ?
            Object.values(profile.team.rosters_by_tour).reduce((a, b) => {
              return a + +(b.captain_id === keyId);
            }, 0)
          : prizeInd === 12 ?
            profile.results.prizeMinWins
          : prizeInd === 14 ?
            profile.results.prizeMaxFoInTour
          : prizeInd === 15 ?
            profile.results.prizeMaxWinStrike
          : prizeInd === 16 ?
            profile.results.prizeMaxFoInLosedTour
          : prizeInd === 17 ?
            profile.results.prizeMaxStoppedNoLoseStrike
          : prizeInd === 18 ?
            profile.results.prizeMaxLosedDiff
          : 0,

        sortParam: 
          prizeInd === 6 ?
            (!!profileResult ? profileResult.points : 0)
            : profile.results.points
      }
    })

    prizesObj.nomineesArr = this.profiles
      .filter(profile => 
        prizeInd === 6 && profile.id === "1028890564"
        || prizeInd === 7 && !["1028890564", "1113514956", "1116311743", "154819672"].includes(profile.id)
        || !["1028890564", "1113514956", "1116311743", "154819672"].includes(profile.id) && profile.prizes[prizeInd]?.value > 0
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
        ( prizeInd !== 10 
          || prizeInd === 10 && nominee.prizes[prizeInd].value >= 3
        )
    });
  }

  updatePrizes() {
    this.consts.prizes.forEach(prize =>
      this.countPrizeNominees(
        prize.id === 6 ?
          this.profiles
          : this.profiles.filter(profile => !["1028890564", "1113514956", "1116311743", "154819672"].includes(profile.id)), prize.id
        , prize.id === 7 ? 
          "213955"
          : prize.id === 10 ?
            "213946"
            : ""
      )
    )

    // console.log('prizes: ', this.consts.prizes, this.profiles);
    
    this.consts.prizes.forEach((prize) => {
      if (!!prize.isFinalStage) prize.state = 2;
      if (!!prize.nomineesArr.length) prize.state = 1;
      if (!prize.state && !prize.nomineesArr.length) prize.state = 3;
    });

    this.updateShowingPrizesList();
  }

  getCurrentStage(tourInd) {
    return tourInd <= this.consts.stages[0].lastTour ? 'apertura' : 'clausura';
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

    if (a.results.points[this.chosenStage] > b.results.points[this.chosenStage]) return -1;
    if (a.results.points[this.chosenStage] < b.results.points[this.chosenStage]) return 1;
    
    if (a.results.diff_fo[this.chosenStage] > b.results.diff_fo[this.chosenStage]) return -1;
    if (a.results.diff_fo[this.chosenStage] < b.results.diff_fo[this.chosenStage]) return 1;
    
    if (a.results.fo[this.chosenStage] > b.results.fo[this.chosenStage]) return -1;
    if (a.results.fo[this.chosenStage] < b.results.fo[this.chosenStage]) return 1;

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

  getTeamId(profileId) {
    return this.profiles.find(profile => profile.id === profileId).team.id;
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

  getOpponentTeamId(matchesArr, profileId) {
    const match = matchesArr.find(match => match.home === profileId || match.away === profileId);
    const opponentId = match.home === profileId ? match.away : match.home;
    return this.profiles.find(profile => profile.id === opponentId).team.id;
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
