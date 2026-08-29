# Данные и внешний API

Документ описывает фактический контракт, на который опирается текущий frontend. Официальной схемы API в репозитории нет; структура восстановлена из кода, сохраненных ответов 2024–25 и живых ответов `fantasy-h2h.ru`, проверенных 28 августа 2026 года.

## Источники данных

| Источник | Роль | Загружается во время работы |
|---|---|---|
| `assets/data/seasons/{YYYY-YY}/{type}.json` | актуальные профили, ссылки API, календарь, этапы, кубок и призы одного турнира | да |
| `assets/data/profiles.json` | профили архивных страниц 2024–25 | только архивом |
| `assets/data/consts.json` | конфигурации архивных страниц 2024–25 и КЧМ-2025 | только архивом |
| `assets/data/teams.json` | справочник реальных клубов для архивной статистики | только архивом |
| `assets/data/2024_2025/**` | сохраненные ответы API Ла Лиги 2024–25 | нет |
| `assets/data/forecasts/**` | зафиксированные до тура котировки матч-центра | да |
| `fantasy-h2h.ru/api/h2h_tournament/full_info/**` | профили внешнего турнира, туры, составы и FO | да |
| `fantasy-h2h.ru/api/fnts_tournament/sport_players_tour_stat/**/{tour}` | футболисты и их очки по турам | да |

Авторизации или API key в коде нет. Браузер обращается к API напрямую, поэтому работоспособность зависит от доступности сервиса, CORS и стабильности его контракта.

## Составы и предматчевые котировки

Состав профиля на конкретный тур находится в `full_info.data.players[profileId].team.rosters_by_tour[tour]`. В нем используются `players` (11 основных), `bench_players` (4 запасных), `captain_id`, `vice_captain_id` и `team_cost`. Карточки футболистов дополняются данными `sport_players_tour_stat`: `name`, `amplua_id`, `team_id`, `cost` и `stat_by_tours`.

Позиции текущего API: `9` — вратарь, `10` — защитник, `11` — полузащитник, `12` — нападающий. Идентификаторы реальных клубов сезона 2026/27 не совпадают со старым `teams.json`, поэтому для названий и эмблем нужен отдельный сезонный справочник.

Манифест `assets/data/forecasts/manifest.json` связывает турнир и тур с неизменяемым JSON-snapshot. Для матча тура `N` расчет использует только туры `< N`; при открытии будущего матча без snapshot показывается предварительный расчет, а для уже сыгранного матча без snapshot прогноз задним числом не строится. Новый снимок создается до старта тура:

```bash
npm run forecast:snapshot -- spain 2026 4
```

## Идентификаторы

| Поле | Смысл | Где используется |
|---|---|---|
| `profile.id` / ключ `data.players` | пользователь внешней фэнтези-системы | связывает profile, календарь и API |
| `data.players[id].team.id` | фэнтези-команда пользователя | отображение и статистика |
| roster player id | реальный футболист в составе | base/bench/captain и `tour_stat.players` |
| `team_id` футболиста | реальный футбольный клуб | `teams.json`, специальные призы |
| `consts.teams[].id` | авторская команда КЧМ | группы и play-off КЧМ |

Все внешние id обычно строки, даже если содержат только цифры. В конфигурации КЧМ team id и индексы пар — числа. Не следует неявно преобразовывать id в number.

## Сезонные файлы актуальных турниров

Для актуальной H2H-страницы один турнир хранится в одном файле:

```text
assets/data/seasons/2025-26/spain.json
assets/data/seasons/2025-26/champions-league.json
assets/data/seasons/2025-26/world-cup.json
```

```ts
interface SeasonCompetitionFile {
  config: SeasonCompetition;
  profiles: Profile[];
}
```

`CompetitionDataLoaderService` строит путь из route type и `?year`: например, `spain + 2026` превращается в `/assets/data/seasons/2026-27/spain.json`. Поля `config.type` и `config.yearStart` проверяются после загрузки.

Массив `profiles` может включать резервные или гостевые профили, но фактический состав турнира всегда задает `config.profiles`.

## Legacy `profiles.json`

Структура различается по поколениям страниц:

```ts
type ProfilesFile = {
  "2024": Profile[];
};

interface Profile {
  id: string;
  name: string;
  nick: string;
  sex?: number;
  url: string;
  logo: string;
}
```

Этот файл читают только архивная страница и КЧМ. Новые сезоны в него не добавляются.

## Legacy `consts.json` и сезонный `config`

