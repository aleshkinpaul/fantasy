import { IProfileDetails } from '../models/domain';
import { calculateMatchForecast } from './forecast-calculator';

describe('calculateMatchForecast', () => {
  it('gives the stronger recent team a higher win probability', () => {
    const forecast = calculateMatchForecast({
      homeProfileId: 'home',
      awayProfileId: 'away',
      targetTour: 4,
      drawGap: 3,
      profiles: [profile('home', [80, 85, 90]), profile('away', [40, 45, 50])],
    });

    expect(forecast.homeWinProbability).toBeGreaterThan(forecast.awayWinProbability);
    expect(forecast.homeForm).toBeGreaterThan(forecast.awayForm);
    expect(forecast.basedOnTours).toEqual([1, 2, 3]);
  });

  it('always returns probabilities totaling one hundred', () => {
    const forecast = calculateMatchForecast({
      homeProfileId: 'home',
      awayProfileId: 'away',
      targetTour: 2,
      drawGap: 5,
      profiles: [profile('home', [50]), profile('away', [50])],
    });

    expect(
      forecast.homeWinProbability + forecast.drawProbability + forecast.awayWinProbability,
    ).toBe(100);
    expect(forecast.confidence).toBe('low');
  });

  it('uses a neutral low-confidence prior before the first tour', () => {
    const forecast = calculateMatchForecast({
      homeProfileId: 'home',
      awayProfileId: 'away',
      targetTour: 1,
      drawGap: 3,
      profiles: [profile('home', []), profile('away', [])],
    });

    expect(forecast.homeForm).toBe(5);
    expect(forecast.awayForm).toBe(5);
    expect(forecast.homeWinProbability).toBe(42);
    expect(forecast.drawProbability).toBe(16);
    expect(forecast.awayWinProbability).toBe(42);
    expect(forecast.basedOnTours).toEqual([]);
    expect(forecast.confidence).toBe('low');
  });

  it('does not use scores from the target or future tours', () => {
    const baseline = calculateMatchForecast({
      homeProfileId: 'home',
      awayProfileId: 'away',
      targetTour: 3,
      drawGap: 3,
      profiles: [profile('home', [60, 65, 500]), profile('away', [55, 50, 0])],
    });
    const changedFuture = calculateMatchForecast({
      homeProfileId: 'home',
      awayProfileId: 'away',
      targetTour: 3,
      drawGap: 3,
      profiles: [profile('home', [60, 65, 0]), profile('away', [55, 50, 500])],
    });

    expect(changedFuture).toEqual(baseline);
  });
});

function profile(id: string, scores: number[]): Pick<IProfileDetails, 'id' | 'team'> {
  return {
    id,
    team: {
      id,
      title: id,
      rosters_by_tour: {},
      results_by_tour: Object.fromEntries(scores.map((score, index) => [
        index + 1,
        { tour_score: score, total_score: score, total_place: 1 },
      ])),
    },
  };
}
