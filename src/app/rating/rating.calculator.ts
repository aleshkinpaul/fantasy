import { ParticipantProfile, ParticipantTournamentHistory } from '../models/participant-profile';
import { TournamentKind, TournamentTimelineGroup, TournamentTimelineItem } from '../models/tournament-catalog';
import {
  ParticipantRatingCell,
  ParticipantRatingRow,
  PowerRating,
  RatingSeasonGroup,
  RatingTournamentColumn,
} from './rating.models';

const FANTASY_WEIGHT = 0.4;
const PLACE_WEIGHT = 0.6;
const CONSISTENCY_BONUS = 0.4;
const MIN_SEASON_WEIGHT = 0.5;
const MIN_EXPERIENCE_FACTOR = 0.6;

const KIND_ORDER: Record<TournamentKind, number> = {
  'la-liga': 0,
  cup: 1,
  'champions-league': 2,
  summer: 3,
};

const KIND_WEIGHT: Record<TournamentKind, number> = {
  'la-liga': 1,
  'champions-league': 1,
  cup: 0.75,
  summer: 0.5,
};

export function calculatePowerRating(
  profiles: ParticipantProfile[],
  timeline: TournamentTimelineGroup[],
  includeLive: boolean,
): PowerRating {
  const tournaments = timeline.flatMap(group => group.tournaments)
    .filter(tournament => tournament.status !== 'scheduled')
    .sort((left, right) => right.yearStart - left.yearStart
      || KIND_ORDER[left.kind] - KIND_ORDER[right.kind]
      || left.title.localeCompare(right.title, 'ru'));
  const includedTournaments = tournaments.filter(tournament =>
    tournament.status === 'completed' || (includeLive && tournament.status === 'active'));
  const latestIncludedSeasons = Array.from(new Set(includedTournaments.map(item => item.yearStart)))
    .sort((left, right) => right - left);
  const seasonWeights = new Map(latestIncludedSeasons.map((year, index) => [
    year,
    Math.max(MIN_SEASON_WEIGHT, 1 - index * 0.1),
  ]));
  const historiesByTournament = new Map(tournaments.map(tournament => [
    tournament.id,
    profiles.map(profile => ({
      profile,
      history: profile.tournaments.find(item => item.tournamentId === tournament.id),
    })).filter((entry): entry is { profile: ParticipantProfile; history: ParticipantTournamentHistory } => Boolean(entry.history)),
  ]));
  const columns = tournaments.map(tournament => buildColumn(
    tournament,
    historiesByTournament.get(tournament.id) ?? [],
    seasonWeights.get(tournament.yearStart) ?? 0,
    includedTournaments.some(item => item.id === tournament.id),
  ));
  const tournamentMetrics = new Map(columns.map(column => [
    column.id,
    buildTournamentMetrics(historiesByTournament.get(column.id) ?? [], column),
  ]));
  const recentSeasonPair = latestIncludedSeasons.slice(0, 2);
  const maxCountedTournaments = Math.max(1, ...profiles.map(profile =>
    countIncludedTournaments(profile.participantId, columns, tournamentMetrics)));
  const rows = profiles.map(profile => buildParticipantRow(
    profile,
    columns,
    tournamentMetrics,
    recentSeasonPair,
    maxCountedTournaments,
  )).sort((left, right) =>
    right.rating - left.rating
    || right.countedTournaments - left.countedTournaments
    || left.name.localeCompare(right.name, 'ru'));

  applyRanks(rows);
  return {
    includeLive,
    columns,
    seasons: buildSeasonGroups(columns),
    rows,
    countedTournaments: includedTournaments.length,
    latestIncludedSeasons,
  };
}

function buildColumn(
  tournament: TournamentTimelineItem,
  entries: Array<{ profile: ParticipantProfile; history: ParticipantTournamentHistory }>,
  seasonWeight: number,
  included: boolean,
): RatingTournamentColumn {
  return {
    id: tournament.id,
    title: tournament.title,
    shortLabel: tournament.shortLabel,
    period: tournament.period,
    yearStart: tournament.yearStart,
    kind: tournament.kind,
    route: tournament.route,
    status: tournament.status,
    isLive: tournament.status === 'active',
    included,
    seasonWeight: included ? seasonWeight : 0,
    kindWeight: KIND_WEIGHT[tournament.kind],
    participantCount: entries.length,
  };
}

