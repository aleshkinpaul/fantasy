import {
  CompetitionPrizeConfig,
  CompetitionPrizeReference,
  SeasonCompetitionConfig,
} from '../models/competition.models';

interface PrizeTemplate {
  prize: CompetitionPrizeConfig;
  iconFile: string;
}

const PRIZE_TEMPLATES: Record<string, PrizeTemplate> = {
  'martin-league': {
    iconFile: 'real-madrid.png',
    prize: {
      id: 6,
      name: '"Лига Мартина"',
      author: 'Мартин Бабаян',
      condition: 'Лучшая команда, в составе которой ни разу не было игроков Барселоны, Атлетико и Пабло Маффео',
      reward: 'Фанатская Роза Реал Мадрид',
      isFinalStage: true,
      isActivity: false,
      excluded: [],
      nomineesArr: [],
    },
  },
  'soft-kitty': {
    iconFile: 'paw.png',
    prize: {
      id: 19,
      name: '"Soft Kitty"',
      author: 'Мартин Бабаян',
      condition: 'Поражение с самой большой разницей в фэнтези-очках, начиная с 3 тура и среди активных участников (Приз в честь песни, которую Пенни поет Шелдону, когда ему грустно или он заболел)',
      reward: 'Горячий напиток на выбор победителя в любом баре',
      isFinalStage: false,
      isActivity: true,
      excluded: [],
      nomineesArr: [],
    },
  },
};

export function resolveCompetitionPrizes(config: SeasonCompetitionConfig): CompetitionPrizeConfig[] {
  const inlinePrizes = config.prizes.map(clonePrize);
  const referencedPrizes = (config.prizeRefs ?? []).map(reference => resolvePrize(reference, config.yearStart));
  const prizes = [...inlinePrizes, ...referencedPrizes];
  const duplicateId = prizes.find((prize, index) => prizes.findIndex(item => item.id === prize.id) !== index)?.id;

  if (duplicateId !== undefined) {
    throw new Error(`Приз ${duplicateId} подключен к сезону несколько раз`);
  }

  return prizes;
}

function resolvePrize(reference: CompetitionPrizeReference, yearStart: number): CompetitionPrizeConfig {
  const template = PRIZE_TEMPLATES[reference.key];
  if (!template) throw new Error(`Не найден шаблон приза ${reference.key}`);

  const { iconFile, prize } = template;
  return clonePrize({
    ...prize,
    icon: `assets/logos/${yearStart}/icons/${iconFile}`,
    ...reference.overrides,
  });
}

function clonePrize(prize: CompetitionPrizeConfig): CompetitionPrizeConfig {
  return {
    ...prize,
    excluded: prize.excluded ? [...prize.excluded] : undefined,
    defaultNomineesArr: prize.defaultNomineesArr ? [...prize.defaultNomineesArr] : undefined,
    nomineesArr: prize.nomineesArr ? [...prize.nomineesArr] : undefined,
    activeLeaders: prize.activeLeaders ? [...prize.activeLeaders] : undefined,
  };
}
