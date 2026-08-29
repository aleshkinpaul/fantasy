import { getTourMedian } from '../competition/domain/rating-calculator';
import { IProfileDetails } from '../models/domain';
import {
  InsightPlayerRef,
  InsightTeamRef,
  RankedClubInsight,
  RankedMatchInsight,
  RankedParticipantInsight,
  RankedPlayerInsight,
  RankedTeamInsight,
  TourInsights,
  TourInsightsInput,
} from './tour-insights.models';
import { getRosterChanges, getRosterSelection } from './roster-selectors';

const TOP_LIMIT = 5;

interface PlayerUsage {
  player: InsightPlayerRef;
  allCount: number;
  baseCount: number;
  captainCount: number;
  addedCount: number;
  droppedCount: number;
}

interface ParticipantSelection {
  profile: IProfileDetails;
  all: string[];
  base: string[];
  added?: string[];
}

export function calculateTourInsights(input: TourInsightsInput): TourInsights {
  const profileIds = new Set(input.profileIds);
  const profilesById = new Map(input.profiles.map(profile => [profile.id, profile]));
  const leagueProfiles = input.profileIds
    .map(profileId => profilesById.get(profileId))
    .filter((profile): profile is IProfileDetails => Boolean(profile));
  const leagueMatches = input.matches.filter(match =>
    profileIds.has(match.home) && profileIds.has(match.away),
  );
  const result = emptyInsights(input, leagueMatches.length);

  if (input.tour > input.lastTour) return result;

  const teamRefs = new Map(leagueProfiles.map(profile => [profile.id, toTeamRef(profile)]));
  const scores = new Map<string, number>();
  leagueProfiles.forEach(profile => {
    const score = finiteNumber(profile.team.results_by_tour[input.tour]?.tour_score);
    if (score !== undefined) scores.set(profile.id, score);
  });
  result.coverage.scoredTeams = scores.size;

  const scoreValues = [...scores.values()];
  const medianScore = scoreValues.length ? Number(getTourMedian(scoreValues)) : undefined;
  result.teams.medianScore = medianScore;
  const teamScores = [...scores.entries()].map(([profileId, score]) => ({
    rank: 0,
    team: requireTeamRef(teamRefs, profileId),
    value: score,
  }));
  result.teams.topScores = rank(
    [...teamScores].sort((left, right) =>
      right.value - left.value || teamTieBreaker(left, right),
    ),
    item => item.value,
  );

  if (medianScore !== undefined) {
    const deviations = teamScores.map(item => ({
      ...item,
      delta: round(item.value - medianScore, 1),
    }));
    result.teams.aboveMedian = rank(
      deviations.filter(item => Number(item.delta) > 0)
        .sort((left, right) =>
          Number(right.delta) - Number(left.delta) || teamTieBreaker(left, right),
        ),
      item => Number(item.delta),
    );
    result.teams.belowMedian = rank(
      deviations.filter(item => Number(item.delta) < 0)
        .sort((left, right) =>
          Number(left.delta) - Number(right.delta) || teamTieBreaker(left, right),
        ),
      item => Number(item.delta),
    );
  }

  const calculatedMatches = leagueMatches
    .map(match => toMatchInsight(match, scores, teamRefs))
    .filter((match): match is RankedMatchInsight => Boolean(match));
  result.context.matchesCount = calculatedMatches.length;
  result.matches.mostProductive = rank(
    [...calculatedMatches].sort(descending(
      match => match.combinedScore,
      (left, right) => left.difference - right.difference || matchTieBreaker(left, right),
    )),
    match => match.combinedScore,
  );
  result.matches.closest = rank(
    [...calculatedMatches].sort(ascending(
      match => match.difference,
      (left, right) => right.combinedScore - left.combinedScore || matchTieBreaker(left, right),
    )),
    match => match.difference,
  );
  result.matches.biggestWins = rank(
    calculatedMatches.filter(match => match.difference > input.drawGap)
      .sort(descending(match => match.difference, matchTieBreaker)),
    match => match.difference,
  );

  const winners: RankedTeamInsight[] = [];
  const losers: RankedTeamInsight[] = [];
  calculatedMatches.forEach(match => {
    if (match.difference <= input.drawGap) return;
    const homeWon = match.homeScore > match.awayScore;
    winners.push({
      rank: 0,
      team: homeWon ? match.home : match.away,
      value: homeWon ? match.homeScore : match.awayScore,
    });
    losers.push({
      rank: 0,
      team: homeWon ? match.away : match.home,
      value: homeWon ? match.awayScore : match.homeScore,
    });
  });
  result.teams.highestScoringLoser = losers
    .sort((left, right) => right.value - left.value || teamTieBreaker(left, right))[0];
  result.teams.lowestScoringWinner = winners
    .sort((left, right) => left.value - right.value || teamTieBreaker(left, right))[0];

  if (input.forecast?.provenance === 'published') {
    const forecastByMatch = new Map(input.forecast.forecasts.map(forecast => [
      `${forecast.homeProfileId}:${forecast.awayProfileId}`,
      forecast,
    ]));
    const upsets = calculatedMatches.flatMap(match => {
      if (match.difference <= input.drawGap) return [];
      const forecast = forecastByMatch.get(`${match.match.home}:${match.match.away}`);
      if (!forecast) return [];
      const homeWon = match.homeScore > match.awayScore;
      return [{
        ...match,
        winnerProbability: homeWon
          ? forecast.homeWinProbability
          : forecast.awayWinProbability,
      }];
    });
    result.matches.biggestUpsets = rank(
      upsets.sort(ascending(
        match => Number(match.winnerProbability),
        (left, right) => right.difference - left.difference || matchTieBreaker(left, right),
      )),
      match => Number(match.winnerProbability),
    );
  }

  calculateRosterInsights(input, leagueProfiles, result);
  result.status = scores.size || result.coverage.loadedRosters ? 'ready' : 'unavailable';
  return result;
}

