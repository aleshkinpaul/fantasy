import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay } from 'rxjs';

import { CompetitionFacade, CompetitionViewModel } from '../competition/data/competition.facade';
import type {
  CompetitionMatch,
  CompetitionSnapshotView,
  CompetitionType,
  FantasyFullInfoResponse,
  SeasonCompetitionConfig,
} from '../competition/models/competition.models';
import type { ArchiveCupTournament } from '../models/archive-cup';
import type { ParticipantDirectoryEntry } from '../models/participant-directory';
import type { TournamentCatalogItem } from '../models/tournament-catalog';
import { ArchiveCupService } from '../service/archive-cup.service';
import { ParticipantDirectoryService } from '../service/participant-directory.service';
import { TournamentCatalogService } from '../service/tournament-catalog.service';
import { logger } from '../utils/logger';
import type {
  HistoricalMatchRecord,
  HistoricalMatchTeam,
  MatchHistoryIndex,
} from './match-center.models';

const ARCHIVE_VIEW_URLS = [
  '/assets/data/history/spain-2025-26/view.json',
  '/assets/data/history/champions-league-2025-26/view.json',
  '/assets/data/history/world-cup-2026/view.json',
];

const LEGACY_SPAIN_SQUADS_URL = '/assets/data/2024_2025/spain/squads.json';
const ACTIVE_COMPETITIONS: Array<{ type: CompetitionType; yearStart: number }> = [
  { type: 'spain', yearStart: 2026 },
  { type: 'champions-league', yearStart: 2026 },
];

interface MatchHistorySources {
  participants: ParticipantDirectoryEntry[];
  catalog: TournamentCatalogItem[];
  archiveViews: CompetitionViewModel[];
  archiveCup?: ArchiveCupTournament;
  legacySpainSquads: FantasyFullInfoResponse;
}

interface BuildMatchHistoryIndexInput extends MatchHistorySources {
  currentViews: CompetitionViewModel[];
}

@Injectable({ providedIn: 'root' })
export class MatchHistoryDataService {
  private readonly archiveSources$: Observable<MatchHistorySources>;
  private readonly liveViews = new Map<string, Observable<CompetitionViewModel | null>>();