```ts
interface ConstsFile {
  league: SeasonCompetition[];
}

interface SeasonCompetition {
  id: string;
  type: "spain" | "champions-league" | "world-cup" | "club-world-cup";
  typeId: string;
  yearStart: number;
  yearEnd: number;

  squad_link: string;
  squad_link_2?: string;
  tour_link: string;
  tour_link_2?: string;

  special_pos?: number | null;
  drawGap?: number;
  format_img_link?: string;

  profiles?: string[];
  matches?: Record<string, Match[]>;
  stages?: Stage[];
  prizes?: Prize[];
  prizeRefs?: PrizeReference[];
  cup?: Cup;

  // Только формат КЧМ-2025:
  teams?: CwcTeam[];
  groups?: CwcGroup[];
  tours?: CwcTour[];
}
```

В legacy `consts.json` оболочка `ConstsFile` нужна архивным страницам. В актуальном сезонном файле один объект `SeasonCompetition` лежит прямо в поле `config`. `id` и `typeId` сохранились от старой интеграции и текущими расчетами почти не используются; обязательное соответствие проверяется по `type` и `yearStart`.

### Календарь H2H

```ts
interface Match {
  home: string;
  away: string;
  home_score?: number; // добавляет frontend
  away_score?: number;
  result?: 0 | 1 | 2; // ничья / победа home / победа away
}
```

Каждый профиль из матча должен существовать одновременно в `config.profiles`, массиве `profiles` того же сезонного файла и `full_info.data.players` внешнего API.

### Этапы и лиги

```ts
interface Stage {
  name: string;
  teamsCount: number;
  firstTour: number;
  lastTour: number;
  qualifiedPlaces?: number;
  leagues: League[];
}

interface League {
  name: string;
  profiles: string[];
}
```

Обе UI-вкладки календаря используют `config.matches`; отдельное представление соперников по профилю не хранится.

### Кубок

```ts
interface Cup {
  name: string;
  matchesTours: number[];
  matchesToursNames: string[];
  matches: Match[][];
  prizes?: unknown[];
}
```

Массивы связаны по индексу: `matchesTours[i]`, `matchesToursNames[i]` и `matches[i]` описывают один раунд. Результат кубкового матча определяется по FO соответствующего тура; при равенстве FO текущий код сохраняет ничью, хотя сетка ожидает победителя.

### Призы

```ts
interface Prize {
  id: number;
  name: string;
  icon: string;
  author?: string;
  condition?: string;
  reward?: string;
  isFinalStage?: boolean;
  isActivity?: boolean;
  excluded?: string[];
  nomineesArr: unknown[];
  activeLeaders?: unknown[]; // runtime
  state?: number;            // runtime
}

interface PrizeReference {
  key: string;
  overrides?: Partial<Prize>; // сезонные исключения или измененный текст карточки
}
```

`prizes` содержит сезонные inline-карточки и сохранен для обратной совместимости. `prizeRefs` позволяет выбрать любое подмножество переиспользуемых карточек из `competition-prize.registry.ts`; отсутствие ссылок означает сезон без этих призов. `overrides` задает только сезонные отличия, например `excluded`. Loader объединяет оба списка и создает независимые runtime-массивы, поэтому вычисление номинантов одного сезона не меняет шаблон или другой сезон.

`id` выбирает конкретную формулу в `prize-calculator.ts`. Добавление нового id без стратегии расчета обычно приведет к значению `'-'`. Специальные profile/player/team id хранятся в `competition-rules.registry.ts`.

### Конфигурация КЧМ

```ts
interface CwcTeam {
  id: number;
  name: string;
  logo: string;
  profiles: string[];
}

interface CwcGroup {
  id: number;
  name: string;
  teams: number[];
}

interface CwcTour {
  tour: number;
  type: "group" | "add" | "po";
  matches: Array<{ first_team: number; second_team: number }>;
}
```

В групповых турах `first_team` и `second_team` — индексы команд внутри группы. На последующих этапах это индексы внутри динамически сформированного списка квалифицировавшихся команд.

## API `full_info`

Шаблоны URL:

```text
GET https://fantasy-h2h.ru/api/h2h_tournament/full_info/{tournament_slug}
GET https://fantasy-h2h.ru/api/h2h_tournament/full_info/{tournament_slug}/stage/{stage}/group/{group}
```

Примеры 2025–26:

```text
/full_info/la_liga_2025_league_friendly_2
/full_info/ucl_2025_league_fondo_ruso
/full_info/ucl_2025_po_league_fondo_ruso
/full_info/wc_2026_fondo_ruso
```

Контракт ответа:

