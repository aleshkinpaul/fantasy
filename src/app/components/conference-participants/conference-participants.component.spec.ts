import { IProfileDetails } from '../../models/domain';
import { buildConferenceParticipants } from './conference-participants.component';

describe('ConferenceParticipantsComponent', () => {
  it('keeps the order from the conference configuration', () => {
    const first = profile('first');
    const second = profile('second');

    const participants = buildConferenceParticipants(
      ['second', 'first'],
      [first, second],
    );

    expect(participants.map(item => item.profile?.id)).toEqual(['second', 'first']);
  });

  it('keeps a placeholder when profile details are unavailable', () => {
    const participants = buildConferenceParticipants(['missing'], []);

    expect(participants).toEqual([{ profileId: 'missing', profile: undefined }]);
  });
});

function profile(id: string): IProfileDetails {
  return {
    id,
    name: id,
    nick: id,
    url: '',
    logo: '',
    team: { id, title: id, results_by_tour: {}, rosters_by_tour: {} },
    score: 0,
    prizes: {},
    results: {} as IProfileDetails['results']
  };
}
