import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, combineLatest, map, shareReplay } from 'rxjs';

import {
  AchievementParticipant,
  AchievementPlace,
  AchievementRecipientSnapshot,
  AchievementRegistry,
  AchievementTitleType,
  HallChampion,
  HallLeader,
  HallOfFame,
  HallPlacement,
  HallSeason,
  HallStage,
  HallTournament,
  TournamentPlacement
} from '../models/achievement';
import { TournamentTimelineGroup, TournamentTimelineItem } from '../models/tournament-catalog';
import { TournamentCatalogService } from './tournament-catalog.service';

const ACHIEVEMENTS_URL = '/assets/data/achievements.json';

export const TITLE_TYPE_LABELS: Record<AchievementTitleType, string> = {
  'la-liga-primera': 'Ла Лига / Примера',
  'la-liga-segunda': 'Ла Лига / Сегунда',
  cup: 'Кубок',
  'champions-league': 'Лига чемпионов',
  'world-cup': 'Чемпионат мира',
  'club-world-cup': 'Клубный чемпионат мира'
};

const TITLE_TYPE_ORDER: Record<AchievementTitleType, number> = {
  'la-liga-primera': 0,
  'la-liga-segunda': 1,
  cup: 2,
  'champions-league': 3,
  'world-cup': 4,
  'club-world-cup': 5
};

@Injectable({ providedIn: 'root' })
export class AchievementService {
  private readonly hall$: Observable<HallOfFame>;

