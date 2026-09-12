interface HomeStageLike {
  name: string;
  firstTour: number;
  lastTour: number;
  leagues: ReadonlyArray<{ name: string }>;
}

export interface HomeStandingSelection<T> {
  stageName: string;
  groups: Array<{ name: string; entries: T[] }>;
}

export function selectHomeStandings<T>(
  stages: readonly HomeStageLike[],
  ratings: Readonly<Record<string, T[]>>,
  commonRating: readonly T[],
  lastTour: number,
  limit = 5,
): HomeStandingSelection<T> {
  const currentStage = stages.find(stage =>
    lastTour >= stage.firstTour && lastTour <= stage.lastTour
  ) ?? [...stages].reverse().find(stage => lastTour >= stage.firstTour)
    ?? stages[0];

  if (!currentStage) {
    return {
      stageName: 'Общий зачёт',
      groups: [{ name: 'Общий зачёт', entries: commonRating.slice(0, limit) }],
    };
  }

  const groups = currentStage.leagues
    .map(league => {
      const leagueRating = ratings[league.name] ?? [];
      const entries = leagueRating.length
        ? leagueRating
        : currentStage.leagues.length === 1
          ? commonRating
          : [];
      return { name: league.name, entries: entries.slice(0, limit) };
    })
    .filter(group => group.entries.length);

  return {
    stageName: currentStage.name,
    groups: groups.length
      ? groups
      : [{ name: 'Общий зачёт', entries: commonRating.slice(0, limit) }],
  };
}
