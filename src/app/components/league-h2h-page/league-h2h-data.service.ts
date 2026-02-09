export interface IMatchResult {
  homeScore: number;
  awayScore: number;
  result: 0 | 1 | 2; // 0 = draw, 1 = home win, 2 = away win
}

export interface IStrikeState {
  currentWinStrike: number;
  maxWinStrike: number;
  currentNoLoseStrike: number;
  maxNoLoseStrike: number;
  maxStoppedNoLoseStrike: number;
}

export class LeagueH2HDataService {
  /**
   * Calculates match result based on scores and draw gap
   */
  calculateMatchResult(homeScore: number, awayScore: number, drawGap: number = 0): IMatchResult {
    const diff = Math.abs(homeScore - awayScore);
    const isDraw = diff <= drawGap;

    return {
      homeScore,
      awayScore,
      result: isDraw ? 0 : homeScore > awayScore ? 1 : 2
    };
  }

  /**
   * Updates FOills (fantasy points) for both profiles
   */
  updateFO(
    homeProfile: any,
    awayProfile: any,
    match: any,
    stage: string
  ): void {
    homeProfile.results.fo[stage] += match.homeScore;
    homeProfile.results.missed_fo[stage] += match.awayScore;
    homeProfile.results.diff_fo[stage] = 
      homeProfile.results.fo[stage] - homeProfile.results.missed_fo[stage];

    awayProfile.results.fo[stage] += match.awayScore;
    awayProfile.results.missed_fo[stage] += match.homeScore;
    awayProfile.results.diff_fo[stage] = 
      awayProfile.results.fo[stage] - awayProfile.results.missed_fo[stage];
  }

  /**
   * Updates win/loss/draw counts for both profiles
   */
  updateMatchCounts(homeProfile: any, awayProfile: any, result: 0 | 1 | 2, stage: string): void {
    if (result === 0) { // draw
      homeProfile.results.draws[stage] += 1;
      awayProfile.results.draws[stage] += 1;
      homeProfile.results.points[stage] += 1;
      awayProfile.results.points[stage] += 1;
    } else if (result === 1) { // home win
      homeProfile.results.wins[stage] += 1;
      awayProfile.results.loses[stage] += 1;
      homeProfile.results.points[stage] += 3;
    } else { // away win
      awayProfile.results.wins[stage] += 1;
      homeProfile.results.loses[stage] += 1;
      awayProfile.results.points[stage] += 3;
    }
  }

  /**
   * Updates strike statistics (win streaks and no-lose streaks)
   */
  updateStrikes(
    homeProfile: any,
    awayProfile: any,
    result: 0 | 1 | 2,
    homeScore: number,
    awayScore: number,
    matchDiffFo: number,
    tourIndex: number
  ): void {
    if (result === 0) { // draw
      this.resetWinStrike(homeProfile);
      this.resetWinStrike(awayProfile);
      homeProfile.results.prizeCurrentNoLoseStrike += 1;
      awayProfile.results.prizeCurrentNoLoseStrike += 1;
      this.updateMaxNoloseStrike(homeProfile);
      this.updateMaxNoloseStrike(awayProfile);
    } else if (result === 1) { // home win
      homeProfile.results.prizeCurrentWinStrike += 1;
      this.updateMaxWinStrike(homeProfile);
      this.updateMaxNoloseStrike(homeProfile);
      awayProfile.results.prizeCurrentWinStrike = 0;
      awayProfile.results.prizeCurrentNoLoseStrike = 0;
      this.updateMaxStoppedNolose(homeProfile, awayProfile.results.prizeCurrentNoLoseStrike);

      if (matchDiffFo <= 5) homeProfile.results.prizeMinWins += 1;
      if (matchDiffFo > awayProfile.results.prizeMaxLosedDiff && tourIndex > 1) {
        awayProfile.results.prizeMaxLosedDiff = matchDiffFo;
      }
    } else { // away win
      awayProfile.results.prizeCurrentWinStrike += 1;
      this.updateMaxWinStrike(awayProfile);
      this.updateMaxNoloseStrike(awayProfile);
      homeProfile.results.prizeCurrentWinStrike = 0;
      homeProfile.results.prizeCurrentNoLoseStrike = 0;
      this.updateMaxStoppedNolose(awayProfile, homeProfile.results.prizeCurrentNoLoseStrike);

      if (matchDiffFo <= 5) awayProfile.results.prizeMinWins += 1;
      if (matchDiffFo > homeProfile.results.prizeMaxLosedDiff && tourIndex > 1) {
        homeProfile.results.prizeMaxLosedDiff = matchDiffFo;
      }
    }
  }

  /**
   * Updates max fantasy points in a tour
   */
  updateMaxFoInTour(
    homeProfile: any,
    awayProfile: any,
    homeScore: number,
    awayScore: number
  ): void {
    if (homeScore > homeProfile.results.prizeMaxFoInTour) {
      homeProfile.results.prizeMaxFoInTour = homeScore;
    }
    if (awayScore > awayProfile.results.prizeMaxFoInTour) {
      awayProfile.results.prizeMaxFoInTour = awayScore;
    }
  }

  /**
   * Updates max fantasy points in losing tours
   */
  updateMaxFoInLosedTour(
    homeProfile: any,
    awayProfile: any,
    homeScore: number,
    awayScore: number,
    result: 0 | 1 | 2
  ): void {
    if (homeScore > homeProfile.results.prizeMaxFoInLosedTour && result === 2) {
      homeProfile.results.prizeMaxFoInLosedTour = homeScore;
    }
    if (awayScore > awayProfile.results.prizeMaxFoInLosedTour && result === 1) {
      awayProfile.results.prizeMaxFoInLosedTour = awayScore;
    }
  }

