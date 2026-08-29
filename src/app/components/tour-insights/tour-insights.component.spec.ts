import { RankedMatchInsight, RankedPlayerInsight, TourInsights } from '../../tour-insights/tour-insights.models';
import { TourInsightsComponent } from './tour-insights.component';

describe('TourInsightsComponent', () => {
  it('opens the selected ranking match in the existing match center', () => {
    const component = new TourInsightsComponent();
    const item = { match: { home: 'home', away: 'away' } } as RankedMatchInsight;
    component.insights = { context: { tour: 7 } } as TourInsights;
    let emittedTour = 0;
    let emittedHome = '';
    component.matchOpen.subscribe(selection => {
      emittedTour = selection.tour;
      emittedHome = selection.match.home;
    });

    component.openMatch(item);

    expect(emittedTour).toBe(7);
    expect(emittedHome).toBe('home');
  });

  it('shows five player rows by default and can expand a list', () => {
    const component = new TourInsightsComponent();
    const items = Array.from({ length: 7 }, (_, index) => ({
      rank: index + 1,
      player: { id: String(index), name: String(index) },
      count: 1,
      share: 10,
      baseCount: 0,
      captainCount: 0,
    })) as RankedPlayerInsight[];

    expect(component.visiblePlayerItems(items, 'popular').length).toBe(5);
    component.togglePlayerList('popular');
    expect(component.visiblePlayerItems(items, 'popular').length).toBe(7);
    component.togglePlayerList('popular');
    expect(component.visiblePlayerItems(items, 'popular').length).toBe(5);
  });
});
