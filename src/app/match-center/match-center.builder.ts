import { SportPlayer } from '../competition/models/competition.models';
import {
  FantasyPlayerStatTotals,
  resolveFantasyLineup,
} from '../competition/domain/fantasy-lineup-resolver';
import { IProfileDetails, IRoster, IRosterPlayerMatchStat } from '../models/domain';
import { getRosterChanges, getRosterSelection } from '../tour-insights/roster-selectors';
import {
  MatchCenterPlayer,
  MatchCenterPlayerEvent,
  MatchCenterTeam,
} from './match-center.models';

const POSITION_LABELS: Record<string, string> = {
  '9': 'ВР',
  '10': 'ЗЩ',
  '11': 'ПЗ',
  '12': 'НП',
};

const POSITION_ORDER: Record<string, number> = {
  '9': 0,
  '10': 1,
  '11': 2,
  '12': 3,
};

const MATCH_STAT_ICON_ROOT = 'assets/icons/match-stat';

export function buildMatchCenterTeam(
  profile: IProfileDetails,
  tour: number,
  sportPlayers: SportPlayer[],
  isLineupFinal = Boolean(profile.team.results_by_tour[tour]),
): MatchCenterTeam {
  const selection = getRosterSelection(profile, tour);
  if (!selection) {
    return {
      profile,
      base: [],
      bench: [],
      hasRoster: false,
      countedPlayersCount: 0,
      autoSubstitutionsCount: 0,
      hasParticipationData: false,
      isLineupFinal,
    };
  }

  const roster = selection.roster;
  const playersById = new Map(sportPlayers.map(player => [player.id, player]));
  const newPlayerIds = new Set(getRosterChanges(profile, tour)?.added || []);
  const lineup = resolveFantasyLineup(roster, tour, playersById, isLineupFinal);
  const base = selection.base
    .map(playerId => buildPlayer(playerId, false, roster, playersById, newPlayerIds, lineup.players[playerId]))
    .sort((left, right) => getPositionOrder(left.positionId) - getPositionOrder(right.positionId))
    .map((player, index, players) => ({
      ...player,
      startsPositionGroup: index > 0 && player.positionId !== players[index - 1].positionId,
    }));

  const bench = selection.bench.map(playerId =>
    buildPlayer(playerId, true, roster, playersById, newPlayerIds, lineup.players[playerId]));

  return {
    profile,
    teamCost: Number.isFinite(Number(roster.team_cost)) ? Number(roster.team_cost) : undefined,
    base,
    bench,
    hasRoster: true,
    countedPlayersCount: lineup.countedPlayersCount,
    autoSubstitutionsCount: lineup.autoSubstitutionsCount,
    hasParticipationData: lineup.hasParticipationData,
    isLineupFinal: lineup.isLineupFinal,
  };
}

function buildPlayer(
  playerId: string,
  isBench: boolean,
  roster: IRoster,
  playersById: Map<string, SportPlayer>,
  newPlayerIds: Set<string>,
  lineupPlayer: ReturnType<typeof resolveFantasyLineup>['players'][string],
): MatchCenterPlayer {
  const player = playersById.get(playerId);
  const playedMinutesLabel = buildMinutesLabel(lineupPlayer.matchStats, lineupPlayer.playedMinutes);
  return {
    id: playerId,
    name: player?.name || `Игрок #${playerId}`,
    position: POSITION_LABELS[player?.amplua_id || ''] || '—',
    positionId: player?.amplua_id,
    startsPositionGroup: false,
    cost: player?.cost,
    realTeamId: player?.team_id,
    isNewToSquad: newPlayerIds.has(playerId),
    isCaptain: roster.captain_id === playerId,
    isViceCaptain: roster.vice_captain_id === playerId,
    isBench,
    ...lineupPlayer,
    playedMinutesLabel,
    events: buildEvents(lineupPlayer.stats, player?.amplua_id),
    statSummary: buildStatSummary(lineupPlayer.stats, playedMinutesLabel),
  };
}

