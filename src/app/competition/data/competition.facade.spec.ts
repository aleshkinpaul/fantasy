import { CompetitionSnapshotView } from '../models/competition.models';
import { CompetitionFacade } from './competition.facade';

describe('CompetitionFacade archive hydration', () => {
  it('restores stage membership lost by legacy snapshot serialization', () => {
    const profile = {
      id: 'profile-1',
      name: 'Участник',
      score: 100,
      leagues: [],
      place_in_league: {},
      results: {
        points: { apertura: 3, common: 3 },
        diff_fo: { apertura: 10, common: 10 },
        fo: { apertura: 70, common: 70 },
      },
    };
    const snapshot = {
      schemaVersion: 1,
      datasetId: 'archive-test',
      config: {
        stages: [{
          name: 'Общий этап',
          firstTour: 1,
          lastTour: 1,
          leagues: [{ name: 'Общий этап', profiles: ['profile-1'] }],
        }],
      },
      squads: {
        data: {
          players: { 'profile-1': { id: 'profile-1' } },
        },
      },
      profiles: [profile],
      leagueProfileIds: { 'Общий этап': [] },
      squadDetails: [{ profileId: 'profile-1' }],
      playersRating: [],
      prizes: [],
      lastTour: 1,
      sportPlayersByTour: {},
    } as unknown as CompetitionSnapshotView;
    const facade = new CompetitionFacade({} as never, {} as never);

    const viewModel = (facade as unknown as {
      hydrateSnapshot(value: CompetitionSnapshotView): ReturnType<CompetitionFacade['load']>;
    }).hydrateSnapshot(snapshot) as unknown as {
      profilesDetails: Array<{ leagues?: Record<string, string> }>;
      leaguesRatings: Record<string, Array<{ id: string }>>;
    };

    expect(viewModel.profilesDetails[0].leagues?.['apertura']).toBe('Общий этап');
    expect(viewModel.leaguesRatings['Общий этап'].map(item => item.id)).toEqual(['profile-1']);
    expect(JSON.parse(JSON.stringify(viewModel.profilesDetails[0].leagues))).toEqual({
      apertura: 'Общий этап',
    });
  });
});
