import { IRoster, IRosterPlayerMatchStat } from '../../models/domain';
import { SportPlayer } from '../models/competition.models';

export type FantasyPlayerParticipation = 'played' | 'not-played' | 'pending' | 'unknown';

export interface FantasyPlayerStatTotals {
  matchRecords: number;
  starts: number;
  substituteAppearances: number;
  replacements: number;
  fullMatches: number;
  sixtyMinuteMatches: number;
  minutes: number;
  goals: number;
  assists: number;
  fantasyAssists: number;
  redCards: number;
  yellowCards: number;
  cleanSheets: number;
  penaltySaves: number;
  shotSaves: number;
  penaltiesMissed: number;
  goalsAgainst: number;
  penaltiesWon: number;
  ballRecoveries: number;
  ownGoals: number;
  penaltiesConceded: number;
}

export interface ResolvedFantasyPlayer {
  id: string;
  positionId?: string;
  isBench: boolean;
  participation: FantasyPlayerParticipation;
  isPlayed: boolean;
  isCounted: boolean;
  isAutoSubbedIn: boolean;
  isEffectiveCaptain: boolean;
  fantasyScore?: number;
  displayFantasyScore?: number;
  scoreMultiplier: 1 | 2;
  playedMinutes?: number;
  redCards: number;
  stats: FantasyPlayerStatTotals;
  matchStats: IRosterPlayerMatchStat[];
}

export interface ResolvedFantasyLineup {
  players: Record<string, ResolvedFantasyPlayer>;
  countedPlayerIds: string[];
  countedPlayersCount: number;
  autoSubstitutionsCount: number;
  effectiveCaptainId?: string;
  hasParticipationData: boolean;
  isLineupFinal: boolean;
}

const GOALKEEPER_POSITION = '9';
const OUTFIELD_POSITIONS = ['10', '11', '12'] as const;
const MINIMUM_OUTFIELD_POSITIONS: Record<string, number> = {
  '10': 3,
  '11': 2,
  '12': 1,
};

export function resolveFantasyLineup(
  roster: IRoster,
  tour: number,
  sportPlayers: SportPlayer[] | ReadonlyMap<string, SportPlayer>,
  isLineupFinal: boolean,
): ResolvedFantasyLineup {
  const playersById = Array.isArray(sportPlayers)
    ? new Map(sportPlayers.map(player => [player.id, player]))
    : sportPlayers;
  const base = roster.players.base.map(playerId =>
    resolvePlayer(playerId, false, roster, playersById, tour, isLineupFinal));
  const bench = roster.players.bench.map(playerId =>
    resolvePlayer(playerId, true, roster, playersById, tour, isLineupFinal));
  const countedPlayerIds = resolveCountedPlayerIds(base, bench, isLineupFinal);
  const effectiveCaptainId = resolveEffectiveCaptainId(
    [...base, ...bench],
    countedPlayerIds,
    roster,
  );
  const players = Object.fromEntries([...base, ...bench].map(player => {
    const isCounted = countedPlayerIds.has(player.id);
    const isEffectiveCaptain = effectiveCaptainId === player.id;
    const scoreMultiplier = isEffectiveCaptain ? 2 : 1;
    return [player.id, {
      ...player,
      isCounted,
      isAutoSubbedIn: player.isBench && isCounted,
      isEffectiveCaptain,
      scoreMultiplier,
      displayFantasyScore: player.fantasyScore === undefined
        ? undefined
        : player.fantasyScore * (isCounted ? scoreMultiplier : 1),
    } satisfies ResolvedFantasyPlayer];
  }));

  return {
    players,
    countedPlayerIds: [...countedPlayerIds],
    countedPlayersCount: countedPlayerIds.size,
    autoSubstitutionsCount: bench.filter(player => countedPlayerIds.has(player.id)).length,
    effectiveCaptainId,
    hasParticipationData: [...base, ...bench]
      .some(player => player.participation !== 'unknown'),
    isLineupFinal,
  };
}

