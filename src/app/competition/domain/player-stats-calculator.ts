import {
  FantasyTourStatsResponse,
  SpecialPlayerRules,
  SportPlayer,
} from '../models/competition.models';
import { IRoster } from '../../models/domain';
import { resolveFantasyLineup } from './fantasy-lineup-resolver';

interface PlayerStatsProfile {
  team: {
    rosters_by_tour: Record<string | number, IRoster>;
  };
  results: {
    portugezePoints: number;
    larinPoints: number;
    uniqueUsedPlayers: string[];
    countedRedCards?: number;
    selectedPlayerPoints?: Record<string, number>;
  };
  isMartin?: number;
  isMartinWC?: number;
}

export function applySquadEligibility(
  profiles: PlayerStatsProfile[],
  latestStats: FantasyTourStatsResponse[],
  lastTour: number,
  rules: SpecialPlayerRules,
): void {
  const sportPlayers = mergeLatestPlayers(latestStats);
  const forbiddenPlayers = new Set(rules.forbiddenPlayerIds);

  profiles.forEach(profile => {
    for (let tour = 1; tour <= lastTour; tour++) {
      getRosterPlayers(profile, tour).forEach(playerId => {
        const player = sportPlayers[playerId];
        if (!player) throw new Error(`В статистике последнего тура отсутствует игрок ${playerId}`);
        if (rules.forbiddenTeamIds.includes(player.team_id)) forbiddenPlayers.add(playerId);
      });
    }
  });

  profiles.forEach(profile => {
    profile.isMartin = 1;
    profile.isMartinWC = 1;

    for (let tour = 1; tour <= lastTour; tour++) {
      const playerIds = getRosterPlayers(profile, tour);
      if (profile.isMartin === 1 && playerIds.some(id => forbiddenPlayers.has(id))) {
        profile.isMartin = 0;
      }
      if (profile.isMartinWC === 1 && playerIds.some(id => rules.worldCupForbiddenPlayerIds.includes(id))) {
        profile.isMartinWC = 0;
      }
    }
  });
}

export function applyTourPlayerStats(
  profiles: PlayerStatsProfile[],
  statsByTour: FantasyTourStatsResponse[],
  lastTour: number,
  rules: SpecialPlayerRules,
  trackSelectedPlayerPoints = false,
): SportPlayer[] {
  const players = mergePlayerStatsByTour(statsByTour);
  const playersById = new Map(players.map(player => [player.id, player]));

  profiles.forEach(profile => {
    if (trackSelectedPlayerPoints) {
      profile.results.selectedPlayerPoints = {};
      profile.results.countedRedCards = 0;
    }

    for (let tour = 1; tour <= lastTour; tour++) {
      const roster = profile.team.rosters_by_tour[tour.toString()];
      const playerIds = roster.players.base.concat(roster.players.bench);

      if (trackSelectedPlayerPoints) {
        playerIds.forEach(playerId => {
          if (!playersById.has(playerId)) {
            throw new Error(`В статистике тура ${tour} отсутствует игрок ${playerId}`);
          }
        });
        const lineup = resolveFantasyLineup(roster, tour, playersById, true);
        lineup.countedPlayerIds.forEach(playerId => {
          const countedPlayer = lineup.players[playerId];
          if (!countedPlayer) throw new Error(`В зачётном составе тура ${tour} отсутствует игрок ${playerId}`);
          profile.results.selectedPlayerPoints![playerId] =
            (profile.results.selectedPlayerPoints![playerId] ?? 0)
            + (countedPlayer.displayFantasyScore ?? 0);
          profile.results.countedRedCards =
            (profile.results.countedRedCards ?? 0) + countedPlayer.redCards;
        });
      }

      profile.results.portugezePoints += players
        .filter(player =>
          player.team_id === rules.portugueseTeamId
          && roster.players.base.includes(player.id))
        .reduce((sum, player) => sum + player.stat_by_tours[tour].score, 0);

      const larin = players.find(player =>
        player.id === rules.larinPlayerId && playerIds.includes(player.id));
      const isLarinCaptain = roster.captain_id === rules.larinPlayerId;
      profile.results.larinPoints += larin
        ? larin.stat_by_tours[tour].score * (1 + +isLarinCaptain)
        : 0;

      profile.results.uniqueUsedPlayers = [
        ...profile.results.uniqueUsedPlayers,
        ...playerIds.filter(id => !profile.results.uniqueUsedPlayers.includes(id)),
      ];
    }
  });

  return players;
}

function mergeLatestPlayers(stats: FantasyTourStatsResponse[]): Record<string, SportPlayer> {
  if (!stats.length) throw new Error('Не загружена статистика игроков последнего тура');
  const players = { ...stats[0].data.players };

  stats.slice(1).forEach(response => {
    Object.values(response.data.players).forEach(player => {
      if (!players[player.id]) players[player.id] = player;
    });
  });

  return players;
}

function mergePlayerStatsByTour(statsByTour: FantasyTourStatsResponse[]): SportPlayer[] {
  if (!statsByTour.length) throw new Error('Не загружена статистика игроков по турам');
  const players = Object.values(statsByTour[0].data.players).map(clone);

  for (let index = 1; index < statsByTour.length; index++) {
    players.forEach(player => {
      const tourPlayer = statsByTour[index].data.players[player.id];
      if (!tourPlayer) throw new Error(`В статистике тура ${index + 1} отсутствует игрок ${player.id}`);
      player.stat_by_tours[(index + 1).toString()] = tourPlayer.stat_by_tours[index + 1];
    });
  }

  return players;
}

function getRosterPlayers(profile: PlayerStatsProfile, tour: number): string[] {
  const roster = profile.team.rosters_by_tour[tour.toString()];
  return roster.players.base.concat(roster.players.bench);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
