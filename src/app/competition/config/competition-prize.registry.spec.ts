import { SeasonCompetitionConfig } from '../models/competition.models';
import { resolveCompetitionPrizes } from './competition-prize.registry';

describe('resolveCompetitionPrizes', () => {
  it('allows a season to select reusable prizes and apply seasonal overrides', () => {
    const config = createConfig({
      prizeRefs: [{ key: 'martin-league', overrides: { excluded: ['guest'] } }],
    });

    const prizes = resolveCompetitionPrizes(config);

    expect(prizes.length).toBe(1);
    expect(prizes[0].id).toBe(6);
    expect(prizes[0].icon).toBe('assets/logos/2026/icons/real-madrid.png');
    expect(prizes[0].excluded).toEqual(['guest']);
  });

  it('allows a season without prize references', () => {
    expect(resolveCompetitionPrizes(createConfig())).toEqual([]);
  });

  it('returns independent runtime arrays for every resolution', () => {
    const config = createConfig({ prizeRefs: [{ key: 'soft-kitty' }] });
    const first = resolveCompetitionPrizes(config);
    const second = resolveCompetitionPrizes(config);

    first[0].nomineesArr!.push('runtime nominee');

    expect(second[0].nomineesArr).toEqual([]);
  });

  it('rejects an unknown prize template', () => {
    const config = createConfig({ prizeRefs: [{ key: 'unknown' }] });

    expect(() => resolveCompetitionPrizes(config)).toThrowError('Не найден шаблон приза unknown');
  });

  it('rejects duplicate prize ids across inline and referenced prizes', () => {
    const config = createConfig({
      prizes: [{ id: 6 }],
      prizeRefs: [{ key: 'martin-league' }],
    });

    expect(() => resolveCompetitionPrizes(config)).toThrowError('Приз 6 подключен к сезону несколько раз');
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
    profiles: [],
    matches: {},
    stages: [],
    prizes: [],
    ...overrides,
  };
}
