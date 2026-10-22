import type {
  CompetitionMatch,
  CompetitionStage,
} from '../competition/models/competition.models';
import type {
  MatchCenterHeadToHead,
  MatchCenterHeadToHeadMeeting,
  MatchCenterHeadToHeadStage,
  MatchHistoryIndex,
} from './match-center.models';
import { getOutcome, isCompletedMatch } from './form-calculator';

export interface HeadToHeadCalculationInput {
  firstProfileId: string;
  secondProfileId: string;
  targetTour: number;
  matchesByTour: Record<string | number, CompetitionMatch[]>;
  stages?: CompetitionStage[];
  historyIndex?: MatchHistoryIndex | null;
  targetStartsAt?: string;
  profileTitleById?: Record<string, string>;
  profileLogoById?: Record<string, string>;
}

export class HeadToHeadHistoryService {
  calculate(input: HeadToHeadCalculationInput): MatchCenterHeadToHead {
    const meetings = input.historyIndex
      ? this.getHistoricalMeetings(input)
      : this.getMeetings(input);
    const firstTotalScore = sum(meetings.map(meeting => meeting.firstScore));
    const secondTotalScore = sum(meetings.map(meeting => meeting.secondScore));

    return {
      firstProfileId: input.firstProfileId,
      secondProfileId: input.secondProfileId,
      matches: meetings.length,
      firstWins: meetings.filter(meeting => meeting.firstOutcome === 'win').length,
      draws: meetings.filter(meeting => meeting.firstOutcome === 'draw').length,
      secondWins: meetings.filter(meeting => meeting.firstOutcome === 'loss').length,
      firstTotalScore,
      secondTotalScore,
      firstAverageScore: roundOne(average(firstTotalScore, meetings.length)),
      secondAverageScore: roundOne(average(secondTotalScore, meetings.length)),
      biggestWin: [...meetings]
        .filter(meeting => meeting.firstOutcome !== 'draw')
        .sort((left, right) => getWinningMargin(right) - getWinningMargin(left))[0],
      recentMeetings: [...meetings].reverse(),
      stages: this.getStageBreakdown(meetings),
    };
  }

  private getMeetings(input: HeadToHeadCalculationInput): MatchCenterHeadToHeadMeeting[] {
    return Object.entries(input.matchesByTour)
      .map(([tour, matches]) => ({ tour: Number(tour), matches }))
      .filter(item => Number.isFinite(item.tour) && item.tour < input.targetTour)
      .sort((left, right) => left.tour - right.tour)
      .flatMap(({ tour, matches }) => matches
        .filter(match => isPair(match, input.firstProfileId, input.secondProfileId))
        .filter(isCompletedMatch)
        .map(match => this.toMeeting(match, tour, input)));
  }

  private getHistoricalMeetings(input: HeadToHeadCalculationInput): MatchCenterHeadToHeadMeeting[] {
    const index = input.historyIndex!;
    const firstParticipantId = index.participantIdByProfileId[input.firstProfileId]
      || `profile-${input.firstProfileId}`;
    const secondParticipantId = index.participantIdByProfileId[input.secondProfileId]
      || `profile-${input.secondProfileId}`;
    const targetTimestamp = parseStartTimestamp(input.targetStartsAt) ?? Number.POSITIVE_INFINITY;

    return index.records
      .filter(record => record.startsAtTimestamp < targetTimestamp)
      .filter(record => isParticipantPair(
        record.home.participantId,
        record.away.participantId,
        firstParticipantId,
        secondParticipantId,
      ))
      .sort((left, right) => left.startsAtTimestamp - right.startsAtTimestamp || left.id.localeCompare(right.id))
      .map(record => {
        const firstIsHome = record.home.participantId === firstParticipantId;
        const firstScore = firstIsHome ? record.homeScore : record.awayScore;
        const secondScore = firstIsHome ? record.awayScore : record.homeScore;
        return {
          id: record.id,
          tour: record.tour,
          stage: record.stage,
          tournamentId: record.tournamentId,
          tournamentTitle: record.tournamentTitle,
          tournamentIcon: record.tournamentIcon,
          season: record.season,
          startsAt: record.startsAt,
          homeProfileId: record.home.profileId,
          awayProfileId: record.away.profileId,
          homeTeamTitle: record.home.teamTitle,
          awayTeamTitle: record.away.teamTitle,
          homeTeamLogo: record.home.logo,
          awayTeamLogo: record.away.logo,
          firstTeamTitle: firstIsHome ? record.home.teamTitle : record.away.teamTitle,
          secondTeamTitle: firstIsHome ? record.away.teamTitle : record.home.teamTitle,
          homeScore: record.homeScore,
          awayScore: record.awayScore,
          firstScore,
          secondScore,
          firstOutcome: getOutcome(firstScore, secondScore, record.result, firstIsHome),
          result: record.result,
        };
      });
  }

