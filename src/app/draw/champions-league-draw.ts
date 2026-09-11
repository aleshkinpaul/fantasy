export interface ChampionsLeagueDrawMatch {
  home: string;
  away: string;
}

export interface ChampionsLeagueDrawRound {
  number: number;
  matches: ChampionsLeagueDrawMatch[];
}

export interface ChampionsLeagueDrawResult {
  rounds: ChampionsLeagueDrawRound[];
  opponentsByProfile: Record<string, string[]>;
}

export function formatCompetitionMatches(result: ChampionsLeagueDrawResult): string {
  const matches = Object.fromEntries(result.rounds.map(round => [
    String(round.number),
    round.matches.map(match => ({ home: match.home, away: match.away })),
  ]));
  return JSON.stringify({ matches }, null, 2);
}

type RandomSource = () => number;

const POTS_COUNT = 4;
const OPPONENTS_FROM_EACH_POT = 2;
const CROSS_POT_PATTERNS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

/**
 * Generates the eight-round Champions League league-phase draw.
 *
 * Every profile gets two unique opponents from each of the four pots,
 * including its own pot, and appears exactly once in every round.
 */
export function drawChampionsLeague(
  pots: readonly (readonly string[])[],
  random: RandomSource = Math.random,
): ChampionsLeagueDrawResult {
  validatePots(pots);

  const shuffledPots = pots.map(pot => shuffle(pot, random));
  const crossPotRounds: ChampionsLeagueDrawMatch[][] = Array.from({ length: 6 }, () => []);

  CROSS_POT_PATTERNS.forEach((pattern, patternIndex) => {
    pattern.forEach(([firstPotIndex, secondPotIndex]) => {
      const [firstMatching, secondMatching] = buildCrossPotMatchings(
        shuffledPots[firstPotIndex],
        shuffledPots[secondPotIndex],
        random,
      );
      crossPotRounds[patternIndex].push(...firstMatching);
      crossPotRounds[patternIndex + CROSS_POT_PATTERNS.length].push(...secondMatching);
    });
  });

  const samePotRounds: ChampionsLeagueDrawMatch[][] = [[], []];
  shuffledPots.forEach(pot => {
    const [firstMatching, secondMatching] = buildSamePotMatchings(pot, random);
    samePotRounds[0].push(...firstMatching);
    samePotRounds[1].push(...secondMatching);
  });

  const roundMatches = shuffle(
    mixRoundMatchings([...crossPotRounds, ...samePotRounds], pots, random),
    random,
  );
  const rounds = roundMatches.map((matches, index) => ({
    number: index + 1,
    matches: shuffle(matches, random).map(match => orientMatch(match, random)),
  }));
  const opponentsByProfile = collectOpponents(rounds, pots.flat());

  assertDrawIntegrity(rounds, opponentsByProfile, pots);
  return { rounds, opponentsByProfile };
}

/**
 * Re-colours alternating cycles shared by pairs of rounds. Every exchange
 * keeps both rounds as perfect matchings while breaking up the original
 * pot-to-pot round pattern into a more varied schedule.
 */
function mixRoundMatchings(
  sourceRounds: readonly (readonly ChampionsLeagueDrawMatch[])[],
  pots: readonly (readonly string[])[],
  random: RandomSource,
): ChampionsLeagueDrawMatch[][] {
  const rounds = sourceRounds.map(matches => [...matches]);
  const potByProfile = new Map<string, number>();
  pots.forEach((pot, potIndex) => pot.forEach(profileId => potByProfile.set(profileId, potIndex)));

  let bestRounds = rounds.map(matches => [...matches]);
  let bestScore = roundVarietyScore(bestRounds, potByProfile);
  const exchanges = rounds.length * 120;

  for (let attempt = 0; attempt < exchanges; attempt++) {
    const firstRoundIndex = randomIndex(rounds.length, random);
    let secondRoundIndex = randomIndex(rounds.length - 1, random);
    if (secondRoundIndex >= firstRoundIndex) secondRoundIndex++;

    const exchanged = exchangeAlternatingComponent(
      rounds[firstRoundIndex],
      rounds[secondRoundIndex],
      random,
    );
    if (!exchanged) continue;

    [rounds[firstRoundIndex], rounds[secondRoundIndex]] = exchanged;
    const score = roundVarietyScore(rounds, potByProfile);
    if (score > bestScore) {
      bestScore = score;
      bestRounds = rounds.map(matches => [...matches]);
    }
  }

  return bestRounds;
}

function exchangeAlternatingComponent(
  firstRound: readonly ChampionsLeagueDrawMatch[],
  secondRound: readonly ChampionsLeagueDrawMatch[],
  random: RandomSource,
): [ChampionsLeagueDrawMatch[], ChampionsLeagueDrawMatch[]] | undefined {
  const firstEdges = indexRoundEdges(firstRound);
  const secondEdges = indexRoundEdges(secondRound);
  const unvisited = new Set(firstEdges.keys());
  const components: Array<{ first: Set<number>; second: Set<number> }> = [];

  while (unvisited.size) {
    const start = unvisited.values().next().value as string;
    const profiles = [start];
    const component = { first: new Set<number>(), second: new Set<number>() };

    while (profiles.length) {
      const profileId = profiles.pop()!;
      if (!unvisited.delete(profileId)) continue;

      const firstEdge = firstEdges.get(profileId)!;
      const secondEdge = secondEdges.get(profileId)!;
      component.first.add(firstEdge.index);
      component.second.add(secondEdge.index);
      profiles.push(firstEdge.opponent, secondEdge.opponent);
    }
    components.push(component);
  }

  if (components.length < 2) return undefined;
  const selected = components[randomIndex(components.length, random)];
  const nextFirst = firstRound.filter((_match, index) => !selected.first.has(index));
  const nextSecond = secondRound.filter((_match, index) => !selected.second.has(index));
  selected.second.forEach(index => nextFirst.push(secondRound[index]));
  selected.first.forEach(index => nextSecond.push(firstRound[index]));
  return [nextFirst, nextSecond];
}

