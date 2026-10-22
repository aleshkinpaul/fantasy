import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  CompetitionSnapshotView,
  SeasonCompetitionConfig,
  SeasonCompetitionFile,
} from '../models/competition.models';
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

  it('loads an archived competition only from its local snapshot', done => {
    const viewUrl = '/assets/data/history/spain-2025-26/view.json';
    const snapshot = {
      schemaVersion: 1,
      datasetId: 'spain-2025-26',
    } as CompetitionSnapshotView;

    service.load('spain', 2025).subscribe(result => {
      expect(result).toEqual({ kind: 'snapshot', snapshot });
      expect(http.match(request => request.url.includes('fantasy-h2h.ru')).length).toBe(0);
      done();
    });

    http.expectOne('/assets/data/seasons/2025-26/spain.json').flush({
      status: 'published',
      config: {
        type: 'spain',
        yearStart: 2025,
        prizes: [],
        dataSource: {
          lifecycle: 'archived',
          snapshot: {
            manifestUrl: '/assets/data/history/spain-2025-26/manifest.json',
            viewUrl,
            schemaVersion: 1,
          },
        },
      } as unknown as SeasonCompetitionConfig,
      profiles: [],
    } as SeasonCompetitionFile);
    http.expectOne(viewUrl).flush(snapshot);
  });

  it('does not fall back to the API when an archive snapshot is unavailable', done => {
    const viewUrl = '/assets/data/history/missing/view.json';
    service.load('spain', 2025).subscribe({
      next: () => done.fail('Missing snapshot must fail'),
      error: () => {
        expect(http.match(request => request.url.includes('fantasy-h2h.ru')).length).toBe(0);
        done();
      },
    });

    http.expectOne('/assets/data/seasons/2025-26/spain.json').flush({
      status: 'published',
      config: {
        type: 'spain',
        yearStart: 2025,
        prizes: [],
        dataSource: {
          lifecycle: 'archived',
          snapshot: {
            manifestUrl: '/assets/data/history/missing/manifest.json',
            viewUrl,
            schemaVersion: 1,
          },
        },
      } as unknown as SeasonCompetitionConfig,
      profiles: [],
    } as SeasonCompetitionFile);
    http.expectOne(viewUrl).flush('missing', { status: 404, statusText: 'Not Found' });
  });
});
