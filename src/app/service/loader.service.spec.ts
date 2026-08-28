import { LoaderService } from './loader.service';

describe('LoaderService', () => {
  it('stays visible until all concurrent requests finish', () => {
    const service = new LoaderService();
    const states: boolean[] = [];
    const subscription = service.isLoading$.subscribe(state => states.push(state));

    service.showLoader();
    service.showLoader();
    service.hideLoader();

    expect(states).toEqual([false, true]);

    service.hideLoader();

    expect(states).toEqual([false, true, false]);
    subscription.unsubscribe();
  });

  it('does not underflow after an unmatched completion', () => {
    const service = new LoaderService();
    const states: boolean[] = [];
    const subscription = service.isLoading$.subscribe(state => states.push(state));

    service.hideLoader();
    service.showLoader();
    service.hideLoader();

    expect(states).toEqual([false, true, false]);
    subscription.unsubscribe();
  });
});
