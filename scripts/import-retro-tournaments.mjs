import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const sourceDirectory = path.resolve(projectRoot, '..');
const outputPath = path.join(projectRoot, 'src/assets/data/retro-tournaments.json');
const defaultLogo = 'assets/logos/default.png';

const sourcePaths = {
  laLiga: path.resolve(process.argv[2] ?? path.join(sourceDirectory, 'Fantasy Fondo Ruso - Ла Лига 2023-24.csv')),
  championsLeague: path.resolve(process.argv[3] ?? path.join(sourceDirectory, 'Fantasy Fondo Ruso - ЛЧ 2023-24.csv')),
  euro: path.resolve(process.argv[4] ?? path.join(sourceDirectory, 'Fantasy Fondo Ruso - ЕВРО 2024.csv'))
};

const registry = JSON.parse(await readFile(path.join(projectRoot, 'src/assets/data/achievements.json'), 'utf8'));
const profiles = await loadProfiles();
const profileOwners = new Map(
  registry.participants.flatMap(participant => participant.profileIds.map(profileId => [String(profileId), participant.id]))
);
const participantNames = new Map(registry.participants.map(participant => [normalizeName(participant.name), participant.id]));
const profileIndex = buildProfileIndex(profiles);
const nameAliases = new Map([
  [normalizeName('Кирил Яковченко'), normalizeName('Кирилл Яковченко')]
]);

const tournaments = [
  await importLaLiga(sourcePaths.laLiga),
  await importChampionsLeague(sourcePaths.championsLeague),
  await importEuro(sourcePaths.euro)
];

await writeFile(outputPath, `${JSON.stringify({ version: 1, tournaments }, null, 2)}\n`, 'utf8');

for (const tournament of tournaments) {
  const unmatched = tournament.standings.filter(row => !row.matched).map(row => row.participantName);
  console.log(`${tournament.title}: ${tournament.standings.length} участников, сопоставлено ${tournament.standings.length - unmatched.length}`);
  if (unmatched.length > 0) console.log(`  Без профиля: ${unmatched.join(', ')}`);
}
console.log(`Результат: ${path.relative(projectRoot, outputPath)}`);

async function importLaLiga(sourcePath) {
  const rows = await readCsv(sourcePath);
  return tournament({
    id: 'la-liga-2023-24',
    title: 'Ла Лига 2023/24',
    period: '2023–24',
    kind: 'la-liga',
    sourcePath,
    standings: rows.slice(1).filter(row => row[0]).map(row => standing({
      place: number(row[0]),
      participantName: row[1],
      telegram: row[2],
      teamName: row[3],
      nickname: row[4],
      ratingPrizeMoney: number(row[5]),
      medals: medals(row[6], row[7], row[8], row[9]),
      totalScore: number(row[10]),
      maxScore: number(row[11]),
      averageScore: decimal(row[12]),
      minScore: number(row[13]),
      tourScores: row.slice(14).map(nullableNumber)
    }))
  });
}

async function importChampionsLeague(sourcePath) {
  const rows = await readCsv(sourcePath);
  return tournament({
    id: 'champions-league-2023-24',
    title: 'Лига чемпионов 2023/24',
    period: '2023–24',
    kind: 'champions-league',
    sourcePath,
    standings: rows.slice(1).filter(row => row[0]).map((row, index) => {
      const tourScores = row.slice(2, 11).map(nullableNumber);
      const playedScores = tourScores.filter(value => value !== null);
      return standing({
        place: index + 1,
        participantName: row[11],
        teamName: row[0],
        totalScore: number(row[1]),
        maxScore: Math.max(...playedScores),
        averageScore: round(number(row[1]) / playedScores.length),
        minScore: Math.min(...playedScores),
        tourScores
      });
    })
  });
}

async function importEuro(sourcePath) {
  const rows = await readCsv(sourcePath);
  return tournament({
    id: 'euro-2024',
    title: 'Евро 2024',
    period: '2023–24',
    kind: 'summer',
    sourcePath,
    standings: rows.slice(1).filter(row => row[0]).map(row => {
      const tourScores = row.slice(12).map(nullableNumber);
      const playedScores = tourScores.filter(value => value !== null);
      return standing({
        place: number(row[0]),
        participantName: row[1],
        telegram: row[2],
        teamName: row[3],
        nickname: row[4],
        ratingPrizeMoney: number(row[5]),
        medals: medals(row[6], row[7], row[8], row[9]),
        totalScore: number(row[10]),
        maxScore: number(row[11]),
        averageScore: round(number(row[10]) / playedScores.length),
        minScore: Math.min(...playedScores),
        tourScores
      });
    })
  });
}

