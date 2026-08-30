import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(projectRoot, 'src/assets/data/archive-cups.json');
const snapshotPath = path.join(projectRoot, 'src/assets/data/2024_2025/spain/squads.json');
const profilesPath = path.join(projectRoot, 'src/assets/data/profiles.json');
const defaultLogo = 'assets/logos/default.png';

const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
const profiles = JSON.parse(await readFile(profilesPath, 'utf8'))['2024'];
const profilesById = new Map(profiles.map(profile => [String(profile.id), profile]));
const teams = Object.values(snapshot.data.players);
const teamsByName = new Map(teams.map(team => [normalize(team.team.title), team]));
const aliases = new Map([
  [normalize('КоготьВальверде'), normalize('КоготьВалверде')],
]);

const rounds = [
  singleRound('qualifying', 'Отборочный раунд', 14, [
    ['Starokozhev', 'Железные яйца Переса'],
    ['Real madrid', 'Skyters'],
    ['Люмос Солем.', 'Эмоции Гарета Бэйла'],
    ['Volidol', 'Финансовый рычаг Саутгейта'],
    ['Черепаший суп', 'Los Viejitos de Chamartín'],
    ['Мыши-байкеры с марса', 'Левая бровь Анчелотти'],
    ['Мижганис C.F.', 'se come una paella'],
    ['КоготьВальверде', 'Правая нога Ойярсабаля'],
    ['Cherry_pie', 'BadBoysWhite'],
    ['слоны', 'Kopf89'],
    ['onorintimka', 'Madrid Skaters'],
    ['ducks', 'Zhulduz'],
    ['krya team', 'Дыхание космоса'],
    ['ChistoPoPrikolu', 'Дирдам Лаер'],
  ]),
  singleRound('round-of-32', '1/16 финала', 18, [
    ['Volidol', 'TimsTeam'],
    ['BadBoysWhite', 'unodostres'],
    ['ducks', 'Kopf89'],
    ['Vova_b', 'FC PEPElats'],
    ['BIG TURTLES', 'КоготьВальверде'],
    ['onorintimka', 'krya team'],
    ['Черные мамбы', 'Мыши-байкеры с марса'],
    ['Испанский эчпочмак', 'ремонтада'],
    ['Железные яйца Переса', 'Andar con rodeos'],
    ['Ravil_Real_Madrid', 'Люмос Солем.'],
    ['Пас Хуанито', 'Sevastopol'],
    ['Los Viejitos de Chamartín', 'shmelek'],
    ['Skyters', 'se come una paella'],
    ['Дирдам Лаер', 'Сахалин'],
    ['ФК Уже не красное пузо', 'LionForce'],
    ['RMonte Carlo', 'SaREAL'],
  ]),
  singleRound('round-of-16', '1/8 финала', 22, [
    ['Volidol', 'unodostres'],
    ['ducks', 'FC PEPElats'],
    ['BIG TURTLES', 'krya team'],
    ['Мыши-байкеры с марса', 'Испанский эчпочмак'],
    ['Andar con rodeos', 'Ravil_Real_Madrid'],
    ['Sevastopol', 'Los Viejitos de Chamartín'],
    ['se come una paella', 'Дирдам Лаер'],
    ['LionForce', 'SaREAL'],
  ]),
  singleRound('quarter-finals', '1/4 финала', 26, [
    ['Volidol', 'ducks'],
    ['BIG TURTLES', 'Испанский эчпочмак'],
    ['Andar con rodeos', 'Sevastopol'],
    ['se come una paella', 'LionForce'],
  ]),
  {
    id: 'semi-finals',
    title: '1/2 финала',
    tours: [30, 32],
    matches: [
      twoLegMatch('semi-finals-1', 'ducks', 'BIG TURTLES'),
      twoLegMatch('semi-finals-2', 'Andar con rodeos', 'LionForce'),
    ],
  },
  singleRound('final', 'Финал', 36, [
    ['ducks', 'Andar con rodeos'],
  ]),
];

const final = rounds.at(-1).matches[0];
const tournament = {
  id: 'la-liga-cup-2024-25',
  title: 'Кубок Короля 2024/25',
  period: '2024–25',
  yearStart: 2024,
  format: 'knockout',
  description: 'Классический кубок на вылет; полуфиналы состоят из двух матчей.',
  sourceDocument: 'docs/Кубок Короля 2024-25 - описание для добавления.md',
  championProfileId: final.winnerProfileId,
  rounds,
};

await writeFile(outputPath, `${JSON.stringify({ version: 1, tournaments: [tournament] }, null, 2)}\n`, 'utf8');
console.log(`Кубок импортирован: ${rounds.length} раундов, ${rounds.reduce((sum, round) => sum + round.matches.length, 0)} пар.`);
console.log(`Результат: ${path.relative(projectRoot, outputPath)}`);

function singleRound(id, title, tour, pairs) {
  return {
    id,
    title,
    tours: [tour],
    matches: pairs.map(([first, second], index) => singleMatch(`${id}-${index + 1}`, first, second, tour)),
  };
}

function singleMatch(id, firstName, secondName, tour) {
  const first = requireTeam(firstName);
  const second = requireTeam(secondName);
  return buildMatch(id, first, second, [{ tour, home: first, away: second }]);
}

function twoLegMatch(id, firstName, secondName) {
  const first = requireTeam(firstName);
  const second = requireTeam(secondName);
  return buildMatch(id, first, second, [
    { tour: 30, home: first, away: second },
    { tour: 32, home: second, away: first },
  ]);
}

function buildMatch(id, firstSource, secondSource, fixtures) {
  const first = teamSnapshot(firstSource);
  const second = teamSnapshot(secondSource);
  const legs = fixtures.map(({ tour, home, away }) => ({
    tour,
    homeProfileId: String(home.id),
    awayProfileId: String(away.id),
    homeScore: score(home, tour),
    awayScore: score(away, tour),
  }));
  const firstTotal = legs.reduce((sum, leg) => sum + scoreForProfile(leg, first.profileId), 0);
  const secondTotal = legs.reduce((sum, leg) => sum + scoreForProfile(leg, second.profileId), 0);
  if (firstTotal === secondTotal) throw new Error(`Для пары ${first.teamName} — ${second.teamName} нужна информация о тай-брейке`);

  return {
    id,
    first,
    second,
    legs,
    firstTotal,
    secondTotal,
    winnerProfileId: firstTotal > secondTotal ? first.profileId : second.profileId,
  };
}

function scoreForProfile(leg, profileId) {
  return leg.homeProfileId === profileId ? leg.homeScore : leg.awayScore;
}

function score(team, tour) {
  const result = Number(team.team.results_by_tour[tour]?.tour_score);
  if (!Number.isFinite(result)) throw new Error(`Нет результата ${team.team.title} в туре ${tour}`);
  return result;
}

function teamSnapshot(team) {
  const profileId = String(team.id);
  const profile = profilesById.get(profileId);
  if (!profile) throw new Error(`Нет локального профиля ${profileId} для ${team.team.title}`);
  return {
    profileId,
    participantName: profile.name,
    teamName: team.team.title,
    logo: profile.logo || defaultLogo,
  };
}

function requireTeam(name) {
  const key = aliases.get(normalize(name)) ?? normalize(name);
  const team = teamsByName.get(key);
  if (!team) throw new Error(`Не найдена команда «${name}»`);
  return team;
}

function normalize(value) {
  return String(value)
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, '');
}
