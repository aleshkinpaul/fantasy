import {
  CompetitionPrizeConfig,
  CompetitionPrizeReference,
  SeasonCompetitionConfig,
} from '../models/competition.models';
import { SPAIN_PRIZE_IDS } from './spain-prize.ids';

interface PrizeTemplate {
  prize: CompetitionPrizeConfig;
  iconFile?: string;
  authorProfileId?: string;
}

const PRIZE_TEMPLATES: Record<string, PrizeTemplate> = {
  'martin-league': {
    iconFile: 'real-madrid.png',
    authorProfileId: '5275903',
    prize: {
      id: SPAIN_PRIZE_IDS.MARTIN_LEAGUE,
      name: '"Лига Мартина"',
      author: 'Мартин Бабаян',
      condition: 'Лучшая команда по фэнтези-очкам, в составе которой ни разу не было игроков Барселоны, Атлетико и Пабло Маффео',
      reward: 'Секретный',
      isFinalStage: true,
      isActivity: false,
      excluded: [],
      nomineesArr: [],
    },
  },
  'soft-kitty': {
    iconFile: 'paw.png',
    authorProfileId: '5275903',
    prize: {
      id: SPAIN_PRIZE_IDS.SOFT_KITTY,
      name: '"Soft Kitty"',
      author: 'Мартин Бабаян',
      condition: 'Поражение с самой большой разницей в фэнтези-очках среди активных участников (Приз в честь песни, которую Пенни поет Шелдону, когда ему грустно или он заболел)',
      reward: 'Горячий напиток на выбор победителя в любом баре',
      isFinalStage: false,
      isActivity: true,
      excluded: [],
      nomineesArr: [],
    },
  },
  classic: {
    authorProfileId: '1076901343',
    prize: {
      id: SPAIN_PRIZE_IDS.CLASSIC,
      name: 'Классика',
      author: 'Данир Эрендженов',
      condition: 'Лучший результат по фэнтези-очкам за сезон',
      reward: 'Аутентичная футболка Реал Мадрид следующего сезона',
      isFinalStage: false,
      isActivity: false,
      excluded: [],
      nomineesArr: [],
    },
  },
  'spicy-pepe': {
    authorProfileId: '1116907944',
    prize: {
      id: SPAIN_PRIZE_IDS.SPICY_PEPE,
      name: 'Привкус Пепе',
      author: 'Александр Торопцев',
      condition: 'Больше всего красных карточек, полученных футболистами своей команды за сезон',
      reward: 'Жгуче острый соус',
      isFinalStage: false,
      isActivity: false,
      isPlaceholder: true,
      excluded: [],
      nomineesArr: [],
    },
  },
  'turtle-hunt': {
    authorProfileId: '1058102914',
    prize: {
      id: SPAIN_PRIZE_IDS.TURTLE_HUNT,
      name: 'Охота за черепахой',
      author: 'Александр Лаптев',
      condition: 'Победить Рамиза Алиева (BIG TURTLES) с максимальной разницей фэнтези-очков в матче лиги',
      reward: 'Секретный',
      isFinalStage: false,
      isActivity: false,
      excluded: [],
      nomineesArr: [],
    },
  },
  'handy-hands': {
    authorProfileId: '73116796',
    prize: {
      id: SPAIN_PRIZE_IDS.HANDY_HANDS,
      name: 'Очумелые ручки',
      author: 'Павел Алешкин',
      condition: 'Больше всего фэнтези-очков с лучшего по соотношению цена/качество полевого игрока сезона стоимостью не более 6',
      reward: 'Реплика футболки этого игрока текущего сезона',
      isFinalStage: false,
      isActivity: false,
      excluded: [],
      nomineesArr: [],
    },
  },
  'martin-points': {
    authorProfileId: '1116309099',
    prize: {
      id: SPAIN_PRIZE_IDS.MARTIN_POINTS,
      name: 'Че? Мартин!',
      author: 'Александр Цурков',
      condition: 'Больше всего фэнтези-очков, набранных футболистами с именем или фамилией Мартин за сезон',
      reward: '5 пачек семечек от Мартина',
      isFinalStage: false,
      isActivity: false,
      excluded: [],
      nomineesArr: [],
    },
  },
  'fire-match': {
    authorProfileId: '1113442132',
    prize: {
      id: SPAIN_PRIZE_IDS.FIRE_MATCH,
      name: 'Наш огооонь',
      author: 'Александр Акименко',
      condition: 'Победа в матче лиги с наибольшей суммой фэнтези-очков победителя и проигравшего',
      reward: 'Сувенир футбольной команды Факел (Воронеж)',
      isFinalStage: false,
      isActivity: false,
      excluded: [],
      nomineesArr: [],
    },
  },
  'first-hundred': {
    authorProfileId: '1116848369',
    prize: {
      id: SPAIN_PRIZE_IDS.FIRST_HUNDRED,
      name: 'СОТОЧКА',
      author: 'Иван Шураев',
      condition: 'Первые девушки, набравшие не менее 100 фэнтези-очков за допустимый тур без дублей реальных команд',
      reward: 'Спонсорский ужин с Fondo Poker',
      isFinalStage: false,
      isActivity: false,
      excluded: [],
      nomineesArr: [],
    },
  },
  'girl-power-primera': {
    iconFile: 'girl.png',
    authorProfileId: '1068332740',
    prize: {
      id: SPAIN_PRIZE_IDS.GIRL_POWER_PRIMERA,
      name: '"Girl Power" (Primera)',
      author: 'Даша Кузнецкая',
      condition: 'Лучшая женская команда в Primera',
      reward: 'Сумка-шопер с принтом в честь Петербурга',
      isFinalStage: true,
      isActivity: false,
      excluded: [],
      nomineesArr: [],
    },
  },
  'girl-power-segunda': {
    iconFile: 'girl.png',
    authorProfileId: '1068332740',
    prize: {
      id: SPAIN_PRIZE_IDS.GIRL_POWER_SEGUNDA,
      name: '"Girl Power" (Segunda)',
      author: 'Даша Кузнецкая',
      condition: 'Лучшая женская команда в Segunda',
      reward: 'Сумка-шопер с принтом в честь Петербурга',
      isFinalStage: true,
      isActivity: false,
      excluded: [],
      nomineesArr: [],
    },
  },
  'legendary-seven': {
    authorProfileId: '152317185',
    prize: {
      id: SPAIN_PRIZE_IDS.LEGENDARY_SEVEN,
      name: 'Легендарная Семерка',
      author: 'Равил Магеррамов',
      condition: '7 место в общем зачёте по фэнтези-очкам',
      reward: 'Торт ручной работы супруги автора',
      isFinalStage: false,
      isActivity: false,
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

  const { iconFile, prize, authorProfileId } = template;
  const excluded = [
    ...(prize.excluded ?? []),
    ...(reference.overrides?.excluded ?? []),
    ...(authorProfileId ? [authorProfileId] : []),
  ].filter((profileId, index, values) => values.indexOf(profileId) === index);
  return clonePrize({
    ...prize,
    ...(iconFile ? { icon: `assets/logos/${yearStart}/icons/${iconFile}` } : {}),
    ...reference.overrides,
    excluded,
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
