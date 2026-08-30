const MARTIN_LEAGUE_2024_TEAM_NAMES = [
  'ducks',
  'Kopf89',
  'SaREAL',
  'BIG TURTLES',
  'Los Viejitos de Chamartín',
  'TimsTeam',
  'Люмос Солем.',
  'Эмоции Гарета Бэйла',
  'Cherry_pie',
  'BadBoysWhite',
  'КоготьВальверде',
  'se come una paella',
  'Финансовый рычаг Саутгейта',
  'Дыхание космоса',
  'Правая нога Ойярсабаля',
  'Zhulduz',
  'Железные яйца Переса',
  'слоны',
  'ChistoPoPrikolu',
  'Мижганис C.F.',
];

const MARTIN_LEAGUE_2024 = new Set(MARTIN_LEAGUE_2024_TEAM_NAMES.map(normalizeTeamName));
const HISTORICAL_NAME_ALIASES = new Map([
  [normalizeTeamName('КоготьВалверде'), normalizeTeamName('КоготьВальверде')],
]);

export function isHistoricalMartinLeagueMember(yearStart: number, teamName: string): boolean {
  const normalized = normalizeTeamName(teamName);
  return yearStart === 2024
    && MARTIN_LEAGUE_2024.has(HISTORICAL_NAME_ALIASES.get(normalized) ?? normalized);
}

function normalizeTeamName(value: string): string {
  return value
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, '');
}
