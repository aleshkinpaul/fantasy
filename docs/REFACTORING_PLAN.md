# План рефакторинга актуального приложения

> Статус на 28 августа 2026 года: этапы characterization tests, типизации API/domain/prize-контура, централизованной загрузки, facade, конфигурации сезонных правил, удаления `@ts-nocheck`, error view, устранения дублирования календаря и разбиения сезонных файлов выполнены. Данные 2025–26 совпадают с golden-файлами. Остаются дополнительные unit/UI-тесты и типизация оставшегося page-state.

## Цель

Сделать код актуальных турниров проще, типобезопаснее и масштабируемее, убрать дублирование загрузки и расчетов, а сезон 2026–27 подключать в основном через конфигурацию.

Неподвижное условие: рефакторинг не должен изменить ни одного результата сезона 2025–26 — очки матчей, исходы, порядок таблиц, кубковые показатели, значения и порядок номинантов призов должны совпасть с текущей реализацией.

Исходная контрольная точка: commit `fffda16` (`refactor: consolidate frontend and document project`).

## Границы работ

### Входит в рефакторинг

- `LeagueH2HPageComponent` — общая страница Ла Лиги, Лиги чемпионов и ЧМ;
- `LeagueH2HDataService`;
- `StandingsComponent`;
- `ScheduleComponent`;
- `MatchesComponent`;
- `PrizesListComponent`;
- `MainPageComponent`, `HeaderComponent`, `AppComponent` в части выбора турнира и сезона;
- `DataService`, `LoaderService`, `LoaderInterceptor`;
- актуальные файлы `assets/data/seasons/2025-26/*.json`;
- модели, загрузка API, нормализация, H2H-расчеты, таблицы, кубок и призы.

Актуальные контрольные URL:

```text
/spain/new?year=2025
/champions-league/new?year=2025
/world-cup/new?year=2025
```

### Не входит

- `LeaguePageComponent` и архивные `/spain?year=2024`, `/champions-league?year=2024`;
- `CWCPageComponent`, `CwcDataService` и `/club-world-cup`;
- пустой `CupPageComponent`;
- изменение регламента, формул призов или визуального дизайна;
- обновление Angular и других крупных зависимостей;
- добавление сезона 2026–27 до достижения полного совпадения 2025–26.

Архивный код можно оставить на месте. Новая архитектура не обязана поддерживать его модели или переиспользовать его сервисы.

## Стратегия защиты данных

Нельзя использовать только скриншоты или ручную проверку таблиц. До первого изменения расчетной логики нужен воспроизводимый эталон.

### Зафиксированные входные данные

Создать компактные fixtures для каждого актуального турнира:

```text
src/testing/fixtures/2025-26/
├── spain/
│   ├── config.json
│   ├── profiles.json
│   ├── full-info.json
│   └── tour-players.json
├── champions-league/
│   ├── config.json
│   ├── profiles.json
│   ├── full-info-stage-1.json
│   ├── full-info-stage-2.json
│   └── tour-players.json
└── world-cup/
    ├── config.json
    ├── profiles.json
    ├── full-info.json
    └── tour-players.json
```

Fixtures должны быть получены один раз из фактических ответов API и больше не обновляться автоматически. Из ответов следует оставить только поля, реально влияющие на расчет, чтобы не хранить десятки мегабайт повторяющихся данных.

Минимальный состав fixture:

- туры и их номера;
- profile id и данные фэнтези-команд;
- `tour_score`, `total_score`, `total_place`, `tour_place`;
- `team_cost`, `captain_id`, base и bench каждого тура;
- player id, `team_id`, `amplua_id` и score по турам;
- локальный календарь, этапы, лиги, cup и prizes.

### Эталонные выходные данные

Текущий код должен сформировать golden files:

```text
src/testing/golden/2025-26/{competition}/
├── matches.json
├── standings.json
├── cup.json
├── prizes.json
└── squads.json
```

Состав эталона:

1. **Матчи** — тур, home/away id, `home_score`, `away_score`, `result`.
2. **Таблицы** — ordered-массив для Common и каждой лиги/стадии: место, id, wins, draws, loses, H2H points, FO, missed FO, diff FO.
3. **Кубок** — пары, счет, результат и все рассчитанные cup-показатели профилей.
4. **Призы** — prize id/state, ordered nominees с `value` и `sortParam`, ordered active leaders.
5. **Squads** — итоговые score/place, медали, rating, стоимость, замены и специальные показатели.

Порядок массивов является частью результата. Перед записью нужно удалять только UI-ссылки, циклические объекты и недетерминированные поля; числовые значения, строки и порядок не нормализовать «для удобства».

### Автоматический барьер

Добавить команду:

```text
npm run verify:season-2025
```

Она должна:

1. запустить новый расчет на зафиксированных fixtures;
2. сравнить результат с golden files;
3. при различии завершиться с ненулевым кодом;
4. вывести точный JSON path, старое и новое значение;
5. дополнительно вывести SHA-256 каждого итогового файла.

Golden files нельзя автоматически перезаписывать обычной тестовой командой. Для их осознанного обновления нужна отдельная команда `update:season-2025-golden`, которую запрещено запускать во время рефакторинга без подтвержденного изменения регламента.

## Целевая архитектура

```text
competition/
├── api/
│   ├── fantasy-h2h-api.client.ts
│   └── fantasy-h2h-api.models.ts
├── config/
│   ├── competition-config.models.ts
│   ├── competition-config.repository.ts
│   └── competition-config.validator.ts
├── domain/
│   ├── match-calculator.ts
│   ├── standings-calculator.ts
│   ├── squad-stats-calculator.ts
│   ├── cup-calculator.ts
│   ├── rating-calculator.ts
│   └── prizes/
│       ├── prize-calculator.ts
│       └── prize-registry.ts
├── data/
│   ├── competition-data.normalizer.ts
│   ├── competition-stages.merger.ts
│   └── competition.facade.ts
└── ui/
    ├── competition-page.component.ts
    └── существующие презентационные компоненты
```

Это ориентир, а не требование создать класс на каждую функцию. Простые расчеты предпочтительно оставлять чистыми функциями. Angular-сервисы нужны только там, где есть DI, HTTP или состояние.

### Направление зависимостей

```text
UI → Facade → normalizer/domain → typed models
             ↓
          API client
```

Domain не импортирует Angular, `HttpClient`, компоненты или browser API. API DTO никогда не мутируются: normalizer создает отдельную доменную модель.

## Этапы выполнения

### Этап 0. Зафиксировать область и контрольную точку

Работы:

- считать `fffda16` исходным состоянием;
- не менять архивные routes и компоненты;
- записать список актуальных URL и API endpoint;
- не совмещать рефакторинг с CSS, Angular upgrade или новым регламентом.

Критерий завершения: рабочее дерево чистое, production build проходит.

### Этап 1. Создать characterization tests

Работы:

- снять компактные fixtures трех турниров;
- получить golden output непосредственно из текущей реализации;
- добавить JSON comparator и `verify:season-2025`;
- добавить несколько явных unit-тестов граничных правил.

Обязательные примеры unit-тестов:

- разница FO 0 и ровно `drawGap` дает ничью;
- разница `drawGap + 1` дает победу;
- H2H начисляет 3/1/0;
- Common равен сумме Apertura и Clausura;
- сортировка сохраняет текущие tie-breakers;
- play-off использует текущий порог ничьей;
- два этапа ЛЧ корректно смещают туры и cumulative score;
- substitutions и team cost повторяют текущие значения.

Gate: все golden files созданы, повторный запуск дает побайтово/семантически тот же результат, build проходит.

### Этап 2. Типизировать внешнюю границу

Работы:

- ввести отдельные типы `FullInfoResponse` и `TourStatResponse`;
- описать актуальный `SeasonCompetitionConfig` без полей КЧМ;
- разделить API DTO, domain и view models;
- на границе преобразовать score/place из строк в числа;
- добавить валидатор обязательных profile/tour/roster связей;
- реализовать понятную ошибку для отсутствующего/невалидного `year`.

На этом этапе расчеты не переписываются: типизированная модель адаптируется к старому компоненту.

Gate: `verify:season-2025` без различий; нет новых `any`; build и tests проходят.

### Этап 3. Централизовать загрузку и объединение этапов

Работы:

- выделить `FantasyH2hApiClient` только для HTTP;
- выделить repository локальных profiles/config;
- заменить вложенные `subscribe` единым RxJS pipeline;
- вынести объединение двух этапов ЛЧ в чистую функцию;
- не мутировать ответы API;
- добавить состояния `loading / ready / error`;
- исправить loader на счетчик активных запросов либо сделать его частью facade.

Gate: одинаковые normalized inputs и golden outputs для всех трех турниров, включая ЛЧ.

### Этап 4. Вынести H2H и таблицы в чистый domain

Работы:

- перенести расчет результата матча;
- перенести wins/draws/loses/points и FO;
- перенести серии и счетчики специальных результатов;
- перенести расчет таблиц и мест в лигах;
- явно описать tie-breakers;
- перенести медали, rating, min/median/max, squad changes и team cost;
- убрать дублирование между компонентом и `LeagueH2HDataService`.

Новая реализация сначала запускается рядом со старой в тестах. Старые методы удаляются только после полного совпадения каждого output-раздела.

Gate: нулевой diff `matches.json`, `standings.json`, `squads.json` для Spain, UCL и World Cup.