function resolvePlayer(
  playerId: string,
  isBench: boolean,
  roster: IRoster,
  playersById: ReadonlyMap<string, SportPlayer>,
  tour: number,
  isLineupFinal: boolean,
): ResolvedFantasyPlayer {
  const player = playersById.get(playerId);
  const participation = getParticipation(roster, playerId, player, tour, isLineupFinal);
  const tourStat = player?.stat_by_tours[tour];
  const detailedStats = getDetailedStats(roster, playerId);
  const stats = aggregateStats(detailedStats ?? []);
  return {
    id: playerId,
    positionId: player?.amplua_id,
    isBench,
    participation,
    isPlayed: participation === 'played',
    isCounted: false,
    isAutoSubbedIn: false,
    isEffectiveCaptain: false,
    fantasyScore: toFiniteNumber(tourStat?.score),
    displayFantasyScore: toFiniteNumber(tourStat?.score),
    scoreMultiplier: 1,
    playedMinutes: stats.minutes > 0 ? stats.minutes : toFiniteNumber(tourStat?.match_time),
    redCards: stats.redCards,
    stats,
    matchStats: detailedStats ? [...detailedStats] : [],
  };
}

function aggregateStats(matchStats: IRosterPlayerMatchStat[]): FantasyPlayerStatTotals {
  return matchStats.reduce<FantasyPlayerStatTotals>((totals, stat) => ({
    matchRecords: totals.matchRecords + Number(hasAppearance(stat)),
    starts: totals.starts + Number(stat.in_start_list || 0),
    substituteAppearances: totals.substituteAppearances + Number(stat.from_reserve || 0),
    replacements: totals.replacements + Number(stat.was_replaced || 0),
    fullMatches: totals.fullMatches + Number(stat.full_match || 0),
    sixtyMinuteMatches: totals.sixtyMinuteMatches + Number(stat['60min_match'] || 0),
    minutes: totals.minutes + Number(stat.match_time || 0),
    goals: totals.goals + Number(stat.goals || 0),
    assists: totals.assists + Number(stat.assists || 0),
    fantasyAssists: totals.fantasyAssists + Number(stat.fantasy_assists || 0),
    redCards: totals.redCards + Number(stat.red_cards || 0),
    yellowCards: totals.yellowCards + Number(stat.yellow_cards || 0),
    cleanSheets: totals.cleanSheets + Number(stat.clean_sheet || 0),
    penaltySaves: totals.penaltySaves + Number(stat.penalty_saves || 0),
    shotSaves: totals.shotSaves + Number(stat.shot_saves || 0),
    penaltiesMissed: totals.penaltiesMissed + Number(stat.penalty_missed || 0),
    goalsAgainst: totals.goalsAgainst + Number(stat.goal_against || 0),
    penaltiesWon: totals.penaltiesWon + Number(stat.penalty_force || 0),
    ballRecoveries: totals.ballRecoveries + Number(stat.ball_recovery || 0),
    ownGoals: totals.ownGoals + Number(stat.own_goals || 0),
    penaltiesConceded: totals.penaltiesConceded + Number(stat.penalty_conceded || 0),
  }), emptyStats());
}

function emptyStats(): FantasyPlayerStatTotals {
  return {
    matchRecords: 0,
    starts: 0,
    substituteAppearances: 0,
    replacements: 0,
    fullMatches: 0,
    sixtyMinuteMatches: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    fantasyAssists: 0,
    redCards: 0,
    yellowCards: 0,
    cleanSheets: 0,
    penaltySaves: 0,
    shotSaves: 0,
    penaltiesMissed: 0,
    goalsAgainst: 0,
    penaltiesWon: 0,
    ballRecoveries: 0,
    ownGoals: 0,
    penaltiesConceded: 0,
  };
}

function getParticipation(
  roster: IRoster,
  playerId: string,
  player: SportPlayer | undefined,
  tour: number,
  isLineupFinal: boolean,
): FantasyPlayerParticipation {
  const detailedStats = getDetailedStats(roster, playerId);
  if (detailedStats) {
    if (detailedStats.some(hasAppearance)) return 'played';
    return isLineupFinal ? 'not-played' : 'pending';
  }

  const tourStat = player?.stat_by_tours[tour];
  if (tourStat && (Number(tourStat.match_time) > 0 || Number(tourStat.score) !== 0)) return 'played';
  if (hasDetailedStatsContainer(roster)) return isLineupFinal ? 'not-played' : 'pending';
  if (tourStat) return isLineupFinal ? 'not-played' : 'pending';
  return 'unknown';
}

function getDetailedStats(roster: IRoster, playerId: string): IRosterPlayerMatchStat[] | undefined {
  if (!hasDetailedStatsContainer(roster)) return undefined;
  return roster.players_stat[playerId] || [];
}

