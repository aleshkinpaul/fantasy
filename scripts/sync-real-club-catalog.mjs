import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const catalogPath = path.join(projectRoot, 'src', 'assets', 'data', 'teams.json');
const logosDirectory = path.join(projectRoot, 'src', 'assets', 'logos', 'real-clubs', 'api');
const logoPublicDirectory = 'assets/logos/real-clubs/api';

const sources = [
  { slug: 'la_liga_2026', tourStatsUrl: 'https://fantasy-h2h.ru/api/fnts_tournament/sport_players_tour_stat/la_liga_2026/1' },
  { slug: 'ucl_2026', tourStatsUrl: 'https://fantasy-h2h.ru/api/fnts_tournament/sport_players_tour_stat/ucl_2026/1' },
];

const nameAliases = new Map([
  ['атлетик', 'атлетик бильбао'],
  ['атлетико', 'атлетико мадрид'],
  ['бетис', 'реал бетис'],
  ['депортиво', 'депортиво ла корунья'],
  ['расинг', 'расинг сантандер'],
]);

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
if (!Array.isArray(catalog)) throw new Error('Real club catalog must be an array');
const downloadedLogos = new Map();

await mkdir(logosDirectory, { recursive: true });

for (const source of sources) {
  const [teamsResponse, playersResponse] = await Promise.all([
    getJson(`https://fantasy-h2h.ru/api/fnts_tournament/teams/${source.slug}`),
    getJson(source.tourStatsUrl),
  ]);
  const teams = Object.values(teamsResponse?.data ?? {})
    .map(validateRemoteTeam)
    .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
  const internalIds = [...new Set(
    Object.values(playersResponse?.data?.players ?? {})
      .map(player => player.team_id)
      .filter(id => id !== null && id !== undefined && String(id).trim())
      .map(String),
  )].sort(compareNumericStrings);

  if (!teams.length || teams.length !== internalIds.length) {
    throw new Error(`${source.slug}: teams (${teams.length}) and fantasy team IDs (${internalIds.length}) do not match`);
  }
  assertSequentialIds(source.slug, internalIds);

  for (let index = 0; index < teams.length; index += 1) {
    const remote = teams[index];
    const internalId = internalIds[index];
    const byInternalId = catalog.find(club => club.ids.includes(internalId));
    const bySourceId = catalog.find(club => club.sourceIds?.includes(remote.id));
    const byName = catalog.find(club => normalizeName(club.name) === normalizeName(remote.name));
    const club = byInternalId ?? bySourceId ?? byName ?? createClub(remote);

    if (byInternalId && bySourceId && byInternalId !== bySourceId) {
      throw new Error(`${source.slug}: ${internalId} and source ${remote.id} resolve to different clubs`);
    }
    if (byInternalId && normalizeName(byInternalId.name) !== normalizeName(remote.name)) {
      throw new Error(`${source.slug}: ${internalId} points to ${byInternalId.name}, API returned ${remote.name}`);
    }

    addUnique(club.ids, internalId);
    club.sourceIds ??= [];
    addUnique(club.sourceIds, remote.id);
    club.logo = await downloadLogo(remote);
    if (!catalog.includes(club)) catalog.push(club);
  }
}

catalog.sort((left, right) => left.name.localeCompare(right.name, 'ru'));
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(`Real club catalog updated: ${catalog.length} clubs`);

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const body = await response.json();
  if (body?.result !== 1) throw new Error(`${url}: API returned an error`);
  return body;
}

function validateRemoteTeam(value) {
  if (!value || typeof value !== 'object') throw new Error('Invalid club in teams API');
  const id = String(value.id ?? '').trim();
  const name = String(value.name ?? '').trim();
  const logoUrl = String(value.logo_url ?? '').trim();
  if (!id || !name || !logoUrl) throw new Error(`Invalid club in teams API: ${JSON.stringify(value)}`);
  return { id, name, logoUrl };
}

function createClub(remote) {
  return {
    key: `sports-${remote.id}`,
    ids: [],
    sourceIds: [remote.id],
    name: remote.name,
    logo: '',
  };
}

function normalizeName(value) {
  const normalized = String(value)
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim();
  return nameAliases.get(normalized) ?? normalized;
}

function compareNumericStrings(left, right) {
  return Number(left) - Number(right) || left.localeCompare(right);
}

function assertSequentialIds(slug, ids) {
  const first = Number(ids[0]);
  if (!Number.isInteger(first) || ids.some((id, index) => Number(id) !== first + index)) {
    throw new Error(`${slug}: fantasy team IDs are not sequential; automatic mapping is unsafe`);
  }
}

function addUnique(items, value) {
  if (!items.includes(value)) items.push(value);
  items.sort(compareNumericStrings);
}

async function downloadLogo(remote) {
  const cachedPath = downloadedLogos.get(remote.id);
  if (cachedPath) return cachedPath;

  const extension = getLogoExtension(remote.logoUrl);
  const fileName = `${remote.id}${extension}`;
  const filePath = path.join(logosDirectory, fileName);
  const response = await fetch(remote.logoUrl);
  if (!response.ok) throw new Error(`${remote.logoUrl}: HTTP ${response.status}`);
  await writeFile(filePath, Buffer.from(await response.arrayBuffer()));

  const publicPath = `${logoPublicDirectory}/${fileName}`;
  downloadedLogos.set(remote.id, publicPath);
  return publicPath;
}

function getLogoExtension(url) {
  const extension = path.extname(new URL(url).pathname).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp'].includes(extension) ? extension : '.png';
}
