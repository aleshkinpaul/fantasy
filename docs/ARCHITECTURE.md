# Архитектура приложения

## Технологический стек

- Angular 16.2, модульный bootstrap через `AppModule`;
- standalone-компоненты для всех страниц и виджетов;
- Angular Router с `PathLocationStrategy`;
- `HttpClient` и RxJS (`forkJoin`, `BehaviorSubject`);
- SCSS, общие переменные и миксины в `src/app/styles`;
- Karma/Jasmine для unit-тестов;
- Lottie-loader: пакет `@lottiefiles/dotlottie-web` и внешний web-component script из unpkg.

Строгая проверка Angular-шаблонов включена. Актуальный `LeagueH2HPageComponent` проходит обычную проверку TypeScript без `@ts-nocheck`; послабление пока остается в архивных больших компонентах. Глобальный `strict` TypeScript выключен.

## Запуск

`src/main.ts` загружает `AppModule`. Модуль подключает браузер, router, `HttpClientModule`, корневой standalone-компонент и HTTP-interceptor загрузчика.

`AppComponent` содержит общую оболочку:

```text
AppComponent
├── HeaderComponent
└── router-outlet
    └── выбранная страница турнира
```

Тема оболочки (`ucl`, `cwc`) и подзаголовок header определяются строкой текущего турнира в `DataService.urlName$`.

## Маршруты

| Route | Компонент | Примечание |
|---|---|---|
| `/` | `MainPageComponent` | главная навигация |
| `/spain/new` | `LeagueH2HPageComponent` | актуальная Ла Лига |
| `/spain` | `LeaguePageComponent` | архивная реализация |
| `/champions-league/new` | `LeagueH2HPageComponent` | актуальная ЛЧ |
| `/champions-league` | `LeaguePageComponent` | архивная реализация |
| `/world-cup/new` | `LeagueH2HPageComponent` | ЧМ-2026 |
| `/spain-cup` | `CupPageComponent` | пока пусто |
| `/club-world-cup` | `CWCPageComponent` | КЧМ-2025 |

Неизвестный route перенаправляется на `/`. Страницы турниров загружаются лениво через `loadComponent`.

Query-параметр `year` фактически обязателен: компоненты обращаются к `profiles[year]`. На главной все ссылки задают его явно. Число обозначает год начала сезона: `year=2025` соответствует 2025–26.

H2H-страница также сохраняет состояние вкладок в query-параметрах (точный набор задается методами `setQueryParam` и `updateTabs`).

## Основной поток данных

```mermaid
flowchart LR
    P[profiles.json] --> L[CompetitionDataLoaderService]
    K[consts.json] --> L
    A1[API full_info] --> L
    A2[API tour_stat] --> L
    L --> F[CompetitionFacade]
    G[season rules registry] --> F
    F --> D[domain calculators]
    D --> V[CompetitionViewModel]
    V --> C[LeagueH2HPageComponent]
    C --> U[таблицы / матчи / призы]
```

Актуальная H2H-страница использует последовательность:

1. параллельно читают `profiles.json`, `consts.json`, `teams.json`;
2. выбирают сезонную конфигурацию по `type` route и `yearStart`;
3. запрашивают один или два `squad_link`;
4. `competition-stages.merger.ts` без мутации входов сшивает два этапа и накопительные результаты;
5. loader загружает последнюю и потуровую статистику футболистов;
6. `CompetitionFacade` запускает H2H, таблицы, рейтинг, кубок, специальные показатели и призы;
7. компонент получает готовую модель и управляет только вкладками и query-параметрами.

Вычислительные модули находятся в `src/app/competition/domain`, загрузка и facade — в `competition/data`, валидация и наборы сезонных правил — в `competition/config`. Набор выбирается полем `rulesId` конфигурации; для старых snapshots действует совместимый fallback `season-${yearStart}`.

`LoaderInterceptor` вызывает loader для каждого HTTP-запроса и скрывает его через секунду после завершения. Сейчас loader хранит только boolean, поэтому параллельные запросы могут преждевременно скрыть индикатор.