  constructor(
    http: HttpClient,
    private readonly competitionFacade: CompetitionFacade,
    participantDirectory: ParticipantDirectoryService,
    catalogService: TournamentCatalogService,
    archiveCupService: ArchiveCupService,
  ) {
    this.archiveSources$ = forkJoin({
      participants: participantDirectory.loadParticipants(),
      catalog: catalogService.loadTimeline().pipe(
        map(groups => groups.flatMap(group => group.tournaments)),
      ),
      archiveSnapshots: forkJoin(ARCHIVE_VIEW_URLS.map(url => http.get<CompetitionSnapshotView>(url))),
      archiveCup: archiveCupService.loadByYear(2024),
      legacySpainSquads: http.get<FantasyFullInfoResponse>(LEGACY_SPAIN_SQUADS_URL),
    }).pipe(
      map(({ archiveSnapshots, ...sources }) => ({
        ...sources,
        archiveViews: archiveSnapshots.map(snapshot => snapshotToViewModel(snapshot)),
      })),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  load(currentView: CompetitionViewModel): Observable<MatchHistoryIndex> {
    const otherActiveViews$ = currentView.config.yearStart === 2026
      ? forkJoin(ACTIVE_COMPETITIONS
        .filter(source => source.type !== currentView.config.type)
        .map(source => this.loadLiveView(source.type, source.yearStart)))
      : of([]);

    return forkJoin({
      sources: this.archiveSources$,
      otherActiveViews: otherActiveViews$,
    }).pipe(
      map(({ sources, otherActiveViews }) => buildMatchHistoryIndex({
        ...sources,
        currentViews: [currentView, ...otherActiveViews.filter(isCompetitionViewModel)],
      })),
    );
  }

  private loadLiveView(type: CompetitionType, yearStart: number): Observable<CompetitionViewModel | null> {
    const key = `${type}:${yearStart}`;
    const cached = this.liveViews.get(key);
    if (cached) return cached;

    const request = this.competitionFacade.load(type, yearStart).pipe(
      catchError(error => {
        logger.error(`Не удалось загрузить ${key} для истории личных встреч:`, error);
        return of(null);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.liveViews.set(key, request);
    return request;
  }
}

export function buildMatchHistoryIndex(input: BuildMatchHistoryIndexInput): MatchHistoryIndex {
  const participantIdByProfileId = buildParticipantIndex(input.participants);
  const catalogById = new Map(input.catalog.map(item => [item.id, item]));
  const views = deduplicateViews([...input.archiveViews, ...input.currentViews]);
  const records = views.flatMap(view => competitionRecords(
    view,
    participantIdByProfileId,
    catalogById,
  ));

  if (input.archiveCup) {
    records.push(...archiveCupRecords(
      input.archiveCup,
      input.legacySpainSquads,
      participantIdByProfileId,
      catalogById,
    ));
  }

  const uniqueRecords = [...new Map(records.map(record => [record.id, record])).values()]
    .sort((left, right) => left.startsAtTimestamp - right.startsAtTimestamp || left.id.localeCompare(right.id));
  const seasonOrder = new Map(input.catalog.map(item => [item.period, item.yearStart]));
  const seasons = [...new Set(uniqueRecords.map(record => record.season))]
    .sort((left, right) => (seasonOrder.get(right) ?? 0) - (seasonOrder.get(left) ?? 0));

  return {
    records: uniqueRecords,
    participantIdByProfileId,
    seasons,
  };
}

export function competitionRecords(
  view: CompetitionViewModel,
  participantIdByProfileId: Record<string, string>,
  catalogById: Map<string, TournamentCatalogItem>,
): HistoricalMatchRecord[] {
  const config = view.config;
  const profileIdentities = new Map(view.profilesDetails.map(profile => [profile.id, {
    title: profile.team.title,
    logo: profile.logo || '',
  }]));
  const mainTournamentId = resolveMainTournamentId(config);
  const mainCatalog = catalogById.get(mainTournamentId);
  const mainRecords = Object.entries(config.matches).flatMap(([tourValue, matches]) => {
    const tour = Number(tourValue);
    const stage = config.stages.find(item => tour >= item.firstTour && tour <= item.lastTour)?.name || 'Турнир';
    return matches.flatMap(match => createRecord({
      match,
      tour,
      stage,
      tournamentId: mainTournamentId,
      tournament: mainCatalog,
      config,
      squads: view.squads,
      profileIdentities,
      participantIdByProfileId,
      drawGap: config.drawGap || 0,
    }));
  });

  if (!config.cup) return mainRecords;
  const cupTournamentId = config.type === 'spain'
    ? config.catalogTournamentIds?.find(id => id.includes('-cup-')) || mainTournamentId
    : mainTournamentId;
  const cupCatalog = catalogById.get(cupTournamentId) || mainCatalog;
  const cupRecords = config.cup.matches.flatMap((roundMatches, roundIndex) => {
    const tour = config.cup!.matchesTours[roundIndex];
    const stage = config.cup!.matchesToursNames?.[roundIndex]
      || config.cup!.name
      || 'Плей-офф';
    return roundMatches.flatMap(match => createRecord({
      match,
      tour,
      stage,
      tournamentId: cupTournamentId,
      tournament: cupCatalog,
      config,
      squads: view.squads,
      profileIdentities,
      participantIdByProfileId,
      drawGap: 0,
    }));
  });
  return [...mainRecords, ...cupRecords];
}

export function archiveCupRecords(
  tournament: ArchiveCupTournament,
  squads: FantasyFullInfoResponse,
  participantIdByProfileId: Record<string, string>,
  catalogById: Map<string, TournamentCatalogItem>,
): HistoricalMatchRecord[] {
  const catalog = catalogById.get(tournament.id);
  return tournament.rounds.flatMap(round => round.matches.flatMap(match => match.legs.flatMap((leg, legIndex) => {
    const home = match.first.profileId === leg.homeProfileId ? match.first : match.second;
    const away = match.first.profileId === leg.awayProfileId ? match.first : match.second;
    const startsAt = normalizeStartAt(squads.data.tours[leg.tour]?.start);
    if (!startsAt) return [];
    return [{
      id: `${tournament.id}:${round.id}:${match.id}:${legIndex + 1}`,
      tournamentId: tournament.id,
      tournamentTitle: catalog?.title || tournament.title,
      tournamentIcon: catalog?.icon || 'assets/icons/leagues/copa.png',
      season: catalog?.period || tournament.period,
      stage: round.title,
      tour: leg.tour,
      startsAt,
      startsAtTimestamp: Date.parse(startsAt),
      home: historicalTeam(home.profileId, home.teamName, home.logo, participantIdByProfileId),
      away: historicalTeam(away.profileId, away.teamName, away.logo, participantIdByProfileId),
      homeScore: leg.homeScore,
      awayScore: leg.awayScore,
      result: scoreResult(leg.homeScore, leg.awayScore, 0),
    }];
  })));
}

interface CreateRecordInput {
  match: CompetitionMatch;
  tour: number;
  stage: string;
  tournamentId: string;
  tournament?: TournamentCatalogItem;
  config: SeasonCompetitionConfig;
  squads: FantasyFullInfoResponse;
  profileIdentities: Map<string, { title: string; logo: string }>;
  participantIdByProfileId: Record<string, string>;
  drawGap: number;
}

function createRecord(input: CreateRecordInput): HistoricalMatchRecord[] {
  if (!Number.isFinite(input.match.home_score) || !Number.isFinite(input.match.away_score)) return [];
  const startsAt = normalizeStartAt(input.squads.data.tours[input.tour]?.start);
  if (!startsAt) return [];
  const homeScore = Number(input.match.home_score);
  const awayScore = Number(input.match.away_score);
  return [{
    id: `${input.tournamentId}:${input.tour}:${input.match.home}:${input.match.away}`,
    tournamentId: input.tournamentId,
    tournamentTitle: input.tournament?.title || input.tournamentId,
    tournamentIcon: input.tournament?.icon || fallbackTournamentIcon(input.config.type),
    season: input.tournament?.period || seasonPeriod(input.config.yearStart, input.config.yearEnd),
    stage: input.stage,
    tour: input.tour,
    startsAt,
    startsAtTimestamp: Date.parse(startsAt),
    home: historicalTeam(
      input.match.home,
      input.profileIdentities.get(input.match.home)?.title,
      input.profileIdentities.get(input.match.home)?.logo,
      input.participantIdByProfileId,
    ),
    away: historicalTeam(
      input.match.away,
      input.profileIdentities.get(input.match.away)?.title,
      input.profileIdentities.get(input.match.away)?.logo,
      input.participantIdByProfileId,
    ),
    homeScore,
    awayScore,
    result: input.match.result ?? scoreResult(homeScore, awayScore, input.drawGap),
  }];
}

function historicalTeam(
  profileId: string,
  teamTitle: string | undefined,
  logo: string | undefined,
  participantIdByProfileId: Record<string, string>,
): HistoricalMatchTeam {
  return {
    participantId: participantIdByProfileId[profileId] || `profile-${profileId}`,
    profileId,
    teamTitle: teamTitle || `Команда #${profileId}`,
    logo: logo || 'assets/logos/default.png',
  };
}

function buildParticipantIndex(participants: ParticipantDirectoryEntry[]): Record<string, string> {
  return Object.fromEntries(participants.flatMap(participant =>
    participant.profileIds.map(profileId => [profileId, participant.participantId])));
}

function resolveMainTournamentId(config: SeasonCompetitionConfig): string {
  return config.catalogTournamentIds?.find(id => !id.includes('-cup-'))
    || `${config.type}-${config.yearStart}-${String(config.yearEnd).slice(-2)}`;
}

function scoreResult(homeScore: number, awayScore: number, drawGap: number): 0 | 1 | 2 {
  if (Math.abs(homeScore - awayScore) <= drawGap) return 0;
  return homeScore > awayScore ? 1 : 2;
}

function normalizeStartAt(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value)
    ? value
    : `${value.replace(' ', 'T')}+03:00`;
  return Number.isFinite(Date.parse(normalized)) ? normalized : undefined;
}

function seasonPeriod(yearStart: number, yearEnd: number): string {
  return `${yearStart}–${String(yearEnd).slice(-2)}`;
}

function fallbackTournamentIcon(type: CompetitionType): string {
  if (type === 'spain') return 'assets/icons/leagues/laliga.png';
  if (type === 'champions-league') return 'assets/icons/leagues/ucl.png';
  return 'assets/icons/leagues/wc2026.png';
}

function deduplicateViews(views: CompetitionViewModel[]): CompetitionViewModel[] {
  const byId = new Map<string, CompetitionViewModel>();
  views.forEach(view => byId.set(resolveMainTournamentId(view.config), view));
  return [...byId.values()];
}

function snapshotToViewModel(snapshot: CompetitionSnapshotView): CompetitionViewModel {
  return {
    config: snapshot.config,
    squads: snapshot.squads,
    profilesDetails: snapshot.profiles as unknown as CompetitionViewModel['profilesDetails'],
    leaguesRatings: {},
    squadsDetails: [],
    playersRating: snapshot.playersRating,
    prizes: [],
    lastTour: snapshot.lastTour,
    sportPlayersByTour: {},
  };
}

function isCompetitionViewModel(value: CompetitionViewModel | null): value is CompetitionViewModel {
  return value !== null;
}
