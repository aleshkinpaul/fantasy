import { IPrizeNominee, IRuntimePrize } from '../models/domain';
import { ParticipantDirectoryEntry } from '../models/participant-directory';
import { selectPersonalizedPrizeResult } from './personalized-prize-result';

describe('selectPersonalizedPrizeResult', () => {
  const participant: ParticipantDirectoryEntry = {
    participantId: 'participant',
    name: 'Participant',
    profileIds: ['old-profile', 'current-profile'],
  };

  it('finds the current profile and returns its position in the full prize rating', () => {
    const prize = buildPrize([
      buildNominee('leader', 12),
      buildNominee('current-profile', 9),
      buildNominee('third', 7),
    ]);

    expect(selectPersonalizedPrizeResult(prize, participant)).toEqual({
      nominee: prize.activeLeaders[1],
      place: 2,
      value: 9,
    });
  });

  it('returns null when the participant has no ranked result', () => {
    expect(selectPersonalizedPrizeResult(buildPrize([buildNominee('leader', 12)]), participant)).toBeNull();
  });

  it('does not expose a secret prize value', () => {
    const prize = { ...buildPrize([buildNominee('current-profile', 9)]), isSecret: true };

    expect(selectPersonalizedPrizeResult(prize, participant)?.value).toBeNull();
    expect(selectPersonalizedPrizeResult(prize, participant)?.place).toBe(1);
  });
});

function buildPrize(activeLeaders: IPrizeNominee[]): IRuntimePrize {
  return {
    id: 1,
    name: 'Prize',
    state: 1,
    nomineesArr: activeLeaders,
    activeLeaders,
  };
}

function buildNominee(id: string, value: number): IPrizeNominee {
  return {
    id,
    name: id,
    logo: '',
    team: { title: id },
    prizes: { 1: { value, sortParam: value } },
    results: { subsCoef: 100 },
  };
}
