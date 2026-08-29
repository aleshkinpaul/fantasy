import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const [competitionType, rawYearStart, rawTargetTour] = process.argv.slice(2);
const yearStart = Number(rawYearStart);
const targetTour = Number(rawTargetTour);

if (!competitionType || !Number.isInteger(yearStart) || !Number.isInteger(targetTour)) {
  throw new Error('Usage: node scripts/generate-forecast-snapshot.mjs <type> <yearStart> <targetTour>');
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
if (targetTour <= lastTour) {
  throw new Error(
    `Тур ${targetTour} уже присутствует в API. Snapshot после начала тура создавать запрещено.`,
  );
}

const tournamentId = getTournamentId(competitionType, yearStart, yearEnd);
const relativeSnapshotPath = `assets/data/forecasts/${tournamentId}/tour-${targetTour}.json`;
const snapshotPath = join(workspaceRoot, 'src', relativeSnapshotPath);
if (existsSync(snapshotPath)) {
  throw new Error(`Snapshot уже существует и не будет перезаписан: ${relativeSnapshotPath}`);
}

const { calculateMatchForecast, FORECAST_ALGORITHM_VERSION } = loadForecastCalculator(workspaceRoot);
const profiles = config.profiles.map(profileId => {
  const participant = squads.data.players[profileId];
  if (!participant) throw new Error(`API не содержит участника ${profileId}`);
  return { id: profileId, team: participant.team };
});

const snapshot = {
  tournamentId,
  tour: targetTour,
  generatedAt: new Date().toISOString(),
  algorithmVersion: FORECAST_ALGORITHM_VERSION,
  inputLastTour: lastTour,
  forecasts: matches.map(match => calculateMatchForecast({
    homeProfileId: match.home,
    awayProfileId: match.away,
    targetTour,
    drawGap: config.drawGap || 0,
    profiles,
  })),
};

mkdirSync(dirname(snapshotPath), { recursive: true });
writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

const manifestPath = join(workspaceRoot, 'src', 'assets', 'data', 'forecasts', 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.snapshots.push({ tournamentId, tour: targetTour, path: `/${relativeSnapshotPath}` });
manifest.snapshots.sort((left, right) =>
  left.tournamentId.localeCompare(right.tournamentId) || left.tour - right.tour,
);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

process.stdout.write(
  `Created ${relativeSnapshotPath}: ${snapshot.forecasts.length} forecasts from tours 1-${lastTour}.\n`,
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

function loadForecastCalculator(root) {
  const calculatorPath = join(root, 'src', 'app', 'match-center', 'forecast-calculator.ts');
  const source = readFileSync(calculatorPath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const calculatorModule = { exports: {} };
  const evaluate = new Function('require', 'module', 'exports', compiled);
  evaluate(require, calculatorModule, calculatorModule.exports);
  return calculatorModule.exports;
}
