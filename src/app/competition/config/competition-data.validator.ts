import {
  FantasyFullInfoResponse,
  LoadedCompetitionData,
  SeasonCompetitionConfig,
} from '../models/competition.models';

export function validateCompetitionData(data: LoadedCompetitionData): void {
  validateConfig(data.config);

  const localProfileIds = new Set(data.profiles.map(profile => profile.id));
  const missingLocalProfiles = data.config.profiles.filter(id => !localProfileIds.has(id));
  if (missingLocalProfiles.length) {
    throw new Error(`В profiles.json отсутствуют участники: ${missingLocalProfiles.join(', ')}`);
  }

  validateFullInfo(data.squads, data.config.profiles, 'squad_link');
  if (data.squads2) validateFullInfo(data.squads2, data.config.profiles, 'squad_link_2');
}

function validateConfig(config: SeasonCompetitionConfig): void {
  if (!config.profiles.length) throw new Error(`В конфигурации ${config.type} нет участников`);

  const uniqueProfiles = new Set(config.profiles);
  if (uniqueProfiles.size !== config.profiles.length) {
    throw new Error(`В конфигурации ${config.type} есть повторяющиеся profile id`);
  }

  for (const [tour, matches] of Object.entries(config.matches)) {
    for (const match of matches) {
      if (match.home === match.away) throw new Error(`Самоигра ${match.home} в туре ${tour}`);
      if (!uniqueProfiles.has(match.home)) {
        throw new Error(`Участник ${match.home} из тура ${tour} отсутствует в config.profiles`);
      }
      if (!uniqueProfiles.has(match.away)) {
        throw new Error(`Участник ${match.away} из тура ${tour} отсутствует в config.profiles`);
      }
    }
  }

  for (const stage of config.stages) {
    if (stage.firstTour < 1 || stage.lastTour < stage.firstTour) {
      throw new Error(`Некорректные границы этапа ${stage.name}`);
    }
    for (const league of stage.leagues) {
      const missing = league.profiles.filter(id => !uniqueProfiles.has(id));
      if (missing.length) {
        throw new Error(`В лиге ${league.name} неизвестные участники: ${missing.join(', ')}`);
      }
    }
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