function hasDetailedStatsContainer(
  roster: IRoster,
): roster is IRoster & { players_stat: Record<string, IRosterPlayerMatchStat[]> } {
  return Boolean(roster.players_stat)
    && !Array.isArray(roster.players_stat)
    && typeof roster.players_stat === 'object';
}

function hasAppearance(stat: IRosterPlayerMatchStat): boolean {
  return Number(stat.match_time) > 0
    || Number(stat.in_start_list) === 1
    || Number(stat.from_reserve) === 1
    || Number(stat.full_match) === 1
    || Number(stat['60min_match']) === 1;
}

function resolveCountedPlayerIds(
  base: ResolvedFantasyPlayer[],
  bench: ResolvedFantasyPlayer[],
  isLineupFinal: boolean,
): Set<string> {
  const countedIds = new Set(base.filter(player => player.isPlayed).map(player => player.id));
  if (!isLineupFinal || countedIds.size >= 11) return limitToEleven(countedIds, base);

  const countedPlayers = base.filter(player => countedIds.has(player.id));
  const hasGoalkeeper = countedPlayers.some(player => player.positionId === GOALKEEPER_POSITION);
  if (!hasGoalkeeper) {
    const reserveGoalkeeper = bench.find(player =>
      player.positionId === GOALKEEPER_POSITION && player.isPlayed);
    if (reserveGoalkeeper) {
      countedIds.add(reserveGoalkeeper.id);
      countedPlayers.push(reserveGoalkeeper);
    }
  }

  const availableSlots = Math.max(0, 11 - countedIds.size);
  const candidates = bench.filter(player =>
    player.isPlayed
    && player.positionId !== GOALKEEPER_POSITION
    && !countedIds.has(player.id));
  selectOutfieldAutoSubstitutes(countedPlayers, candidates, availableSlots)
    .forEach(player => countedIds.add(player.id));
  return countedIds;
}

function selectOutfieldAutoSubstitutes(
  countedPlayers: ResolvedFantasyPlayer[],
  candidates: ResolvedFantasyPlayer[],
  availableSlots: number,
): ResolvedFantasyPlayer[] {
  let bestCandidateIndexes: number[] = [];
  const combinationsCount = 2 ** candidates.length;

  for (let mask = 0; mask < combinationsCount; mask++) {
    const candidateIndexes = candidates
      .map((_, index) => index)
      .filter(index => (mask & (1 << index)) !== 0);
    if (candidateIndexes.length > availableSlots) continue;

    const lineup = [
      ...countedPlayers,
      ...candidateIndexes.map(index => candidates[index]),
    ];
    if (!hasValidFormation(lineup)) continue;
    if (isPreferredCombination(candidateIndexes, bestCandidateIndexes)) {
      bestCandidateIndexes = candidateIndexes;
    }
  }

  return bestCandidateIndexes.map(index => candidates[index]);
}

function hasValidFormation(players: ResolvedFantasyPlayer[]): boolean {
  const goalkeeperCount = players.filter(player => player.positionId === GOALKEEPER_POSITION).length;
  return goalkeeperCount === 1
    && OUTFIELD_POSITIONS.every(position =>
      players.filter(player => player.positionId === position).length
        >= MINIMUM_OUTFIELD_POSITIONS[position]);
}

function isPreferredCombination(candidate: number[], current: number[]): boolean {
  if (candidate.length !== current.length) return candidate.length > current.length;
  for (let index = 0; index < candidate.length; index++) {
    if (candidate[index] !== current[index]) return candidate[index] < current[index];
  }
  return false;
}

function limitToEleven(
  countedIds: Set<string>,
  base: ResolvedFantasyPlayer[],
): Set<string> {
  if (countedIds.size <= 11) return countedIds;
  return new Set(base.filter(player => countedIds.has(player.id)).slice(0, 11).map(player => player.id));
}

function resolveEffectiveCaptainId(
  players: ResolvedFantasyPlayer[],
  countedPlayerIds: Set<string>,
  roster: IRoster,
): string | undefined {
  if (countedPlayerIds.has(roster.captain_id)) return roster.captain_id;
  const viceCaptainId = roster.vice_captain_id;
  if (!viceCaptainId || !countedPlayerIds.has(viceCaptainId)) return undefined;
  return players.find(player => player.id === viceCaptainId)?.isPlayed ? viceCaptainId : undefined;
}

function toFiniteNumber(value: unknown): number | undefined {
  const number = Number(value);
  return value !== undefined && value !== null && Number.isFinite(number) ? number : undefined;
}
