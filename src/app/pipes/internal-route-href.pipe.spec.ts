import { InternalRouteHrefPipe } from './internal-route-href.pipe';

describe('InternalRouteHrefPipe', () => {
  const pipe = new InternalRouteHrefPipe();

  it('turns an application route into a server-safe hash URL', () => {
    expect(pipe.transform('/spain/new?year=2026&tabId=3'))
      .toBe('/#/spain/new?year=2026&tabId=3');
  });

  it('normalizes a route without the leading slash', () => {
    expect(pipe.transform('rating')).toBe('/#/rating');
  });

  it('does not modify external and existing hash links', () => {
    expect(pipe.transform('https://www.sports.ru/')).toBe('https://www.sports.ru/');
    expect(pipe.transform('#/rating')).toBe('#/rating');
  });

  it('keeps an absent href absent', () => {
    expect(pipe.transform(null)).toBeNull();
  });
});
