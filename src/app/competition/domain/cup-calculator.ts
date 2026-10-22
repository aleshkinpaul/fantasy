import type { IRoster } from '../../models/domain';
import type {
  CompetitionCup,
  CompetitionMatch,
  CupMatchDecision,
  CupTieBreakValues,
  FantasyFullInfoResponse,
  SportPlayer,
} from '../models/competition.models';
import { resolveFantasyLineup } from './fantasy-lineup-resolver';
import { getPlaceAfterTour } from './standings-calculator';

interface CupProfile {
  id: string;
  results: {
    cup?: {
      fo: number;
      missed_fo: number;
      diff_fo: number;
      matchesPlayed: number;
      avg_diff_fo: number;
      diff_fo_arr: number[];
      standings: number[];
      lowest_winning_pos_diff: number | null;
    };
  };
}

export interface CupCalculationInput {
  cup: CompetitionCup;
  profiles: CupProfile[];
  squads: FantasyFullInfoResponse;
  lastTour: number;
  sportPlayers?: SportPlayer[];
}

interface BracketSource {
  round: number;
  match: number;
  outcome: 'winner' | 'loser';
}

interface BracketTemplateMatch {
  home: BracketSource;
  away: BracketSource;
  type: 'up' | 'down';
}

interface MatchAttempt {
  tour: number;
  homeScore: number;
  awayScore: number;
  result: 0 | 1 | 2;
  decidedBy?: CupMatchDecision;
  homeTieBreak?: CupTieBreakValues;
  awayTieBreak?: CupTieBreakValues;
}

export function calculateCup(input: CupCalculationInput): void {
  const { cup, profiles, squads, lastTour, sportPlayers = [] } = input;
  const currentRoundCount = cup.matchesTours.filter(tour => tour <= lastTour).length;
  const sportPlayersById = new Map(sportPlayers.map(player => [player.id, player]));

  profiles.forEach(profile => {
    profile.results.cup = {
      fo: 0,
      missed_fo: 0,
      diff_fo: 0,
      matchesPlayed: 0,
      avg_diff_fo: 0,
      diff_fo_arr: [],
      standings: [],
      lowest_winning_pos_diff: null,
    };
  });

  for (let roundIndex = 0; roundIndex < currentRoundCount; roundIndex++) {
    materializeRound(cup, roundIndex);
    const tour = cup.matchesTours[roundIndex];
    cup.matches[roundIndex].forEach(match => {
      const attempt = resolveMatchAttempt(cup, match, tour, lastTour, squads, sportPlayersById);
      applyAttempt(match, attempt);

      const homeProfile = profiles.find(profile => profile.id === match.home);
      const awayProfile = profiles.find(profile => profile.id === match.away);
      if (!homeProfile || !awayProfile) {
        throw new Error(`Не найдены профили кубкового матча ${match.home} — ${match.away}`);
      }

      const homeStanding = getPlaceAfterTour(squads, match.home, attempt.tour);
      const awayStanding = getPlaceAfterTour(squads, match.away, attempt.tour);
      updateCupProfile(homeProfile, attempt.homeScore, attempt.awayScore, homeStanding);
      updateCupProfile(awayProfile, attempt.awayScore, attempt.homeScore, awayStanding);

      if (match.result === 1) {
        updateLowestWinningDifference(homeProfile, homeStanding - awayStanding);
      }
      if (match.result === 2) {
        updateLowestWinningDifference(awayProfile, awayStanding - homeStanding);
      }
    });
  }

  // Publish the next resolvable round as soon as its participants are known.
  // Before tour 10 this also exposes the completed qualification draw.
  if (currentRoundCount < cup.matches.length) materializeRound(cup, currentRoundCount);
}

function resolveMatchAttempt(
  cup: CompetitionCup,
  match: CompetitionMatch,
  tour: number,
  lastTour: number,
  squads: FantasyFullInfoResponse,
  sportPlayers: ReadonlyMap<string, SportPlayer>,
): MatchAttempt {
  const firstAttempt = calculateAttempt(cup, match, tour, squads, sportPlayers);
  if (firstAttempt.result !== 0 || firstAttempt.decidedBy !== 'replay-required') return firstAttempt;

  match.replayTour = tour + 1;
  if (match.replayTour > lastTour) return firstAttempt;
  return calculateAttempt(cup, match, match.replayTour, squads, sportPlayers);
}

