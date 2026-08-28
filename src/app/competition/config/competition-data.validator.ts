import {
  FantasyFullInfoResponse,
  LoadedCompetitionData,
  SeasonCompetitionConfig,
} from '../models/competition.models';

export function validateCompetitionData(
  data: Pick<LoadedCompetitionData, 'config' | 'profiles' | 'squads' | 'squads2'>,
): void {
  validateCompetitionConfig(data.config);

  const localProfileIds = new Set(data.profiles.map(profile => profile.id));
  const missingLocalProfiles = data.config.profiles.filter(id => !localProfileIds.has(id));
  if (missingLocalProfiles.length) {
    throw new Error(`В profiles.json отсутствуют участники: ${missingLocalProfiles.join(', ')}`);
  }

  validateFullInfo(data.squads, data.config.profiles, 'squad_link');
  if (data.squads2) validateFullInfo(data.squads2, data.config.profiles, 'squad_link_2');
}

export function validateCompetitionConfig(config: SeasonCompetitionConfig): void {
  if (!config.profiles.length) throw new Error(`В конфигурации ${config.type} нет участников`);

  const uniqueProfiles = new Set(config.profiles);
  if (uniqueProfiles.size !== config.profiles.length) {
    throw new Error(`В конфигурации ${config.type} есть повторяющиеся profile id`);
  }

  const calendarTours = validateCalendar(config, uniqueProfiles);
  validateStages(config, uniqueProfiles, calendarTours.at(-1)!);
  validateCup(config, uniqueProfiles);
}

function validateCalendar(config: SeasonCompetitionConfig, profileIds: Set<string>): number[] {
  const calendarTours = Object.keys(config.matches)
    .map(tour => Number(tour))
    .sort((left, right) => left - right);

  if (!calendarTours.length) throw new Error(`В конфигурации ${config.type} нет календаря матчей`);
  if (calendarTours.some(tour => !Number.isInteger(tour) || tour < 1)) {
    throw new Error(`В конфигурации ${config.type} есть некорректный номер тура`);
  }

  calendarTours.forEach((tour, index) => {
    const expectedTour = index + 1;
    if (tour !== expectedTour) {
      throw new Error(`В календаре ${config.type} отсутствует тур ${expectedTour}`);
    }

    const participants = new Set<string>();
    for (const match of config.matches[tour]) {
      validateMatchProfiles(match.home, match.away, profileIds, `туре ${tour}`);
      if (participants.has(match.home)) {
        throw new Error(`Участник ${match.home} повторяется в туре ${tour}`);
      }
      if (participants.has(match.away)) {
        throw new Error(`Участник ${match.away} повторяется в туре ${tour}`);
      }
      participants.add(match.home);
      participants.add(match.away);
    }
  });

  return calendarTours;
}

