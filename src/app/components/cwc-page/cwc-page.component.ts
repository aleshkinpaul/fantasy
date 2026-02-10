// @ts-nocheck
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Apollo } from 'apollo-angular';
import { IGroup, IPlayers } from '../../models/model';
import { DataService } from '../../service/data.service';
import { CwcDataService } from '../../service/cwc-data.service';
import { Observable } from '@apollo/client';
import { BehaviorSubject, forkJoin } from 'rxjs';
import { ISquadDetails, IProfileDetails } from '../../models/domain';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { LoaderService } from 'src/app/service/loader.service';
import { logger } from 'src/app/utils/logger';
import { HeaderComponent } from '../header/header.component';
import { DefaultLoaderComponent } from '../loader/default-loader.component';

@Component({
  selector: 'app-cwc-page',
  templateUrl: './cwc-page.component.html',
  styleUrls: ['./cwc-page.component.scss'],
  standalone: true,
  imports: [CommonModule, HeaderComponent, DefaultLoaderComponent],
  providers: [CwcDataService]
})
export class CWCPageComponent implements OnInit {
  public activeTab = 'groups';
  public activeGroupTabs = [{id: 1, isTeams: true}, {id: 2, isTeams: true}, {id: 3, isTeams: true}, {id: 4, isTeams: true}]
  private data;
  public profiles;
  public consts;
  public squads;
  public teams;
  public results = [];
  public groupResults = [];
  public additionalGroup = {
    groupId: 4,
    groupName: "Отборочный тур",
    teams: [],
    matches: []
  };
  public playOffGroup = {
    groupId: 5,
    groupName: "Плей-офф",
    teams: [],
    matches: []
  };
  public semifinalGroup = {
    groupId: 6,
    groupName: "Плей-офф",
    teams: [],
    matches: []
  };
  public finalGroup = {
    groupId: 7,
    groupName: "Плей-офф",
    teams: [],
    matches: []
  };
  public thirdplaceGroup = {
    groupId: 7,
    groupName: "Плей-офф",
    teams: [],
    matches: []
  };
  public resultTeams = [];
  // public tours;
  // public squadsDetails = [];
	public groups = new BehaviorSubject<IGroup[]>([])
  public groups$ = this.groups.asObservable();
	public squadsDetails = new BehaviorSubject<ISquadDetails[]>([])
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
    private cwcDataService: CwcDataService,
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
        this.profiles = Object.values(profiles[yearParam]);
        this.consts = consts;
        this.consts = this.consts.league.find(x => x.type === this.route.snapshot.url[0].path);
        this.teams = teams;
        this.groups.next([...this.consts.groups] as IGroup[]);        

        const sources = [];
        sources.push(this.http.get(this.consts.squad_link));
        if (!!this.consts.squad_link_2) sources.push(this.http.get(this.consts.squad_link_2));
        
