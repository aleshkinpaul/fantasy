import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { LeagueH2HDataService } from '../../components/league-h2h-page/league-h2h-data.service';
import {
  IProfileDetails,
  IProfileResults,
  ISquadDetails,
} from '../../models/domain';
import { calculateCup } from '../domain/cup-calculator';
import {
  applySquadEligibility,
  applyTourPlayerStats,
} from '../domain/player-stats-calculator';
import {
  calculateChampionsLeaguePrizes,
  calculateSpainPrizes,
  calculateWorldCupPrizes,
} from '../domain/prize-calculator';
import { calculateSquadRatings } from '../domain/rating-calculator';
import {
  buildLeagueRatings,
  compareStandings,
  getPlaceAfterTour,
  getSeasonMedals,
} from '../domain/standings-calculator';
import {
  CompetitionPrizeConfig,
  CompetitionType,
  FantasyFullInfoResponse,
  LoadedCompetitionData,
  LocalProfile,
  SeasonCompetitionConfig,
  SpainPrizeRules,
} from '../models/competition.models';
import { CompetitionDataLoaderService } from './competition-data-loader.service';
import { getCompetitionRules } from '../config/competition-rules.registry';

type RuntimeProfile = LocalProfile & Partial<IProfileDetails>;

export interface CompetitionViewModel {
  config: SeasonCompetitionConfig;
  squads: FantasyFullInfoResponse;
  profilesDetails: IProfileDetails[];
  leaguesRatings: Record<string, IProfileDetails[]>;
  squadsDetails: ISquadDetails[];
  playersRating: number[];
  prizes: CompetitionPrizeConfig[];
  lastTour: number;
}

@Injectable({ providedIn: 'root' })
export class CompetitionFacade {
  constructor(
    private readonly loader: CompetitionDataLoaderService,
    private readonly h2h: LeagueH2HDataService,
  ) {}

  load(type: CompetitionType, yearStart: number): Observable<CompetitionViewModel> {
    return this.loader.load(type, yearStart).pipe(
      map(data => this.buildViewModel(data))
    );
  }

  private buildViewModel(data: LoadedCompetitionData): CompetitionViewModel {
    const { config, squads } = data;
    const rules = getCompetitionRules(config.rulesId || `season-${config.yearStart}`);
    const profiles = data.profiles as RuntimeProfile[];
    const lastTour = Object.keys(squads.data.tours).length;
    const playersRating = calculateSquadRatings(squads, lastTour);
    const profilesDetails = this.initializeProfiles(profiles, config, squads, lastTour);

    for (let tourIndex = 0; tourIndex < lastTour; tourIndex++) {
      this.h2h.processTour({
        tourIndex,
        currentStage: this.h2h.getCurrentStage(tourIndex + 1, config.stages[0].lastTour),
        profiles: profilesDetails,
        matches: config.matches[tourIndex + 1],
        squads,
        drawGap: config.drawGap || 0,
        competitionType: config.type,
        playOffTours: config.cup?.matchesTours || [],
        substitutionRules: rules.substitutions[config.type],
      });
      profilesDetails.sort((left, right) => compareStandings(left, right, 'common'));
    }

    if (config.cup) calculateCup({ cup: config.cup, profiles: profilesDetails, squads, lastTour });
    const leaguesRatings = buildLeagueRatings(profilesDetails, config.stages) as Record<string, IProfileDetails[]>;

    const squadsDetails = this.buildSquadDetails(profiles, squads, lastTour);
    this.assignScorePlaces(profilesDetails);
    applySquadEligibility(profilesDetails, data.latestPlayerStats, lastTour, rules.playerStats);

    let prizes = this.calculatePrizes(config.type, config.prizes, profiles, profilesDetails, rules.spainPrizes);
    applyTourPlayerStats(profilesDetails, data.playerStatsByTour, lastTour, rules.playerStats);
    if (config.type === 'world-cup') {
      prizes = calculateWorldCupPrizes({ prizes: config.prizes, profiles, profilesDetails });
    }

    return {
      config,
      squads,
      profilesDetails,
      leaguesRatings,
      squadsDetails,
      playersRating,
      prizes,
      lastTour,
    };
  }

