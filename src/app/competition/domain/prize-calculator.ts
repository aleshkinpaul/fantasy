import {
  IProfileDetails,
  IPrizeNominee,
  IRuntimePrize,
} from '../../models/domain';
import {
  CompetitionPrizeConfig,
  LocalProfile,
  SportPlayer,
  SpainPrizeRules,
} from '../models/competition.models';
import { SPAIN_PRIZE_IDS } from '../config/spain-prize.ids';

type PrizeSourceProfile = LocalProfile & Partial<IProfileDetails>;

interface ManualPrizeNominee {
  profileId: string;
  points: number;
}

export interface PrizeCalculationInput {
  prizes: CompetitionPrizeConfig[];
  profiles: PrizeSourceProfile[];
  profilesDetails: IProfileDetails[];
  random?: () => number;
}

export interface SpainPrizeCalculationInput extends PrizeCalculationInput {
  rules: SpainPrizeRules;
  sportPlayers?: SportPlayer[];
}

function updatePrizeStates(prizes: CompetitionPrizeConfig[]): void {
  prizes.forEach(prize => {
    const nomineesCount = prize.nomineesArr?.length ?? 0;
    if (prize.isFinalStage) prize.state = 2;
    if (nomineesCount) prize.state = 1;
    if (!prize.state && !nomineesCount) prize.state = 3;
  });
}

function countSpainPrizeNominees(
  prizes: CompetitionPrizeConfig[],
  allProfiles: PrizeSourceProfile[],
  profilesDetails: IProfileDetails[],
  eligibleProfiles: PrizeSourceProfile[],
  prizeId: number,
  rules: SpainPrizeRules,
  keyId = '',
): void {
  const prize = requirePrize(prizes, prizeId);
  const sortValueAscending = [1, 2, 3, 9, 10].includes(prizeId);
  const sortParamAscending = prizeId === 18;
  const manualNominees = (prize.nomineesArr ?? []).filter(isManualPrizeNominee);
  const detailedProfiles = new Map(profilesDetails.map(profile => [profile.id, profile]));
  const calculatedNominees = new Map<string, IPrizeNominee>();

  const placeVal2Prize = prizeId === 2
    ? getPrimeraPlace(profilesDetails, requirePlaceReference(rules, 'prize2'))
    : 0;
  const placeVal3Prize = prizeId === 3
    ? getPrimeraPlace(profilesDetails, requirePlaceReference(rules, 'prize3'))
    : 0;
  const placeVal10Prize = prizeId === 10
    ? getPrimeraPlace(profilesDetails, requirePlaceReference(rules, 'prize10'))
    : 0;

  eligibleProfiles.forEach(sourceProfile => {
    const manualNominee = manualNominees.find(nominee => nominee.profileId === sourceProfile.id);

    if (prizeId === 7 && rules.guestProfileIds.includes(sourceProfile.id)) {
      const guestNominee = initializeGuestNominee(sourceProfile, manualNominee?.points ?? 0, prizeId);
      calculatedNominees.set(guestNominee.id, guestNominee);
      return;
    }

    const profile = detailedProfiles.get(sourceProfile.id);
    if (!profile) throw new Error(`Не найден runtime-профиль ${sourceProfile.id} для приза ${prizeId}`);

    profile.prizes[prizeId] = {
      value: getSpainPrizeValue(
        profile,
        prizeId,
        manualNominee?.points ?? 0,
        keyId,
        placeVal2Prize,
        placeVal3Prize,
        placeVal10Prize,
      ),
      sortParam: prizeId === 7 ? manualNominee?.points ?? 0 : profile.results.points,
    };
    calculatedNominees.set(profile.id, profile);
  });

  const nominees = allProfiles
    .map(profile => calculatedNominees.get(profile.id))
    .filter((profile): profile is IPrizeNominee => Boolean(profile))
    .filter(profile =>
      prizeId !== 14
      && (
        prizeId === 7 && profile.id === rules.specialGuestId
        || !rules.guestProfileIds.includes(profile.id) && profile.prizes[prizeId]?.value !== 0
      ))
    .sort((left, right) => compareNominees(
      left,
      right,
      prizeId,
      sortValueAscending,
      sortParamAscending,
    ));

  prize.nomineesArr = nominees;
  prize.activeLeaders = nominees.filter(nominee =>
    (!prize.excluded || !prize.excluded.includes(nominee.id))
    && (!prize.isActivity || nominee.results.subsCoef > 50)
    && (prizeId !== 11 || Number(nominee.prizes[prizeId].value) >= 3));
}