  /**
   * Updates team cost averages
   */
  updateTeamCostAvg(
    homeProfile: any,
    awayProfile: any,
    homeTeamCost: number,
    awayTeamCost: number
  ): void {
    homeProfile.results.teamCostTotal += homeTeamCost;
    homeProfile.results.teamCostAvg = 
      Math.round(homeProfile.results.teamCostTotal / homeProfile.results.matchesPlayed * 100) / 100;

    awayProfile.results.teamCostTotal += awayTeamCost;
    awayProfile.results.teamCostAvg = 
      Math.round(awayProfile.results.teamCostTotal / awayProfile.results.matchesPlayed * 100) / 100;
  }

  /**
   * Updates substitution metrics
   */
  updateSubs(
    homeProfile: any,
    awayProfile: any,
    tourIndex: number,
    homeActSquad: string[],
    homePrevSquad: string[],
    awayActSquad: string[],
    awayPrevSquad: string[]
  ): void {
    homeProfile.results.subsTotalCount += tourIndex > 0 ? 3 : 0;
    awayProfile.results.subsTotalCount += tourIndex > 0 ? 3 : 0;

    if ([19, 20, 21].includes(tourIndex)) {
      homeProfile.results.subsTotalCount += 1;
      awayProfile.results.subsTotalCount += 1;
    }

    if (tourIndex > 0) {
      const homeSubsUsed = 15 - homeActSquad.filter(pId => homePrevSquad.includes(pId)).length;
      const awaySubsUsed = 15 - awayActSquad.filter(pId => awayPrevSquad.includes(pId)).length;

      homeProfile.results.subsUsedCount += homeSubsUsed;
      homeProfile.results.subsCoef = 
        Math.round(homeProfile.results.subsUsedCount / homeProfile.results.subsTotalCount * 10000) / 100;

      awayProfile.results.subsUsedCount += awaySubsUsed;
      awayProfile.results.subsCoef = 
        Math.round(awayProfile.results.subsUsedCount / awayProfile.results.subsTotalCount * 10000) / 100;
    }
  }

  /**
   * Helper: Update max win strike
   */
  private updateMaxWinStrike(profile: any): void {
    if (profile.results.prizeCurrentWinStrike > profile.results.prizeMaxWinStrike) {
      profile.results.prizeMaxWinStrike = profile.results.prizeCurrentWinStrike;
    }
  }

  /**
   * Helper: Update max no-lose streak
   */
  private updateMaxNoloseStrike(profile: any): void {
    if (profile.results.prizeCurrentNoLoseStrike > profile.results.prizeMaxNoLoseStrike) {
      profile.results.prizeMaxNoLoseStrike = profile.results.prizeCurrentNoLoseStrike;
    }
  }

  /**
   * Helper: Update max stopped no-lose streak
   */
  private updateMaxStoppedNolose(profile: any, opponentStrike: number): void {
    if (opponentStrike > profile.results.prizeMaxStoppedNoLoseStrike) {
      profile.results.prizeMaxStoppedNoLoseStrike = opponentStrike;
    }
  }

  /**
   * Helper: Reset win strike
   */
  private resetWinStrike(profile: any): void {
    if (profile.results.prizeCurrentWinStrike > profile.results.prizeMaxWinStrike) {
      profile.results.prizeMaxWinStrike = profile.results.prizeCurrentWinStrike;
    }
    profile.results.prizeCurrentWinStrike = 0;
  }

  /**
   * Aggregates apertura and clausura results for common stage
   */
  updateCommonResults(profile: any): void {
    profile.results.wins['common'] = profile.results.wins['apertura'] + profile.results.wins['clausura'];
    profile.results.draws['common'] = profile.results.draws['apertura'] + profile.results.draws['clausura'];
    profile.results.loses['common'] = profile.results.loses['apertura'] + profile.results.loses['clausura'];
    profile.results.points['common'] = profile.results.points['apertura'] + profile.results.points['clausura'];
    profile.results.fo['common'] = profile.results.fo['apertura'] + profile.results.fo['clausura'];
    profile.results.missed_fo['common'] = profile.results.missed_fo['apertura'] + profile.results.missed_fo['clausura'];
    profile.results.diff_fo['common'] = profile.results.diff_fo['apertura'] + profile.results.diff_fo['clausura'];
  }

  /**
   * Gets current stage name (apertura/clausura) based on tour number
   */
  getCurrentStage(tourNumber: number, lastApertureaTour: number): string {
    return tourNumber <= lastApertureaTour ? 'apertura' : 'clausura';
  }

  /**
   * Calculates median value from array
   */
  getMedian(arr: number[]): number {
    if (arr.length === 0) return 0;
    
    const sorted = [...arr].sort((a, b) => b - a);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 !== 0) {
      return sorted[mid];
    }
    
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Extracts active squad (base + bench)
   */
  getActiveSquad(rosters: any, tourNumber: string | number): string[] {
    const roster = rosters[tourNumber];
    if (!roster) return [];
    return roster.players.base.concat(roster.players.bench);
  }

  /**
   * Counts squad changes
   */
  countSquadChanges(rosters: any, maxTour: number): number {
    let changes = 0;
    
    for (let i = 2; i <= maxTour; i++) {
      const currentSquad = this.getActiveSquad(rosters, i);
      const prevSquad = this.getActiveSquad(rosters, i - 1);
      
      if (currentSquad.length > 0 && prevSquad.length > 0) {
        const unchanged = currentSquad.filter(pId => prevSquad.includes(pId)).length;
        changes += 15 - unchanged;
      }
    }
    
    return changes;
  }
}