  private toMeeting(
    match: CompetitionMatch,
    tour: number,
    input: HeadToHeadCalculationInput,
  ): MatchCenterHeadToHeadMeeting {
    const firstIsHome = match.home === input.firstProfileId;
    const homeScore = Number(match.home_score);
    const awayScore = Number(match.away_score);
    const firstScore = firstIsHome ? homeScore : awayScore;
    const secondScore = firstIsHome ? awayScore : homeScore;
    return {
      id: `current:${tour}:${match.home}:${match.away}`,
      tour,
      stage: resolveStageName(input.stages, tour),
      tournamentId: 'current',
      tournamentTitle: 'Текущий турнир',
      tournamentIcon: '',
      season: '',
      startsAt: '',
      homeProfileId: match.home,
      awayProfileId: match.away,
      homeTeamTitle: input.profileTitleById?.[match.home] || match.home,
      awayTeamTitle: input.profileTitleById?.[match.away] || match.away,
      homeTeamLogo: input.profileLogoById?.[match.home] || 'assets/logos/default.png',
      awayTeamLogo: input.profileLogoById?.[match.away] || 'assets/logos/default.png',
      firstTeamTitle: input.profileTitleById?.[input.firstProfileId] || input.firstProfileId,
      secondTeamTitle: input.profileTitleById?.[input.secondProfileId] || input.secondProfileId,
      homeScore,
      awayScore,
      firstScore,
      secondScore,
      firstOutcome: getOutcome(firstScore, secondScore, match.result, firstIsHome),
      result: match.result ?? (homeScore === awayScore ? 0 : homeScore > awayScore ? 1 : 2),
    };
  }

  private getStageBreakdown(meetings: MatchCenterHeadToHeadMeeting[]): MatchCenterHeadToHeadStage[] {
    const byStage = new Map<string, { label: string; meetings: MatchCenterHeadToHeadMeeting[] }>();
    meetings.forEach(meeting => {
      const key = `${meeting.tournamentId}:${meeting.stage}`;
      const existing = byStage.get(key);
      byStage.set(key, {
        label: meeting.tournamentId === 'current'
          ? meeting.stage
          : `${meeting.tournamentTitle} · ${meeting.stage}`,
        meetings: [...(existing?.meetings || []), meeting],
      });
    });
    return [...byStage.values()].map(({ label, meetings: stageMeetings }) => ({
      stage: label,
      matches: stageMeetings.length,
      firstWins: stageMeetings.filter(meeting => meeting.firstOutcome === 'win').length,
      draws: stageMeetings.filter(meeting => meeting.firstOutcome === 'draw').length,
      secondWins: stageMeetings.filter(meeting => meeting.firstOutcome === 'loss').length,
    }));
  }
}

function isParticipantPair(
  homeParticipantId: string,
  awayParticipantId: string,
  firstParticipantId: string,
  secondParticipantId: string,
): boolean {
  return (homeParticipantId === firstParticipantId && awayParticipantId === secondParticipantId)
    || (homeParticipantId === secondParticipantId && awayParticipantId === firstParticipantId);
}

function isPair(match: CompetitionMatch, firstId: string, secondId: string): boolean {
  return (match.home === firstId && match.away === secondId)
    || (match.home === secondId && match.away === firstId);
}

function resolveStageName(stages: CompetitionStage[] | undefined, tour: number): string {
  return stages?.find(stage => tour >= stage.firstTour && tour <= stage.lastTour)?.name || 'Турнир';
}

function getWinningMargin(meeting: MatchCenterHeadToHeadMeeting): number {
  return Math.abs(meeting.firstScore - meeting.secondScore);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function average(total: number, count: number): number {
  return count ? total / count : 0;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function parseStartTimestamp(value?: string): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(normalizeStartAt(value));
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function normalizeStartAt(value: string): string {
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(value)) return value;
  return `${value.replace(' ', 'T')}+03:00`;
}
