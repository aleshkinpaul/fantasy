import { CompetitionMatch } from '../models/competition.models';
import {
  findProfile,
  getMatchResultForProfile,
  getOpponentProfileId,
  requireMatchForProfile,
  requireProfile,
} from './competition-match-selectors';

describe('competition match selectors', () => {
  const matches: CompetitionMatch[] = [
    { home: 'home', away: 'away', result: 1 },
    { home: 'draw-home', away: 'draw-away', result: 0 },
  ];

  it('returns the result from each participant perspective', () => {
    expect(getMatchResultForProfile(matches, 'home')).toBe(1);
    expect(getMatchResultForProfile(matches, 'away')).toBe(2);
    expect(getMatchResultForProfile(matches, 'draw-home')).toBe(0);
    expect(getMatchResultForProfile(matches, 'draw-away')).toBe(0);
  });

  it('returns the opponent from each participant perspective', () => {
    expect(getOpponentProfileId(matches, 'home')).toBe('away');
    expect(getOpponentProfileId(matches, 'away')).toBe('home');
  });

  it('finds and requires profiles by id', () => {
    const profiles = [{ id: 'home', name: 'Home profile' }];

    expect(findProfile(profiles, 'home')).toBe(profiles[0]);
    expect(findProfile(profiles, 'missing')).toBeUndefined();
    expect(requireProfile(profiles, 'home')).toBe(profiles[0]);
    expect(() => requireProfile(profiles, 'missing')).toThrowError('Не найден профиль missing');
  });

  it('reports an incomplete schedule explicitly', () => {
    expect(() => requireMatchForProfile(matches, 'missing'))
      .toThrowError('Не найден матч профиля missing');
  });
});
