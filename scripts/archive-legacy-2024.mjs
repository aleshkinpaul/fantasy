import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const consts = JSON.parse(await readFile(path.join(root, 'src/assets/data/consts.json'), 'utf8'));
const targets = consts.league.filter(item => ['champions-league', 'club-world-cup'].includes(item.type));

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

for (const config of targets) {
  const datasetId = config.type === 'club-world-cup' ? 'club-world-cup-2025' : 'champions-league-2024-25';
  const directory = path.join(root, 'src/assets/data/history', datasetId, 'raw');
  await mkdir(directory, { recursive: true });
  const api = config.data_source?.api ?? config;
  const urls = [api.squad_link, api.squad_link_2].filter(Boolean);
  const files = {};
  let firstResponse;
  let totalTours = 0;
  for (const [index, url] of urls.entries()) {
    const body = await fetchJson(url);
    firstResponse ??= body;
    totalTours += Object.keys(body.data.tours).length;
    const relative = `raw/full-info-${index + 1}.json`;
    const contents = `${JSON.stringify(body, null, 2)}\n`;
    await writeFile(path.join(root, 'src/assets/data/history', datasetId, relative), contents);
    files[relative] = `sha256:${createHash('sha256').update(contents).digest('hex')}`;
  }

  let latestTourUrl;
  if (api.tour_link) {
    latestTourUrl = `${api.tour_link}${totalTours}`;
    const body = await fetchJson(latestTourUrl);
    const relative = 'raw/latest-tour.json';
    const contents = `${JSON.stringify(body, null, 2)}\n`;
    await writeFile(path.join(root, 'src/assets/data/history', datasetId, relative), contents);
    files[relative] = `sha256:${createHash('sha256').update(contents).digest('hex')}`;
  }

  const manifest = {
    schemaVersion: 1,
    datasetId,
    catalogTournamentIds: [datasetId],
    generatedAt: new Date().toISOString(),
    source: { fullInfo: urls, tourStats: latestTourUrl ? [latestTourUrl] : [] },
    files,
    counts: {
      profiles: Object.keys(firstResponse.data.players).length,
      tours: Object.keys(firstResponse.data.tours).length,
      matches: Object.keys(firstResponse.data.matches ?? {}).length,
    },
  };
  await writeFile(
    path.join(root, 'src/assets/data/history', datasetId, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  process.stdout.write(`created ${datasetId}\n`);
}
