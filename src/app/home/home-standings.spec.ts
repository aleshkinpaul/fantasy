import { selectHomeStandings } from './home-standings';

describe('home standings', () => {
  const stages = [
    {
      name: 'Apertura',
      firstTour: 1,
      lastTour: 15,
      leagues: [
        { name: 'Конференция Анчелотти' },
        { name: 'Конференция Муньоса' },
        { name: 'Конференция Зидана' },
      ],
    },
    {
      name: 'Clausura',
      firstTour: 16,
      lastTour: 30,
      leagues: [{ name: 'Primera' }, { name: 'Segunda' }],
    },
  ];

  it('shows all Apertura conferences during the first stage', () => {
    const selection = selectHomeStandings(stages, {
      'Конференция Анчелотти': ['a'],
      'Конференция Муньоса': ['m'],
      'Конференция Зидана': ['z'],
    }, [], 5);

    expect(selection.stageName).toBe('Apertura');
    expect(selection.groups.map(group => group.name)).toEqual([
      'Конференция Анчелотти',
      'Конференция Муньоса',
      'Конференция Зидана',
    ]);
  });

  it('switches to Primera and Segunda during Clausura', () => {
    const selection = selectHomeStandings(stages, {
      Primera: ['p'],
      Segunda: ['s'],
    }, [], 16);

    expect(selection.stageName).toBe('Clausura');
    expect(selection.groups.map(group => group.name)).toEqual(['Primera', 'Segunda']);
  });

  it('keeps the stage league name when a single league uses the common rating', () => {
    const selection = selectHomeStandings([{
      name: 'Общий этап',
      firstTour: 1,
      lastTour: 8,
      leagues: [{ name: 'Общий этап' }],
    }], {}, ['first', 'second'], 1);

    expect(selection.groups).toEqual([{
      name: 'Общий этап',
      entries: ['first', 'second'],
    }]);
  });
});
