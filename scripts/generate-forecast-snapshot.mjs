import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { loadTypeScriptModule } from './lib/load-typescript-module.mjs';

const [competitionType, rawYearStart, rawTargetTour, ...rawFlags] = process.argv.slice(2);
const yearStart = Number(rawYearStart);
const targetTour = Number(rawTargetTour);
const allowedFlags = new Set([
  '--reconstruct',
  '--replace-reconstruction',
  '--replace-before-start',
]);
const unknownFlags = rawFlags.filter(flag => !allowedFlags.has(flag));
const reconstruct = rawFlags.includes('--reconstruct');
const replaceReconstruction = rawFlags.includes('--replace-reconstruction');
const replaceBeforeStart = rawFlags.includes('--replace-before-start');

if (
  !competitionType
  || !Number.isInteger(yearStart)
  || !Number.isInteger(targetTour)
  || unknownFlags.length
  || (reconstruct && replaceBeforeStart)
  || (replaceReconstruction && !reconstruct)
) {
  throw new Error(
    'Usage: node scripts/generate-forecast-snapshot.mjs <type> <yearStart> <targetTour> '
      + '[--reconstruct [--replace-reconstruction] | --replace-before-start]',
  );
}

const workspaceRoot = resolve(import.meta.dirname, '..');
const yearEnd = yearStart + 1;
const seasonPath = join(
  workspaceRoot,
  'src',
  'assets',
  'data',
  'seasons',
  `${yearStart}-${String(yearEnd).slice(-2)}`,
  `${competitionType}.json`,
);
const season = JSON.parse(readFileSync(seasonPath, 'utf8'));
const config = season.config;
const matches = config.matches[String(targetTour)];
if (!Array.isArray(matches) || !matches.length) {
  throw new Error(`В конфигурации нет матчей тура ${targetTour}`);
}

const squads = await fetchJson(config.squad_link);
const lastTour = Math.max(...Object.keys(squads.data.tours).map(Number));
if (targetTour <= lastTour && !reconstruct) {
  throw new Error(
    `Тур ${targetTour} уже присутствует в API. Для восстановления используйте --reconstruct.`,
  );
}
if (targetTour > lastTour && reconstruct) {
  throw new Error(`Тур ${targetTour} ещё не начался, поэтому его нельзя пометить как восстановленный.`);
}
if (targetTour <= lastTour && replaceBeforeStart) {
  throw new Error('Перезапись опубликованного прогноза разрешена только до начала тура.');
}

const tournamentId = getTournamentId(competitionType, yearStart, yearEnd);
const relativeSnapshotPath = `assets/data/forecasts/${tournamentId}/tour-${targetTour}.json`;
const snapshotPath = join(workspaceRoot, 'src', relativeSnapshotPath);

const {
  calculateMatchForecast,
  FORECAST_ALGORITHM_VERSION,
  RATING_FORECAST_CALIBRATION,
} = loadTypeScriptModule(
  join(workspaceRoot, 'src', 'app', 'match-center', 'forecast-calculator.ts'),
);

let archivePath;
if (existsSync(snapshotPath)) {
  const previousSnapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const mayRefreshReconstruction = reconstruct
    && replaceReconstruction
    && previousSnapshot.provenance === 'reconstructed';
  if (!replaceBeforeStart && !mayRefreshReconstruction) {
    throw new Error(`Snapshot уже существует и не будет перезаписан: ${relativeSnapshotPath}`);
  }

  if (replaceBeforeStart && previousSnapshot.algorithmVersion !== FORECAST_ALGORITHM_VERSION) {
    const previousVersion = sanitizeFilePart(previousSnapshot.algorithmVersion || 'unknown');
    archivePath = join(dirname(snapshotPath), `tour-${targetTour}.${previousVersion}.json`);
    if (existsSync(archivePath)) {
      throw new Error(`Архив предыдущего snapshot уже существует: ${archivePath}`);
    }
  }
}

const profiles = config.profiles.map(profileId => {
  const participant = squads.data.players[profileId];
  if (!participant) throw new Error(`API не содержит участника ${profileId}`);
  return { id: profileId, team: participant.team };
});

const inputHash = createHash('sha256').update(JSON.stringify({
  algorithmVersion: FORECAST_ALGORITHM_VERSION,
  calibration: RATING_FORECAST_CALIBRATION,
  drawGap: config.drawGap || 0,
  targetTour,
  matches,
  profiles: profiles.map(profile => ({
    id: profile.id,
    resultsByTour: Object.fromEntries(
      Object.entries(profile.team.results_by_tour)
        .filter(([tour]) => Number(tour) < targetTour)
        .sort(([left], [right]) => Number(left) - Number(right)),
    ),
  })),
})).digest('hex');

const snapshot = {
  tournamentId,
  tour: targetTour,
  generatedAt: new Date().toISOString(),
  algorithmVersion: FORECAST_ALGORITHM_VERSION,
  inputLastTour: lastTour,
  calculationLastTour: targetTour - 1,
  inputHash,
  provenance: reconstruct ? 'reconstructed' : 'published',
  forecasts: matches.map(match => calculateMatchForecast({
    homeProfileId: match.home,
    awayProfileId: match.away,
    targetTour,
    drawGap: config.drawGap || 0,
    profiles,
  })),
};

mkdirSync(dirname(snapshotPath), { recursive: true });
if (archivePath) copyFileSync(snapshotPath, archivePath);
writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

const manifestPath = join(workspaceRoot, 'src', 'assets', 'data', 'forecasts', 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.snapshots = manifest.snapshots.filter(entry =>
  entry.tournamentId !== tournamentId || entry.tour !== targetTour,
);
manifest.snapshots.push({ tournamentId, tour: targetTour, path: `/${relativeSnapshotPath}` });
manifest.snapshots.sort((left, right) =>
  left.tournamentId.localeCompare(right.tournamentId) || left.tour - right.tour,
);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

process.stdout.write(
  `Created ${relativeSnapshotPath}: ${snapshot.forecasts.length} forecasts, `
    + `rating data through tour ${targetTour - 1}, provenance ${snapshot.provenance}.\n`,
);

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} while loading ${url}`);
  return response.json();
}

function getTournamentId(type, start, end) {
  const period = `${start}-${String(end).slice(-2)}`;
  if (type === 'spain') return `la-liga-${period}`;
  if (type === 'champions-league') return `champions-league-${period}`;
  if (type === 'world-cup') return `world-cup-${end}`;
  return `${type}-${period}`;
}

function sanitizeFilePart(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '-');
}
