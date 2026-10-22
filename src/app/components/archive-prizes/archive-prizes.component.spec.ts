import { buildArchiveRuntimePrizes } from './archive-prizes.component';

describe('buildArchiveRuntimePrizes', () => {
  it('creates a completed prize card with its historical winner', () => {
    const prizes = buildArchiveRuntimePrizes([{
      id: 'archive-prize',
      prizeId: 24001,
      tournamentId: 'archive',
      profileId: 'winner',
      name: 'Архивный приз',
      author: 'Организаторы',
      result: 33,
      winnerTeamName: 'Команда сезона',
    }], [{ id: 'winner', name: 'Победитель', logo: 'assets/winner.png' }], 'archive');

    expect(prizes).toEqual([jasmine.objectContaining({
      id: 24001,
      state: 1,
      activeLeaders: [jasmine.objectContaining({
        id: 'winner',
        name: 'Победитель',
        logo: 'assets/winner.png',
        team: { title: 'Команда сезона' },
        prizes: { 24001: { value: 33, sortParam: 33 } },
      })],
    })]);
  });
});
