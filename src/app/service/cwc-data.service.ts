import { Injectable } from '@angular/core';
import { logger } from '../utils/logger';

@Injectable({
  providedIn: 'root'
})
export class CwcDataService {
  private squads: any;

  setSquads(squads: any): void {
    this.squads = squads;
  }

  /**
   * Create individual meets between paired profiles in team rosters
   * Creates head-to-head matchups with calculated scores
   */
  addMeets(match: any, tourInd: number): void {
    const meets = match.first_team.profiles.map((profile, meetInd) => {
      const first_profile = match.first_team.profiles[meetInd];
      const second_profile = match.second_team.profiles[meetInd];

      logger.debug('meet profiles', first_profile, second_profile);

      const first_profile_score = +this.squads.data.players[first_profile.id].team.results_by_tour[tourInd + 1]?.tour_score || 0;
      const second_profile_score = +this.squads.data.players[second_profile.id].team.results_by_tour[tourInd + 1]?.tour_score || 0;

      return {
        order: meetInd,
        first_profile: first_profile,
        second_profile: second_profile,
        first_profile_score: first_profile_score,
        second_profile_score: second_profile_score,
        result:
          Math.abs(first_profile_score - second_profile_score) <= 3 ?
            0 :
            first_profile_score > second_profile_score ? 1 : 2
      };
    });

    match.meets = meets;
  }

  /**
   * Calculate match result from all individual meets
   * Aggregates wins/draws/losses from meets to determine overall match winner
   */
  countMatchResult(match: any): void {
    const first_team_score = match.meets.reduce((a, b) => a + [0, 1].includes(b.result), 0);
    const second_team_score = match.meets.reduce((a, b) => a + [0, 2].includes(b.result), 0);
    const match_result =
      first_team_score === second_team_score ?
        0 :
        first_team_score > second_team_score ? 1 : 2;

    const first_team_fo_score = match.meets.reduce((a, b) => a + b.first_profile_score, 0);
    const second_team_fo_score = match.meets.reduce((a, b) => a + b.second_profile_score, 0);

    match.first_team_score = first_team_score;
    match.second_team_score = second_team_score;
    match.first_team_fo_score = first_team_fo_score;
    match.second_team_fo_score = second_team_fo_score;
    match.match_result = match_result;
  }

