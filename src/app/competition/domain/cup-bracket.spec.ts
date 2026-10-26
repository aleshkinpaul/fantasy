import { CompetitionCup } from '../models/competition.models';
import { bracketNodeId, buildCupBracketViewModel } from './cup-bracket';

describe('buildCupBracketViewModel', () => {
  function createCup(): CompetitionCup {
    const qualificationPairs = Array.from({ length: 16 }, (_, index) => ({
      home: `q${index}-home`,
      away: `q${index}-away`,
    }));
    return {
      bracketFormat: 'double-elimination-48-v1',
      matchesTours: [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36],
      matchesToursNames: [
        'Отб', '1/16', '1/16 НС', '1/8', '1/8 НС', '1/4',
        '1/4 НС', '1/2', '1/2 НС', 'Финал ВС', 'Финал НС', 'Гранд-финал',
      ],
      matches: Array.from({ length: 12 }, () => []),
      draw: {
        capturedAt: '2026-10-22',
        standingsThroughTour: 9,
        ranking: [],
        seededProfileIds: Array.from({ length: 16 }, (_, index) => `seed-${index}`),
        qualificationProfileIds: qualificationPairs.flatMap(match => [match.home, match.away]),
        qualificationPairs,
        seededAssignments: Array.from({ length: 16 }, (_, index) => ({
          seededProfileId: `seed-${index}`,
          qualificationMatch: index + 1,
        })),
      },
    };
  }

  it('publishes all match slots and their transitions before the cup starts', () => {
    const view = buildCupBracketViewModel(createCup());

    expect(view.nodes.length).toBe(94);
    expect(view.edges.length).toBe(140);
    expect(view.rounds.map(round => round.nodes.length))
      .toEqual([16, 16, 16, 16, 8, 8, 4, 4, 2, 2, 1, 1]);
    expect(view.nodes.find(node => node.id === bracketNodeId(1, 0))?.away.placeholder)
      .toBe('Победитель: Отб, пара 1');

    const semifinalNodes = view.rounds[7].nodes;
    const semifinalSpan = Math.max(...semifinalNodes.map(node => node.y))
      - Math.min(...semifinalNodes.map(node => node.y))
      + view.cardHeight;
    expect(semifinalSpan).toBeLessThanOrEqual(520);
  });

  it('resolves individual future pairs without waiting for the complete round', () => {
    const cup = createCup();
    cup.matches[0] = cup.draw!.qualificationPairs.map(match => ({ ...match, type: 'up' }));
    cup.matches[0][0].result = 1;
    cup.matches[0][15].result = 2;
    cup.matches[1] = [{
      home: 'seed-0',
      away: 'q0-home',
      type: 'up',
      result: 2,
    }];

    const view = buildCupBracketViewModel(cup);
    const upperFirst = view.nodes.find(node => node.id === bracketNodeId(1, 0));
    const lowerFirst = view.nodes.find(node => node.id === bracketNodeId(2, 0));

    expect(upperFirst?.away.profileId).toBe('q0-home');
    expect(lowerFirst?.home.profileId).toBe('q15-home');
    expect(lowerFirst?.away.profileId).toBe('seed-0');
    expect(lowerFirst?.match).toEqual({
      home: 'q15-home',
      away: 'seed-0',
      type: 'down',
    });
  });
});