        forkJoin([
          ...sources
        ])
        .subscribe({
          next: ([squads, squads_2]) => {
              this.squads = squads;
              this.cwcDataService.setSquads(this.squads);
              this.playersArr = Object.values(this.squads.data.players).map(player => player.id);
              this.lastTour = Object.keys(this.squads.data.tours).length;
              
              Object.values(this.squads.data.tours)
              .forEach((tour, ind) => {
                const objMaxMin = this.getMinMaxInTour(tour.number);
                tour.max = objMaxMin.max;
                tour.med = objMaxMin.med;
                tour.min = objMaxMin.min;
              });

              // console.log('CHECK: ', this.squads.data.tours, this.lastTour);
              
              // console.log('profiles', this.profiles);
              logger.debug('consts', this.consts);
              // console.log('squads', this.squads);
              // console.log('teams', this.teams);

              // console.log('lastTour', this.lastTour);
              // console.log('this.playersArr', this.playersArr);

              // console.log('calcRating()');

              this.calcRating();
              // console.log('squads!!!', this.squads);

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

              logger.debug('this.squadsDetails', this.squadsDetails.value);

              // идем по группам
              this.consts.groups.forEach((group, groupInd) => {
                const groupInfo = {
                  groupId: group.id,
                  groupName: group.name,
                  teams: [],
                  tours: []
                };

                this.results = groupInd === 0 ? [groupInfo] : [...this.results, groupInfo];
                const result = this.results.find(result => result.groupName === group.name);

                // идем по командам внутри группы, записываем их полную инфу в group.teams
                group.teams.forEach((teamId, teamInd) => {       
                  const teamObj = {};
                  Object.assign(teamObj, this.consts.teams.find(team => team.id === teamId));
                  teamObj.results = {
                    win: 0,
                    draw: 0,
                    lose: 0,
                    points: 0,
                    goals: 0,
                    missed_goals: 0,
                    fo: 0,
                    missed_fo: 0,
                    gd: 0,
                    pd: 0
                  };

                  teamObj.profiles.forEach((profileId, profileInd) => {
                    teamObj.profiles[profileInd] = {};
                    Object.assign(teamObj.profiles[profileInd], this.profiles.find(profile => profile.id === profileId));
                    teamObj.profiles[profileInd].results = [];
                    
                    teamObj.profiles[profileInd].teamName = this.squadsDetails.value.find(squad => squad.id === profileId)?.name || '';
                  })

                  result.teams = [...result.teams, teamObj];
                });
                
                // идем по турам группы
                this.consts.tours.filter(tour => tour.type === 'group' || tour.type === 'add')
                .forEach((tour, tourInd) => {

                  result.tours = [...result.tours, {
                    num: tour.tour,
                    type: tour.type,
                    matches: [],
                    teams: Object.assign([], this.results[groupInd].teams)
                  }]

                  if (tourInd < 3)
                    result.tours[tourInd].matches = tour.matches.map((match, matchInd) => {
                      const first_team = Object.assign({}, result.tours[tourInd].teams.find(team => group.teams[match.first_team] === team.id));
                      const second_team = Object.assign({}, result.tours[tourInd].teams.find(team => group.teams[match.second_team] === team.id));

                      return {
                        first_team: first_team,
                        second_team: second_team,
                      }
                    });
                })

                logger.debug('results', this.results);
                

                result.tours.filter(tour => tour.type === 'group')
                .forEach((tour, tourInd) => {
                  result.tours[tourInd].matches.forEach(match => {
                    logger.debug('addmeet:', match, tourInd);
                    
                    this.cwcDataService.addMeets(match, tourInd);

                    if (tour.num <= this.lastTour) {
                      match.meets.forEach(meet => this.cwcDataService.countProfileResult(meet, tourInd));
                      
                      logger.debug('tour[tourInd+1]', tour[tourInd+1]);
                      
                      if (!!result.tours[tourInd+1]) {
                        this.cwcDataService.sortProfilesInTeam(match.first_team, tourInd, result, this.lastTour, this.consts);
                        this.cwcDataService.sortProfilesInTeam(match.second_team, tourInd, result, this.lastTour, this.consts);
                      }

                      this.cwcDataService.countMatchResult(match);

                      this.cwcDataService.countTeamResult(match, match.first_team);
                      this.cwcDataService.countTeamResult(match, match.second_team);
                    }
                  });

                  this.cwcDataService.sortTeamsInGroup(result.teams);
                });

                logger.debug('result', result);                
                this.groupResults.push(JSON.parse(JSON.stringify(result)));
              });

              // 4 tour

              let lastTeams = [];
              this.results.forEach((group, groupInd) => {
                logger.debug(group.teams);
                
                lastTeams = lastTeams.concat([
                  Object.assign({}, group.teams[2]),
                  Object.assign({}, group.teams[3])
                ]);
              });

              this.additionalGroup = {
                groupId: 4,
                groupName: 'Отборочный тур',
                teams: lastTeams,
                tours: []
              };
              
              this.cwcDataService.sortTeamsInGroup(this.additionalGroup.teams);

              logger.debug(this.additionalGroup);

              this.additionalGroup.matches = this.consts.tours[3].matches.map((match, matchInd) => {
                const first_team = Object.assign({}, this.additionalGroup.teams.find(team => this.additionalGroup.teams[match.first_team].id === team.id));
                const second_team = Object.assign({}, this.additionalGroup.teams.find(team => this.additionalGroup.teams[match.second_team].id === team.id));

                return {
                  first_team: first_team,
                  second_team: second_team,
                }
              });

              this.additionalGroup.matches.forEach(match => {
                this.cwcDataService.addMeets(match, 3);
                
                if (this.lastTour > 3) {
                  this.cwcDataService.countMatchResult(match);

                  this.cwcDataService.countTeamResult(match, match.first_team);
                  this.cwcDataService.countTeamResult(match, match.second_team);
              
                  this.cwcDataService.sortTeamsInGroup(this.additionalGroup.teams);
                }
              });

              // play-off (5,6,7)

              let playOffTeams = [];
              let semiFinalTeams = [];
              let finalTeams = [];
              let thirdplaceTeams = [];
              let resultTeams = [];

              this.results.forEach((group, groupInd) => {
                logger.debug(group.teams);
                
                playOffTeams = this.cwcDataService.getNewObj(playOffTeams.concat([group.teams[0], group.teams[1]]));
              });

              logger.debug('groupResults.teams', this.groupResults.reduce((a,b) => a.concat(b.teams), []));
              
              this.playOffGroup.teams = this.cwcDataService.getNewObj(playOffTeams.concat([
                this.groupResults.reduce((a,b) => a.concat(b.teams), []).find(team => team.id === this.additionalGroup.teams[0].id),
                this.groupResults.reduce((a,b) => a.concat(b.teams), []).find(team => team.id === this.additionalGroup.teams[1].id)
              ]));

              logger.debug('this.additionalGroup', this.additionalGroup);

              logger.debug('this.playOffGroup', this.playOffGroup);
              
              this.playOffGroup.matches = this.consts.tours[4].matches.map((match, matchInd) => {
                const first_team = Object.assign({}, this.playOffGroup.teams.find(team => this.playOffGroup.teams[match.first_team].id === team.id));
                const second_team = Object.assign({}, this.playOffGroup.teams.find(team => this.playOffGroup.teams[match.second_team].id === team.id));

                return {
                  first_team: first_team,
                  second_team: second_team,
                }
              });

              this.playOffGroup.matches.forEach(match => {
                this.cwcDataService.addMeets(match, 4);
                
                if (this.lastTour > 4) {
                  this.cwcDataService.countMatchResult(match);

                  this.cwcDataService.countTeamResult(match, match.first_team);
                  this.cwcDataService.countTeamResult(match, match.second_team);
                }
                
                match.meets.forEach(meet => this.cwcDataService.countProfileResult(meet, 3));
              });
                
              this.cwcDataService.updateInnerRating(this.groupResults, this.playOffGroup, 4);

              this.playOffGroup.matches.forEach(match => {
                semiFinalTeams.push(
                  this.cwcDataService.getPlayoffResult(match) === 2 ? this.cwcDataService.getNewObj(match.second_team) : 
                    this.cwcDataService.getPlayoffResult(match) === 1 ? this.cwcDataService.getNewObj(match.first_team) : {}
                );
              });

              // semifinal 
              this.semifinalGroup.teams = this.cwcDataService.getNewObj(semiFinalTeams);             
              this.semifinalGroup.matches = this.consts.tours[5].matches.map((match, matchInd) => {
                const first_team = Object.assign({}, this.semifinalGroup.teams.find(team => this.semifinalGroup.teams[match.first_team].id === team.id));
                const second_team = Object.assign({}, this.semifinalGroup.teams.find(team => this.semifinalGroup.teams[match.second_team].id === team.id));

                return {
                  first_team: first_team,
                  second_team: second_team,
                }
              });

              this.semifinalGroup.matches.forEach(match => {
                this.cwcDataService.addMeets(match, 5);
                
                if (this.lastTour > 4) {
                  this.cwcDataService.countMatchResult(match);

                  this.cwcDataService.countTeamResult(match, match.first_team);
                  this.cwcDataService.countTeamResult(match, match.second_team);
                }
                
                match.meets.forEach(meet => this.cwcDataService.countProfileResult(meet, 4));
              });

              this.cwcDataService.updateInnerRating(this.groupResults, this.semifinalGroup, 5);

              this.semifinalGroup.matches.forEach(match => {
                finalTeams.push(
                  this.cwcDataService.getPlayoffResult(match) === 2 ? this.cwcDataService.getNewObj(match.second_team) : 
                    this.cwcDataService.getPlayoffResult(match) === 1 ? this.cwcDataService.getNewObj(match.first_team) : {}
                );
              });

              this.semifinalGroup.matches.forEach(match => {
                finalTeams.push(
                  this.cwcDataService.getPlayoffResult(match) === 2 ? this.cwcDataService.getNewObj(match.first_team) : 
                    this.cwcDataService.getPlayoffResult(match) === 1 ? this.cwcDataService.getNewObj(match.second_team) : {}
                );
              });

              // final 
              this.finalGroup.teams = this.cwcDataService.getNewObj(finalTeams);      
              logger.debug('this.finalGroup', this.finalGroup);
                     
              this.finalGroup.matches = this.consts.tours[6].matches.map((match, matchInd) => {
                const first_team = Object.assign({}, this.finalGroup.teams.find(team => this.finalGroup.teams[match.first_team].id === team.id));
                const second_team = Object.assign({}, this.finalGroup.teams.find(team => this.finalGroup.teams[match.second_team].id === team.id));

                return {
                  first_team: first_team,
                  second_team: second_team,
                }
              });

              this.finalGroup.matches.forEach(match => {
                this.cwcDataService.addMeets(match, 6);
                
                if (this.lastTour > 6) {
                  this.cwcDataService.countMatchResult(match);

                  this.cwcDataService.countTeamResult(match, match.first_team);
                  this.cwcDataService.countTeamResult(match, match.second_team);
                }
                
                match.meets.forEach(meet => this.cwcDataService.countProfileResult(meet, 5));
              });
              
              if (this.lastTour > 6) {
                this.updateInnerRating(this.groupResults, this.finalGroup, 6);

                this.finalGroup.matches.forEach((match, matchInd) => {
                  resultTeams.push(
                    this.cwcDataService.getPlayoffResult(match) === 2 ? this.cwcDataService.getNewObj(match.second_team) : 
                      this.cwcDataService.getPlayoffResult(match) === 1 ? this.cwcDataService.getNewObj(match.first_team) : {}
                  );

                  if (matchInd === 0)
                    resultTeams.push(
                      this.cwcDataService.getPlayoffResult(match) === 2 ? this.cwcDataService.getNewObj(match.first_team) : 
                        this.cwcDataService.getPlayoffResult(match) === 1 ? this.cwcDataService.getNewObj(match.second_team) : {}
                    );
                });
              }

              this.resultTeams = resultTeams;

              logger.debug('this.playOffGroup', this.playOffGroup, this.semifinalGroup, this.finalGroup, this.resultTeams);
              
              
              setTimeout(() => {
                this.route.queryParams.subscribe(params => {
                  if (!!params['tab'])
                    this.updateActiveTab(params['tab']);
                  else
                    this.updateActiveTab(this.activeTab);
                });
              }, 1250);
              
          },
          error: err => {
            logger.error('Ошибка при получении данных:', err);
          }
        });
    }});
  }

  getShortName(name: string) {
    const maxLength = 50;
    return name.length > maxLength ? name.substr(0, maxLength)+"..." : name;
  }

  toggleGroupTab(event, ind, isTeams) {
    this.activeGroupTabs[ind].isTeams = isTeams;
  }

  countTeamResult(match, team) {
    if (match.first_team.id === team.id) {
      if (match.match_result === 1) {
        team.results.win += 1;
        team.results.points += 3;
      }
      if (match.match_result === 0) {
        team.results.draw += 1;
        team.results.points += 1;
      }
      if (match.match_result === 2) team.results.lose += 1;

      team.results.goals += match.first_team_score;
      team.results.missed_goals += match.second_team_score;

      team.results.fo += match.first_team_fo_score;
      team.results.missed_fo += match.second_team_fo_score;
    }

    if (match.second_team.id === team.id) {
      if (match.match_result === 2) {
        team.results.win += 1;
        team.results.points += 3;
      }
      if (match.match_result === 0) {
        team.results.draw += 1;
        team.results.points += 1;
      }
      if (match.match_result === 1) team.results.lose += 1;

      team.results.goals += match.second_team_score;
      team.results.missed_goals += match.first_team_score;

      team.results.fo += match.second_team_fo_score;
      team.results.missed_fo += match.first_team_fo_score;
    }

    team.results.gd = team.results.goals - team.results.missed_goals;
    team.results.pd = team.results.fo - team.results.missed_fo;
  }

  sortTeamsInGroup(teams) {
    teams = teams.sort((a,b) => {
      if (b.results.points !== a.results.points) return b.results.points - a.results.points;
      if (b.results.gd !== a.results.gd) return b.results.gd - a.results.gd;
      return b.results.pd - a.results.pd;
    });
  }

  selectTab(event: Event): void {
    const elem = event.srcElement;
    this.updateActiveTab(elem.id);
  }

  updateActiveTab(newActiveTab) {
    this.activeTab = newActiveTab;
    
    const navElems = Array.from(document.getElementsByClassName('nav-item'));
    const activeElem = navElems.find(elem => elem.id === newActiveTab);
    
    navElems.forEach(elem => elem.classList.remove('acitve-tab'));
    activeElem.classList.add('acitve-tab');
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: this.activeTab },
      queryParamsHandling: 'merge'
    });
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

  getTeamInfo(id: number) {
    return this.consts.teams.find(team => team.id === id);
  }

  getProfileByTeamId(squadId: number, profileId: string = "") {
    const profiles = this.consts.teams.find(team => team.id === squadId).profiles;
    
    return this.squadsDetails.value.filter(squad => !!profileId ? squad.id === profileId : profiles.includes(squad.id));
  }

  getTeamProfilesByTour(group, tourId, teamId) {
    return group.tours
      .find(tour => tour.num === tourId).teams
      .find(team => team.id === teamId).profiles;
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

    this.maxResultValue = this.lastToursDetails.reduce((acc, cur, ind) => {
      return acc + (cur.med > 0 ?
        (cur.max - cur.med)/cur.med * this.ratingKoefs[ind]
        : 0
      )
    }, 0) - this.ratingMed;

    this.minResultValue = this.lastToursDetails.reduce((acc, cur, ind) => {
      return acc + (cur.med > 0 ?
        (cur.min - cur.med)/cur.med * this.ratingKoefs[ind]
        : 0
      )
    }, 0) - this.ratingMed;

    Object.values(this.squads.data.players).forEach(player => {
      const lastPlayerToursDetails = [
        this.lastTour   > 0  ? +this.squads.data.players[player.id].team.results_by_tour[this.lastTour].tour_score   : 0,
        this.lastTour-1 > 0  ? +this.squads.data.players[player.id].team.results_by_tour[this.lastTour-1].tour_score : 0,
        this.lastTour-2 > 0  ? +this.squads.data.players[player.id].team.results_by_tour[this.lastTour-2].tour_score : 0,
        this.lastTour-3 > 0  ? +this.squads.data.players[player.id].team.results_by_tour[this.lastTour-3].tour_score : 0,
        this.lastTour-4 > 0  ? +this.squads.data.players[player.id].team.results_by_tour[this.lastTour-4].tour_score : 0,
      ];
  
      const playersRating = this.lastToursDetails.reduce((acc, cur, ind) => {
        return acc + (cur.med > 0 ?
          (lastPlayerToursDetails[ind] - cur.med)/cur.med * this.ratingKoefs[ind]
          : 0
        )
      }, 0);
 
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

  getScoreColor(first_score: number, second_score: number) {
    if (Math.abs(first_score-second_score) <= 3) return 'grey';
    if (first_score > second_score) return 'green';
    if (first_score < second_score) return 'red';
  }

  getRgbForTour(score, max, min) {
    const value = max > 0 ? (score - min)/(max - min) : 0;

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
    if (tourNum < 1) return {
      max: 0,
      med: 0,
      min: 0
    };

    const tourResults = Object.values(this.squads.data.players)
      .map(player => player.team.results_by_tour[tourNum].tour_score);

    tourResults.sort(this.sortCustom);

    const resultObj = {
      max: +tourResults[0],
      med: +this.getMedian(tourResults),
      min: +tourResults[tourResults.length - 1]
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
