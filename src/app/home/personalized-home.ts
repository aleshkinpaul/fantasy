import { CompetitionViewModel } from '../competition/data/competition.facade';
import {
  CompetitionMatch,
  CompetitionStage,
} from '../competition/models/competition.models';
import { IProfileDetails } from '../models/domain';
import { ParticipantDirectoryEntry } from '../models/participant-directory';
import { TournamentTimelineItem } from '../models/tournament-catalog';
import { matchCenterQuery } from '../match-center/match-center-route';
import {
  PersonalizedPlayerStats,
  calculatePersonalizedPlayerStats,
} from './personalized-player-stats';

export interface PersonalizedStandingRow {
  place: number;
  profile: IProfileDetails;
  isSelected: boolean;
}

export interface PersonalizedHomeMatch {
  tour: number;
  home: IProfileDetails;
  away: IProfileDetails;
  homeScore?: number;
  awayScore?: number;
  route: string;
}

export interface PersonalizedHomeTournament {
  tournament: TournamentTimelineItem;
  profile: IProfileDetails;
  stageName: string;
  leagueName: string;
  standingKey: 'apertura' | 'clausura';
  place: number;
  standings: PersonalizedStandingRow[];
  currentMatch: PersonalizedHomeMatch | null;
  nextMatch: PersonalizedHomeMatch | null;
  playerStats: PersonalizedPlayerStats;
  seasonRating: number | null;
  seasonRatingPlace: number | null;
  seasonRatingParticipants: number;
}

interface ParticipantStage {
  stage: CompetitionStage;
  stageIndex: number;
  league: CompetitionStage['leagues'][number];
  leagueIndex: number;
}

export function buildPersonalizedHomeTournament(
  tournament: TournamentTimelineItem,
  viewModel: CompetitionViewModel,
  participant: ParticipantDirectoryEntry,
  neighborsCount = 3,
): PersonalizedHomeTournament | null {
  const profileIds = new Set(participant.profileIds);
  const profile = viewModel.profilesDetails.find(item => profileIds.has(item.id));
  if (!profile) return null;

  const participantStages = findParticipantStages(viewModel.config.stages, profile.id);
  const currentStage = selectCurrentParticipantStage(participantStages, viewModel.lastTour);
  if (!currentStage) return null;

  const rating = selectLeagueRating(viewModel, currentStage, profile.id);
  const selectedIndex = rating.findIndex(item => item.id === profile.id);
  if (selectedIndex < 0) return null;

  const from = Math.max(0, selectedIndex - neighborsCount);
  const to = Math.min(rating.length, selectedIndex + neighborsCount + 1);
  const matchesByTour = viewModel.config.matches;
  const currentMatch = findMatch(matchesByTour[viewModel.lastTour], profile.id);
  const nextMatchEntry = Object.keys(matchesByTour)
    .map(Number)
    .filter(tour => tour > viewModel.lastTour)
    .sort((left, right) => left - right)
    .map(tour => ({ tour, match: findMatch(matchesByTour[tour], profile.id) }))
    .find(entry => entry.match);
  const ratedProfiles = viewModel.profilesDetails
    .filter(item => Number.isFinite(Number(item.team.rating)))
    .sort((left, right) => Number(right.team.rating) - Number(left.team.rating));
  const ratingIndex = ratedProfiles.findIndex(item => item.id === profile.id);
  const seasonRating = Number(profile.team.rating);

  return {
    tournament,
    profile,
    stageName: currentStage.stage.name,
    leagueName: currentStage.league.name,
    standingKey: currentStage.stageIndex === 0 ? 'apertura' : 'clausura',
    place: selectedIndex + 1,
    standings: rating.slice(from, to).map((item, index) => ({
      place: from + index + 1,
      profile: item,
      isSelected: item.id === profile.id,
    })),
    currentMatch: currentMatch
      ? toHomeMatch(tournament.route, viewModel, viewModel.lastTour, currentMatch)
      : null,
    nextMatch: nextMatchEntry?.match
      ? toHomeMatch(tournament.route, viewModel, nextMatchEntry.tour, nextMatchEntry.match)
      : null,
    playerStats: calculatePersonalizedPlayerStats(
      profile,
      viewModel.lastTour,
      viewModel.sportPlayersByTour,
    ),
    seasonRating: Number.isFinite(seasonRating) ? seasonRating : null,
    seasonRatingPlace: ratingIndex >= 0 ? ratingIndex + 1 : null,
    seasonRatingParticipants: ratedProfiles.length,
  };
}