export function calculateSpainPrizes(input: SpainPrizeCalculationInput): IRuntimePrize[] {
  const { prizes, profiles, profilesDetails, rules, sportPlayers = [], random = Math.random } = input;

  prizes.forEach(prize => {
    if (prize.isPlaceholder) {
      prize.nomineesArr = [];
      prize.activeLeaders = [];
      prize.state = 2;
      return;
    }
    if (calculateNewSpainPrize(prize, profilesDetails, rules, sportPlayers)) return;

    const keyId = prize.id === 8
      ? requireRuleId(rules.frequentPlayerId, 'frequentPlayerId', prize.id)
      : prize.id === 11
        ? requireRuleId(rules.frequentCaptainId, 'frequentCaptainId', prize.id)
        : '';
    countSpainPrizeNominees(
      prizes,
      profiles,
      profilesDetails,
      prize.id === 7
        ? profiles
        : profiles.filter(profile => !rules.guestProfileIds.includes(profile.id)),
      prize.id,
      rules,
      keyId,
    );
  });

  updatePrizeStates(prizes);

  const winnerIds = prizes.map(prize => getActiveLeaders(prize)[0]?.id || '');
  winnerIds.push(...rules.extraWinnerIds);

  if (rules.randomPrizeIndex !== undefined) {
    const randomPrize = prizes[rules.randomPrizeIndex];
    if (!randomPrize) throw new Error(`Не найден случайный приз с индексом ${rules.randomPrizeIndex}`);
    const randomPrizeNominees = profilesDetails.filter(profile =>
      !winnerIds.includes(profile.id)
      && profile.results.subsCoef > 50
      && !(randomPrize.excluded ?? []).includes(profile.id));

    randomPrize.nomineesArr = randomPrizeNominees;
    getActiveLeaders(randomPrize).push(
      randomPrizeNominees[Math.floor(random() * randomPrizeNominees.length)],
    );
    randomPrize.state = 1;
  }

  return asRuntimePrizes(prizes);
}

function calculateNewSpainPrize(
  prize: CompetitionPrizeConfig,
  profiles: IProfileDetails[],
  rules: SpainPrizeRules,
  sportPlayers: SportPlayer[],
): boolean {
  let valueByProfile: ((profile: IProfileDetails) => number) | undefined;

  switch (prize.id) {
    case SPAIN_PRIZE_IDS.CLASSIC:
      valueByProfile = profile => profile.score;
      break;
    case SPAIN_PRIZE_IDS.TURTLE_HUNT:
      valueByProfile = profile => profile.results.prizeMaxWinDiffAgainstTarget ?? 0;
      break;
    case SPAIN_PRIZE_IDS.HANDY_HANDS: {
      const valuePlayers = getBestValuePlayers(sportPlayers);
      const player = valuePlayers[0];
      if (player) {
        prize.calculationInfo = valuePlayers.slice(0, 5)
          .map((item, index) =>
            `${index + 1}. ${item.name} — ${item.score} FO / ${item.cost} = ${formatRatio(item.ratio)}`)
          .join('; ');
      }
      valueByProfile = profile => player ? profile.results.selectedPlayerPoints?.[player.id] ?? 0 : 0;
      break;
    }
    case SPAIN_PRIZE_IDS.MARTIN_POINTS: {
      const martinPlayerIds = rules.martinPlayerIds ?? [];
      valueByProfile = profile => martinPlayerIds.reduce(
        (sum, playerId) => sum + (profile.results.selectedPlayerPoints?.[playerId] ?? 0),
        0,
      );
      break;
    }
    case SPAIN_PRIZE_IDS.FIRE_MATCH:
      valueByProfile = profile => profile.results.prizeMaxWinningMatchTotalFo ?? 0;
      break;
    case SPAIN_PRIZE_IDS.FIRST_HUNDRED: {
      const firstWinningTour = getFirstHundredTour(profiles, rules.firstHundredEligibleTours ?? []);
      valueByProfile = profile => {
        if (!firstWinningTour || Number(profile.sex) !== 2) return 0;
        const score = Number(profile.team.results_by_tour[firstWinningTour]?.tour_score ?? 0);
        return score >= 100 ? score : 0;
      };
      break;
    }
    case SPAIN_PRIZE_IDS.LEGENDARY_SEVEN:
      valueByProfile = profile => profile.place_in_league?.['ByScore'] === 7 ? profile.score : 0;
      break;
    default:
      return false;
  }

  setCalculatedNominees(prize, profiles, valueByProfile);
  return true;
}