## Страницы и ответственность

### `LeagueH2HPageComponent`

Главная UI-реализация актуальных турниров. Компонент имеет около 260 строк и отвечает за route/query state, вкладки, выбор текущей лиги и передачу готовых данных дочерним компонентам. Прямых HTTP-запросов и сезонных расчетов в нем нет.

Оркестрация находится в `CompetitionFacade`. Результат матча и потуровая агрегация выполняются `LeagueH2HDataService`; остальные расчеты разделены на `standings-calculator`, `rating-calculator`, `cup-calculator`, `player-stats-calculator` и `prize-calculator`.

Алгоритм H2H:

1. взять `tour_score` хозяина и гостя из `squads.data.players[id].team.results_by_tour[tour]`;
2. если абсолютная разница `<= drawGap`, зафиксировать ничью (для play-off порог обычно принудительно равен нулю);
3. начислить H2H-очки 3/1/0;
4. обновить FO, пропущенные FO и разницу;
5. обновить серии и призовые счетчики;
6. агрегировать Apertura + Clausura в Common.

### `LeaguePageComponent`

Архивная страница 2024–25. Показывает общий рейтинг по внешним фэнтези-очкам, медали за туры, изменения позиций и статистику использованных футболистов/трансферов. Собственный H2H-календарь здесь не рассчитывается.

### `CWCPageComponent` и `CwcDataService`

Отдельная модель командного КЧМ-2025:

- 12 команд по 3 профиля;
- три группы по четыре команды;
- три групповых тура;
- дополнительный отборочный тур;
- четвертьфинал, полуфинал, финал и матч за третье место.

В каждой встрече профили двух команд попарно сравниваются по FO. Разница до 3 FO включительно дает ничью в индивидуальной встрече. Командный результат складывается из индивидуальных встреч. Сортировка группы: H2H-очки, разница «голов» встреч, разница FO.

Пары play-off в `consts.tours[].matches` задаются индексами внутри динамически сформированного массива команд, а не стабильными team id. Это делает порядок команд частью контракта.

### Дочерние компоненты

- `StandingsComponent` показывает позиции и туровую динамику.
- `ScheduleComponent` показывает расписание выбранного профиля и данные соперника.
- `MatchesComponent` показывает все встречи по турам.
- `PrizesListComponent` отображает уже рассчитанные номинации.
- `HeaderComponent` реагирует на `DataService.urlName$`.
- `DefaultLoaderComponent` отображает Lottie-анимацию по `LoaderService.isLoading$`.

## Рейтинг и медали

Для актуальной H2H-страницы рейтинг, min/median/max, места и медали централизованы в domain. Похожий старый код остается только в архивных `LeaguePageComponent` и `CWCPageComponent`, которые сознательно не входили в текущий рефакторинг.

Формула актуального рейтинга сохраняет legacy-поведение:

- участники сортируются по `total_score`;
- туровые места используются для gold/silver/bronze;
- рейтинг использует коэффициенты `[19, 15, 12, 10, 9]`;
- строковая семантика медианы API 2025–26 сохранена ради точного совпадения эталона.

## Ошибки и наблюдаемость

- Глобального error view нет.
- Ошибка загрузки актуального турнира проходит через единый subscription facade и пишется в `logger`; отдельного error view пока нет.
- `logger` активен только на `localhost` и `127.0.0.1`.
- Retry, timeout и fallback на snapshots не реализованы.
- Локальные snapshots 2024–25 не подключаются автоматически и служат архивом/образцами.

## Сборка и публикация

Production build создается в `dist/fr-fantasy`, включает hashing и optimization. Лимит initial bundle: warning 500 KB, error 8 MB. Команда `mypage` задает `base-href=https://fr-fantasy.ru/`.

Так как используется `PathLocationStrategy`, production-сервер должен отдавать `index.html` для неизвестных frontend-маршрутов. Без SPA fallback прямое открытие URL даст 404.
