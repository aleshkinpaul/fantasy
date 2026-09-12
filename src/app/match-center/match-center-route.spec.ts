import { CompetitionMatch } from '../competition/models/competition.models';
import { matchCenterQuery, resolveMatchCenterQuery } from './match-center-route';

describe('match center route', () => {
  const match: CompetitionMatch = { home: 'home', away: 'away' };
  const matches = { 4: [match] };

  it('resolves a published match from query parameters', () => {
    expect(resolveMatchCenterQuery(matches, {
      matchTour: '4',
      matchHome: 'home',
      matchAway: 'away',
    })).toEqual({ match, tour: 4 });
  });

  it('accepts the same pair in reverse order but keeps the canonical match', () => {
    expect(resolveMatchCenterQuery(matches, {
      matchTour: '4',
      matchHome: 'away',
      matchAway: 'home',
    })?.match).toBe(match);
  });

  it('rejects incomplete and unknown match links', () => {
    expect(resolveMatchCenterQuery(matches, {
      matchTour: '4',
      matchHome: 'home',
      matchAway: null,
    })).toBeNull();
    expect(resolveMatchCenterQuery(matches, {
      matchTour: '8',
      matchHome: 'home',
      matchAway: 'away',
    })).toBeNull();
  });

  it('serializes the stable match query contract', () => {
    expect(matchCenterQuery({ match, tour: 4 })).toEqual({
      matchTour: 4,
      matchHome: 'home',
      matchAway: 'away',
    });
  });
});
