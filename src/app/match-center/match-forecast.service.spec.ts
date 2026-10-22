import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { IProfileDetails } from '../models/domain';
import { MatchForecastService } from './match-forecast.service';

describe('MatchForecastService', () => {
  it('keeps a pre-match forecast visible during a live match without a snapshot', done => {
    const http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get']);
    http.get.and.returnValue(of({ snapshots: [] }));
    const service = new MatchForecastService(http);

    service.resolve({
      tournamentId: 'la-liga-2026-27',
      selection: { match: { home: 'home', away: 'away' }, tour: 5 },
      profiles: [profile('home', [50, 60, 70, 80]), profile('away', [40, 45, 50, 55])],
      drawGap: 3,
      matchStatus: 'live',
    }).subscribe(result => {
      expect(result.state).toBe('preview');
      expect(result.forecast?.basedOnTours).toEqual([1, 2, 3, 4]);
      expect(result.message).toContain('Live-данные');
      done();
    });
  });

  it('reconstructs a missing forecast from no more than five preceding tours', done => {
    const http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get']);
    http.get.and.returnValue(of({ snapshots: [] }));
    const service = new MatchForecastService(http);

    service.resolve({
      tournamentId: 'la-liga-2026-27',
      selection: { match: { home: 'home', away: 'away' }, tour: 7 },
      profiles: [
        profile('home', [40, 50, 60, 70, 80, 90, 1_000]),
        profile('away', [90, 80, 70, 60, 50, 40, 0]),
      ],
      drawGap: 3,
      matchStatus: 'completed',
    }).subscribe(result => {
      expect(result.state).toBe('calculated');
      expect(result.forecast?.basedOnTours).toEqual([2, 3, 4, 5, 6]);
      expect(result.forecast?.homeWinProbability).toBeGreaterThan(
        result.forecast?.awayWinProbability || 0,
      );
      expect(result.message).toContain('пяти туров до этого матча');
      done();
    });
  });
});

function profile(id: string, scores: number[]): IProfileDetails {
  return {
    id,
    name: id,
    nick: '',
    url: '',
    logo: '',
    score: 0,
    prizes: {},
    results: {} as IProfileDetails['results'],
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
