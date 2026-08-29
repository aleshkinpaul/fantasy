import { SportPlayer } from '../competition/models/competition.models';
import { IProfileDetails, IRoster } from '../models/domain';
import { getRosterChanges, getRosterSelection } from '../tour-insights/roster-selectors';
import { MatchCenterPlayer, MatchCenterTeam } from './match-center.models';

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

export function buildMatchCenterTeam(
  profile: IProfileDetails,
  tour: number,
  sportPlayers: SportPlayer[],
): MatchCenterTeam {
  const selection = getRosterSelection(profile, tour);
  if (!selection) {
    return { profile, base: [], bench: [], hasRoster: false };
  }

  const roster = selection.roster;
  const playersById = new Map(sportPlayers.map(player => [player.id, player]));
  const newPlayerIds = new Set(getRosterChanges(profile, tour)?.added || []);
  const base = selection.base
    .map(playerId => buildPlayer(playerId, false, roster, playersById, newPlayerIds))
    .sort((left, right) => getPositionOrder(left.positionId) - getPositionOrder(right.positionId))
    .map((player, index, players) => ({
      ...player,
      startsPositionGroup: index > 0 && player.positionId !== players[index - 1].positionId,
    }));

  return {
    profile,
    teamCost: Number.isFinite(Number(roster.team_cost)) ? Number(roster.team_cost) : undefined,
    base,
    bench: selection.bench.map(playerId =>
      buildPlayer(playerId, true, roster, playersById, newPlayerIds)),
    hasRoster: true,
  };
}

function buildPlayer(
  playerId: string,
  isBench: boolean,
  roster: IRoster,
  playersById: Map<string, SportPlayer>,
  newPlayerIds: Set<string>,
): MatchCenterPlayer {
  const player = playersById.get(playerId);
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
  };
}

function getPositionOrder(positionId?: string): number {
  return POSITION_ORDER[positionId || ''] ?? Number.MAX_SAFE_INTEGER;
}
