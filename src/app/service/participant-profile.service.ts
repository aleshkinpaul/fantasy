import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay, switchMap } from 'rxjs';

import {
  FantasyFullInfoResponse,
  LocalProfile,
  SeasonCompetitionFile,
  SeasonCompetitionConfig,
} from '../competition/models/competition.models';
import { mergeCompetitionStages } from '../competition/data/competition-stages.merger';
import { ArchiveCupTournament } from '../models/archive-cup';
import { ParticipantHistorySource, ParticipantProfile, ParticipantTournamentStats } from '../models/participant-profile';
import { RetroTournament } from '../models/retro-tournament';
import { buildParticipantProfiles } from '../participant-profile/participant-profile.builder';
import { AchievementService } from './achievement.service';
import { ArchiveCupService } from './archive-cup.service';
import { RetroTournamentService } from './retro-tournament.service';
import { TournamentCatalogService } from './tournament-catalog.service';

const SEASON_SOURCES: Array<{ path: string; tournamentIds: string[] }> = [
  { path: '/assets/data/seasons/2025-26/spain.json', tournamentIds: ['la-liga-2025-26', 'la-liga-cup-2025-26'] },
  { path: '/assets/data/seasons/2025-26/champions-league.json', tournamentIds: ['champions-league-2025-26'] },
  { path: '/assets/data/seasons/2025-26/world-cup.json', tournamentIds: ['world-cup-2026'] },
  { path: '/assets/data/seasons/2026-27/spain.json', tournamentIds: ['la-liga-2026-27'] },
  { path: '/assets/data/seasons/2026-27/champions-league.json', tournamentIds: ['champions-league-2026-27'] }
];

interface SeasonSnapshot {
  file: SeasonCompetitionFile;
  squads?: FantasyFullInfoResponse;
}

interface LegacyProfilesRegistry {
  '2024': LocalProfile[];
}

interface CwcTeamSource {
  name: string;
  logo: string;
  profiles: string[];
}

interface LegacyConsts {
  league: Array<{ type: string; teams?: CwcTeamSource[] }>;
}

@Injectable({ providedIn: 'root' })
export class ParticipantProfileService {
  private readonly profiles$: Observable<ParticipantProfile[]>;

