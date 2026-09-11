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
  TourInsightsTourData,
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
  tour: number;
  all: string[];
  base: string[];
  added?: string[];
}

export function calculateTourInsights(input: TourInsightsInput): TourInsights {
  const tourData = getTourData(input);
  const profileIds = new Set(input.profileIds);
  const profilesById = new Map(input.profiles.map(profile => [profile.id, profile]));
  const leagueProfiles = input.profileIds
    .map(profileId => profilesById.get(profileId))
    .filter((profile): profile is IProfileDetails => Boolean(profile));
  const completedTourData = tourData.filter(item => item.tour <= input.lastTour);
  const result = emptyInsights(input, completedTourData.length);

  if ((input.period || 'tour') === 'tour' && input.tour > input.lastTour) return result;

  const teamRefs = new Map(leagueProfiles.map(profile => [profile.id, toTeamRef(profile)]));
  const totalScores = new Map<string, number>();
  const scoresByTour = new Map<number, Map<string, number>>();
  completedTourData.forEach(item => {
    const scores = new Map<string, number>();
    leagueProfiles.forEach(profile => {
      const score = finiteNumber(profile.team.results_by_tour[item.tour]?.tour_score);
      if (score === undefined) return;
      scores.set(profile.id, score);
      totalScores.set(profile.id, round((totalScores.get(profile.id) || 0) + score, 1));
      result.coverage.scoredTeams++;
    });
    scoresByTour.set(item.tour, scores);
  });

  const scoreValues = [...totalScores.values()];
  const medianScore = scoreValues.length ? Number(getTourMedian(scoreValues)) : undefined;
  result.teams.medianScore = medianScore;
  const teamScores = [...totalScores.entries()].map(([profileId, score]) => ({
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

  const calculatedMatches = completedTourData.flatMap(item => item.matches
    .filter(match => profileIds.has(match.home) && profileIds.has(match.away))
    .map(match => toMatchInsight(match, item.tour, scoresByTour.get(item.tour) || new Map(), teamRefs))
    .filter((match): match is RankedMatchInsight => Boolean(match)));
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

  const forecastsByTour = new Map(completedTourData.map(item => [item.tour, item.forecast]));
  const upsets = calculatedMatches.flatMap(match => {
      const snapshot = forecastsByTour.get(match.tour);
      if (snapshot?.provenance !== 'published') return [];
      if (match.difference <= input.drawGap) return [];
      const forecast = snapshot.forecasts.find(item =>
        item.homeProfileId === match.match.home && item.awayProfileId === match.match.away,
      );
      if (!forecast) return [];
      const homeWon = match.homeScore > match.awayScore;
      return [{
        ...match,
        winnerProbability: homeWon
          ? forecast.homeWinProbability
          : forecast.awayWinProbability,
      }];
  });
  if (upsets.length) {
    result.matches.biggestUpsets = rank(
      upsets.sort(ascending(
        match => Number(match.winnerProbability),
        (left, right) => right.difference - left.difference || matchTieBreaker(left, right),
      )),
      match => Number(match.winnerProbability),
    );
  }

  calculateRosterInsights(completedTourData, leagueProfiles, result);
  result.status = totalScores.size || result.coverage.loadedRosters ? 'ready' : 'unavailable';
  return result;
}

function calculateRosterInsights(
  tourData: TourInsightsTourData[],
  profiles: IProfileDetails[],
  result: TourInsights,
): void {
  const usage = new Map<string, PlayerUsage>();
  const selections: ParticipantSelection[] = [];
  const allUsageByTour = new Map<number, Map<string, number>>();
  const baseUsageByTour = new Map<number, Map<string, number>>();
  const loadedRostersByTour = new Map<number, number>();
  let selectedPlayerSlots = 0;
  let identifiedPlayerSlots = 0;

  tourData.forEach(item => {
    const sportPlayers = new Map(item.sportPlayers.map(player => [player.id, player]));
    const tourAllUsage = new Map<string, number>();
    const tourBaseUsage = new Map<string, number>();
    let loadedRosters = 0;

    profiles.forEach(profile => {
      const selection = getRosterSelection(profile, item.tour);
      if (!selection) return;
      const changes = getRosterChanges(profile, item.tour);
      if (changes) result.coverage.comparableRosters++;
      result.coverage.loadedRosters++;
      loadedRosters++;
      selectedPlayerSlots += selection.all.length;
      selections.push({
        profile,
        tour: item.tour,
        all: selection.all,
        base: selection.base,
        added: changes?.added,
      });

      selection.all.forEach(playerId => {
        const playerUsage = requirePlayerUsage(usage, sportPlayers, playerId);
        playerUsage.allCount++;
        increment(tourAllUsage, playerId);
        if (sportPlayers.has(playerId)) identifiedPlayerSlots++;
      });
      selection.base.forEach(playerId => {
        requirePlayerUsage(usage, sportPlayers, playerId).baseCount++;
        increment(tourBaseUsage, playerId);
      });
      if (selection.captainId) {
        requirePlayerUsage(usage, sportPlayers, selection.captainId).captainCount++;
      }
      changes?.added.forEach(playerId => requirePlayerUsage(usage, sportPlayers, playerId).addedCount++);
      changes?.dropped.forEach(playerId => requirePlayerUsage(usage, sportPlayers, playerId).droppedCount++);
    });

    allUsageByTour.set(item.tour, tourAllUsage);
    baseUsageByTour.set(item.tour, tourBaseUsage);
    loadedRostersByTour.set(item.tour, loadedRosters);
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
  const participantTotals = new Map<string, {
    profile: IProfileDetails;
    active: number;
    comparableRosters: number;
    originalTotal: number;
    originalBaseTotal: number;
    selections: number;
    uniquePicks: number;
  }>();
  selections.forEach(selection => {
    const rosterCount = loadedRostersByTour.get(selection.tour) || 0;
    const tourAllUsage = allUsageByTour.get(selection.tour) || new Map();
    const tourBaseUsage = baseUsageByTour.get(selection.tour) || new Map();
    const total = participantTotals.get(selection.profile.id) || {
      profile: selection.profile,
      active: 0,
      comparableRosters: 0,
      originalTotal: 0,
      originalBaseTotal: 0,
      selections: 0,
      uniquePicks: 0,
    };
    total.active += selection.added?.length || 0;
    total.comparableRosters += Number(selection.added !== undefined);
    total.originalTotal += average(selection.all.map(playerId =>
      rosterCount ? (tourAllUsage.get(playerId) || 0) / rosterCount * 100 : 0,
    ));
    total.originalBaseTotal += average(selection.base.map(playerId =>
      rosterCount ? (tourBaseUsage.get(playerId) || 0) / rosterCount * 100 : 0,
    ));
    total.selections++;
    total.uniquePicks += selection.all.filter(playerId => tourAllUsage.get(playerId) === 1).length;
    participantTotals.set(selection.profile.id, total);
  });
  const participantEntries = [...participantTotals.values()].map(item => ({
    profile: item.profile,
    active: item.comparableRosters ? item.active : undefined,
    original: item.selections ? item.originalTotal / item.selections : 0,
    originalBase: item.selections ? item.originalBaseTotal / item.selections : 0,
    uniquePicks: item.uniquePicks,
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

function emptyInsights(input: TourInsightsInput, toursCount: number): TourInsights {
  return {
    status: (input.period || 'tour') === 'tour' && input.tour > input.lastTour
      ? 'upcoming'
      : 'unavailable',
    context: {
      tour: input.tour,
      period: input.period || 'tour',
      scope: input.scope || 'league',
      toursCount,
      stageName: input.stageName,
      leagueName: input.leagueName,
      teamsCount: input.profileIds.length,
      matchesCount: 0,
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
  tour: number,
  scores: Map<string, number>,
  teams: Map<string, InsightTeamRef>,
): RankedMatchInsight | undefined {
  const homeScore = scores.get(match.home);
  const awayScore = scores.get(match.away);
  if (homeScore === undefined || awayScore === undefined) return undefined;
  return {
    rank: 0,
    tour,
    match,
    home: requireTeamRef(teams, match.home),
    away: requireTeamRef(teams, match.away),
    homeScore,
    awayScore,
    combinedScore: round(homeScore + awayScore, 1),
    difference: round(Math.abs(homeScore - awayScore), 1),
  };
}

function getTourData(input: TourInsightsInput): TourInsightsTourData[] {
  if (input.tourData?.length) return input.tourData;
  return [{
    tour: input.tour,
    matches: input.matches,
    sportPlayers: input.sportPlayers,
    forecast: input.forecast,
  }];
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
  const player = sportPlayers.get(playerId);
  if (existing) {
    if (player && existing.player.name.startsWith('Игрок #')) {
      existing.player = {
        id: playerId,
        name: player.name,
        positionId: player.amplua_id,
        realTeamId: player.team_id,
      };
    }
    return existing;
  }
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

function increment(values: Map<string, number>, key: string): void {
  values.set(key, (values.get(key) || 0) + 1);
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
