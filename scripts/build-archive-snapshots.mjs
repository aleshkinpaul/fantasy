import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { getCompetitionRules } from '../src/app/competition/config/competition-rules.registry.ts';
import {
  applySquadEligibility,
  applyTourPlayerStats,
} from '../src/app/competition/domain/player-stats-calculator.ts';
import {
  calculateChampionsLeaguePrizes,
  calculateSpainPrizes,
  calculateWorldCupPrizes,
} from '../src/app/competition/domain/prize-calculator.ts';

const root = path.resolve(import.meta.dirname, '..');
const fixtureRoot = path.join(root, 'src', 'testing', 'season-2025-26');
const archiveRoot = path.join(root, 'src', 'assets', 'data', 'history');
const competitions = [
  { key: 'spain', datasetId: 'spain-2025-26', catalogTournamentIds: ['la-liga-2025-26', 'la-liga-cup-2025-26'] },
  { key: 'champions-league', datasetId: 'champions-league-2025-26', catalogTournamentIds: ['champions-league-2025-26'] },
  { key: 'world-cup', datasetId: 'world-cup-2026', catalogTournamentIds: ['world-cup-2026'] },
];

const json = async file => JSON.parse(await readFile(file, 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));

function responseForUrl(fixture, url) {
  const parsed = new URL(url);
  const key = `api:${parsed.pathname}${parsed.search}`;
  const response = fixture.responses[key];
  if (!response) throw new Error(`Captured response is missing: ${url}`);
  return response.body;
}

function mergeStages(first, second) {
  const merged = clone(first);
  if (!second) return merged;
  Object.values(merged.data.players).forEach(player => {
    const next = second.data.players[player.id];
    if (!next) throw new Error(`Second stage participant is missing: ${player.id}`);
    const offset = Object.keys(player.team.results_by_tour).length;
    const points = Number(player.team.results_by_tour[offset].total_score);
    Object.values(next.team.results_by_tour).forEach((result, index) => {
      const copy = clone(result);
      copy.total_score = String(Number(copy.total_score) + points);
      player.team.results_by_tour[offset + index + 1] = copy;
    });
    Object.values(next.team.rosters_by_tour).forEach((roster, index) => {
      player.team.rosters_by_tour[offset + index + 1] = clone(roster);
    });
  });
  const offset = Object.keys(merged.data.tours).length;
  Object.values(second.data.tours).forEach(tour => {
    const copy = clone(tour);
    copy.number = String(Number(copy.number) + offset);
    merged.data.tours[copy.number] = copy;
  });
  return merged;
}

function applyCalculatedMatches(config, matches) {
  matches.forEach(({ tour, matches: calculated }) => {
    if (!config.matches[tour]) return;
    config.matches[tour] = config.matches[tour].map((match, index) => ({
      ...match,
      ...calculated[index],
    }));
  });
}