function tournament({ id, title, period, kind, sourcePath, standings }) {
  return {
    id,
    title,
    period,
    kind,
    format: 'overall',
    sourceFile: path.basename(sourcePath),
    tourCount: Math.max(...standings.map(row => row.tourScores.length)),
    standings
  };
}

function standing(values) {
  const match = matchParticipant(values.participantName);
  return {
    ...values,
    participantName: clean(values.participantName),
    teamName: clean(values.teamName),
    telegram: optional(values.telegram),
    nickname: optional(values.nickname),
    participantId: match.participantId,
    profileId: match.profileId,
    logo: match.logo,
    matched: match.matched
  };
}

function matchParticipant(name) {
  const normalized = normalizeName(name);
  const aliased = nameAliases.get(normalized) ?? normalized;
  const profile = profileIndex.get(aliased) ?? profileIndex.get(sortedName(aliased));
  const participantId = (profile && profileOwners.get(profile.id)) ?? participantNames.get(aliased);

  if (profile) {
    return {
      participantId: participantId ?? `profile-${profile.id}`,
      profileId: profile.id,
      logo: profile.logo || defaultLogo,
      matched: true
    };
  }

  if (participantId) {
    const participant = registry.participants.find(item => item.id === participantId);
    const profileId = participant.profileIds[0];
    return {
      participantId,
      profileId,
      logo: defaultLogo,
      matched: !String(profileId).startsWith('retro-')
    };
  }

  const id = `retro-${slug(sortedName(normalized))}`;
  return { participantId: id, profileId: id, logo: defaultLogo, matched: false };
}

async function loadProfiles() {
  const legacy = JSON.parse(await readFile(path.join(projectRoot, 'src/assets/data/profiles.json'), 'utf8'));
  const result = Object.values(legacy).flat();
  const seasonsDirectory = path.join(projectRoot, 'src/assets/data/seasons');
  const seasonDirectories = (await readdir(seasonsDirectory, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();

  for (const season of seasonDirectories) {
    const directory = path.join(seasonsDirectory, season);
    const files = (await readdir(directory)).filter(file => file.endsWith('.json')).sort();
    for (const file of files) {
      const data = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
      if (Array.isArray(data.profiles)) result.push(...data.profiles);
    }
  }
  return result;
}

function buildProfileIndex(items) {
  const index = new Map();
  for (const profile of items) {
    if (!profile?.id || !profile?.name) continue;
    const normalized = normalizeName(profile.name);
    const snapshot = { ...profile, id: String(profile.id) };
    const sorted = sortedName(normalized);

    // Profiles are loaded from the oldest available season to the newest one.
    // Keep the first snapshot so retro tournaments use the earliest known team logo.
    if (!index.has(normalized)) index.set(normalized, snapshot);
    if (!index.has(sorted)) index.set(sorted, snapshot);
  }
  return index;
}

async function readCsv(sourcePath) {
  return parseCsv(await readFile(sourcePath, 'utf8'));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function medals(gold, silver, bronze, total) {
  return { gold: number(gold), silver: number(silver), bronze: number(bronze), total: number(total) };
}

function number(value) {
  const parsed = decimal(value);
  return parsed ?? 0;
}

function nullableNumber(value) {
  const cleaned = clean(value);
  return cleaned === '' ? null : decimal(cleaned);
}

function decimal(value) {
  const cleaned = clean(value).replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function optional(value) {
  const valueClean = clean(value);
  return valueClean || undefined;
}

function clean(value) {
  return String(value ?? '').trim();
}

function normalizeName(value) {
  return clean(value)
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function sortedName(value) {
  return value.split(' ').sort((left, right) => left.localeCompare(right, 'ru')).join(' ');
}

function slug(value) {
  return value
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-|-$/g, '') || 'unknown';
}

function round(value) {
  return Math.round(value * 100) / 100;
}
