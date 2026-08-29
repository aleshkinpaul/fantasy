import { IProfileDetails } from '../../models/domain';
import { ParticipantCardComponent } from './participant-card.component';

describe('ParticipantCardComponent', () => {
  it('links to the fantasy team for the selected competition', () => {
    const component = new ParticipantCardComponent();
    component.competitionType = 'champions-league';
    component.profile = profile();

    expect(component.getTeamUrl()).toBe(
      'https://www.sports.ru/fantasy/football/champions-league/team-1',
    );
  });

  it('falls back to the participant profile when team id is unavailable', () => {
    const component = new ParticipantCardComponent();
    component.profile = profile();
    component.profile.team.id = '';

    expect(component.getTeamUrl()).toBe('https://www.sports.ru/profile/profile-1/');
  });
});

function profile(): IProfileDetails {
  return {
    id: 'profile-1',
    name: 'Иван Иванов',
    nick: 'ivan',
    url: 'https://www.sports.ru/profile/profile-1/',
    logo: '',
    team: { id: 'team-1', title: 'Команда', results_by_tour: {}, rosters_by_tour: {} },
    score: 0,
    prizes: {},
    results: {} as IProfileDetails['results']
  };
}