async function build(competition) {
  const fixtureDirectory = path.join(fixtureRoot, competition.key);
  const seasonFile = await json(path.join(root, 'src', 'assets', 'data', 'seasons', '2025-26', `${competition.key}.json`));
  const fixture = JSON.parse(gunzipSync(await readFile(path.join(fixtureDirectory, 'responses.json.gz'))));
  const normalized = await json(path.join(fixtureDirectory, 'normalized-input.json'));
  const calculatedProfiles = await json(path.join(fixtureDirectory, 'profiles.json'));
  const standings = await json(path.join(fixtureDirectory, 'standings.json'));
  const squadDetails = await json(path.join(fixtureDirectory, 'squads.json'));
  const matches = await json(path.join(fixtureDirectory, 'matches.json'));
  const cup = await json(path.join(fixtureDirectory, 'cup.json'));

  const config = clone(seasonFile.config);
  applyCalculatedMatches(config, matches);
  if (config.cup && cup.config) config.cup = { ...config.cup, ...cup.config };

  const first = responseForUrl(fixture, config.squad_link);
  const second = config.squad_link_2 ? responseForUrl(fixture, config.squad_link_2) : undefined;
  const squads = mergeStages(first, second);
  const profileResults = new Map(calculatedProfiles.map(profile => [profile.id, profile]));
  const profiles = normalized.profiles.map(profile => ({
    ...profile,
    ...profileResults.get(profile.id),
    prizes: {},
  }));
  const profilesById = new Map(profiles.map(profile => [profile.id, profile]));
  squadDetails.forEach(squad => {
    const profile = profilesById.get(squad.id);
    if (profile) profile.squadDetails = squad;
  });

  const statsByTour = Array.from({ length: normalized.lastTour }, (_, index) =>
    responseForUrl(fixture, `${config.tour_link}${index + 1}`));
  const firstStageTours = Math.max(...Object.keys(squads.data.matches).map(Number));
  const firstStageLastTour = config.tour_link_2 && normalized.lastTour > firstStageTours
    ? firstStageTours
    : normalized.lastTour;
  const latestStats = [responseForUrl(fixture, `${config.tour_link}${firstStageLastTour}`)];
  if (config.tour_link_2 && normalized.lastTour > firstStageTours) {
    latestStats.push(responseForUrl(
      fixture,
      `${config.tour_link_2}${normalized.lastTour - firstStageTours}`,
    ));
  }
  const rules = getCompetitionRules(config.rulesId || `season-${config.yearStart}`);
  profiles.forEach(profile => {
    profile.results.portugezePoints = 0;
    profile.results.larinPoints = 0;
    profile.results.uniqueUsedPlayers = [];
    delete profile.results.selectedPlayerPoints;
    profile.results.countedRedCards = 0;
  });
  applySquadEligibility(profiles, latestStats, normalized.lastTour, rules.playerStats);
  const sportPlayers = applyTourPlayerStats(
    profiles,
    statsByTour,
    normalized.lastTour,
    rules.playerStats,
    config.type === 'spain',
  );

  let calculatedPrizes;
  if (config.type === 'spain') {
    calculatedPrizes = calculateSpainPrizes({
      prizes: config.prizes,
      profiles,
      profilesDetails: profiles,
      rules: rules.spainPrizes,
      sportPlayers,
      random: () => 0.3141592653589793,
    });
  } else if (config.type === 'champions-league') {
    calculatedPrizes = calculateChampionsLeaguePrizes({
      prizes: config.prizes,
      profiles,
      profilesDetails: profiles,
    });
  } else {
    calculatedPrizes = calculateWorldCupPrizes({
      prizes: config.prizes,
      profiles,
      profilesDetails: profiles,
    });
  }
  const runtimePrizes = calculatedPrizes.map(runtime => {
    const { nomineesArr = [], activeLeaders = [], ...configured } = runtime;
    return {
      ...configured,
      nomineeIds: nomineesArr.map(item => item.id ?? item.profileId),
      activeLeaderIds: activeLeaders.map(item => item.id ?? item.profileId),
    };
  });
  config.prizes = runtimePrizes.map(({ nomineeIds, activeLeaderIds, ...prize }) => prize);

  squadDetails.forEach(squad => {
    const player = squads.data.players[squad.id];
    if (player) player.team.rating = squad.rating;
  });
  const playersRating = squadDetails.map(squad => squad.rating).filter(Number.isFinite).sort((a, b) => a - b);
  const sportPlayersByTour = {};
  for (let tour = 1; tour <= normalized.lastTour; tour++) {
    const response = statsByTour[tour - 1];
    sportPlayersByTour[tour] = Object.values(response.data.players);
  }

  const snapshot = {
    schemaVersion: 1,
    datasetId: competition.datasetId,
    config,
    squads,
    profiles: profiles.map(({ squadDetails: _squadDetails, ...profile }) => profile),
    leagueProfileIds: Object.fromEntries(
      Object.entries(standings).map(([name, rows]) => [name, rows.map(row => row.id)]),
    ),
    squadDetails: squadDetails.map(squad => ({ ...squad, profileId: squad.id })),
    playersRating,
    prizes: runtimePrizes,
    lastTour: normalized.lastTour,
    sportPlayersByTour,
  };

  const outputDirectory = path.join(archiveRoot, competition.datasetId);
  const rawDirectory = path.join(outputDirectory, 'raw');
  await mkdir(rawDirectory, { recursive: true });
  const viewContents = `${JSON.stringify(snapshot, null, 2)}\n`;
  const rawContents = gzipSync(`${JSON.stringify(fixture)}\n`, { level: 9 });
  await writeFile(path.join(outputDirectory, 'view.json'), viewContents);
  await writeFile(path.join(rawDirectory, 'responses.json.gz'), rawContents);
  const profileBaseline = snapshot.profiles.map(profile => ({
    id: profile.id,
    score: profile.score,
    isMartin: profile.isMartin,
    isMartinWC: profile.isMartinWC,
    leagues: profile.leagues,
    place_in_league: profile.place_in_league,
    results: profile.results,
  }));
  const profileBaselineContents = `${JSON.stringify(profileBaseline, null, 2)}\n`;
  await writeFile(path.join(fixtureDirectory, 'profiles.json'), profileBaselineContents);
  const regressionHashes = await json(path.join(fixtureDirectory, 'hashes.json'));
  regressionHashes['profiles.json'] = createHash('sha256').update(profileBaselineContents).digest('hex');
  await writeFile(
    path.join(fixtureDirectory, 'hashes.json'),
    `${JSON.stringify(regressionHashes, null, 2)}\n`,
  );

  const apiResponses = Object.values(fixture.responses).filter(response => response.url.includes('fantasy-h2h.ru'));
  const manifest = {
    schemaVersion: 1,
    datasetId: competition.datasetId,
    catalogTournamentIds: competition.catalogTournamentIds,
    generatedAt: new Date().toISOString(),
    calculatorVersion: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim() || 'unknown',
    source: {
      fullInfo: [...new Set(apiResponses.filter(item => item.url.includes('/full_info/')).map(item => item.url))].sort(),
      tourStats: [...new Set(apiResponses.filter(item => item.url.includes('/sport_players_tour_stat/')).map(item => item.url))].sort(),
    },
    files: {
      'view.json': `sha256:${createHash('sha256').update(viewContents).digest('hex')}`,
      'raw/responses.json.gz': `sha256:${createHash('sha256').update(rawContents).digest('hex')}`,
    },
    counts: {
      profiles: profiles.length,
      tours: normalized.lastTour,
      matches: Object.values(config.matches).reduce((total, tourMatches) => total + tourMatches.length, 0),
    },
  };
  await writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`created ${competition.datasetId}\n`);
}

for (const competition of competitions) await build(competition);