function calculateRosterInsights(
  input: TourInsightsInput,
  profiles: IProfileDetails[],
  result: TourInsights,
): void {
  const sportPlayers = new Map(input.sportPlayers.map(player => [player.id, player]));
  const usage = new Map<string, PlayerUsage>();
  const selections: ParticipantSelection[] = [];
  let selectedPlayerSlots = 0;
  let identifiedPlayerSlots = 0;

  profiles.forEach(profile => {
    const selection = getRosterSelection(profile, input.tour);
    if (!selection) return;
    const changes = getRosterChanges(profile, input.tour);
    if (changes) result.coverage.comparableRosters++;
    result.coverage.loadedRosters++;
    selectedPlayerSlots += selection.all.length;
    selections.push({ profile, all: selection.all, base: selection.base, added: changes?.added });

    selection.all.forEach(playerId => {
      const item = requirePlayerUsage(usage, sportPlayers, playerId);
      item.allCount++;
      if (sportPlayers.has(playerId)) identifiedPlayerSlots++;
    });
    selection.base.forEach(playerId => requirePlayerUsage(usage, sportPlayers, playerId).baseCount++);
    if (selection.captainId) {
      requirePlayerUsage(usage, sportPlayers, selection.captainId).captainCount++;
    }
    changes?.added.forEach(playerId => requirePlayerUsage(usage, sportPlayers, playerId).addedCount++);
    changes?.dropped.forEach(playerId => requirePlayerUsage(usage, sportPlayers, playerId).droppedCount++);
  });

  result.coverage.selectedPlayerSlots = selectedPlayerSlots;
  result.coverage.identifiedPlayerSlots = identifiedPlayerSlots;
  const denominator = result.coverage.loadedRosters;
  const playerEntries = [...usage.values()];
  result.players.mostPopular = toPlayerRanking(playerEntries, denominator, 'allCount');
  result.players.mostPopularBase = toPlayerRanking(playerEntries, denominator, 'baseCount');
  result.players.mostPopularCaptains = toPlayerRanking(playerEntries, denominator, 'captainCount');
  result.players.mostAdded = toPlayerRanking(playerEntries, result.coverage.comparableRosters, 'addedCount');
  result.players.mostDropped = toPlayerRanking(playerEntries, result.coverage.comparableRosters, 'droppedCount');
  result.players.popularClubs = calculatePopularClubs(playerEntries, selectedPlayerSlots);

  if (!denominator) return;
  const allPopularity = new Map(playerEntries.map(item => [item.player.id, item.allCount / denominator * 100]));
  const basePopularity = new Map(playerEntries.map(item => [item.player.id, item.baseCount / denominator * 100]));
  const participantEntries = selections.map(selection => ({
    profile: selection.profile,
    active: selection.added?.length,
    original: average(selection.all.map(playerId => allPopularity.get(playerId) || 0)),
    originalBase: average(selection.base.map(playerId => basePopularity.get(playerId) || 0)),
    uniquePicks: selection.all.filter(playerId => usage.get(playerId)?.allCount === 1).length,
  }));

  const comparable = participantEntries.filter(item => item.active !== undefined);
  result.participants.mostActive = toParticipantRanking(
    comparable.sort((left, right) =>
      Number(right.active) - Number(left.active) || participantTieBreaker(left, right),
    ),
    item => Number(item.active),
  );
  result.participants.mostStable = toParticipantRanking(
    comparable.sort((left, right) =>
      Number(left.active) - Number(right.active) || participantTieBreaker(left, right),
    ),
    item => Number(item.active),
  );
  result.participants.mostOriginal = toParticipantRanking(
    [...participantEntries].sort((left, right) =>
      left.original - right.original || participantTieBreaker(left, right),
    ),
    item => round(item.original, 1),
  );
  result.participants.mostTemplate = toParticipantRanking(
    [...participantEntries].sort((left, right) =>
      right.original - left.original || participantTieBreaker(left, right),
    ),
    item => round(item.original, 1),
  );
  result.participants.mostOriginalBase = toParticipantRanking(
    [...participantEntries].sort((left, right) =>
      left.originalBase - right.originalBase || participantTieBreaker(left, right),
    ),
    item => round(item.originalBase, 1),
  );
  result.participants.mostUniquePicks = toParticipantRanking(
    [...participantEntries].sort((left, right) =>
      right.uniquePicks - left.uniquePicks || participantTieBreaker(left, right),
    ),
    item => item.uniquePicks,
  );
}