### Этап 5. Вынести кубок

Работы:

- создать чистый расчет cup rounds и profile cup stats;
- сохранить существующую семантику ничьей и `lowest_winning_pos_diff`;
- валидировать синхронность `matchesTours`, names и matches;
- отделить исходную сетку от рассчитанного результата.

Gate: нулевой diff `cup.json` по всем соревнованиям.

### Этап 6. Вынести призы в registry стратегий

Работы:

- для каждого текущего prize id создать именованную стратегию;
- перенести формулы без изменения арифметики, фильтрации и сортировки;
- вынести profile/player/team ids и параметры приза из компонента в config;
- сохранить `excluded`, `isActivity`, `isFinalStage`, state и порядок nominees;
- разделить общие правила и правила Spain/UCL/World Cup.

На первом проходе запрещено «исправлять» подозрительные формулы: сначала точная совместимость, затем отдельное согласованное изменение бизнес-правил.

Gate: нулевой diff `prizes.json`, включая values, sortParam, nominees и active leaders.

### Этап 7. Создать facade и упростить page-компонент

Работы:

- `CompetitionFacade` принимает `{type, yearStart}`;
- facade отдает готовую immutable view model;
- page-компонент оставляет route state и переключение вкладок;
- `Standings`, `Schedule`, `Matches`, `PrizesList` получают типизированные inputs;
- убрать вычисления из HTML-выражений и повторные `.find()` в template;
- сохранить существующие URL, query params и DOM-поведение.

Целевой размер page TypeScript — ориентировочно до 250–350 строк, без `@ts-nocheck` и без прямого `HttpClient`.

Gate: все data-golden тесты проходят; добавлены smoke/e2e проверки трех URL и вкладок.

### Этап 8. Сделать конфигурацию сезонной

Работы:

- хранить каждый актуальный турнир в `assets/data/seasons/{YYYY-YY}/{type}.json`;
- использовать `matches` как единственный источник матчей и расписания;
- вынести substitutions, special ids, draw rules и prize settings в config;
- сделать fallback icons независимыми от каталога `2025`;
- добавить скрипт проверки profiles, календаря, cup и assets.

Gate: сезон 2025–26 загружается из новой конфигурации с нулевым golden diff.

### Этап 9. Финальная очистка

Работы:

- удалить старые методы H2H из компонента;
- удалить мертвые поля и debug `console.log`;
- убрать `@ts-nocheck` в актуальном контуре;
- включить более строгие TypeScript flags постепенно;
- удалить временный dual-run только после полного набора тестов;
- обновить архитектурную документацию.

Архивные компоненты не удалять и не чинить в этом этапе.

Gate: чистый build, unit/golden/e2e tests, нулевой diff всех данных сезона.

## Проверки после каждого этапа

```text
npm run build
npm test -- --watch=false --browsers=ChromeHeadless
npm run verify:season-2025
```

Дополнительно после UI-этапов:

- открыть три актуальных URL напрямую;
- проверить refresh на вложенном route;
- проверить все tabs/conferences/tours/cup tours;
- проверить отсутствие `undefined`, `NaN` и console errors;
- сделать desktop/mobile smoke screenshots.

## Правила работы с golden данными

- Любое различие считается регрессией, пока не доказано обратное.
- Нельзя обновлять golden только для того, чтобы тест снова стал зеленым.
- Если найден баг текущего сезона, его исправление оформляется отдельной задачей после рефакторинга или отдельным согласованным commit с описанием ожидаемого изменения данных.
- Изменение только представления допускается, если data-golden полностью совпадает.
- Сетевой API не используется в регулярном regression test: только зафиксированные fixtures.

## Рекомендуемые границы коммитов

1. `test: capture 2025-26 competition baselines`
2. `refactor: type competition API and config boundaries`
3. `refactor: centralize competition data loading`
4. `refactor: extract match and standings domain`
5. `refactor: extract cup calculations`
6. `refactor: extract prize strategies`
7. `refactor: introduce competition facade`
8. `refactor: split current season configuration`
9. `refactor: remove legacy logic from current competition page`

Каждый commit должен самостоятельно проходить `verify:season-2025`. Это позволяет локализовать любое расхождение через `git bisect`.

## Определение готовности к сезону 2026–27

Рефакторинг готов к следующему сезону, когда:

- новый турнир создается добавлением profiles/config/assets;
- component и domain calculators не содержат проверок `year === 2025`;
- все специальные id находятся в конфигурации;
- один и тот же engine обслуживает Spain, UCL и World Cup;
- старые и новые результаты сезона 2025–26 полностью совпадают;
- не осталось `@ts-nocheck` и прямых HTTP-запросов в актуальном page-компоненте;
- валидатор до запуска UI сообщает о пропущенных профилях, турах, roster, матчах и assets.