function buildTournamentMetrics(
  entries: Array<{ profile: ParticipantProfile; history: ParticipantTournamentHistory }>,
  column: RatingTournamentColumn,
): Map<string, ParticipantRatingCell> {
  const scoreEntries = entries.filter(entry => Number.isFinite(entry.history.stats?.totalScore));
  const fantasyRanks = rankValues(scoreEntries.map(entry => ({
    id: entry.profile.participantId,
    value: entry.history.stats!.totalScore,
  })));
  const competitorCount = Math.max(entries.length, scoreEntries.length);

  return new Map(entries.map(({ profile, history }) => {
    const totalScore = history.stats?.totalScore;
    const fantasyRank = fantasyRanks.get(profile.participantId);
    const officialPlace = getOfficialPlace(history);
    const fantasyIndex = fantasyRank === undefined ? undefined : normalizedRank(fantasyRank, scoreEntries.length);
    const placeIndex = officialPlace === undefined ? undefined : normalizedRank(officialPlace, competitorCount);
    const tournamentPower = fantasyIndex === undefined
      ? undefined
      : placeIndex === undefined
        ? fantasyIndex
        : fantasyIndex * FANTASY_WEIGHT + placeIndex * PLACE_WEIGHT;
    return [profile.participantId, {
      tournamentId: column.id,
      totalScore,
      officialPlace,
      fantasyRank,
      fantasyIndex,
      placeIndex,
      tournamentPower,
      included: column.included && tournamentPower !== undefined,
    }];
  }));
}

function buildParticipantRow(
  profile: ParticipantProfile,
  columns: RatingTournamentColumn[],
  metrics: Map<string, Map<string, ParticipantRatingCell>>,
  recentSeasonPair: number[],
  maxCountedTournaments: number,
): ParticipantRatingRow {
  const cells = Object.fromEntries(columns.flatMap(column => {
    const cell = metrics.get(column.id)?.get(profile.participantId);
    return cell ? [[column.id, cell]] : [];
  }));
  const countedCells = columns.flatMap(column => {
    const cell = cells[column.id];
    return cell?.included ? [{ cell, column }] : [];
  });
  const weightTotal = countedCells.reduce((sum, item) =>
    sum + item.column.seasonWeight * item.column.kindWeight, 0);
  const weightedPower = weightTotal
    ? countedCells.reduce((sum, item) =>
      sum + item.cell.tournamentPower! * item.column.seasonWeight * item.column.kindWeight, 0) / weightTotal
    : 0;
  const activeYears = new Set(countedCells.map(item => item.column.yearStart));
  const consistencyBonus = recentSeasonPair.length === 2
    && recentSeasonPair.every(year => activeYears.has(year)) ? CONSISTENCY_BONUS : 0;
  const experienceFactor = countedCells.length
    ? MIN_EXPERIENCE_FACTOR
      + (1 - MIN_EXPERIENCE_FACTOR) * countedCells.length / maxCountedTournaments
    : MIN_EXPERIENCE_FACTOR;

  return {
    rank: 0,
    participantId: profile.participantId,
    profileId: profile.primaryProfileId,
    name: profile.name,
    teamName: profile.currentTeam?.teamName,
    logo: profile.currentTeam?.logo,
    rating: countedCells.length
      ? round(Math.min(10, Math.max(1, weightedPower * 10 * experienceFactor + consistencyBonus)), 2)
      : 0,
    experienceFactor: round(experienceFactor, 2),
    consistencyBonus,
    countedTournaments: countedCells.length,
    cells,
  };
}

function countIncludedTournaments(
  participantId: string,
  columns: RatingTournamentColumn[],
  metrics: Map<string, Map<string, ParticipantRatingCell>>,
): number {
  return columns.filter(column => metrics.get(column.id)?.get(participantId)?.included).length;
}

function getOfficialPlace(history: ParticipantTournamentHistory): number | undefined {
  const achievementPlace = history.achievements.length
    ? Math.min(...history.achievements.map(achievement => achievement.place))
    : undefined;
  return achievementPlace ?? history.stats?.place;
}

function rankValues(items: Array<{ id: string; value: number }>): Map<string, number> {
  const sorted = [...items].sort((left, right) => right.value - left.value || left.id.localeCompare(right.id));
  const ranks = new Map<string, number>();
  sorted.forEach((item, index) => {
    const previous = sorted[index - 1];
    ranks.set(item.id, index > 0 && previous.value === item.value ? ranks.get(previous.id)! : index + 1);
  });
  return ranks;
}

function normalizedRank(rank: number, count: number): number {
  if (count <= 1) return 1;
  const boundedRank = Math.min(Math.max(rank, 1), count);
  return 0.1 + 0.9 * (count - boundedRank) / (count - 1);
}

function buildSeasonGroups(columns: RatingTournamentColumn[]): RatingSeasonGroup[] {
  const groups = new Map<number, RatingSeasonGroup>();
  columns.forEach(column => {
    const group = groups.get(column.yearStart) ?? {
      period: column.period,
      yearStart: column.yearStart,
      columns: [],
    };
    group.columns.push(column);
    groups.set(column.yearStart, group);
  });
  return Array.from(groups.values()).sort((left, right) => right.yearStart - left.yearStart);
}

function applyRanks(rows: ParticipantRatingRow[]): void {
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    row.rank = index > 0 && previous.rating === row.rating ? previous.rank : index + 1;
  });
}

function round(value: number, digits: number): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}