function emptyInsights(input: TourInsightsInput, matchesCount: number): TourInsights {
  return {
    status: input.tour > input.lastTour ? 'upcoming' : 'unavailable',
    context: {
      tour: input.tour,
      stageName: input.stageName,
      leagueName: input.leagueName,
      teamsCount: input.profileIds.length,
      matchesCount,
    },
    coverage: {
      scoredTeams: 0,
      loadedRosters: 0,
      comparableRosters: 0,
      selectedPlayerSlots: 0,
      identifiedPlayerSlots: 0,
    },
    teams: { topScores: [], aboveMedian: [], belowMedian: [] },
    matches: { mostProductive: [], closest: [], biggestWins: [], biggestUpsets: [] },
    players: {
      mostPopular: [],
      mostPopularBase: [],
      mostPopularCaptains: [],
      mostAdded: [],
      mostDropped: [],
      popularClubs: [],
    },
    participants: {
      mostActive: [],
      mostStable: [],
      mostOriginal: [],
      mostTemplate: [],
      mostOriginalBase: [],
      mostUniquePicks: [],
    },
    capabilities: input.capabilities || { playerScores: false, played: false },
  };
}

function toMatchInsight(
  match: TourInsightsInput['matches'][number],
  scores: Map<string, number>,
  teams: Map<string, InsightTeamRef>,
): RankedMatchInsight | undefined {
  const homeScore = scores.get(match.home);
  const awayScore = scores.get(match.away);
  if (homeScore === undefined || awayScore === undefined) return undefined;
  return {
    rank: 0,
    match,
    home: requireTeamRef(teams, match.home),
    away: requireTeamRef(teams, match.away),
    homeScore,
    awayScore,
    combinedScore: round(homeScore + awayScore, 1),
    difference: round(Math.abs(homeScore - awayScore), 1),
  };
}

function toPlayerRanking(
  items: PlayerUsage[],
  denominator: number,
  field: 'allCount' | 'baseCount' | 'captainCount' | 'addedCount' | 'droppedCount',
): RankedPlayerInsight[] {
  if (!denominator) return [];
  const sorted = items.filter(item => item[field] > 0).sort(descending(
    item => item[field],
    (left, right) => right.baseCount - left.baseCount
      || right.captainCount - left.captainCount
      || left.player.name.localeCompare(right.player.name, 'ru'),
  ));
  const ranking = sorted.map(item => ({
    rank: 0,
    player: item.player,
    count: item[field],
    share: round(item[field] / denominator * 100, 1),
    baseCount: item.baseCount,
    captainCount: item.captainCount,
  }));
  return rank(ranking, item => item.count, ranking.length);
}