function calculateAttempt(
  cup: CompetitionCup,
  match: CompetitionMatch,
  tour: number,
  squads: FantasyFullInfoResponse,
  sportPlayers: ReadonlyMap<string, SportPlayer>,
): MatchAttempt {
  const homeScore = Number(squads.data.players[match.home].team.results_by_tour[tour].tour_score);
  const awayScore = Number(squads.data.players[match.away].team.results_by_tour[tour].tour_score);
  if (homeScore !== awayScore) {
    return {
      tour,
      homeScore,
      awayScore,
      result: homeScore > awayScore ? 1 : 2,
      decidedBy: 'fo',
    };
  }
  if (!cup.tieBreak || !sportPlayers.size) {
    return { tour, homeScore, awayScore, result: 0 };
  }

  const homeTieBreak = calculateTieBreak(match.home, tour, squads, sportPlayers);
  const awayTieBreak = calculateTieBreak(match.away, tour, squads, sportPlayers);
  for (const criterion of cup.tieBreak.criteria) {
    const key = tieBreakKey(criterion);
    if (homeTieBreak[key] === awayTieBreak[key]) continue;
    return {
      tour,
      homeScore,
      awayScore,
      result: homeTieBreak[key] > awayTieBreak[key] ? 1 : 2,
      decidedBy: criterion,
      homeTieBreak,
      awayTieBreak,
    };
  }
  return {
    tour,
    homeScore,
    awayScore,
    result: 0,
    decidedBy: 'replay-required',
    homeTieBreak,
    awayTieBreak,
  };
}

export function calculateTieBreak(
  profileId: string,
  tour: number,
  squads: FantasyFullInfoResponse,
  sportPlayers: ReadonlyMap<string, SportPlayer>,
): CupTieBreakValues {
  const roster = squads.data.players[profileId].team.rosters_by_tour[tour] as unknown as IRoster;
  const lineup = resolveFantasyLineup(roster, tour, sportPlayers, true);
  const captain = lineup.effectiveCaptainId
    ? lineup.players[lineup.effectiveCaptainId]?.displayFantasyScore ?? 0
    : 0;
  const excludedTopPlayers = new Set([roster.captain_id, roster.vice_captain_id].filter(Boolean));
  const eligibleTopPlayers = roster.players.base
    .map(playerId => lineup.players[playerId])
    .filter(player => player?.isPlayed && !excludedTopPlayers.has(player.id));
  const topNonCaptain = eligibleTopPlayers.length
    ? Math.max(...eligibleTopPlayers.map(player => player.fantasyScore ?? 0))
    : 0;
  const startingPlayers = roster.players.base
    .filter(playerId => lineup.players[playerId]?.isPlayed)
    .length;
  const bench = roster.players.bench
    .reduce((sum, playerId) => sum + (lineup.players[playerId]?.fantasyScore ?? 0), 0);

  return { captain, topNonCaptain, startingPlayers, bench };
}

function tieBreakKey(
  criterion: 'captain' | 'top-non-captain' | 'starting-players' | 'bench',
): keyof CupTieBreakValues {
  switch (criterion) {
    case 'captain': return 'captain';
    case 'top-non-captain': return 'topNonCaptain';
    case 'starting-players': return 'startingPlayers';
    case 'bench': return 'bench';
  }
}

function applyAttempt(match: CompetitionMatch, attempt: MatchAttempt): void {
  match.home_score = attempt.homeScore;
  match.away_score = attempt.awayScore;
  match.result = attempt.result;
  match.decidingTour = attempt.tour;
  match.decidedBy = attempt.decidedBy;
  match.homeTieBreak = attempt.homeTieBreak;
  match.awayTieBreak = attempt.awayTieBreak;
}

function materializeRound(cup: CompetitionCup, roundIndex: number): void {
  if (cup.matches[roundIndex].length || cup.bracketFormat !== 'double-elimination-48-v1') return;
  if (roundIndex === 0) {
    if (cup.draw?.qualificationPairs.length === 16) {
      cup.matches[0] = cup.draw.qualificationPairs.map(match => ({ ...match, type: 'up' }));
    }
    return;
  }
  if (roundIndex === 1) {
    if (cup.draw?.seededAssignments.length !== 16) return;
    const matches = cup.draw.seededAssignments.map(assignment => {
      const qualifier = resolveSource(cup, source(0, assignment.qualificationMatch - 1, 'winner'));
      return qualifier
        ? { home: assignment.seededProfileId, away: qualifier, type: 'up' as const }
        : undefined;
    });
    if (matches.every(Boolean)) cup.matches[1] = matches as CompetitionMatch[];
    return;
  }

  const templates = getDoubleElimination48RoundTemplate(roundIndex);
  if (!templates) return;
  const matches = templates.map(item => {
    const home = resolveSource(cup, item.home);
    const away = resolveSource(cup, item.away);
    return home && away ? { home, away, type: item.type } : undefined;
  });
  if (matches.every(Boolean)) cup.matches[roundIndex] = matches as CompetitionMatch[];
}