```ts
interface FullInfoResponse {
  result: number; // успешный ответ наблюдался как 1
  data: {
    id: string;
    title: string;
    fantasy_tournament_name: string;
    season: string;
    tours: Record<string, ApiTour>;
    players: Record<string, FantasyParticipant>;
    matches: Record<string, ApiH2HMatch[]>;
  };
}

interface ApiTour {
  number: string;
  start: string; // "YYYY-MM-DD HH:mm:ss"
  end: string;
}

interface ApiH2HMatch {
  home_player: string;
  away_player: string;
  home_score: string;
  away_score: string;
}

interface FantasyParticipant {
  id: string;
  name: string;
  logo: string;
  team: {
    id: string;
    title: string;
    results_by_tour: Record<string, TourResult>;
    rosters_by_tour: Record<string, Roster>;
  };
}

interface TourResult {
  total_score: string;
  tour_score: string;
  total_place: string;
  tour_place: string;
}

interface Roster {
  id: string;
  captain_id: string;
  vice_captain_id: string;
  team_cost?: number;
  players: {
    base: string[];
    bench: string[];
  };
}
```

Код полагается на следующие инварианты:

- ключ словаря `players` равен `FantasyParticipant.id` и `profile.id`;
- туры пронумерованы подряд с 1;
- для каждого обработанного тура существуют `results_by_tour[tour]` и `rosters_by_tour[tour]`;
- `tour_score` и `total_score` преобразуются в number;
- состав содержит 15 id и имеет `players.base`, `players.bench`;
- для новых H2H-страниц доступен `team_cost`, иначе средняя стоимость станет `NaN`.

В ответе `la_liga_2026_fr_primera` находятся 48 участников, 15 полных туров по 24 H2H-матча и fantasy-данные двух уже сыгранных туров. У матчей туров 1–2 заполнен счет, у будущих туров счет `0:0`. Скрипт `npm run import:h2h-calendar -- <URL> <season-file>` проверяет состав, дубли и границы лиг, затем переносит только пары в `config.matches`. Счет намеренно не копируется: приложение рассчитывает его из `results_by_tour`, сохраняя один источник истины. Для ЛЧ количество ключей `data.matches` также используется как граница первого внешнего этапа.

## API `sport_players_tour_stat`

```text
GET https://fantasy-h2h.ru/api/fnts_tournament/sport_players_tour_stat/{fantasy_tournament}/{tourNumber}
```

Пример: `/sport_players_tour_stat/la_liga_2025/1`.

```ts
interface TourStatResponse {
  result: number;
  data: {
    tournament: {
      id: string;
      title: string;
      season: string;
    };
    players: Record<string, SportPlayer>;
  };
}

interface SportPlayer {
  id: string;
  name: string;
  amplua_id: string;
  team_id: string;
  cost: number;
  stat_by_tours: Record<string, {
    score: number;
    match_time: number;
  }>;
}
```

В живом ответе первого тура Ла Лиги 2025–26 было 721 футболист. Компонент использует endpoint для расшифровки roster player id, позиции, клуба, популярности выбора и отдельных сезонных призов. UI сопоставляет `amplua_id` 9/10/11/12 с вратарем/защитником/полузащитником/нападающим.

H2H-страница может загрузить endpoint каждого прошедшего тура. Для двухэтапной ЛЧ используются `tour_link` и `tour_link_2`, а номера второго этапа логически продолжают первый. API не содержит статистику красных карточек. Поле `cost` доступно, но отдельного признака «футболист был учтён в результате фэнтези-команды» на дату проверки нет.

## Объединение двух внешних этапов

Лига чемпионов 2025–26 использует два `full_info` и два `tour_stat` URL. Текущий алгоритм:

1. первый ответ сохраняется как основной `squads`;
2. определяется число туров первого этапа;
3. результаты второго этапа добавляются совпавшему профилю с новым номером тура;
4. `total_score` второго этапа увеличивается на итог первого этапа;
5. rosters и tours второго этапа получают смещенные номера;
6. для справочника футболистов словари двух последних туров объединяются по player id.

Один и тот же участник должен присутствовать в обоих ответах. Сейчас отсутствие `player2` не обрабатывается.

## Локальные snapshots

`src/assets/data/2024_2025/spain/squads.json` и `tours/tour1.json` … `tour38.json` повторяют API-контракты старого сезона. Они полезны для разработки схем, регрессионных тестов и анализа изменений API, но приложение их не читает. Snapshot roster 2024–25 не всегда содержит `team_cost`.

## Валидация нового сезона

Перед подключением конфигурации следует автоматически проверить:

1. уникальность profile id и наличие всех участников во всех источниках;
2. непрерывность номеров туров;
3. наличие результата и roster для каждой пары `profile × tour`;
4. ровно одну игру участника в рамках ожидаемого тура/лиги;
5. отсутствие самоигр и дубликатов пар;
6. соответствие `stages.firstTour/lastTour` ключам `matches`;
7. согласованность трех cup-массивов;
8. существование всех logo/icon/image путей;
9. существование всех player/team/profile id из набора сезонных правил.