  constructor(http: HttpClient, catalogService: TournamentCatalogService) {
    this.hall$ = combineLatest([
      http.get<unknown>(ACHIEVEMENTS_URL),
      catalogService.loadTimeline()
    ]).pipe(
      map(([registry, timeline]) => buildHallOfFame(registry, timeline)),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  loadHallOfFame(): Observable<HallOfFame> {
    return this.hall$;
  }
}

export function buildHallOfFame(
  registryValue: unknown,
  timeline: TournamentTimelineGroup[]
): HallOfFame {
  const tournaments = timeline.flatMap(group => group.tournaments);
  const registry = validateAchievementRegistry(registryValue, tournaments);
  const participants = new Map(registry.participants.map(participant => [participant.id, participant]));
  const placementsByTournament = groupBy(registry.placements, placement => placement.tournamentId);

  const seasons: HallSeason[] = timeline
    .map(group => ({
      period: group.period,
      yearStart: group.yearStart,
      tournaments: group.tournaments
        .filter(tournament => tournament.status === 'completed')
        .map(tournament => buildTournament(tournament, placementsByTournament.get(tournament.id) ?? [], participants))
        .filter(tournament => tournament.stages.length > 0)
    }))
    .filter(season => season.tournaments.length > 0);

  const hallPlacements = seasons.flatMap(season =>
    season.tournaments.flatMap(tournament => tournament.stages.flatMap(stage => stage.placements))
  );
  const stages = seasons.flatMap(season =>
    season.tournaments.flatMap(tournament => tournament.stages)
  );

  return {
    seasons,
    leaders: buildLeaders(registry, participants),
    currentChampions: buildCurrentChampions(seasons),
    summary: {
      competitions: stages.length,
      champions: hallPlacements.filter(placement => placement.place === 1).length,
      podiumEntries: hallPlacements.length,
      participants: new Set(registry.placements.flatMap(placement =>
        placement.recipient.members.map(member => member.participantId)
      )).size
    },
    periods: seasons.map(season => season.period)
  };
}

export function validateAchievementRegistry(
  value: unknown,
  tournaments: TournamentTimelineItem[]
): AchievementRegistry {
  if (!isRecord(value) || value['version'] !== 1) {
    throw new Error('Achievement registry must be an object with version 1');
  }
  if (!Array.isArray(value['participants']) || !Array.isArray(value['placements'])) {
    throw new Error('Achievement registry must contain participants and placements arrays');
  }

  const participantIds = new Set<string>();
  const profileOwners = new Map<string, string>();
  const participants = value['participants'].map((item, index) =>
    validateParticipant(item, index, participantIds, profileOwners)
  );
  const participantMap = new Map(participants.map(participant => [participant.id, participant]));
  const tournamentMap = new Map(tournaments.map(tournament => [tournament.id, tournament]));
  const placementKeys = new Set<string>();
  const placements = value['placements'].map((item, index) =>
    validatePlacement(item, index, tournamentMap, participantMap, placementKeys)
  );

  const completedIds = tournaments
    .filter(tournament => tournament.status === 'completed')
    .map(tournament => tournament.id);
  const representedIds = new Set(placements.map(placement => placement.tournamentId));
  const missing = completedIds.filter(id => !representedIds.has(id));
  if (missing.length > 0) {
    throw new Error(`Achievement registry has no placements for completed tournaments: ${missing.join(', ')}`);
  }

  return { version: 1, participants, placements };
}

function buildTournament(
  tournament: TournamentTimelineItem,
  placements: TournamentPlacement[],
  participants: Map<string, AchievementParticipant>
): HallTournament {
  const stageGroups = groupBy(placements, placement => placement.stageId);
  const stages: HallStage[] = Array.from(stageGroups.values())
    .map(stagePlacements => {
      const first = stagePlacements[0];
      return {
        id: first.stageId,
        title: first.stageTitle,
        titleType: first.titleType,
        titleTypeLabel: TITLE_TYPE_LABELS[first.titleType],
        placements: stagePlacements
          .map(placement => resolvePlacement(placement, participants))
          .sort((left, right) => left.place - right.place || left.displayName.localeCompare(right.displayName, 'ru'))
      };
    })
    .sort((left, right) => TITLE_TYPE_ORDER[left.titleType] - TITLE_TYPE_ORDER[right.titleType]);

  return { tournament, stages };
}

function resolvePlacement(
  placement: TournamentPlacement,
  participants: Map<string, AchievementParticipant>
): HallPlacement {
  const memberNames = placement.recipient.members.map(member => participants.get(member.participantId)!.name);
  const isTeam = placement.recipient.type === 'team';

  return {
    ...placement,
    displayName: isTeam ? placement.recipient.label : memberNames[0],
    teamName: isTeam ? '' : placement.recipient.label,
    memberNames
  };
}

function buildLeaders(
  registry: AchievementRegistry,
  participants: Map<string, AchievementParticipant>
): HallLeader[] {
  const leaders = new Map<string, HallLeader>();

  registry.placements.forEach(placement => {
    placement.recipient.members.forEach(member => {
      const leader = leaders.get(member.participantId) ?? {
        participantId: member.participantId,
        name: participants.get(member.participantId)!.name,
        championships: 0,
        finals: 0,
        podiums: 0
      };
      leader.podiums += 1;
      if (placement.place <= 2) leader.finals += 1;
      if (placement.place === 1) leader.championships += 1;
      leaders.set(member.participantId, leader);
    });
  });

  return Array.from(leaders.values()).sort((left, right) =>
    right.championships - left.championships ||
    right.finals - left.finals ||
    right.podiums - left.podiums ||
    left.name.localeCompare(right.name, 'ru')
  );
}

function buildCurrentChampions(seasons: HallSeason[]): HallChampion[] {
  const champions = new Map<AchievementTitleType, HallChampion[]>();

  seasons.forEach(season => {
    season.tournaments.forEach(tournament => {
      tournament.stages.forEach(stage => {
        const winners = stage.placements.filter(placement => placement.place === 1);
        if (winners.length === 0 || champions.has(stage.titleType)) return;
        champions.set(stage.titleType, winners.map(placement => ({
          titleType: stage.titleType,
          titleTypeLabel: stage.titleTypeLabel,
          period: season.period,
          tournamentTitle: tournament.tournament.title,
          tournamentRoute: tournament.tournament.route,
          placement
        })));
      });
    });
  });

  return Array.from(champions.entries())
    .sort(([left], [right]) => TITLE_TYPE_ORDER[left] - TITLE_TYPE_ORDER[right])
    .flatMap(([, entries]) => entries);
}

function validateParticipant(
  value: unknown,
  index: number,
  participantIds: Set<string>,
  profileOwners: Map<string, string>
): AchievementParticipant {
  if (!isRecord(value)) throw new Error(`Achievement participant ${index} must be an object`);
  const id = requiredString(value['id'], `Achievement participant ${index} id`);
  if (participantIds.has(id)) throw new Error(`Achievement registry contains duplicate participant "${id}"`);
  participantIds.add(id);

  if (!Array.isArray(value['profileIds']) || value['profileIds'].length === 0) {
    throw new Error(`Achievement participant "${id}" must have profileIds`);
  }
  const profileIds = value['profileIds'].map((profileId, profileIndex) =>
    requiredString(profileId, `Achievement participant "${id}" profileIds[${profileIndex}]`)
  );
  profileIds.forEach(profileId => {
    const owner = profileOwners.get(profileId);
    if (owner) throw new Error(`Profile "${profileId}" belongs to both "${owner}" and "${id}"`);
    profileOwners.set(profileId, id);
  });

  return { id, name: requiredString(value['name'], `Achievement participant "${id}" name`), profileIds };
}

function validatePlacement(
  value: unknown,
  index: number,
  tournaments: Map<string, TournamentTimelineItem>,
  participants: Map<string, AchievementParticipant>,
  placementKeys: Set<string>
): TournamentPlacement {
  if (!isRecord(value)) throw new Error(`Tournament placement ${index} must be an object`);
  const tournamentId = requiredString(value['tournamentId'], `Tournament placement ${index} tournamentId`);
  const tournament = tournaments.get(tournamentId);
  if (!tournament) throw new Error(`Tournament placement ${index} references unknown tournament "${tournamentId}"`);
  if (tournament.status !== 'completed') {
    throw new Error(`Tournament placement ${index} references unfinished tournament "${tournamentId}"`);
  }

  const stageId = requiredString(value['stageId'], `Tournament placement ${index} stageId`);
  const stageTitle = requiredString(value['stageTitle'], `Tournament placement ${index} stageTitle`);
  const titleType = requiredString(value['titleType'], `Tournament placement ${index} titleType`);
  if (!isTitleType(titleType)) throw new Error(`Tournament placement ${index} has invalid titleType "${titleType}"`);
  const place = value['place'];
  if (place !== 1 && place !== 2 && place !== 3) {
    throw new Error(`Tournament placement ${index} has invalid place`);
  }
  const recipient = validateRecipient(value['recipient'], index, participants);
  const key = `${tournamentId}:${stageId}:${place}:${recipient.id}`;
  if (placementKeys.has(key)) throw new Error(`Achievement registry contains duplicate placement "${key}"`);
  placementKeys.add(key);

  return { tournamentId, stageId, stageTitle, titleType, place: place as AchievementPlace, recipient };
}

function validateRecipient(
  value: unknown,
  placementIndex: number,
  participants: Map<string, AchievementParticipant>
): AchievementRecipientSnapshot {
  if (!isRecord(value)) throw new Error(`Tournament placement ${placementIndex} recipient must be an object`);
  const id = requiredString(value['id'], `Tournament placement ${placementIndex} recipient id`);
  const type = value['type'];
  if (type !== 'participant' && type !== 'team') {
    throw new Error(`Tournament placement ${placementIndex} recipient has invalid type`);
  }
  if (!Array.isArray(value['members']) || value['members'].length === 0) {
    throw new Error(`Tournament placement ${placementIndex} recipient must have members`);
  }
  if (type === 'participant' && value['members'].length !== 1) {
    throw new Error(`Tournament placement ${placementIndex} participant recipient must have one member`);
  }

  const memberIds = new Set<string>();
  const members = value['members'].map((member, memberIndex) => {
    if (!isRecord(member)) {
      throw new Error(`Tournament placement ${placementIndex} member ${memberIndex} must be an object`);
    }
    const participantId = requiredString(member['participantId'], `Tournament placement ${placementIndex} member participantId`);
    const profileId = requiredString(member['profileId'], `Tournament placement ${placementIndex} member profileId`);
    const participant = participants.get(participantId);
    if (!participant) throw new Error(`Tournament placement ${placementIndex} references unknown participant "${participantId}"`);
    if (!participant.profileIds.includes(profileId)) {
      throw new Error(`Profile "${profileId}" does not belong to participant "${participantId}"`);
    }
    if (memberIds.has(participantId)) {
      throw new Error(`Tournament placement ${placementIndex} repeats participant "${participantId}"`);
    }
    memberIds.add(participantId);
    return { participantId, profileId };
  });

  return {
    id,
    type,
    label: requiredString(value['label'], `Tournament placement ${placementIndex} recipient label`),
    logo: requiredAssetPath(value['logo'], `Tournament placement ${placementIndex} recipient logo`),
    members
  };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  items.forEach(item => result.set(key(item), [...(result.get(key(item)) ?? []), item]));
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${field} is invalid`);
  return value.trim();
}

function requiredAssetPath(value: unknown, field: string): string {
  const path = requiredString(value, field);
  if (!path.startsWith('assets/')) throw new Error(`${field} must start with "assets/"`);
  return path;
}

function isTitleType(value: string): value is AchievementTitleType {
  return Object.prototype.hasOwnProperty.call(TITLE_TYPE_LABELS, value);
}
