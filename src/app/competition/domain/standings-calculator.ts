import {
  CompetitionStage,
  FantasyFullInfoResponse,
} from '../models/competition.models';

interface StandingsProfile {
  id: string;
  score: number;
  leagues?: Record<string, string>;
  place_in_league?: Record<string, number>;
  results: {
    points: Record<string, number>;
    diff_fo: Record<string, number>;
    fo: Record<string, number>;
  };
}

export interface SeasonMedals {
  gold: number;
  silver: number;
  bronze: number;
  medalsArr: number[];
  curMedalsInARow: number;
  maxMedalsInARow: number;
}

export function compareStandings(left: StandingsProfile, right: StandingsProfile, stage: string): number {
  if (left.results.points[stage] > right.results.points[stage]) return -1;
  if (left.results.points[stage] < right.results.points[stage]) return 1;

  if (left.results.diff_fo[stage] > right.results.diff_fo[stage]) return -1;
  if (left.results.diff_fo[stage] < right.results.diff_fo[stage]) return 1;

  if (left.results.fo[stage] > right.results.fo[stage]) return -1;
  if (left.results.fo[stage] < right.results.fo[stage]) return 1;

  return 0;
}

export function compareByFantasyScore(left: Pick<StandingsProfile, 'score'>, right: Pick<StandingsProfile, 'score'>): number {
  if (left.score > right.score) return -1;
  if (left.score < right.score) return 1;
  return 0;
}

export function buildLeagueRatings(
  profiles: StandingsProfile[],
  stages: CompetitionStage[],
): Record<string, StandingsProfile[]> {
  const ratings: Record<string, StandingsProfile[]> = {};

  profiles.forEach(profile => {
    stages.forEach((stage, stageIndex) => {
      stage.leagues.forEach(league => {
        // Legacy output serializes this map as [], so keep the array-backed shape.
        if (!profile.leagues) profile.leagues = [] as unknown as Record<string, string>;
        if (league.profiles.includes(profile.id)) {
          profile.leagues[stageIndex === 0 ? 'apertura' : 'clausura'] = league.name;
        }
      });
    });
  });

  stages.forEach(stage => {
    const stageName = stage.name.toLowerCase();
    stage.leagues.forEach(league => {
      ratings[league.name] = profiles
        .filter(profile => profile.leagues?.[stageName] === league.name)
        .sort((left, right) => compareStandings(left, right, stageName));
    });
  });

  ratings['Common'] = profiles
    .map(profile => ({ ...profile }))
    .sort((left, right) => compareStandings(left, right, 'common'));
  ratings['Apertura'] = profiles
    .map(profile => ({ ...profile }))
    .sort((left, right) => compareStandings(left, right, 'apertura'));
  ratings['CommonFO'] = profiles
    .map(profile => ({ ...profile }))
    .sort(compareByFantasyScore);

  stages.forEach(stage => {
    stage.leagues.forEach(league => assignPlaces(ratings[league.name], league.name));
  });
  assignPlacesToSourceProfiles(profiles, ratings['Common'], 'Common');
  assignPlacesToSourceProfiles(profiles, ratings['Apertura'], 'Apertura');
  assignPlacesToSourceProfiles(profiles, ratings['CommonFO'], 'CommonFO');

  return ratings;
}

export function getPlaceInTour(
  squads: FantasyFullInfoResponse,
  profileId: string,
  tour: number,
): number {
  const standings = Object.values(squads.data.players)
    .map(player => ({
      id: player.id,
      score: +player.team.results_by_tour[tour].tour_score,
      position: 0,
    }))
    .sort((left, right) => right.score - left.score);

  standings.forEach((player, index) => {
    player.position = index === 0
      ? 1
      : standings[index - 1].score === player.score
        ? standings[index - 1].position
        : standings[index - 1].position + 1;
  });

  return findProfilePlace(standings, profileId, tour);
}

export function getPlaceAfterTour(
  squads: FantasyFullInfoResponse,
  profileId: string,
  tour: number,
): number {
  const standings = Object.values(squads.data.players)
    .map(player => ({
      id: player.id,
      score: +player.team.results_by_tour[tour].total_score,
      position: 0,
    }))
    .sort((left, right) => right.score - left.score);

  standings.forEach((player, index) => {
    player.position = index === 0
      ? 1
      : standings[index - 1].score === player.score
        ? standings[index - 1].position
        : standings[index - 1].position < 3
          ? standings[index - 1].position + 1
          : index + 1;
  });

  return findProfilePlace(standings, profileId, tour);
}

export function getSeasonMedals(
  squads: FantasyFullInfoResponse,
  profileId: string,
  lastTour: number,
): SeasonMedals {
  const medals: SeasonMedals = {
    gold: 0,
    silver: 0,
    bronze: 0,
    medalsArr: [],
    curMedalsInARow: 0,
    maxMedalsInARow: 0,
  };

  for (let tour = 1; tour <= lastTour; tour++) {
    const place = getPlaceInTour(squads, profileId, tour);
    medals.gold += +(place === 1);
    medals.silver += +(place === 2);
    medals.bronze += +(place === 3);
    medals.medalsArr.push(place <= 3 ? place : 0);

    if (place <= 3) {
      medals.curMedalsInARow += 1;
      medals.maxMedalsInARow = Math.max(medals.maxMedalsInARow, medals.curMedalsInARow);
    } else {
      medals.curMedalsInARow = 0;
    }
  }

  return medals;
}

function assignPlaces(profiles: StandingsProfile[], leagueName: string): void {
  profiles.forEach((profile, index) => {
    if (!profile.place_in_league) profile.place_in_league = {};
    profile.place_in_league[leagueName] = index + 1;
  });
}

function assignPlacesToSourceProfiles(
  sourceProfiles: StandingsProfile[],
  rating: StandingsProfile[],
  ratingName: string,
): void {
  rating.forEach((ratedProfile, index) => {
    const profile = sourceProfiles.find(item => item.id === ratedProfile.id);
    if (!profile) return;
    if (!profile.place_in_league) profile.place_in_league = {};
    profile.place_in_league[ratingName] = index + 1;
  });
}

function findProfilePlace(
  standings: Array<{ id: string; position: number }>,
  profileId: string,
  tour: number,
): number {
  const profile = standings.find(player => player.id === profileId);
  if (!profile) throw new Error(`Не найдено место участника ${profileId} после тура ${tour}`);
  return profile.position;
}
