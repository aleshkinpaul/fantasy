import { resolveFantasyLineup } from '../competition/domain/fantasy-lineup-resolver';
import { SportPlayer } from '../competition/models/competition.models';
import { IProfileDetails } from '../models/domain';

export interface PersonalizedPlayerContribution {
  id: string;
  name: string;
  positionId?: string;
  appearances: number;
  fantasyPoints: number;
}

export interface PersonalizedPlayerStats {
  mostUsed: PersonalizedPlayerContribution[];
  topScorers: PersonalizedPlayerContribution[];
  countedTours: number;
}

export function calculatePersonalizedPlayerStats(
  profile: IProfileDetails,
  lastTour: number,
  sportPlayersByTour: Record<number, SportPlayer[]>,
  limit = 5,
): PersonalizedPlayerStats {
  const contributions = new Map<string, PersonalizedPlayerContribution>();
  let countedTours = 0;

  for (let tour = 1; tour <= lastTour; tour++) {
    const roster = profile.team.rosters_by_tour[tour];
    if (!roster) continue;

    const sportPlayers = sportPlayersByTour[tour] ?? [];
    const sportPlayersMap = new Map(sportPlayers.map(player => [player.id, player]));
    const lineup = resolveFantasyLineup(
      roster,
      tour,
      sportPlayersMap,
      Boolean(profile.team.results_by_tour[tour]),
    );
    const countedPlayers = lineup.countedPlayerIds
      .map(playerId => lineup.players[playerId])
      .filter(player => player?.isPlayed && player.isCounted);
    if (countedPlayers.length) countedTours++;

    countedPlayers.forEach(player => {
      const sportPlayer = sportPlayersMap.get(player.id);
      const contribution = contributions.get(player.id) ?? {
        id: player.id,
        name: sportPlayer?.name ?? `Игрок #${player.id}`,
        positionId: sportPlayer?.amplua_id,
        appearances: 0,
        fantasyPoints: 0,
      };
      if (sportPlayer?.name) contribution.name = sportPlayer.name;
      if (sportPlayer?.amplua_id) contribution.positionId = sportPlayer.amplua_id;
      contribution.appearances++;
      contribution.fantasyPoints += player.displayFantasyScore ?? 0;
      contributions.set(player.id, contribution);
    });
  }

  const players = [...contributions.values()].map(player => ({
    ...player,
    fantasyPoints: roundScore(player.fantasyPoints),
  }));
  return {
    mostUsed: [...players]
      .sort((left, right) => right.appearances - left.appearances
        || right.fantasyPoints - left.fantasyPoints
        || left.name.localeCompare(right.name, 'ru'))
      .slice(0, limit),
    topScorers: [...players]
      .sort((left, right) => right.fantasyPoints - left.fantasyPoints
        || right.appearances - left.appearances
        || left.name.localeCompare(right.name, 'ru'))
      .slice(0, limit),
    countedTours,
  };
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}
