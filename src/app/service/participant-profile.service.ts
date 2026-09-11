import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, forkJoin, map, shareReplay } from 'rxjs';

import {
  FantasyFullInfoResponse,
  LocalProfile,
  SeasonCompetitionFile
} from '../competition/models/competition.models';
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
    const seasons = SEASON_SOURCES.map(source => http.get<SeasonCompetitionFile>(source.path));
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
          ...buildCwcSources(data.legacyConsts, collectNames(data.seasons, data.legacyProfiles['2024'] ?? []))
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

function buildSeasonSources(files: SeasonCompetitionFile[]): ParticipantHistorySource[] {
  return files.flatMap((file, index) => {
    const allowed = new Set(file.config.profiles);
    return SEASON_SOURCES[index].tournamentIds.flatMap(tournamentId =>
      file.profiles
        .filter(profile => allowed.has(profile.id))
        .map(profile => ({
          tournamentId,
          profileId: profile.id,
          participantName: profile.name,
          teamName: profile.teamName,
          logo: profile.logo
        }))
    );
  });
}

function buildRetroSources(tournaments: RetroTournament[]): ParticipantHistorySource[] {
  return tournaments.flatMap(tournament => tournament.standings.map(standing => ({
    tournamentId: tournament.id,
    participantId: standing.participantId,
    profileId: standing.profileId,
    participantName: standing.participantName,
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
      teamName: row.player.team.title,
      logo: profile?.logo || row.player.logo,
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
    logo: team.logo
  })));
}

function collectNames(files: SeasonCompetitionFile[], legacyProfiles: LocalProfile[]): Map<string, string> {
  return new Map([...legacyProfiles, ...files.flatMap(file => file.profiles)].map(profile => [profile.id, profile.name]));
}

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : 0;
}