  constructor(
    http: HttpClient,
    achievementService: AchievementService,
    catalogService: TournamentCatalogService,
    retroService: RetroTournamentService,
    archiveCupService: ArchiveCupService
  ) {
    const seasons = SEASON_SOURCES.map(source =>
      http.get<SeasonCompetitionFile>(source.path).pipe(
        switchMap(file => loadSeasonSnapshot(http, file).pipe(
          catchError(error => {
            console.warn(`Не удалось загрузить результаты сезона из ${file.config.squad_link}`, error);
            return of({ file } as SeasonSnapshot);
          })
        ))
      ));
    this.profiles$ = forkJoin({
      registry: achievementService.loadRegistry(),
      timeline: catalogService.loadTimeline(),
      retro: retroService.loadTournaments(),
      archiveCups: archiveCupService.loadTournaments(),
      legacyProfiles: http.get<LegacyProfilesRegistry>('/assets/data/profiles.json'),
      legacySpain: http.get<FantasyFullInfoResponse>('/assets/data/2024_2025/spain/squads.json'),
      legacyConsts: http.get<LegacyConsts>('/assets/data/consts.json'),
      seasons: forkJoin(seasons)
    }).pipe(
      map(data => buildParticipantProfiles(
        data.registry,
        data.timeline,
        [
          ...buildSeasonSources(data.seasons),
          ...buildRetroSources(data.retro),
          ...buildLegacySpainSources(data.legacySpain, data.legacyProfiles['2024'] ?? []),
          ...buildArchiveCupSources(data.archiveCups),
          ...buildCwcSources(
            data.legacyConsts,
            collectNames(data.seasons.map(snapshot => snapshot.file), data.legacyProfiles['2024'] ?? [])
          )
        ]
      )),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  loadProfiles(): Observable<ParticipantProfile[]> {
    return this.profiles$;
  }

  loadParticipant(reference: string): Observable<ParticipantProfile | undefined> {
    return this.profiles$.pipe(map(profiles => profiles.find(profile =>
      profile.participantId === reference || profile.profileIds.includes(reference)
    )));
  }
}

function buildSeasonSources(snapshots: SeasonSnapshot[]): ParticipantHistorySource[] {
  return snapshots.flatMap((snapshot, index) => {
    const { file, squads } = snapshot;
    const allowed = new Set(file.config.profiles);
    return SEASON_SOURCES[index].tournamentIds.flatMap(tournamentId =>
      file.profiles
        .filter(profile => allowed.has(profile.id))
        .map(profile => {
          const remoteProfile = squads?.data.players[profile.id];
          const mode = tournamentId.includes('-cup-') ? 'cup' : 'league';
          return {
            tournamentId,
            profileId: profile.id,
            participantName: profile.name,
            profileUrl: profile.url,
            profileNick: profile.nick,
            teamName: remoteProfile?.team.title || profile.teamName,
            logo: profile.logo,
            teamUrl: remoteProfile?.team.id
              ? buildFantasyTeamUrl(file.config.type, remoteProfile.team.id)
              : undefined,
            stats: squads ? buildSeasonStats(file.config, squads, profile.id, mode) : undefined,
          };
        })
    );
  });
}

function loadSeasonSnapshot(http: HttpClient, file: SeasonCompetitionFile): Observable<SeasonSnapshot> {
  const requests: Record<string, Observable<FantasyFullInfoResponse>> = {
    first: http.get<FantasyFullInfoResponse>(file.config.squad_link),
  };
  if (file.config.squad_link_2) {
    requests['second'] = http.get<FantasyFullInfoResponse>(file.config.squad_link_2);
  }
  return forkJoin(requests).pipe(map(responses => ({
    file,
    squads: mergeCompetitionStages(responses['first'], responses['second']),
  })));
}

function buildSeasonStats(
  config: SeasonCompetitionConfig,
  squads: FantasyFullInfoResponse,
  profileId: string,
  mode: 'league' | 'cup',
): ParticipantTournamentStats | undefined {
  const player = squads.data.players[profileId];
  if (!player) return undefined;

  const schedule = mode === 'cup'
    ? Object.fromEntries((config.cup?.matchesTours ?? []).map((tour, index) => [tour, config.cup?.matches[index] ?? []]))
    : config.matches;
  const scores: number[] = [];
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let scoreFor = 0;
  let scoreAgainst = 0;

  Object.entries(schedule).forEach(([tourKey, matches]) => {
    const tour = Number(tourKey);
    const match = matches.find(item => item.home === profileId || item.away === profileId);
    if (!match) return;
    const homeResult = squads.data.players[match.home]?.team.results_by_tour[tour];
    const awayResult = squads.data.players[match.away]?.team.results_by_tour[tour];
    if (!homeResult || !awayResult) return;
    const homeScore = Number(homeResult.tour_score);
    const awayScore = Number(awayResult.tour_score);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return;

    const ownScore = match.home === profileId ? homeScore : awayScore;
    const opponentScore = match.home === profileId ? awayScore : homeScore;
    scores.push(ownScore);
    scoreFor += ownScore;
    scoreAgainst += opponentScore;
    const drawGap = mode === 'cup' ? 0 : config.drawGap ?? 0;
    if (Math.abs(ownScore - opponentScore) <= drawGap) draws += 1;
    else if (ownScore > opponentScore) wins += 1;
    else losses += 1;
  });

  const ownResults = Object.entries(player.team.results_by_tour)
    .map(([tour, result]) => ({ tour: Number(tour), result }))
    .filter(item => Number.isFinite(Number(item.result.tour_score)))
    .sort((left, right) => left.tour - right.tour);
  const fantasyScores = ownResults.map(item => Number(item.result.tour_score));
  const relevantScores = mode === 'cup' ? scores : fantasyScores;
  if (!relevantScores.length && !scores.length) return undefined;
  const latest = ownResults.at(-1)?.result;
  const matchesPlayed = wins + draws + losses;
  const totalScore = mode === 'cup'
    ? scores.reduce((sum, score) => sum + score, 0)
    : Number(latest?.total_score ?? fantasyScores.reduce((sum, score) => sum + score, 0));
  const standings = mode === 'league' ? buildSeasonStandings(config, squads) : [];

  return {
    place: standings.findIndex(item => item.profileId === profileId) + 1 || undefined,
    fantasyPlace: numberOrUndefined(latest?.total_place),
    totalScore,
    averageScore: average(relevantScores),
    maxScore: relevantScores.length ? Math.max(...relevantScores) : 0,
    minScore: relevantScores.length ? Math.min(...relevantScores) : 0,
    toursPlayed: relevantScores.length,
    matchesPlayed,
    wins,
    draws,
    losses,
    points: wins * 3 + draws,
    scoreFor,
    scoreAgainst,
    scoreDifference: scoreFor - scoreAgainst,
  };
}

function buildSeasonStandings(
  config: SeasonCompetitionConfig,
  squads: FantasyFullInfoResponse,
): Array<{ profileId: string; points: number; difference: number; scoreFor: number }> {
  return config.profiles.map(profileId => {
    let wins = 0;
    let draws = 0;
    let scoreFor = 0;
    let scoreAgainst = 0;
    Object.entries(config.matches).forEach(([tourKey, matches]) => {
      const tour = Number(tourKey);
      const match = matches.find(item => item.home === profileId || item.away === profileId);
      if (!match) return;
      const homeResult = squads.data.players[match.home]?.team.results_by_tour[tour];
      const awayResult = squads.data.players[match.away]?.team.results_by_tour[tour];
      if (!homeResult || !awayResult) return;
      const own = Number(match.home === profileId ? homeResult.tour_score : awayResult.tour_score);
      const against = Number(match.home === profileId ? awayResult.tour_score : homeResult.tour_score);
      if (!Number.isFinite(own) || !Number.isFinite(against)) return;
      scoreFor += own;
      scoreAgainst += against;
      if (Math.abs(own - against) <= (config.drawGap ?? 0)) draws += 1;
      else if (own > against) wins += 1;
    });
    return { profileId, points: wins * 3 + draws, difference: scoreFor - scoreAgainst, scoreFor };
  }).sort((left, right) =>
    right.points - left.points || right.difference - left.difference || right.scoreFor - left.scoreFor);
}

function buildFantasyTeamUrl(type: string, teamId: string): string {
  return `https://www.sports.ru/fantasy/football/${type}/${teamId}`;
}

function numberOrUndefined(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function buildRetroSources(tournaments: RetroTournament[]): ParticipantHistorySource[] {
  return tournaments.flatMap(tournament => tournament.standings.map(standing => ({
    tournamentId: tournament.id,
    participantId: standing.participantId,
    profileId: standing.profileId,
    participantName: standing.participantName,
    profileNick: standing.nickname,
    profileTelegram: standing.telegram,
    teamName: standing.teamName,
    logo: standing.logo,
    stats: {
      place: standing.place,
      totalScore: standing.totalScore,
      averageScore: standing.averageScore,
      maxScore: standing.maxScore,
      minScore: standing.minScore,
      toursPlayed: standing.tourScores.filter(score => score !== null).length
    }
  })));
}

function buildLegacySpainSources(
  response: FantasyFullInfoResponse,
  profiles: LocalProfile[]
): ParticipantHistorySource[] {
  const profileMap = new Map(profiles.map(profile => [profile.id, profile]));
  const rows = Object.values(response.data.players).map(player => {
    const scores = Object.values(player.team.results_by_tour)
      .map(result => Number(result.tour_score))
      .filter(Number.isFinite);
    const totals = Object.values(player.team.results_by_tour)
      .map(result => Number(result.total_score))
      .filter(Number.isFinite);
    return { player, scores, totalScore: totals.at(-1) ?? scores.reduce((sum, score) => sum + score, 0) };
  }).sort((left, right) => right.totalScore - left.totalScore);

  return rows.map((row, index) => {
    const profile = profileMap.get(row.player.id);
    const stats: ParticipantTournamentStats = {
      place: index + 1,
      totalScore: row.totalScore,
      averageScore: average(row.scores),
      maxScore: row.scores.length ? Math.max(...row.scores) : 0,
      minScore: row.scores.length ? Math.min(...row.scores) : 0,
      toursPlayed: row.scores.length
    };
    return {
      tournamentId: 'la-liga-2024-25',
      profileId: row.player.id,
      participantName: profile?.name || row.player.name,
      profileUrl: profile?.url,
      profileNick: profile?.nick,
      teamName: row.player.team.title,
      logo: profile?.logo || row.player.logo,
      teamUrl: buildFantasyTeamUrl('spain', row.player.team.id),
      stats
    };
  });
}

function buildArchiveCupSources(tournaments: ArchiveCupTournament[]): ParticipantHistorySource[] {
  return tournaments.flatMap(tournament => {
    const teams = new Map<string, ParticipantHistorySource>();
    tournament.rounds.flatMap(round => round.matches).forEach(match => {
      [match.first, match.second].forEach(team => teams.set(team.profileId, {
        tournamentId: tournament.id,
        profileId: team.profileId,
        participantName: team.participantName,
        teamName: team.teamName,
        logo: team.logo
      }));
    });
    return Array.from(teams.values());
  });
}

function buildCwcSources(consts: LegacyConsts, names: Map<string, string>): ParticipantHistorySource[] {
  const league = consts.league.find(item => item.type === 'club-world-cup');
  return (league?.teams ?? []).flatMap(team => team.profiles.map(profileId => ({
    tournamentId: 'club-world-cup-2025',
    profileId,
    participantName: names.get(profileId) || `Участник ${profileId}`,
    teamName: team.name,
    logo: team.logo,
    includeInTeamHistory: false,
  })));
}

function collectNames(files: SeasonCompetitionFile[], legacyProfiles: LocalProfile[]): Map<string, string> {
  return new Map([...legacyProfiles, ...files.flatMap(file => file.profiles)].map(profile => [profile.id, profile.name]));
}

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : 0;
}
