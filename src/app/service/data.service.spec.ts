import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DataService } from './data.service';

describe('DataService', () => {
  let service: DataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });

    service = TestBed.inject(DataService);
  });

  it('returns the midpoint color when all scores are equal', () => {
    expect(service.getRgbForTour(10, 10, 10)).toBe('rgb(255, 214, 102)');
  });

  it('clamps scores outside the configured range', () => {
    expect(service.getRgbForTour(-1, 100, 0)).toBe('rgb(183, 51, 42)');
    expect(service.getRgbForTour(101, 100, 0)).toBe('rgb(55, 112, 82)');
  });

  it('exposes the current route name without exposing the subject', () => {
    service.setUrlName('spain');

    expect(service.getUrlName()).toBe('spain');
  });
});
