import { isHistoricalMartinLeagueMember } from './martin-league.registry';

describe('Martin League registry', () => {
  it('matches historical team names without depending on case and punctuation', () => {
    expect(isHistoricalMartinLeagueMember(2024, 'Cherry pie')).toBeTrue();
    expect(isHistoricalMartinLeagueMember(2024, 'ЛЮМОС СОЛЕМ')).toBeTrue();
    expect(isHistoricalMartinLeagueMember(2024, 'Мижганис C.F.')).toBeTrue();
  });

  it('supports both spellings of the Valverde team from the source data', () => {
    expect(isHistoricalMartinLeagueMember(2024, 'КоготьВальверде')).toBeTrue();
    expect(isHistoricalMartinLeagueMember(2024, 'КоготьВалверде')).toBeTrue();
  });

  it('does not apply the static list to later seasons', () => {
    expect(isHistoricalMartinLeagueMember(2025, 'ducks')).toBeFalse();
    expect(isHistoricalMartinLeagueMember(2024, 'Volidol')).toBeFalse();
  });
});