function setCalculatedNominees(
  prize: CompetitionPrizeConfig,
  profiles: IProfileDetails[],
  valueByProfile: (profile: IProfileDetails) => number,
): void {
  profiles.forEach(profile => {
    profile.prizes[prize.id] = {
      value: valueByProfile(profile),
      sortParam: profile.score,
    };
  });

  const nominees = profiles
    .filter(profile => Number(profile.prizes[prize.id].value) > 0)
    .sort((left, right) => {
      const valueDifference = Number(right.prizes[prize.id].value) - Number(left.prizes[prize.id].value);
      return valueDifference || right.score - left.score;
    });

  prize.nomineesArr = nominees;
  prize.activeLeaders = nominees.filter(nominee =>
    !(prize.excluded ?? []).includes(nominee.id)
    && (!prize.isActivity || nominee.results.subsCoef > 50));
}

function getBestValuePlayers(players: SportPlayer[]): Array<{
  id: string;
  name: string;
  cost: number;
  score: number;
  ratio: number;
}> {
  return players
    .filter(player => ['10', '11', '12'].includes(player.amplua_id) && player.cost > 0 && player.cost <= 6)
    .map(player => ({
      id: player.id,
      name: player.name,
      cost: player.cost,
      score: Object.values(player.stat_by_tours).reduce((sum, stat) => sum + stat.score, 0),
    }))
    .sort((left, right) =>
      right.score / right.cost - left.score / left.cost
      || right.score - left.score
      || left.cost - right.cost
      || left.id.localeCompare(right.id))
    .map(player => ({ ...player, ratio: player.score / player.cost }));
}

