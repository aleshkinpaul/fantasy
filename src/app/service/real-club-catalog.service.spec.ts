import { createRealClubIndex, findRealClubByExternalId } from '../models/real-club';
import { validateRealClubCatalog } from './real-club-catalog.service';

describe('RealClubCatalogService domain', () => {
  it('resolves one club by identifiers from different tournaments', () => {
    const clubs = validateRealClubCatalog([{
      key: 'real-madrid',
      ids: ['7004', '8379', 'ucl-id'],
      name: 'Реал Мадрид',
      logo: 'assets/real-madrid.png',
    }]);
    const index = createRealClubIndex(clubs);

    expect(index.get('7004')?.key).toBe('real-madrid');
    expect(index.get('8379')?.logo).toBe('assets/real-madrid.png');
    expect(findRealClubByExternalId(clubs, 'ucl-id')?.name).toBe('Реал Мадрид');
  });

  it('rejects an external id assigned to two clubs', () => {
    expect(() => validateRealClubCatalog([
      { key: 'first', ids: ['1'], name: 'First', logo: '' },
      { key: 'second', ids: ['1'], name: 'Second', logo: '' },
    ])).toThrowError(/Duplicate real club external id "1"/);
  });

  it('requires a stable key and at least one external id', () => {
    expect(() => validateRealClubCatalog([
      { key: '', ids: [], name: 'Club', logo: '' },
    ])).toThrowError(/invalid key/);
  });
});