  /**
   * Update team statistics based on match result
   * Both win/loss points and goal/FO differential tracking
   */
  countTeamResult(match: any, team: any): void {
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

  /**
   * Update individual profile statistics after meet
   * Accumulates total goals, FO, and differential calculations
   * ~50 lines of careful aggregation logic consolidated here
   */
  countProfileResult(meet: any, tourInd: number): void {
    const defaultObj = {
      tourInd: tourInd,
      goals: 0,
      missed_goals: 0,
      fo: 0,
      missed_fo: 0,
      gd: 0,
      pd: 0,
    };

    meet.first_profile.results.push(Object.assign({}, defaultObj));
    meet.second_profile.results.push(Object.assign({}, defaultObj));

    if ([0, 1].includes(meet.result)) {
      meet.first_profile.results[tourInd].goals += 1;
      meet.second_profile.results[tourInd].missed_goals += 1;
    }

    if ([0, 2].includes(meet.result)) {
      meet.second_profile.results[tourInd].goals += 1;
      meet.first_profile.results[tourInd].missed_goals += 1;
    }

    // First profile calculations
    meet.first_profile.results[tourInd].fo += meet.first_profile_score;
    meet.first_profile.results[tourInd].missed_fo += meet.second_profile_score;
    meet.first_profile.results[tourInd].gd = meet.first_profile.results[tourInd].goals - meet.first_profile.results[tourInd].missed_goals;
    meet.first_profile.results[tourInd].pd = meet.first_profile.results[tourInd].fo - meet.first_profile.results[tourInd].missed_fo;

    meet.first_profile.results[tourInd].total_fo = meet.first_profile.results.reduce((a, b) => a + b.fo, 0);
    meet.first_profile.results[tourInd].total_missed_fo = meet.first_profile.results.reduce((a, b) => a + b.missed_fo, 0);
    meet.first_profile.results[tourInd].total_pd = meet.first_profile.results[tourInd].total_fo - meet.first_profile.results[tourInd].total_missed_fo;
    meet.first_profile.results[tourInd].total_goals = meet.first_profile.results.reduce((a, b) => a + b.goals, 0);
    meet.first_profile.results[tourInd].total_missed_goals = meet.first_profile.results.reduce((a, b) => a + b.missed_goals, 0);
    meet.first_profile.results[tourInd].total_gd = meet.first_profile.results[tourInd].total_goals - meet.first_profile.results[tourInd].total_missed_goals;

    // Second profile calculations
    meet.second_profile.results[tourInd].fo += meet.second_profile_score;
    meet.second_profile.results[tourInd].missed_fo += meet.first_profile_score;
    meet.second_profile.results[tourInd].gd = meet.second_profile.results[tourInd].goals - meet.second_profile.results[tourInd].missed_goals;
    meet.second_profile.results[tourInd].pd = meet.second_profile.results[tourInd].fo - meet.second_profile.results[tourInd].missed_fo;

    meet.second_profile.results[tourInd].total_fo = meet.second_profile.results.reduce((a, b) => a + b.fo, 0);
    meet.second_profile.results[tourInd].total_missed_fo = meet.second_profile.results.reduce((a, b) => a + b.missed_fo, 0);
    meet.second_profile.results[tourInd].total_pd = meet.second_profile.results[tourInd].total_fo - meet.second_profile.results[tourInd].total_missed_fo;
    meet.second_profile.results[tourInd].total_goals = meet.second_profile.results.reduce((a, b) => a + b.goals, 0);
    meet.second_profile.results[tourInd].total_missed_goals = meet.second_profile.results.reduce((a, b) => a + b.missed_goals, 0);
    meet.second_profile.results[tourInd].total_gd = meet.second_profile.results[tourInd].total_goals - meet.second_profile.results[tourInd].total_missed_goals;
  }

  /**
   * Sort teams within group by playoff tiebreaker rules
   * Points → Goal differential → FO differential
   */
  sortTeamsInGroup(teams: any[]): void {
    teams.sort((a, b) => {
      if (b.results.points !== a.results.points) return b.results.points - a.results.points;
      if (b.results.gd !== a.results.gd) return b.results.gd - a.results.gd;
      return b.results.pd - a.results.pd;
    });
  }

  /**
   * Sort profiles within team for next round preparation
   * Goals → FO → Match FO (for tiebreaking)
   */
  sortProfilesInTeam(team: any, tourInd: number, result: any, lastTour: number, consts: any): void {
    if (tourInd + 1 < consts.tours.length && tourInd < lastTour) {
      let profiles = Object.assign([], team.profiles);

      profiles = profiles.sort((a, b) => {
        if (b.results[tourInd].total_goals !== a.results[tourInd].total_goals)
          return b.results[tourInd].total_goals - a.results[tourInd].total_goals;
        if (b.results[tourInd].total_fo - a.results[tourInd].total_fo)
          return b.results[tourInd].total_fo - a.results[tourInd].total_fo;
        return b.results[tourInd].fo - a.results[tourInd].fo;
      });

      if (tourInd < 3) {
        result.tours[tourInd + 1].matches.forEach(match => {
          if (match.first_team.id === team.id) match.first_team.profiles = Object.assign([], profiles);
          if (match.second_team.id === team.id) match.second_team.profiles = Object.assign([], profiles);
        });

        result.tours[tourInd + 1].teams = Object.assign([], result.tours[tourInd + 1].teams);
        result.tours[tourInd + 1].teams.find(tmpTeam => tmpTeam.id === team.id).profiles = Object.assign([], profiles);
      }
    }
  }

  /**
   * Determine playoff match winner using tiebreaker hierarchy
   * Match result → FO diff → Goal diff → Potential diff
   */
  getPlayoffResult(match: any): number {
    if (match.match_result !== 0) return match.match_result;

    if (match.first_team_fo_score - match.second_team_fo_score > 0) return 1;
    if (match.second_team_fo_score - match.first_team_fo_score > 0) return 2;

    if (match.first_team.results.gd - match.second_team.results.gd > 0) return 1;
    if (match.second_team.results.gd - match.first_team.results.gd > 0) return 2;

    if (match.first_team.results.pd - match.second_team.results.pd > 0) return 1;
    if (match.second_team.results.pd - match.first_team.results.pd > 0) return 2;

    return undefined;
  }

  /**
   * Update group tour results with playoff performance data
   * Adds playoff tour information and sorted profiles to group structure
   */
  updateInnerRating(basicGroup: any[], tmpGroup: any, tourNum: number): void {
    basicGroup.forEach(group => {
      group.tours.push({
        num: tourNum + 1,
        matches: [],
        teams: [],
        type: "po"
      });

      group.teams.forEach(team => {
        let check = false;

        tmpGroup.teams.forEach(tmpTeam => {
          if (tmpTeam.id === team.id) {
            check = true;

            tmpTeam.profiles = tmpTeam.profiles.sort((a, b) => {
              if (b.results[tourNum - 1].total_goals !== a.results[tourNum - 1].total_goals)
                return b.results[tourNum - 1].total_goals - a.results[tourNum - 1].total_goals;
              if (b.results[tourNum - 1].total_fo - a.results[tourNum - 1].total_fo)
                return b.results[tourNum - 1].total_fo - a.results[tourNum - 1].total_fo;
              return b.results[tourNum - 1].fo - a.results[tourNum - 1].fo;
            });

            let newTeam = JSON.parse(JSON.stringify(tmpTeam));

            group.tours[tourNum].teams.push(newTeam);
            logger.debug(group.groupName, tmpTeam);
          }
        });

        if (!check) group.tours[tourNum].teams.push(team);
      });

      logger.debug('basicGroup', basicGroup);
    });
  }

  /**
   * Deep copy utility for safe object cloning
   */
  getNewObj<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}
