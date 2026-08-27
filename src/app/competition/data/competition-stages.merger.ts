import { FantasyFullInfoResponse } from '../models/competition.models';

export function mergeCompetitionStages(
  firstStage: FantasyFullInfoResponse,
  secondStage?: FantasyFullInfoResponse,
): FantasyFullInfoResponse {
  const merged = clone(firstStage);
  if (!secondStage) return merged;

  Object.values(merged.data.players).forEach(firstStagePlayer => {
    const secondStagePlayer = secondStage.data.players[firstStagePlayer.id];
    if (!secondStagePlayer) {
      throw new Error(`Во втором этапе API отсутствует участник ${firstStagePlayer.id}`);
    }

    const firstStageToursCount = Object.keys(firstStagePlayer.team.results_by_tour).length;
    const firstStagePoints = +firstStagePlayer.team.results_by_tour[firstStageToursCount].total_score;

    Object.values(secondStagePlayer.team.results_by_tour).forEach((result, secondStageIndex) => {
      const mergedResult = clone(result);
      mergedResult.total_score = (+mergedResult.total_score + firstStagePoints).toString();
      firstStagePlayer.team.results_by_tour[firstStageToursCount + secondStageIndex + 1] = mergedResult;
    });

    Object.values(secondStagePlayer.team.rosters_by_tour).forEach((roster, secondStageIndex) => {
      firstStagePlayer.team.rosters_by_tour[firstStageToursCount + secondStageIndex + 1] = clone(roster);
    });
  });

  const firstStageToursCount = Object.keys(merged.data.tours).length;
  Object.values(secondStage.data.tours).forEach(tour => {
    const mergedTour = clone(tour);
    mergedTour.number = (+mergedTour.number + firstStageToursCount).toString();
    merged.data.tours[mergedTour.number] = mergedTour;
  });

  return merged;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
