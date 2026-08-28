import { PrizesListComponent } from './prizes-list.component';

describe('PrizesListComponent', () => {
  const component = new PrizesListComponent();

  it('uses season-independent medal icons for the leading places', () => {
    expect(component.getMedalImage(0)).toBe('assets/icons/prizes/gold-medal.png');
    expect(component.getMedalImage(1)).toBe('assets/icons/prizes/silver-medal.png');
    expect(component.getMedalImage(2)).toBe('assets/icons/prizes/bronze-medal.png');
    expect(component.getMedalImage(3)).toBe('assets/icons/prizes/medal.png');
  });

  it('uses a generic medal for a prize without its own icon', () => {
    expect(component.getPrizeImage()).toBe('assets/icons/prizes/medal.png');
    expect(component.getPrizeImage('custom.png')).toBe('custom.png');
  });
});