function buildEvents(stats: FantasyPlayerStatTotals, positionId?: string): MatchCenterPlayerEvent[] {
  return [
    event('goals', 'goal.png', 'Голы', stats.goals, 'default'),
    event(
      'penalty-missed',
      'goal.png',
      'Незабитые пенальти',
      stats.penaltiesMissed,
      'danger',
    ),
    event(
      'assists',
      'assist.png',
      'Голевые и фэнтези-передачи',
      stats.assists + stats.fantasyAssists,
      'assist',
    ),
    event('yellow-cards', 'yellow-card.png', 'Жёлтые карточки', stats.yellowCards, 'warning'),
    event('red-cards', 'red-card.png', 'Красные карточки', stats.redCards, 'danger'),
    positionId === '12'
      ? undefined
      : event('clean-sheets', 'is_dry.png', 'Сухие матчи', stats.cleanSheets, 'success'),
    event('shot-saves', 'save.png', 'Сейвы', stats.shotSaves, 'success'),
    event('penalty-saves', 'save.png', 'Отбитые пенальти', stats.penaltySaves, 'success', 'П'),
  ].filter((item): item is MatchCenterPlayerEvent => Boolean(item));
}

function event(
  key: string,
  iconFile: string,
  label: string,
  count: number,
  tone: MatchCenterPlayerEvent['tone'],
  marker?: string,
): MatchCenterPlayerEvent | undefined {
  return count > 0
    ? { key, iconPath: `${MATCH_STAT_ICON_ROOT}/${iconFile}`, label, count, tone, marker }
    : undefined;
}

function buildMinutesLabel(matchStats: IRosterPlayerMatchStat[], playedMinutes?: number): string {
  const playedMatches = matchStats.filter(stat =>
    Number(stat.match_time) > 0
    || Number(stat.in_start_list) === 1
    || Number(stat.from_reserve) === 1
    || Number(stat.full_match) === 1
    || Number(stat['60min_match']) === 1);
  if (playedMatches.length > 1) {
    return `${playedMatches.map(stat => Number(stat.match_time || 0)).join('+')} мин`;
  }
  if (playedMinutes !== undefined && playedMinutes > 0) return `${playedMinutes} мин`;
  return '';
}

function buildStatSummary(stats: FantasyPlayerStatTotals, playedMinutesLabel: string): string {
  const summary: string[] = [];
  if (playedMinutesLabel) summary.push(playedMinutesLabel);
  if (stats.starts && stats.substituteAppearances) {
    summary.push(`в старте: ${stats.starts}`, `с лавки: ${stats.substituteAppearances}`);
  } else if (stats.starts) {
    summary.push(stats.starts > 1 ? `в старте: ${stats.starts}` : 'в старте');
  } else if (stats.substituteAppearances) {
    summary.push(stats.substituteAppearances > 1 ? `с лавки: ${stats.substituteAppearances}` : 'вышел с лавки');
  }
  if (stats.replacements) summary.push(stats.replacements > 1 ? `заменён: ${stats.replacements}` : 'был заменён');
  if (stats.shotSaves) summary.push(`сейвы: ${stats.shotSaves}`);
  if (stats.ballRecoveries) summary.push(`возвраты мяча: ${stats.ballRecoveries}`);
  if (stats.goalsAgainst) summary.push(`пропущено: ${stats.goalsAgainst}`);
  if (stats.penaltiesMissed) summary.push(`не забил пенальти: ${stats.penaltiesMissed}`);
  if (stats.penaltiesWon) summary.push(`заработал пенальти: ${stats.penaltiesWon}`);
  if (stats.penaltiesConceded) summary.push(`привёз пенальти: ${stats.penaltiesConceded}`);
  if (stats.ownGoals) summary.push(`автоголы: ${stats.ownGoals}`);
  return summary.join(' · ');
}

function getPositionOrder(positionId?: string): number {
  return POSITION_ORDER[positionId || ''] ?? Number.MAX_SAFE_INTEGER;
}