function validateStages(
  config: SeasonCompetitionConfig,
  profileIds: Set<string>,
  lastCalendarTour: number,
): void {
  if (!config.stages.length) throw new Error(`В конфигурации ${config.type} нет этапов`);

  let previousLastTour = 0;
  for (const stage of config.stages) {
    if (stage.firstTour < 1 || stage.lastTour < stage.firstTour) {
      throw new Error(`Некорректные границы этапа ${stage.name}`);
    }
    if (stage.firstTour !== previousLastTour + 1) {
      throw new Error(`Этап ${stage.name} должен начинаться с тура ${previousLastTour + 1}`);
    }
    if (stage.lastTour > lastCalendarTour) {
      throw new Error(`Этап ${stage.name} выходит за границы календаря`);
    }
    if (!stage.leagues.length) throw new Error(`В этапе ${stage.name} нет лиг`);

    const leagueByProfile = new Map<string, string>();
    for (const league of stage.leagues) {
      if (!league.profiles.length) throw new Error(`В лиге ${league.name} нет участников`);

      for (const profileId of league.profiles) {
        if (!profileIds.has(profileId)) {
          throw new Error(`В лиге ${league.name} неизвестный участник ${profileId}`);
        }
        const previousLeague = leagueByProfile.get(profileId);
        if (previousLeague) {
          throw new Error(`Участник ${profileId} одновременно входит в лиги ${previousLeague} и ${league.name}`);
        }
        leagueByProfile.set(profileId, league.name);
      }
    }

    for (let tour = stage.firstTour; tour <= stage.lastTour; tour++) {
      const matchesByLeague = new Map(stage.leagues.map(league => [league.name, 0]));
      for (const match of config.matches[tour]) {
        const homeLeague = leagueByProfile.get(match.home);
        const awayLeague = leagueByProfile.get(match.away);
        if (!homeLeague || !awayLeague) {
          const missingId = !homeLeague ? match.home : match.away;
          throw new Error(`Участник ${missingId} из тура ${tour} не входит ни в одну лигу этапа ${stage.name}`);
        }
        if (homeLeague !== awayLeague) {
          throw new Error(`Матч ${match.home} — ${match.away} в туре ${tour} пересекает лиги этапа ${stage.name}`);
        }
        matchesByLeague.set(homeLeague, matchesByLeague.get(homeLeague)! + 1);
      }

      for (const league of stage.leagues) {
        const expectedMatches = Math.floor(league.profiles.length / 2);
        const actualMatches = matchesByLeague.get(league.name)!;
        if (actualMatches !== expectedMatches) {
          throw new Error(
            `В лиге ${league.name} тура ${tour} ожидается ${expectedMatches} матчей, получено ${actualMatches}`,
          );
        }
      }
    }

    previousLastTour = stage.lastTour;
  }
}

function validateCup(config: SeasonCompetitionConfig, profileIds: Set<string>): void {
  const cup = config.cup;
  if (!cup) return;

  if (cup.matchesTours.length !== cup.matches.length) {
    throw new Error(`В кубке ${config.type} не совпадает количество туров и раундов`);
  }
  if (cup.matchesToursNames && cup.matchesToursNames.length !== cup.matches.length) {
    throw new Error(`В кубке ${config.type} не совпадает количество названий и раундов`);
  }

  cup.matches.forEach((matches, roundIndex) => {
    const participants = new Set<string>();
    for (const match of matches) {
      validateMatchProfiles(match.home, match.away, profileIds, `раунде кубка ${roundIndex + 1}`);
      if (participants.has(match.home) || participants.has(match.away)) {
        const duplicateId = participants.has(match.home) ? match.home : match.away;
        throw new Error(`Участник ${duplicateId} повторяется в раунде кубка ${roundIndex + 1}`);
      }
      participants.add(match.home);
      participants.add(match.away);
    }
  });
}

function validateMatchProfiles(
  homeId: string,
  awayId: string,
  profileIds: Set<string>,
  context: string,
): void {
  if (homeId === awayId) throw new Error(`Самоигра ${homeId} в ${context}`);
  if (!profileIds.has(homeId)) {
    throw new Error(`Участник ${homeId} в ${context} отсутствует в config.profiles`);
  }
  if (!profileIds.has(awayId)) {
    throw new Error(`Участник ${awayId} в ${context} отсутствует в config.profiles`);
  }
}

function validateFullInfo(response: FantasyFullInfoResponse, profileIds: string[], source: string): void {
  if (response.result !== 1 || !response.data) throw new Error(`API ${source} вернул неуспешный ответ`);
  const tours = Object.keys(response.data.tours);
  if (!tours.length) throw new Error(`API ${source} не содержит туров`);

  for (const profileId of profileIds) {
    const participant = response.data.players[profileId];
    if (!participant) throw new Error(`API ${source} не содержит участника ${profileId}`);

    for (const tour of tours) {
      if (!participant.team.results_by_tour[tour]) {
        throw new Error(`API ${source}: нет результата ${profileId} в туре ${tour}`);
      }
      if (!participant.team.rosters_by_tour[tour]) {
        throw new Error(`API ${source}: нет состава ${profileId} в туре ${tour}`);
      }
    }
  }
}
