import { Component, DestroyRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService } from '../../service/data.service';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import {
  IActiveCompetitionTabs,
  IRuntimePrize,
  ISquadDetails,
  IProfileDetails,
} from '../../models/domain';
import { ActivatedRoute, Router } from '@angular/router';
import { LoaderService } from 'src/app/service/loader.service';
import { logger } from '../../utils/logger';
import { StandingsComponent } from '../standings/standings.component';
import { ScheduleComponent } from '../schedule/schedule.component';
import { MatchesComponent } from '../matches/matches.component';
import { HeaderComponent } from '../header/header.component';
import { DefaultLoaderComponent } from '../loader/default-loader.component';
import { PrizesListComponent } from './prizes-list.component';
import {
  CompetitionMatch,
  CompetitionType,
  FantasyFullInfoResponse,
  SeasonCompetitionConfig,
  SportPlayer,
} from '../../competition/models/competition.models';
import {
  compareByFantasyScore,
  compareStandings,
} from '../../competition/domain/standings-calculator';
import { CompetitionFacade } from '../../competition/data/competition.facade';
import { ConferenceParticipantsComponent } from '../conference-participants/conference-participants.component';
import { MatchCenterComponent } from '../match-center/match-center.component';
import { MatchForecastService, getTournamentCatalogId } from '../../match-center/match-forecast.service';
import { MatchCenterSelection, MatchForecastView } from '../../match-center/match-center.models';
import { TourInsightsComponent } from '../tour-insights/tour-insights.component';
import { TourInsights } from '../../tour-insights/tour-insights.models';
import { calculateTourInsights } from '../../tour-insights/tour-insights-calculator';

@Component({
  selector: 'app-league-h2h-page',
  templateUrl: './league-h2h-page.component.html',
  styleUrls: ['./league-h2h-page.component.scss'],
  standalone: true,
  imports: [CommonModule, StandingsComponent, ScheduleComponent, MatchesComponent, HeaderComponent, DefaultLoaderComponent, PrizesListComponent, ConferenceParticipantsComponent, MatchCenterComponent, TourInsightsComponent],
})
export class LeagueH2HPageComponent implements OnInit {
  public consts!: SeasonCompetitionConfig;
  public squads!: FantasyFullInfoResponse;
  public squadsDetails = new BehaviorSubject<ISquadDetails[]>([]);
  public activeTabs: IActiveCompetitionTabs = {
    tabId: 1,
    confId: 0,
    confTabId: 1,
    tourId: 1,
    cupTourId: 1,
    tourView: 'matches',
  }

  public isShowUnitedTableByPoints = false;
  public prizesToShow: IRuntimePrize[] = [];
  public unitedProfiles: IProfileDetails[] = [];
  public profilesDetails: IProfileDetails[] = [];
  public currentLeagueMatches: CompetitionMatch[][] = [];
  public leaguesRatings: Record<string, IProfileDetails[]> = {};
  public chosenStage = 'common';
  public chosenLeague = '';
  public competitionType!: CompetitionType;
  public loadError = false;
  public sportPlayersByTour: Record<number, SportPlayer[]> = {};
  public selectedMatch: MatchCenterSelection | null = null;
  public selectedSportPlayers: SportPlayer[] = [];
  public matchForecast: MatchForecastView | null = null;
  public forecastLoading = false;
  public tourInsights: TourInsights | null = null;
  private forecastSubscription?: Subscription;
  private insightsForecastSubscription?: Subscription;

  public lastTour = 1;

  public playersRatingArr: number[] = [];

  public isLoading$: Observable<boolean>;
  constructor(
    public service: DataService, 
    private route: ActivatedRoute,
    private router: Router,
    public loader: LoaderService,
    private competitionFacade: CompetitionFacade,
    private matchForecastService: MatchForecastService,
    private destroyRef: DestroyRef,
  ) {
    this.isLoading$ = this.loader.isLoading$;
    this.destroyRef.onDestroy(() => {
      this.forecastSubscription?.unsubscribe();
      this.insightsForecastSubscription?.unsubscribe();
    });
  }

  ngOnInit(): void {
    this.service.setUrlName(this.route.snapshot.url[0].path);
    this.loadCompetition();
  }