function indexRoundEdges(
  matches: readonly ChampionsLeagueDrawMatch[],
): Map<string, { index: number; opponent: string }> {
  const result = new Map<string, { index: number; opponent: string }>();
  matches.forEach((match, index) => {
    result.set(match.home, { index, opponent: match.away });
    result.set(match.away, { index, opponent: match.home });
  });
  return result;
}

function roundVarietyScore(
  rounds: readonly (readonly ChampionsLeagueDrawMatch[])[],
  potByProfile: ReadonlyMap<string, number>,
): number {
  const variety = rounds.map(matches => new Set(matches.map(match => {
    const firstPot = potByProfile.get(match.home)!;
    const secondPot = potByProfile.get(match.away)!;
    return firstPot <= secondPot ? `${firstPot}-${secondPot}` : `${secondPot}-${firstPot}`;
  })).size);

  return Math.min(...variety) * 1000 + variety.reduce((sum, value) => sum + value, 0);
}

function buildCrossPotMatchings(
  firstPot: readonly string[],
  secondPot: readonly string[],
  random: RandomSource,
): [ChampionsLeagueDrawMatch[], ChampionsLeagueDrawMatch[]] {
  const first = shuffle(firstPot, random);
  const second = shuffle(secondPot, random);
  const offset = 1 + randomIndex(second.length - 1, random);

  return [
    first.map((home, index) => ({ home, away: second[index] })),
    first.map((home, index) => ({ home, away: second[(index + offset) % second.length] })),
  ];
}

function buildSamePotMatchings(
  pot: readonly string[],
  random: RandomSource,
): [ChampionsLeagueDrawMatch[], ChampionsLeagueDrawMatch[]] {
  const cycle = shuffle(pot, random);
  const first: ChampionsLeagueDrawMatch[] = [];
  const second: ChampionsLeagueDrawMatch[] = [];

  for (let index = 0; index < cycle.length; index += 2) {
    first.push({ home: cycle[index], away: cycle[index + 1] });
    second.push({ home: cycle[index + 1], away: cycle[(index + 2) % cycle.length] });
  }

  return [first, second];
}

function collectOpponents(
  rounds: readonly ChampionsLeagueDrawRound[],
  profileIds: readonly string[],
): Record<string, string[]> {
  const opponents = Object.fromEntries(profileIds.map(profileId => [profileId, [] as string[]]));
  rounds.forEach(round => round.matches.forEach(match => {
    opponents[match.home].push(match.away);
    opponents[match.away].push(match.home);
  }));
  return opponents;
}

function assertDrawIntegrity(
  rounds: readonly ChampionsLeagueDrawRound[],
  opponentsByProfile: Record<string, string[]>,
  pots: readonly (readonly string[])[],
): void {
  const allProfiles = pots.flat();
  const potByProfile = new Map<string, number>();
  pots.forEach((pot, potIndex) => pot.forEach(profileId => potByProfile.set(profileId, potIndex)));

  if (rounds.length !== POTS_COUNT * OPPONENTS_FROM_EACH_POT) {
    throw new Error('Жеребьёвка должна содержать восемь туров');
  }

  rounds.forEach(round => {
    const participants = round.matches.flatMap(match => [match.home, match.away]);
    if (participants.length !== allProfiles.length || new Set(participants).size !== allProfiles.length) {
      throw new Error(`В туре ${round.number} не каждая команда играет ровно один матч`);
    }
  });

  allProfiles.forEach(profileId => {
    const opponents = opponentsByProfile[profileId];
    if (opponents.length !== POTS_COUNT * OPPONENTS_FROM_EACH_POT || new Set(opponents).size !== opponents.length) {
      throw new Error(`Участник ${profileId} получил некорректный список соперников`);
    }

    const counts = Array.from({ length: POTS_COUNT }, () => 0);
    opponents.forEach(opponentId => counts[potByProfile.get(opponentId)!]++);
    if (counts.some(count => count !== OPPONENTS_FROM_EACH_POT)) {
      throw new Error(`Участник ${profileId} должен получить по два соперника из каждой корзины`);
    }
  });
}

function validatePots(pots: readonly (readonly string[])[]): void {
  if (pots.length !== POTS_COUNT) {
    throw new Error('Для жеребьёвки нужны четыре корзины');
  }

  const potSize = pots[0]?.length ?? 0;
  if (potSize < 4 || potSize % 2 !== 0 || pots.some(pot => pot.length !== potSize)) {
    throw new Error('Корзины должны быть одинакового чётного размера');
  }

  const profiles = pots.flat();
  if (new Set(profiles).size !== profiles.length) {
    throw new Error('Один профиль не может находиться в нескольких корзинах');
  }
}

function orientMatch(match: ChampionsLeagueDrawMatch, random: RandomSource): ChampionsLeagueDrawMatch {
  return random() < 0.5 ? match : { home: match.away, away: match.home };
}

function shuffle<T>(values: readonly T[], random: RandomSource): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = randomIndex(index + 1, random);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function randomIndex(length: number, random: RandomSource): number {
  const value = random();
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(value, 0.999999999999)) : 0;
  return Math.floor(normalized * length);
}