function resolveSource(cup: CompetitionCup, ref: BracketSource): string | undefined {
  const match = cup.matches[ref.round]?.[ref.match];
  if (!match || match.result === undefined || match.result === 0) return undefined;
  const winner = match.result === 1 ? match.home : match.away;
  const loser = match.result === 1 ? match.away : match.home;
  return ref.outcome === 'winner' ? winner : loser;
}

export function getDoubleElimination48RoundTemplate(
  roundIndex: number,
): BracketTemplateMatch[] | undefined {
  switch (roundIndex) {
    case 2:
      return Array.from({ length: 16 }, (_, index) => template(
        source(0, 15 - index, 'loser'),
        source(1, index, 'loser'),
        'down',
      ));
    case 3:
      return [
        ...pairWinners(1, 0, 8, 'up'),
        ...pairWinners(2, 0, 8, 'down'),
      ];
    case 4:
      return Array.from({ length: 8 }, (_, index) => template(
        source(3, index ^ 1, 'loser'),
        source(3, 8 + index, 'winner'),
        'down',
      ));
    case 5:
      return [
        ...pairWinners(3, 0, 4, 'up'),
        ...Array.from({ length: 4 }, (_, index) => template(
          source(4, index * 2 + 1, 'winner'),
          source(4, index * 2, 'winner'),
          'down',
        )),
      ];
    case 6: {
      const upperLosers = [2, 3, 0, 1];
      return upperLosers.map((upperMatch, index) => template(
        source(5, 4 + index, 'winner'),
        source(5, upperMatch, 'loser'),
        'down',
      ));
    }
    case 7:
      return [
        ...pairWinners(5, 0, 2, 'up'),
        ...pairWinners(6, 0, 2, 'down'),
      ];
    case 8:
      return [
        template(source(7, 3, 'winner'), source(7, 1, 'loser'), 'down'),
        template(source(7, 2, 'winner'), source(7, 0, 'loser'), 'down'),
      ];
    case 9:
      return [
        template(source(7, 0, 'winner'), source(7, 1, 'winner'), 'up'),
        template(source(8, 0, 'winner'), source(8, 1, 'winner'), 'down'),
      ];
    case 10:
      return [template(source(9, 0, 'loser'), source(9, 1, 'winner'), 'down')];
    case 11:
      return [template(source(9, 0, 'winner'), source(10, 0, 'winner'), 'up')];
    default:
      return undefined;
  }
}

function pairWinners(
  round: number,
  offset: number,
  count: number,
  type: 'up' | 'down',
): BracketTemplateMatch[] {
  return Array.from({ length: count }, (_, index) => template(
    source(round, offset + index * 2, 'winner'),
    source(round, offset + index * 2 + 1, 'winner'),
    type,
  ));
}

function source(round: number, match: number, outcome: 'winner' | 'loser'): BracketSource {
  return { round, match, outcome };
}

function template(
  home: BracketSource,
  away: BracketSource,
  type: 'up' | 'down',
): BracketTemplateMatch {
  return { home, away, type };
}

function updateCupProfile(profile: CupProfile, ownFo: number, opponentFo: number, standing: number): void {
  const result = profile.results.cup!;
  result.fo += ownFo;
  result.missed_fo += opponentFo;
  result.diff_fo = result.fo - result.missed_fo;
  result.diff_fo_arr.push(ownFo - opponentFo);
  result.matchesPlayed += 1;
  result.standings.push(standing);
  if (result.matchesPlayed > 3) {
    result.avg_diff_fo = Math.round(result.diff_fo / result.matchesPlayed * 100) / 100;
  }
}

function updateLowestWinningDifference(profile: CupProfile, difference: number): void {
  const result = profile.results.cup!;
  if (result.lowest_winning_pos_diff === null) result.lowest_winning_pos_diff = difference;
  result.lowest_winning_pos_diff = Math.max(result.lowest_winning_pos_diff, difference);
}
