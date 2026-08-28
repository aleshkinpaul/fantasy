import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SeasonCompetitionConfig, SeasonCompetitionFile } from '../models/competition.models';
import {
  CompetitionDataLoaderService,
  getSeasonCompetitionFileUrl,
} from './competition-data-loader.service';

describe('getSeasonCompetitionFileUrl', () => {
  it('builds a season-scoped path for each competition', () => {
    expect(getSeasonCompetitionFileUrl('spain', 2025))
      .toBe('/assets/data/seasons/2025-26/spain.json');
    expect(getSeasonCompetitionFileUrl('champions-league', 2026))
      .toBe('/assets/data/seasons/2026-27/champions-league.json');
  });
});

describe('CompetitionDataLoaderService', () => {
  let service: CompetitionDataLoaderService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(CompetitionDataLoaderService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('does not publish an explicitly marked draft season', done => {
    service.load('spain', 2026).subscribe({
      next: () => done.fail('Draft season must not load'),
      error: error => {
        expect(error.message).toBe('Турнир spain сезона 2026 готовится к публикации');
        done();
      },
    });

    const request = http.expectOne('/assets/data/seasons/2026-27/spain.json');
    request.flush({
      status: 'draft',
      config: { type: 'spain', yearStart: 2026 } as SeasonCompetitionConfig,
      profiles: [],
    } as SeasonCompetitionFile);
  });
});