  private initializeProfiles(
    profiles: RuntimeProfile[],
    config: SeasonCompetitionConfig,
    squads: FantasyFullInfoResponse,
    lastTour: number,
  ): IProfileDetails[] {
    return config.profiles.map(profileId => {
      const profile = profiles.find(item => item.id === profileId);
      if (!profile) throw new Error(`Не найден профиль участника ${profileId}`);

      profile.team = clone(squads.data.players[profileId].team) as unknown as IProfileDetails['team'];
      profile.score = +squads.data.players[profileId].team.results_by_tour[lastTour].total_score;
      profile.prizes = {};
      profile.results = createInitialResults();
      return profile as IProfileDetails;
    });
  }

  private buildSquadDetails(
    profiles: RuntimeProfile[],
    squads: FantasyFullInfoResponse,
    lastTour: number,
  ): ISquadDetails[] {
    const details: ISquadDetails[] = [];

    Object.values(squads.data.players).forEach(player => {
      const profile = profiles.find(item => item.id === player.id) as IProfileDetails | undefined;
      if (!profile) return;

      const medals = getSeasonMedals(squads, profile.id, lastTour);
      profile.squadDetails = {
        id: player.id,
        name: player.team.title,
        score: player.team.results_by_tour[lastTour].total_score,
        diff: lastTour > 1
          ? getPlaceAfterTour(squads, profile.id, lastTour - 1) - getPlaceAfterTour(squads, profile.id, lastTour)
          : 0,
        rating_of_prize_positions: medals.gold * 3 + medals.silver * 2 + medals.bronze,
        gold_medals: medals.gold,
        silver_medals: medals.silver,
        bronze_medals: medals.bronze,
        medals_count: medals.gold + medals.silver + medals.bronze,
        medals_arr: medals.medalsArr,
        max_medals_in_a_row: medals.maxMedalsInARow,
        cur_medals_in_a_row: medals.curMedalsInARow,
        totalPlaces: player.team.results_by_tour[lastTour].total_place,
        profile,
        team_id: player.team.id,
        info: player as unknown as ISquadDetails['info'],
        rating: player.team.rating,
      };
      details.push(profile.squadDetails);
    });

    return details.sort((left, right) => +right.score - +left.score);
  }

  private assignScorePlaces(profiles: IProfileDetails[]): void {
    const byScore = profiles
      .map(profile => ({ id: profile.squadDetails!.id, score: +profile.squadDetails!.score }))
      .sort((left, right) => right.score - left.score);

    profiles.forEach(profile => {
      if (!profile.place_in_league) profile.place_in_league = {};
      profile.place_in_league['ByScore'] = byScore.findIndex(item => item.id === profile.id) + 1;
    });
  }

  private calculatePrizes(
    type: CompetitionType,
    prizes: CompetitionPrizeConfig[],
    profiles: RuntimeProfile[],
    profilesDetails: IProfileDetails[],
    spainRules?: SpainPrizeRules,
  ): CompetitionPrizeConfig[] {
    if (type === 'spain') {
      if (!spainRules) throw new Error('Для турнира Испании не настроены правила призов');
      return calculateSpainPrizes({ prizes, profiles, profilesDetails, rules: spainRules });
    }
    if (type === 'champions-league') {
      return calculateChampionsLeaguePrizes({ prizes, profiles, profilesDetails });
    }
    return calculateWorldCupPrizes({ prizes, profiles, profilesDetails });
  }
}

function createInitialResults(): IProfileResults {
  return {
    wins: { apertura: 0, clausura: 0, common: 0 },
    draws: { apertura: 0, clausura: 0, common: 0 },
    loses: { apertura: 0, clausura: 0, common: 0 },
    points: { apertura: 0, clausura: 0, common: 0 },
    fo: { apertura: 0, clausura: 0, common: 0 },
    missed_fo: { apertura: 0, clausura: 0, common: 0 },
    diff_fo: { apertura: 0, clausura: 0, common: 0 },
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
    prizeMaxLosedDiff: 0,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
