import { SportPlayer } from '../competition/models/competition.models';
import { IProfileDetails, IRoster } from '../models/domain';
import { MatchCenterPlayer, MatchCenterTeam } from './match-center.models';

const POSITION_LABELS: Record<string, string> = {
  '9': 'ВР',
  '10': 'ЗЩ',
  '11': 'ПЗ',
  '12': 'НП',
};

export function buildMatchCenterTeam(
  profile: IProfileDetails,
  tour: number,
  sportPlayers: SportPlayer[],
): MatchCenterTeam {
  const roster = profile.team.rosters_by_tour[tour];
  if (!roster) {
    return { profile, base: [], bench: [], hasRoster: false };
  }

  const playersById = new Map(sportPlayers.map(player => [player.id, player]));
  return {
    profile,
    teamCost: Number.isFinite(Number(roster.team_cost)) ? Number(roster.team_cost) : undefined,
    base: roster.players.base.map(playerId => buildPlayer(playerId, false, roster, playersById)),
    bench: roster.players.bench.map(playerId => buildPlayer(playerId, true, roster, playersById)),
    hasRoster: true,
  };
}

function buildPlayer(
  playerId: string,
  isBench: boolean,
  roster: IRoster,
  playersById: Map<string, SportPlayer>,
): MatchCenterPlayer {
  const player = playersById.get(playerId);
  return {
    id: playerId,
    name: player?.name || `Игрок #${playerId}`,
    position: POSITION_LABELS[player?.amplua_id || ''] || '—',
    cost: player?.cost,
    realTeamId: player?.team_id,
    isCaptain: roster.captain_id === playerId,
    isViceCaptain: roster.vice_captain_id === playerId,
    isBench,
  };
}
