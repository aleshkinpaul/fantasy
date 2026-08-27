import {
  CompetitionCup,
  FantasyFullInfoResponse,
} from '../models/competition.models';

interface CupProfile {
  id: string;
  results: {
    cup?: {
      fo: number;
      missed_fo: number;
      diff_fo: number;
      matchesPlayed: number;
      avg_diff_fo: number;
      diff_fo_arr: number[];
      standings: number[];
      lowest_winning_pos_diff: number | null;
    };
  };
}

export interface CupCalculationInput {
  cup: CompetitionCup;
  profiles: CupProfile[];
  squads: FantasyFullInfoResponse;
  lastTour: number;
}

export function calculateCup(input: CupCalculationInput): void {
  const { cup, profiles, squads, lastTour } = input;
  const actualCupTour = Math.max(...cup.matchesTours.filter(tour => tour <= lastTour));
  const currentRoundCount = cup.matchesTours.indexOf(actualCupTour) + 1;

  profiles.forEach(profile => {
    profile.results.cup = {
      fo: 0,
      missed_fo: 0,
      diff_fo: 0,
      matchesPlayed: 0,
      avg_diff_fo: 0,
      diff_fo_arr: [],
      standings: [],
      lowest_winning_pos_diff: null,
    };
  });

  for (let roundIndex = 0; roundIndex < currentRoundCount; roundIndex++) {
    const tour = cup.matchesTours[roundIndex];
    cup.matches[roundIndex].forEach(match => {
      match.home_score = +squads.data.players[match.home].team.results_by_tour[tour].tour_score;
      match.away_score = +squads.data.players[match.away].team.results_by_tour[tour].tour_score;
      match.result = match.home_score === match.away_score ? 0 : match.home_score > match.away_score ? 1 : 2;

      const homeProfile = profiles.find(profile => profile.id === match.home);
      const awayProfile = profiles.find(profile => profile.id === match.away);
      if (!homeProfile || !awayProfile) {
        throw new Error(`Не найдены профили кубкового матча ${match.home} — ${match.away}`);
      }

      updateCupProfile(homeProfile, match.home_score, match.away_score, getPlaceAfterTour(squads, match.home, tour));
      updateCupProfile(awayProfile, match.away_score, match.home_score, getPlaceAfterTour(squads, match.away, tour));

      if (match.result === 1) {
        updateLowestWinningDifference(
          homeProfile,
          getPlaceAfterTour(squads, match.home, tour) - getPlaceAfterTour(squads, match.away, tour)
        );
      }
      if (match.result === 2) {
        updateLowestWinningDifference(
          awayProfile,
          getPlaceAfterTour(squads, match.away, tour) - getPlaceAfterTour(squads, match.home, tour)
        );
      }
    });
  }
}

function updateCupProfile(profile: CupProfile, ownFo: number, opponentFo: number, standing: number): void {
  const result = profile.results.cup!;
  result.fo += ownFo;
  result.missed_fo += opponentFo;
  result.diff_fo = result.fo - result.missed_fo;
  result.diff_fo_arr.push(ownFo - opponentFo);
  result.matchesPlayed += 1;
  result.standings.push(standing);
  if (result.matchesPlayed > 3) {
    result.avg_diff_fo = Math.round(result.diff_fo / result.matchesPlayed * 100) / 100;
  }
}

function updateLowestWinningDifference(profile: CupProfile, difference: number): void {
  const result = profile.results.cup!;
  if (result.lowest_winning_pos_diff === null) result.lowest_winning_pos_diff = difference;
  result.lowest_winning_pos_diff = Math.max(result.lowest_winning_pos_diff, difference);
}

function getPlaceAfterTour(squads: FantasyFullInfoResponse, profileId: string, tour: number): number {
  const standings = Object.values(squads.data.players)
    .map(player => ({ id: player.id, score: +player.team.results_by_tour[tour].total_score, position: 0 }))
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

  const profile = standings.find(player => player.id === profileId);
  if (!profile) throw new Error(`Не найдено место участника ${profileId} после тура ${tour}`);
  return profile.position;
}