  loadCompetition(): void {
    const yearParam = +this.route.snapshot.queryParams['year'] || 0;
    const competitionType = this.route.snapshot.url[0].path as CompetitionType;
    this.loadError = false;

    this.competitionFacade.load(competitionType, yearParam)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: viewModel => {
              this.consts = viewModel.config;
              this.competitionType = viewModel.config.type;
              this.squads = viewModel.squads;
              this.lastTour = viewModel.lastTour;
              this.playersRatingArr = viewModel.playersRating;
              this.profilesDetails = viewModel.profilesDetails;
              this.leaguesRatings = viewModel.leaguesRatings;
              this.prizesToShow = viewModel.prizes;
              this.squadsDetails.next(viewModel.squadsDetails);
              this.sportPlayersByTour = viewModel.sportPlayersByTour;
              this.unitedProfiles = this.profilesDetails;

              this.updateTabs();
              const initialConfId = this.activeTabs.confId;

              this.setTabId(this.activeTabs.tabId, false);
              this.setConfId(initialConfId);
              this.setConfTabId(this.activeTabs.confTabId);

              this.getMatchesForLeague();
      },
      error: err => {
            this.loadError = true;
            logger.error('Ошибка при получении данных:', err);
      }
    });
  }

  getMatchesForLeague(): void {
    this.currentLeagueMatches = [];

    if (!!this.consts.stages[this.activeTabs.tabId-1]) {
      const stageInfo = this.consts.stages[this.activeTabs.tabId-1];
      const leagueProfiles = stageInfo.leagues[this.activeTabs.confId].profiles;
      const matches = this.consts.matches;

      for (let i = stageInfo.firstTour - 1; i < stageInfo.lastTour; i++) {
        if (matches[i + 1])
          this.currentLeagueMatches.push(matches[i + 1].filter(match => {
            return leagueProfiles.includes(match.home) || leagueProfiles.includes(match.away);
          }));
      }
    }
    this.refreshTourInsights();
  }

  updateProfilesByStage(stageType = '', leagueType = ''): void {
    if (!!stageType) this.chosenStage = stageType;
    this.unitedProfiles = this.chosenStage === 'common' ? this.profilesDetails
      : this.profilesDetails.filter(x => x.leagues?.[this.chosenStage] === leagueType);
    this.unitedProfiles.sort(!!this.isShowUnitedTableByPoints && this.chosenStage === 'common' ? this.sortStandingsByFO.bind(this) : this.sortStandings.bind(this));
  }

  updateStageTypeByTabId(): void {
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

  updateLeagueTypeByConfId(): void {
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

  toggleUnitedRating(): void {
    this.isShowUnitedTableByPoints = !this.isShowUnitedTableByPoints;
    this.updateProfilesByStage();
  }

  setTabId(ind: number, resetTour = true): void {
    this.activeTabs.tabId = ind;
    this.activeTabs.confId = 0;
    
    if (!!this.consts.stages[ind-1]) {
      const stage = this.consts.stages[ind-1];
      const stageToursCount = stage.lastTour - stage.firstTour + 1;
      const latestRelativeTour = Math.max(1, this.lastTour - stage.firstTour + 1);
      this.activeTabs.tourId = resetTour
        ? Math.min(latestRelativeTour, stageToursCount)
        : Math.max(1, Math.min(this.activeTabs.tourId, stageToursCount));
    }

    if (ind === 5 && this.consts.cup) {
      const cup = this.consts.cup;
      const actualCupTour =
        cup.matchesTours[0] <= this.lastTour ?
          Math.max(
            ...cup.matchesTours.filter(val => val <= this.lastTour)
          ) : cup.matchesTours[0];
      const indOfActualCupTour = cup.matchesTours.indexOf(actualCupTour) + 1;

      this.activeTabs.tourId = indOfActualCupTour;
      this.activeTabs.cupTourId = indOfActualCupTour;
    }

    this.setQueryParam(this.activeTabs);
    this.isShowUnitedTableByPoints = false;
    this.updateStageTypeByTabId();
    this.updateLeagueTypeByConfId();
    
    this.updateProfilesByStage(this.chosenStage, this.chosenLeague);
    this.getMatchesForLeague();
  }

  setConfId(ind: number): void {
    this.activeTabs.confId = ind;
    this.setQueryParam(this.activeTabs);
    this.updateLeagueTypeByConfId();
    this.updateProfilesByStage(this.chosenStage, this.chosenLeague);
    this.getMatchesForLeague();
  }

  setConfTabId(ind: number): void {
    this.activeTabs.confTabId = ind;
    this.setQueryParam(this.activeTabs)
  }

  setTourId(ind: number): void {
    this.activeTabs.tourId = ind;
    this.setQueryParam(this.activeTabs);
    this.refreshTourInsights();
  }

  setTourView(view: 'matches' | 'insights'): void {
    this.activeTabs.tourView = view;
    this.setQueryParam(this.activeTabs);
    if (view === 'insights') this.refreshTourInsights();
  }

  setCupTourId(ind: number): void {
    this.activeTabs.cupTourId = ind;
    this.setQueryParam(this.activeTabs)
  }

  updateTabs(): void {
    const tabIdParam = +this.route.snapshot.queryParams['tabId'] || '';
    const confIdParam = +this.route.snapshot.queryParams['confId'] || '';
    const confTabIdParam = +this.route.snapshot.queryParams['confTabId'] || '';
    const activeTourIdParam = +this.route.snapshot.queryParams['tourId'] || '';
    const tourViewParam = this.route.snapshot.queryParams['tourView'];

    if (!!tabIdParam) this.activeTabs.tabId = tabIdParam;
    if (!!confIdParam) this.activeTabs.confId = confIdParam;
    if (!!confTabIdParam) this.activeTabs.confTabId = confTabIdParam;

    this.activeTabs.tourId = !!activeTourIdParam ? activeTourIdParam : this.lastTour;
    this.activeTabs.tourView = tourViewParam === 'insights' ? 'insights' : 'matches';
  }

  private refreshTourInsights(): void {
    this.insightsForecastSubscription?.unsubscribe();
    const stage = this.consts?.stages[this.activeTabs.tabId - 1];
    const league = stage?.leagues[this.activeTabs.confId];
    if (!stage || !league) {
      this.tourInsights = null;
      return;
    }

    const relativeTourIndex = Math.max(0, this.activeTabs.tourId - 1);
    const tour = stage.firstTour + relativeTourIndex;
    const tournamentId = getTournamentCatalogId(
      this.consts.type,
      this.consts.yearStart,
      this.consts.yearEnd,
    );
    const calculate = (forecast?: Parameters<typeof calculateTourInsights>[0]['forecast']) =>
      calculateTourInsights({
        tournamentId,
        tour,
        lastTour: this.lastTour,
        stageName: stage.name,
        leagueName: league.name,
        profileIds: league.profiles,
        matches: this.currentLeagueMatches[relativeTourIndex] || [],
        profiles: this.profilesDetails,
        sportPlayers: this.sportPlayersByTour[tour] || [],
        drawGap: this.consts.drawGap || 0,
        forecast,
        capabilities: { playerScores: false, played: false },
      });

    this.tourInsights = calculate();
    if (tour > this.lastTour) return;
    this.insightsForecastSubscription = this.matchForecastService
      .loadTourSnapshot(tournamentId, tour)
      .subscribe(snapshot => this.tourInsights = calculate(snapshot));
  }

  sortStandings(a: IProfileDetails, b: IProfileDetails): number {
    return compareStandings(a, b, this.chosenStage);
  }

  sortStandingsByFO(a: IProfileDetails, b: IProfileDetails): number {
    return compareByFantasyScore(a, b);
  }

  getProfileRating(profileId: string): number | undefined {
    const profile = this.squadsDetails.value.find(x => x.id === profileId);
    return profile?.rating;
  }

  hasCupSchedule(): boolean {
    return Boolean(this.consts.cup?.matches.some(round => round.length > 0));
  }

  getSeasonPeriod(): string {
    return `${this.consts.yearStart}/${String(this.consts.yearEnd).slice(-2)}`;
  }

  openMatchCenter(selection: MatchCenterSelection): void {
    this.selectedMatch = selection;
    this.selectedSportPlayers = this.sportPlayersByTour[selection.tour]
      || this.sportPlayersByTour[this.lastTour]
      || [];
    this.matchForecast = null;
    this.forecastLoading = true;
    this.forecastSubscription?.unsubscribe();
    this.forecastSubscription = this.matchForecastService.resolve({
      tournamentId: getTournamentCatalogId(
        this.consts.type,
        this.consts.yearStart,
        this.consts.yearEnd,
      ),
      selection,
      profiles: this.profilesDetails,
      drawGap: this.consts.drawGap || 0,
      lastTour: this.lastTour,
    }).subscribe({
      next: forecast => {
        this.matchForecast = forecast;
        this.forecastLoading = false;
      },
      error: error => {
        logger.error('Не удалось загрузить прогноз матча:', error);
        this.matchForecast = {
          state: 'unavailable',
          message: 'Котировки временно недоступны. Составы команд можно посмотреть ниже.',
        };
        this.forecastLoading = false;
      },
    });
  }

  closeMatchCenter(): void {
    this.forecastSubscription?.unsubscribe();
    this.selectedMatch = null;
    this.matchForecast = null;
    this.forecastLoading = false;
  }

  setQueryParam(newParam: IActiveCompetitionTabs): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: newParam,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

}
