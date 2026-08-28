import { CompetitionRuntimeRules } from '../models/competition.models';

const RULES: Record<string, CompetitionRuntimeRules> = {
  'season-2025': {
    playerStats: {
      forbiddenTeamIds: ['7655', '7654'],
      forbiddenPlayerIds: ['213875'],
      worldCupForbiddenPlayerIds: [
        '230526', '230534', '230542', '230546', '230544',
        '230553', '230633', '230860', '230861', '230862',
        '230868', '230874', '230875', '230879', '230880',
        '230882', '230884', '231768', '231111', '231139',
        '231194', '231274', '231473', '231480', '231500',
      ],
      portugueseTeamId: '8182',
      larinPlayerId: '230935',
    },
    spainPrizes: {
      guestProfileIds: ['1028890564', '1116311743', '154819672'],
      extraWinnerIds: ['1063076888', '1116843193'],
      specialGuestId: '1028890564',
      frequentPlayerId: '213955',
      frequentCaptainId: '213946',
      randomPrizeIndex: 13,
      placeReferenceProfileIds: {
        prize2: '1115308799',
        prize3: '1113412675',
        prize10: '1116311079',
      },
    },
    prizeMetrics: {
      maxLosingDifferenceFirstTour: 3,
    },
    substitutions: {
      spain: {
        defaultLimit: 3,
        limitsByTourIndex: { '19': 4, '20': 4, '21': 4 },
      },
      'world-cup': {
        defaultLimit: 0,
        limitsByTourIndex: {
          '1': 4,
          '2': 4,
          '3': 15,
          '4': 4,
          '5': 4,
          '6': 6,
          '7': 6,
        },
      },
    },
  },
  'season-2026': {
    playerStats: {
      forbiddenTeamIds: ['8368', '8369'],
      forbiddenPlayerIds: ['241107'],
      worldCupForbiddenPlayerIds: [],
      portugueseTeamId: '',
      larinPlayerId: '',
    },
    spainPrizes: {
      guestProfileIds: [],
      extraWinnerIds: [],
    },
    prizeMetrics: {
      maxLosingDifferenceFirstTour: 1,
    },
    substitutions: {
      spain: {
        defaultLimit: 3,
        limitsByTourIndex: { '19': 4, '20': 4, '21': 4 },
      },
    },
  },
};

export function getCompetitionRules(rulesId: string): CompetitionRuntimeRules {
  const rules = RULES[rulesId];
  if (!rules) throw new Error(`Не найден набор сезонных правил ${rulesId}`);
  return rules;
}
