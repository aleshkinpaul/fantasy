import { getSeasonCompetitionFileUrl } from './competition-data-loader.service';

describe('getSeasonCompetitionFileUrl', () => {
  it('builds a season-scoped path for each competition', () => {
    expect(getSeasonCompetitionFileUrl('spain', 2025))
      .toBe('/assets/data/seasons/2025-26/spain.json');
    expect(getSeasonCompetitionFileUrl('champions-league', 2026))
      .toBe('/assets/data/seasons/2026-27/champions-league.json');
  });
});