function calculatePopularClubs(items: PlayerUsage[], selectedPlayerSlots: number): RankedClubInsight[] {
  if (!selectedPlayerSlots) return [];
  const clubs = new Map<string, { count: number; baseCount: number }>();
  items.forEach(item => {
    if (!item.player.realTeamId) return;
    const club = clubs.get(item.player.realTeamId) || { count: 0, baseCount: 0 };
    club.count += item.allCount;
    club.baseCount += item.baseCount;
    clubs.set(item.player.realTeamId, club);
  });
  const sorted = [...clubs.entries()].map(([realTeamId, value]) => ({
    rank: 0,
    realTeamId,
    count: value.count,
    baseCount: value.baseCount,
    share: round(value.count / selectedPlayerSlots * 100, 1),
  })).sort(descending(
    item => item.count,
    (left, right) => right.baseCount - left.baseCount
      || left.realTeamId.localeCompare(right.realTeamId),
  ));
  return rank(sorted, item => item.count);
}

function toParticipantRanking<T extends { profile: IProfileDetails }>(
  items: T[],
  getValue: (item: T) => number,
): RankedParticipantInsight[] {
  return rank(items.map(item => ({
    rank: 0,
    team: toTeamRef(item.profile),
    value: getValue(item),
  })), item => item.value);
}

function requirePlayerUsage(
  usage: Map<string, PlayerUsage>,
  sportPlayers: Map<string, TourInsightsInput['sportPlayers'][number]>,
  playerId: string,
): PlayerUsage {
  const existing = usage.get(playerId);
  if (existing) return existing;
  const player = sportPlayers.get(playerId);
  const created: PlayerUsage = {
    player: {
      id: playerId,
      name: player?.name || `Игрок #${playerId}`,
      positionId: player?.amplua_id,
      realTeamId: player?.team_id,
    },
    allCount: 0,
    baseCount: 0,
    captainCount: 0,
    addedCount: 0,
    droppedCount: 0,
  };
  usage.set(playerId, created);
  return created;
}

function toTeamRef(profile: IProfileDetails): InsightTeamRef {
  return {
    profileId: profile.id,
    teamTitle: profile.team.title,
    participantName: profile.name,
    logo: profile.logo,
  };
}

function requireTeamRef(teams: Map<string, InsightTeamRef>, profileId: string): InsightTeamRef {
  const team = teams.get(profileId);
  if (!team) throw new Error(`Не найден участник статистики тура ${profileId}`);
  return team;
}

function rank<T extends { rank: number }>(
  items: T[],
  getValue: (item: T) => number,
  limit = TOP_LIMIT,
): T[] {
  let previousValue: number | undefined;
  let previousRank = 0;
  return items.slice(0, limit).map((item, index) => {
    const value = getValue(item);
    const itemRank = previousValue !== undefined && value === previousValue
      ? previousRank
      : index + 1;
    previousValue = value;
    previousRank = itemRank;
    return { ...item, rank: itemRank };
  });
}

function ascending<T>(
  getValue: (item: T) => number,
  tieBreaker: (left: T, right: T) => number,
): (left: T, right: T) => number {
  return (left, right) => getValue(left) - getValue(right) || tieBreaker(left, right);
}

function descending<T>(
  getValue: (item: T) => number,
  tieBreaker: (left: T, right: T) => number,
): (left: T, right: T) => number {
  return (left, right) => getValue(right) - getValue(left) || tieBreaker(left, right);
}

function teamTieBreaker(left: { team: InsightTeamRef }, right: { team: InsightTeamRef }): number {
  return left.team.teamTitle.localeCompare(right.team.teamTitle, 'ru');
}

function matchTieBreaker(left: RankedMatchInsight, right: RankedMatchInsight): number {
  return `${left.home.teamTitle}:${left.away.teamTitle}`
    .localeCompare(`${right.home.teamTitle}:${right.away.teamTitle}`, 'ru');
}

function participantTieBreaker(
  left: { profile: IProfileDetails },
  right: { profile: IProfileDetails },
): number {
  return left.profile.team.title.localeCompare(right.profile.team.title, 'ru');
}

function finiteNumber(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