function findParticipantStages(
  stages: CompetitionStage[],
  profileId: string,
): ParticipantStage[] {
  return stages.flatMap((stage, stageIndex) => stage.leagues.flatMap((league, leagueIndex) =>
    league.profiles.includes(profileId)
      ? [{ stage, stageIndex, league, leagueIndex }]
      : []
  ));
}

function selectCurrentParticipantStage(
  stages: ParticipantStage[],
  lastTour: number,
): ParticipantStage | undefined {
  return stages.find(item => lastTour >= item.stage.firstTour && lastTour <= item.stage.lastTour)
    ?? [...stages].reverse().find(item => lastTour >= item.stage.firstTour)
    ?? stages[0];
}

function selectLeagueRating(
  viewModel: CompetitionViewModel,
  selection: ParticipantStage,
  profileId: string,
): IProfileDetails[] {
  const configuredRating = viewModel.leaguesRatings[selection.league.name];
  if (configuredRating?.some(item => item.id === profileId)) return configuredRating;

  const leagueIds = new Set(selection.league.profiles);
  return (viewModel.leaguesRatings['Common'] ?? viewModel.profilesDetails)
    .filter(item => leagueIds.has(item.id));
}

function findMatch(
  matches: CompetitionMatch[] | undefined,
  profileId: string,
): CompetitionMatch | undefined {
  return matches?.find(match => match.home === profileId || match.away === profileId);
}

function toHomeMatch(
  tournamentRoute: string,
  viewModel: CompetitionViewModel,
  tour: number,
  match: CompetitionMatch,
): PersonalizedHomeMatch | null {
  const home = viewModel.profilesDetails.find(profile => profile.id === match.home);
  const away = viewModel.profilesDetails.find(profile => profile.id === match.away);
  if (!home || !away) return null;

  const stage = findStageForMatch(viewModel.config.stages, tour, match);
  return {
    tour,
    home,
    away,
    homeScore: match.home_score,
    awayScore: match.away_score,
    route: buildMatchRoute(tournamentRoute, stage, tour, match),
  };
}

function findStageForMatch(
  stages: CompetitionStage[],
  tour: number,
  match: CompetitionMatch,
): ParticipantStage | undefined {
  for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
    const stage = stages[stageIndex];
    if (tour < stage.firstTour || tour > stage.lastTour) continue;

    const leagueIndex = stage.leagues.findIndex(league =>
      league.profiles.includes(match.home) && league.profiles.includes(match.away)
    );
    if (leagueIndex >= 0) {
      return { stage, stageIndex, league: stage.leagues[leagueIndex], leagueIndex };
    }
  }
  return undefined;
}

function buildMatchRoute(
  tournamentRoute: string,
  selection: ParticipantStage | undefined,
  tour: number,
  match: CompetitionMatch,
): string {
  const [path, query = ''] = tournamentRoute.split('?');
  const params = new URLSearchParams(query);
  params.set('tabId', String((selection?.stageIndex ?? 0) + 1));
  params.set('confId', String(selection?.leagueIndex ?? 0));
  params.set('confTabId', '3');
  params.set('tourId', String(selection ? tour - selection.stage.firstTour + 1 : tour));
  Object.entries(matchCenterQuery({ match, tour })).forEach(([key, value]) => {
    params.set(key, String(value));
  });
  return `${path}?${params.toString()}`;
}
