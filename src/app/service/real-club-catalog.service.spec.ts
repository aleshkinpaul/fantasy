import { createRealClubIndex, findRealClubByExternalId } from '../models/real-club';
import { validateRealClubCatalog } from './real-club-catalog.service';

describe('RealClubCatalogService domain', () => {
  it('resolves one club by identifiers from different tournaments', () => {
    const clubs = validateRealClubCatalog([{
      key: 'real-madrid',
      ids: ['7004', '8379', 'ucl-id'],
      sourceIds: ['779'],
      name: 'Реал Мадрид',
      logo: 'assets/real-madrid.png',
    }]);
    const index = createRealClubIndex(clubs);

    expect(index.get('7004')?.key).toBe('real-madrid');
    expect(index.get('8379')?.logo).toBe('assets/real-madrid.png');
    expect(clubs[0].sourceIds).toEqual(['779']);
    expect(findRealClubByExternalId(clubs, 'ucl-id')?.name).toBe('Реал Мадрид');
  });

  it('rejects malformed source ids', () => {
    expect(() => validateRealClubCatalog([{
      key: 'club', ids: ['1'], sourceIds: [779], name: 'Club', logo: '',
    }])).toThrowError(/sourceIds/);
  });

  it('rejects a source id assigned to two clubs', () => {
    expect(() => validateRealClubCatalog([
      { key: 'first', ids: ['1'], sourceIds: ['100'], name: 'First', logo: '' },
      { key: 'second', ids: ['2'], sourceIds: ['100'], name: 'Second', logo: '' },
    ])).toThrowError(/Duplicate real club source id "100"/);
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