function formatRatio(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function getFirstHundredTour(profiles: IProfileDetails[], eligibleTours: number[]): number | undefined {
  return [...eligibleTours]
    .sort((left, right) => left - right)
    .find(tour => profiles.some(profile =>
      Number(profile.sex) === 2
      && Number(profile.team.results_by_tour[tour]?.tour_score ?? 0) >= 100));
}

export function calculateChampionsLeaguePrizes(input: PrizeCalculationInput): IRuntimePrize[] {
  const { prizes, profilesDetails } = input;

  prizes.forEach((prize, prizeIndex) => {
    const configuredNominee = prize.nomineesArr?.[0];
    profilesDetails.forEach(profile => {
      profile.prizes[prize.id] = {
        value:
          prize.id === 1
            ? (profile.place_in_league!['ByScore'] < 7 ? 0 : profile.score)
            : prize.id === 2
              ? (profile.squadDetails!.max_medals_in_a_row! < 2 ? 0 : profile.squadDetails!.max_medals_in_a_row!)
              : prize.id === 3
                ? (configuredNominee === profile.id ? 1 : 0)
                : prize.id === 4
                  ? (configuredNominee === profile.id ? 1 : 0)
                  : 0,
        sortParam: prize.id === 2 ? profile.score : profile.results.points,
      };
    });

    const nominees = profilesDetails
      .filter(profile => Number(profile.prizes[prize.id].value) > 0)
      .sort((left, right) => compareNominees(left, right, prize.id));

    prize.nomineesArr = nominees;
    prize.activeLeaders = nominees.filter(nominee =>
      (!prize.excluded || !prize.excluded.includes(nominee.id))
      && (!prize.isActivity || nominee.results.subsCoef > 50)
      && (prizeIndex !== 11 || Number(nominee.prizes[prizeIndex].value) >= 3));
  });

  updatePrizeStates(prizes);
  return asRuntimePrizes(prizes);
}

export function calculateWorldCupPrizes(input: PrizeCalculationInput): IRuntimePrize[] {
  const { prizes, profilesDetails } = input;

  prizes.forEach((prize, prizeIndex) => {
    const sortValueAscending = prizeIndex === 2;
    const defaultNominees = prize.defaultNomineesArr ?? [];

    profilesDetails.forEach(profile => {
      profile.prizes[prize.id] = {
        value:
          prize.id === 1
            ? (defaultNominees.includes(profile.id) ? 1 : 0)
            : prize.id === 2
              ? (profile.isMartinWC === 1 ? profile.score : 0)
              : prize.id === 3
                ? profile.score
                : prize.id === 4
                  ? (defaultNominees.includes(profile.id) ? 1 : 0)
                  : prize.id === 5
                    ? profile.results.uniqueUsedPlayers.length
                    : prize.id === 6
                      ? profile.results.portugezePoints
                      : prize.id === 7
                        ? profile.results.prizeMaxFoInLosedTour
                        : prize.id === 8
                          ? +profile.results.larinPoints
                          : prize.id === 9
                            ? profile.score
                            : 0,
        sortParam: prize.id === 2 ? profile.score : profile.results.points,
      };
    });

    const nominees = profilesDetails
      .filter(profile => Number(profile.prizes[prize.id].value) > 0)
      .sort((left, right) => compareNominees(left, right, prize.id, sortValueAscending));

    prize.nomineesArr = nominees;
    prize.activeLeaders = nominees.filter(nominee =>
      (!prize.excluded || !prize.excluded.includes(nominee.id))
      && (!prize.isActivity || nominee.results.subsCoef > 50));
  });

  updatePrizeStates(prizes);
  return asRuntimePrizes(prizes);
}

function getSpainPrizeValue(
  profile: IProfileDetails,
  prizeId: number,
  manualPoints: number,
  keyId: string,
  placeVal2Prize: number,
  placeVal3Prize: number,
  placeVal10Prize: number,
): string | number {
  const place = profile.place_in_league!;
  switch (prizeId) {
    case 1: return !place['Primera'] || place['Primera'] < 4 ? 0 : place['Primera'];
    case 2: return placeVal2Prize !== 10
      ? (!place['Primera'] || place['Primera'] < 10 ? 0 : place['Primera'])
      : (!place['Segunda'] || place['Segunda'] < 10 ? 0 : place['Segunda']);
    case 3: return placeVal3Prize !== 13
      ? (!place['Primera'] || place['Primera'] < 13 ? 0 : place['Primera'])
      : (!place['Segunda'] || place['Segunda'] < 13 ? 0 : place['Segunda']);
    case 4: return !place['Primera'] || +profile.sex! === 1 ? 0 : profile.results.points['clausura'];
    case 5: return !place['Segunda'] || +profile.sex! === 1 ? 0 : profile.results.points['clausura'];
    case 6: return profile.isMartin === 1 ? profile.results.fo['common'] : 0;
    case 7: return manualPoints;
    case 8: return Object.values(profile.team.rosters_by_tour).reduce((sum, roster) =>
      sum + Number(roster.players.base.includes(keyId)) + Number(roster.players.bench.includes(keyId)), 0);
    case 9: return profile.results.teamCostAvg;
    case 10: return !place['Primera'] || place['Primera'] <= placeVal10Prize ? 0 : place['Primera'];
    case 11: return Object.values(profile.team.rosters_by_tour).reduce((sum, roster) =>
      sum + Number(roster.captain_id === keyId), 0);
    case 12: return place['Apertura'] - place['Common'];
    case 13: return profile.results.prizeMinWins;
    case 15: return profile.results.prizeMaxFoInTour;
    case 16: return profile.results.prizeMaxWinStrike;
    case 17: return profile.results.prizeMaxFoInLosedTour;
    case 18: return profile.results.prizeMaxStoppedNoLoseStrike;
    case 19: return profile.results.prizeMaxLosedDiff;
    case 20: return profile.results.cup!.lowest_winning_pos_diff || 0;
    case 21: return profile.results.cup!.avg_diff_fo;
    default: return '-';
  }
}

function compareNominees(
  left: IPrizeNominee,
  right: IPrizeNominee,
  prizeId: number,
  sortValueAscending = false,
  sortParamAscending = false,
): number {
  const leftPrize = left.prizes[prizeId];
  const rightPrize = right.prizes[prizeId];
  if (leftPrize.value === rightPrize.value) {
    return (sortParamAscending ? -1 : 1)
      * (Number(rightPrize.sortParam) - Number(leftPrize.sortParam));
  }
  return (sortValueAscending ? -1 : 1)
    * (Number(rightPrize.value) - Number(leftPrize.value));
}

function initializeGuestNominee(
  profile: PrizeSourceProfile,
  points: number,
  prizeId: number,
): IPrizeNominee {
  profile.prizes = {};
  profile.team = { title: 'BallBoy17' } as IProfileDetails['team'];
  profile.results = {
    subsCoef: 100,
    points: 0,
  } as unknown as IProfileDetails['results'];
  profile.prizes[prizeId] = { value: points, sortParam: points };
  return profile as unknown as IPrizeNominee;
}

function getPrimeraPlace(profiles: IProfileDetails[], profileId: string): number {
  const profile = profiles.find(item => item.id === profileId);
  if (!profile?.place_in_league) {
    throw new Error(`Не найден reference-профиль ${profileId} для расчета призов`);
  }
  return profile.place_in_league['Primera'];
}

function requirePlaceReference(
  rules: SpainPrizeRules,
  key: 'prize2' | 'prize3' | 'prize10',
): string {
  const profileId = rules.placeReferenceProfileIds?.[key];
  if (!profileId) throw new Error(`Не настроен reference-профиль ${key}`);
  return profileId;
}

function requireRuleId(value: string | undefined, field: string, prizeId: number): string {
  if (!value) throw new Error(`Для приза ${prizeId} не настроено правило ${field}`);
  return value;
}

function requirePrize(prizes: CompetitionPrizeConfig[], prizeId: number): CompetitionPrizeConfig {
  const prize = prizes.find(item => item.id === prizeId);
  if (!prize) throw new Error(`Не найден приз ${prizeId}`);
  return prize;
}

function isManualPrizeNominee(value: unknown): value is ManualPrizeNominee {
  return Boolean(value)
    && typeof value === 'object'
    && 'profileId' in value
    && 'points' in value
    && typeof value.profileId === 'string'
    && typeof value.points === 'number';
}

function getActiveLeaders(prize: CompetitionPrizeConfig): IPrizeNominee[] {
  if (!prize.activeLeaders) prize.activeLeaders = [];
  return prize.activeLeaders as IPrizeNominee[];
}

function asRuntimePrizes(prizes: CompetitionPrizeConfig[]): IRuntimePrize[] {
  return prizes as unknown as IRuntimePrize[];
}
