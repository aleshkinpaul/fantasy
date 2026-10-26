import type {
  CompetitionCup,
  CompetitionMatch,
} from '../models/competition.models';

export type CupBracketLane = 'qualification' | 'upper' | 'lower' | 'grand-final';
export type CupBracketOutcome = 'winner' | 'loser';

export interface CupBracketMatchSource {
  kind: 'match';
  round: number;
  match: number;
  outcome: CupBracketOutcome;
}

export interface CupBracketProfileSource {
  kind: 'profile';
  profileId: string;
}

export type CupBracketSource = CupBracketMatchSource | CupBracketProfileSource;

export interface CupBracketTemplateMatch {
  home: CupBracketMatchSource;
  away: CupBracketMatchSource;
  type: 'up' | 'down';
}

export interface CupBracketSlotView {
  profileId?: string;
  placeholder: string;
}

export interface CupBracketNodeView {
  id: string;
  roundIndex: number;
  matchIndex: number;
  pairNumber: number;
  tour: number;
  roundTitle: string;
  lane: CupBracketLane;
  laneLabel: string;
  home: CupBracketSlotView;
  away: CupBracketSlotView;
  match?: CompetitionMatch;
  x: number;
  y: number;
}

export interface CupBracketEdgeView {
  id: string;
  from: string;
  to: string;
  targetSlot: 'home' | 'away';
  outcome: CupBracketOutcome;
  path: string;
}

export interface CupBracketRoundView {
  index: number;
  title: string;
  tour: number;
  nodes: CupBracketNodeView[];
}

