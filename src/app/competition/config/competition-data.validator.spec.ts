import { SeasonCompetitionConfig } from '../models/competition.models';
import { validateCompetitionConfig } from './competition-data.validator';

describe('validateCompetitionConfig', () => {
  it('accepts a complete schedule and profiles used only by prize rules', () => {
    const config = createConfig({ profiles: ['a', 'b', 'c', 'd', 'guest'] });

    expect(() => validateCompetitionConfig(config)).not.toThrow();
  });

  it('rejects a participant repeated in one tour', () => {
    const config = createConfig({
      matches: { 1: [match('a', 'b'), match('a', 'c')] },
    });

    expect(() => validateCompetitionConfig(config))
      .toThrowError('Участник a повторяется в туре 1');
  });

  it('rejects gaps in calendar numbering', () => {
    const config = createConfig({
      matches: {
        1: [match('a', 'b'), match('c', 'd')],
        3: [match('a', 'c'), match('b', 'd')],
      },
    });

    expect(() => validateCompetitionConfig(config))
      .toThrowError('В календаре spain отсутствует тур 2');
  });

  it('rejects gaps between competition stages', () => {
    const config = createConfig({
      matches: {
        1: [match('a', 'b'), match('c', 'd')],
        2: [match('a', 'c'), match('b', 'd')],
        3: [match('a', 'd'), match('b', 'c')],
      },
      stages: [
        stage('Apertura', 1, 1, [['Общая', ['a', 'b', 'c', 'd']]]),
        stage('Clausura', 3, 3, [['Общая', ['a', 'b', 'c', 'd']]]),
      ],
    });

    expect(() => validateCompetitionConfig(config))
      .toThrowError('Этап Clausura должен начинаться с тура 2');
  });

  it('rejects duplicate membership inside one stage', () => {
    const config = createConfig({
      stages: [stage('Apertura', 1, 1, [
        ['Первая', ['a', 'b']],
        ['Вторая', ['b', 'c', 'd']],
      ])],
    });

    expect(() => validateCompetitionConfig(config))
      .toThrowError('Участник b одновременно входит в лиги Первая и Вторая');
  });

  it('rejects matches between different leagues of one stage', () => {
    const config = createConfig({
      matches: { 1: [match('a', 'c'), match('b', 'd')] },
      stages: [stage('Apertura', 1, 1, [
        ['Первая', ['a', 'b']],
        ['Вторая', ['c', 'd']],
      ])],
    });

    expect(() => validateCompetitionConfig(config))
      .toThrowError('Матч a — c в туре 1 пересекает лиги этапа Apertura');
  });

  it('rejects an incomplete round', () => {
    const config = createConfig({ matches: { 1: [match('a', 'b')] } });

    expect(() => validateCompetitionConfig(config))
      .toThrowError('В лиге Общая тура 1 ожидается 2 матчей, получено 1');
  });

  it('allows one bye per tour in an odd-sized league', () => {
    const config = createConfig({
      profiles: ['a', 'b', 'c', 'guest'],
      matches: {
        1: [match('a', 'b')],
        2: [match('b', 'c')],
        3: [match('c', 'a')],
      },
      stages: [stage('Apertura', 1, 3, [['Общая', ['a', 'b', 'c']]])],
    });

    expect(() => validateCompetitionConfig(config)).not.toThrow();
  });

  it('rejects inconsistent cup arrays', () => {
    const config = createConfig({
      cup: {
        name: 'Кубок',
        matchesTours: [1],
        matchesToursNames: ['1/2', 'Финал'],
        matches: [[match('a', 'b')]],
      },
    });

    expect(() => validateCompetitionConfig(config))
      .toThrowError('В кубке spain не совпадает количество названий и раундов');
  });
});

function createConfig(overrides: Partial<SeasonCompetitionConfig> = {}): SeasonCompetitionConfig {
  return {
    id: 'test',
    type: 'spain',
    typeId: 'test',
    yearStart: 2026,
    yearEnd: 2027,
    squad_link: 'https://example.test/full_info',
    tour_link: 'https://example.test/tour/',
    profiles: ['a', 'b', 'c', 'd'],
    matches: { 1: [match('a', 'b'), match('c', 'd')] },
    stages: [stage('Apertura', 1, 1, [['Общая', ['a', 'b', 'c', 'd']]])],
    prizes: [],
    ...overrides,
  };
}

function match(home: string, away: string): { home: string; away: string } {
  return { home, away };
}

function stage(
  name: string,
  firstTour: number,
  lastTour: number,
  leagues: Array<[string, string[]]>,
): SeasonCompetitionConfig['stages'][number] {
  return {
    name,
    firstTour,
    lastTour,
    leagues: leagues.map(([leagueName, profiles]) => ({ name: leagueName, profiles })),
  };
}