export interface CupBracketLaneGroupView {
  id: string;
  lane: CupBracketLane;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CupBracketViewModel {
  nodes: CupBracketNodeView[];
  edges: CupBracketEdgeView[];
  rounds: CupBracketRoundView[];
  laneGroups: CupBracketLaneGroupView[];
  width: number;
  height: number;
  cardWidth: number;
  cardHeight: number;
}

interface CupBracketNodeTemplate {
  roundIndex: number;
  matchIndex: number;
  lane: CupBracketLane;
  type: 'up' | 'down';
  home: CupBracketSource;
  away: CupBracketSource;
}

const CARD_WIDTH = 224;
const CARD_HEIGHT = 88;
const COLUMN_WIDTH = 296;
const CANVAS_PADDING_X = 36;
const CANVAS_PADDING_TOP = 96;
const LANE_STEP = 96;
const MAX_LANE_MATCHES = 16;
const LANE_HEIGHT = MAX_LANE_MATCHES * LANE_STEP;
const LANE_GAP = 180;
const LOWER_LANE_START = CANVAS_PADDING_TOP + LANE_HEIGHT + LANE_GAP;

export function buildCupBracketViewModel(cup: CompetitionCup): CupBracketViewModel {
  if (cup.bracketFormat !== 'double-elimination-48-v1') {
    return emptyViewModel();
  }

  const templates = buildDoubleElimination48Templates(cup);
  const nodeById = new Map<string, CupBracketNodeView>();
  const templateById = new Map<string, CupBracketNodeTemplate>();
  const laneCountsByRound = countLanesByRound(templates);

  const nodes = templates.map(item => {
    const id = bracketNodeId(item.roundIndex, item.matchIndex);
    const laneMatches = templates.filter(candidate =>
      candidate.roundIndex === item.roundIndex && candidate.lane === item.lane,
    );
    const laneIndex = laneMatches.findIndex(candidate => candidate.matchIndex === item.matchIndex);
    const laneCount = laneCountsByRound.get(`${item.roundIndex}:${item.lane}`) || 1;
    const node: CupBracketNodeView = {
      id,
      roundIndex: item.roundIndex,
      matchIndex: item.matchIndex,
      pairNumber: laneIndex + 1,
      tour: cup.matchesTours[item.roundIndex],
      roundTitle: cup.matchesToursNames?.[item.roundIndex] || `${item.roundIndex + 1} этап`,
      lane: item.lane,
      laneLabel: laneLabel(item.lane),
      home: unresolvedSlot(item.home, cup),
      away: unresolvedSlot(item.away, cup),
      x: CANVAS_PADDING_X + item.roundIndex * COLUMN_WIDTH,
      y: nodeY(item.roundIndex, item.lane, laneIndex, laneCount),
    };
    nodeById.set(id, node);
    templateById.set(id, item);
    return node;
  });

  // Resolve in round order: every match source always points to an earlier round.
  nodes.forEach(node => {
    const template = templateById.get(node.id)!;
    node.home = resolveSlot(template.home, cup, nodeById);
    node.away = resolveSlot(template.away, cup, nodeById);
    const materialized = cup.matches[node.roundIndex]?.[node.matchIndex];
    if (materialized) {
      node.match = materialized;
      node.home = { profileId: materialized.home, placeholder: '' };
      node.away = { profileId: materialized.away, placeholder: '' };
    } else if (node.home.profileId && node.away.profileId) {
      node.match = {
        home: node.home.profileId,
        away: node.away.profileId,
        type: template.type,
      };
    }
  });

  const edges = templates.flatMap(template => {
    const target = nodeById.get(bracketNodeId(template.roundIndex, template.matchIndex))!;
    return (['home', 'away'] as const).flatMap(targetSlot => {
      const source = template[targetSlot];
      if (source.kind !== 'match') return [];
      const from = nodeById.get(bracketNodeId(source.round, source.match));
      if (!from) return [];
      return [{
        id: `${from.id}:${source.outcome}:${target.id}:${targetSlot}`,
        from: from.id,
        to: target.id,
        targetSlot,
        outcome: source.outcome,
        path: connectorPath(from, target),
      } satisfies CupBracketEdgeView];
    });
  });

  const rounds = cup.matchesTours.map((tour, index) => ({
    index,
    title: cup.matchesToursNames?.[index] || `${index + 1} этап`,
    tour,
    nodes: nodes.filter(node => node.roundIndex === index),
  }));
  const laneGroups = buildLaneGroups(nodes);

  return {
    nodes,
    edges,
    rounds,
    laneGroups,
    width: CANVAS_PADDING_X * 2 + (cup.matchesTours.length - 1) * COLUMN_WIDTH + CARD_WIDTH,
    height: LOWER_LANE_START + LANE_HEIGHT + CANVAS_PADDING_TOP,
    cardWidth: CARD_WIDTH,
    cardHeight: CARD_HEIGHT,
  };
}

export function getDoubleElimination48RoundTemplate(
  roundIndex: number,
): CupBracketTemplateMatch[] | undefined {
  switch (roundIndex) {
    case 2:
      return Array.from({ length: 16 }, (_, index) => template(
        matchSource(0, 15 - index, 'loser'),
        matchSource(1, index, 'loser'),
        'down',
      ));
    case 3:
      return [
        ...pairWinners(1, 0, 8, 'up'),
        ...pairWinners(2, 0, 8, 'down'),
      ];
    case 4:
      return Array.from({ length: 8 }, (_, index) => template(
        matchSource(3, index ^ 1, 'loser'),
        matchSource(3, 8 + index, 'winner'),
        'down',
      ));
    case 5:
      return [
        ...pairWinners(3, 0, 4, 'up'),
        ...Array.from({ length: 4 }, (_, index) => template(
          matchSource(4, index * 2 + 1, 'winner'),
          matchSource(4, index * 2, 'winner'),
          'down',
        )),
      ];
    case 6: {
      const upperLosers = [2, 3, 0, 1];
      return upperLosers.map((upperMatch, index) => template(
        matchSource(5, 4 + index, 'winner'),
        matchSource(5, upperMatch, 'loser'),
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
        template(matchSource(7, 3, 'winner'), matchSource(7, 1, 'loser'), 'down'),
        template(matchSource(7, 2, 'winner'), matchSource(7, 0, 'loser'), 'down'),
      ];
    case 9:
      return [
        template(matchSource(7, 0, 'winner'), matchSource(7, 1, 'winner'), 'up'),
        template(matchSource(8, 0, 'winner'), matchSource(8, 1, 'winner'), 'down'),
      ];
    case 10:
      return [template(matchSource(9, 0, 'loser'), matchSource(9, 1, 'winner'), 'down')];
    case 11:
      return [template(matchSource(9, 0, 'winner'), matchSource(10, 0, 'winner'), 'up')];
    default:
      return undefined;
  }
}

export function bracketNodeId(round: number, match: number): string {
  return `r${round}-m${match}`;
}

function buildDoubleElimination48Templates(cup: CompetitionCup): CupBracketNodeTemplate[] {
  const qualification = (cup.draw?.qualificationPairs || []).map((match, matchIndex) => ({
    roundIndex: 0,
    matchIndex,
    lane: 'qualification' as const,
    type: 'up' as const,
    home: profileSource(match.home),
    away: profileSource(match.away),
  }));
  const upperFirstRound = (cup.draw?.seededAssignments || []).map((assignment, matchIndex) => ({
    roundIndex: 1,
    matchIndex,
    lane: 'upper' as const,
    type: 'up' as const,
    home: profileSource(assignment.seededProfileId),
    away: matchSource(0, assignment.qualificationMatch - 1, 'winner'),
  }));
  const laterRounds = cup.matchesTours.flatMap((_, roundIndex) => {
    if (roundIndex < 2) return [];
    const round = getDoubleElimination48RoundTemplate(roundIndex) || [];
    return round.map((match, matchIndex) => ({
      roundIndex,
      matchIndex,
      lane: laneFor(roundIndex, match.type),
      type: match.type,
      home: match.home,
      away: match.away,
    }));
  });
  return [...qualification, ...upperFirstRound, ...laterRounds];
}

function resolveSlot(
  source: CupBracketSource,
  cup: CompetitionCup,
  nodes: ReadonlyMap<string, CupBracketNodeView>,
): CupBracketSlotView {
  if (source.kind === 'profile') {
    return { profileId: source.profileId, placeholder: '' };
  }
  const sourceNode = nodes.get(bracketNodeId(source.round, source.match));
  const result = sourceNode?.match?.result;
  if (sourceNode?.match && result) {
    const winner = result === 1 ? sourceNode.match.home : sourceNode.match.away;
    const loser = result === 1 ? sourceNode.match.away : sourceNode.match.home;
    return {
      profileId: source.outcome === 'winner' ? winner : loser,
      placeholder: '',
    };
  }
  if (sourceNode) {
    const outcome = source.outcome === 'winner' ? 'Победитель' : 'Проигравший';
    const sourceLabel = sourceNode.lane === 'qualification'
      ? `${sourceNode.roundTitle}, пара ${sourceNode.pairNumber}`
      : `${sourceNode.roundTitle}, ${sourceNode.laneLabel.toLowerCase()}, пара ${sourceNode.pairNumber}`;
    return {
      placeholder: `${outcome}: ${sourceLabel}`,
    };
  }
  return unresolvedSlot(source, cup);
}

function unresolvedSlot(source: CupBracketSource, cup: CompetitionCup): CupBracketSlotView {
  if (source.kind === 'profile') return { profileId: source.profileId, placeholder: '' };
  const title = cup.matchesToursNames?.[source.round] || `${source.round + 1} этап`;
  const outcome = source.outcome === 'winner' ? 'Победитель' : 'Проигравший';
  return { placeholder: `${outcome}: ${title}, пара ${source.match + 1}` };
}

function countLanesByRound(templates: CupBracketNodeTemplate[]): Map<string, number> {
  return templates.reduce((result, item) => {
    const key = `${item.roundIndex}:${item.lane}`;
    result.set(key, (result.get(key) || 0) + 1);
    return result;
  }, new Map<string, number>());
}

function nodeY(roundIndex: number, lane: CupBracketLane, index: number, count: number): number {
  if (roundIndex <= 2) {
    const start = lane === 'lower' ? LOWER_LANE_START : CANVAS_PADDING_TOP;
    const spacing = LANE_HEIGHT / count;
    return start + spacing * index + (spacing - CARD_HEIGHT) / 2;
  }

  const layout = compactRoundLayout(roundIndex, lane);
  return layout.start + index * layout.step;
}

function compactRoundLayout(
  roundIndex: number,
  lane: CupBracketLane,
): { start: number; step: number } {
  const layouts: Record<number, Partial<Record<CupBracketLane, number>>> = {
    3: { upper: 104, lower: 972 },
    4: { lower: 972 },
    5: { upper: 150, lower: 640 },
    6: { lower: 640 },
    7: { upper: 220, lower: 540 },
    8: { lower: 540 },
    9: { upper: 300, lower: 540 },
    10: { lower: 540 },
    11: { 'grand-final': 420 },
  };
  return {
    start: layouts[roundIndex]?.[lane] ?? CANVAS_PADDING_TOP,
    step: LANE_STEP,
  };
}

function buildLaneGroups(nodes: CupBracketNodeView[]): CupBracketLaneGroupView[] {
  const groups = new Map<string, CupBracketNodeView[]>();
  nodes.forEach(node => {
    const key = `${node.roundIndex}:${node.lane}`;
    groups.set(key, [...(groups.get(key) || []), node]);
  });
  return [...groups.entries()].map(([id, groupNodes]) => {
    const first = groupNodes[0];
    const minY = Math.min(...groupNodes.map(node => node.y));
    const maxY = Math.max(...groupNodes.map(node => node.y));
    return {
      id,
      lane: first.lane,
      label: first.laneLabel,
      x: first.x - 12,
      y: Math.max(68, minY - 30),
      width: CARD_WIDTH + 24,
      height: maxY - minY + CARD_HEIGHT + 42,
    };
  });
}

function connectorPath(from: CupBracketNodeView, to: CupBracketNodeView): string {
  const x1 = from.x + CARD_WIDTH;
  const y1 = from.y + CARD_HEIGHT / 2;
  const x2 = to.x;
  const y2 = to.y + CARD_HEIGHT / 2;
  const bend = Math.max(52, (x2 - x1) * 0.42);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

function laneFor(roundIndex: number, type: 'up' | 'down'): CupBracketLane {
  if (roundIndex === 11) return 'grand-final';
  return type === 'up' ? 'upper' : 'lower';
}

function laneLabel(lane: CupBracketLane): string {
  switch (lane) {
    case 'qualification': return 'Отбор';
    case 'upper': return 'Верхняя сетка';
    case 'lower': return 'Нижняя сетка';
    case 'grand-final': return 'Гранд-финал';
  }
}

function pairWinners(
  round: number,
  offset: number,
  count: number,
  type: 'up' | 'down',
): CupBracketTemplateMatch[] {
  return Array.from({ length: count }, (_, index) => template(
    matchSource(round, offset + index * 2, 'winner'),
    matchSource(round, offset + index * 2 + 1, 'winner'),
    type,
  ));
}

function profileSource(profileId: string): CupBracketProfileSource {
  return { kind: 'profile', profileId };
}

function matchSource(
  round: number,
  match: number,
  outcome: CupBracketOutcome,
): CupBracketMatchSource {
  return { kind: 'match', round, match, outcome };
}

function template(
  home: CupBracketMatchSource,
  away: CupBracketMatchSource,
  type: 'up' | 'down',
): CupBracketTemplateMatch {
  return { home, away, type };
}

function emptyViewModel(): CupBracketViewModel {
  return {
    nodes: [],
    edges: [],
    rounds: [],
    laneGroups: [],
    width: 0,
    height: 0,
    cardWidth: CARD_WIDTH,
    cardHeight: CARD_HEIGHT,
  };
}
