import { SpainPrizeRules } from '../models/competition.models';

export interface PrizeCalculationInput {
  prizes: any[];
  profiles: any[];
  profilesDetails: any[];
  random?: () => number;
}

export interface SpainPrizeCalculationInput extends PrizeCalculationInput {
  rules: SpainPrizeRules;
}

function updatePrizeStates(prizes: any[]): void {
  prizes.forEach(prize => {
    if (prize.isFinalStage) prize.state = 2;
    if (prize.nomineesArr.length) prize.state = 1;
    if (!prize.state && !prize.nomineesArr.length) prize.state = 3;
  });
}

function countSpainPrizeNominees(
  prizes: any[],
  allProfiles: any[],
  profilesDetails: any[],
  eligibleProfiles: any[],
  prizeId: number,
  rules: SpainPrizeRules,
  keyId = '',
): void {
  const prize = prizes.find(item => item.id === prizeId);
  const sortValueAscending = [1, 2, 3, 9, 10].includes(prizeId);
  const sortParamAscending = prizeId === 18;

  const placeVal2Prize = profilesDetails.find(profile =>
    profile.id === rules.placeReferenceProfileIds.prize2).place_in_league.Primera;
  const placeVal3Prize = profilesDetails.find(profile =>
    profile.id === rules.placeReferenceProfileIds.prize3).place_in_league.Primera;
  const placeVal10Prize = profilesDetails.find(profile =>
    profile.id === rules.placeReferenceProfileIds.prize10).place_in_league.Primera;

  eligibleProfiles.forEach(profile => {
    const manualNominee = prize.nomineesArr.find(nominee => nominee.profileId === profile.id);

    if (prizeId === 7 && rules.guestProfileIds.includes(profile.id)) {
      profile.prizes = {};
      profile.team = { title: 'BallBoy17' };
      profile.results = {
        subsCoef: 100,
        points: 0,
      };
    }

    profile.prizes[prizeId] = {
      value:
        prizeId === 1
          ? (!profile.place_in_league.Primera || profile.place_in_league.Primera < 4 ? 0 : profile.place_in_league.Primera)
          : prizeId === 2
            ? placeVal2Prize !== 10
              ? (!profile.place_in_league.Primera || profile.place_in_league.Primera < 10 ? 0 : profile.place_in_league.Primera)
              : (!profile.place_in_league.Segunda || profile.place_in_league.Segunda < 10 ? 0 : profile.place_in_league.Segunda)
            : prizeId === 3
              ? placeVal3Prize !== 13
                ? (!profile.place_in_league.Primera || profile.place_in_league.Primera < 13 ? 0 : profile.place_in_league.Primera)
                : (!profile.place_in_league.Segunda || profile.place_in_league.Segunda < 13 ? 0 : profile.place_in_league.Segunda)
              : prizeId === 4
                ? (!profile.place_in_league.Primera || +profile.sex === 1 ? 0 : profile.results.points.clausura)
                : prizeId === 5
                  ? (!profile.place_in_league.Segunda || +profile.sex === 1 ? 0 : profile.results.points.clausura)
                  : prizeId === 6
                    ? (profile.isMartin === 1 ? profile.results.fo.common : 0)
                    : prizeId === 7
                      ? (manualNominee ? manualNominee.points : 0)
                      : prizeId === 8
                        ? Object.values<any>(profile.team.rosters_by_tour).reduce((sum, roster) =>
                          sum + roster.players.base.includes(keyId) + roster.players.bench.includes(keyId), 0)
                        : prizeId === 9
                          ? profile.results.teamCostAvg
                          : prizeId === 10
                            ? (!profile.place_in_league.Primera || profile.place_in_league.Primera <= placeVal10Prize ? 0 : profile.place_in_league.Primera)
                            : prizeId === 11
                              ? Object.values<any>(profile.team.rosters_by_tour).reduce((sum, roster) =>
                                sum + +(roster.captain_id === keyId), 0)
                              : prizeId === 12
                                ? profile.place_in_league.Apertura - profile.place_in_league.Common
                                : prizeId === 13
                                  ? profile.results.prizeMinWins
                                  : prizeId === 15
                                    ? profile.results.prizeMaxFoInTour
                                    : prizeId === 16
                                      ? profile.results.prizeMaxWinStrike
                                      : prizeId === 17
                                        ? profile.results.prizeMaxFoInLosedTour
                                        : prizeId === 18
                                          ? profile.results.prizeMaxStoppedNoLoseStrike
                                          : prizeId === 19
                                            ? profile.results.prizeMaxLosedDiff
                                            : prizeId === 20
                                              ? profile.results.cup.lowest_winning_pos_diff || 0
                                              : prizeId === 21
                                                ? profile.results.cup.avg_diff_fo
                                                : '-',
      sortParam: prizeId === 7
        ? (manualNominee ? manualNominee.points : 0)
        : profile.results.points,
    };
  });

  prize.nomineesArr = allProfiles
    .filter(profile =>
      prizeId !== 14
      && (
        prizeId === 7 && profile.id === rules.specialGuestId
        || !rules.guestProfileIds.includes(profile.id) && profile.prizes[prizeId]?.value !== 0
      ))
    .sort((a, b) =>
      a.prizes[prizeId].value === b.prizes[prizeId].value
        ? (sortParamAscending ? -1 : 1) * (b.prizes[prizeId].sortParam - a.prizes[prizeId].sortParam)
        : (sortValueAscending ? -1 : 1) * (b.prizes[prizeId].value - a.prizes[prizeId].value));

  prize.activeLeaders = prize.nomineesArr.filter(nominee =>
    (!prize.excluded || !prize.excluded.includes(nominee.id))
    && (!prize.isActivity || nominee.results.subsCoef > 50)
    && (prizeId !== 11 || nominee.prizes[prizeId].value >= 3));
}

export function calculateSpainPrizes(input: SpainPrizeCalculationInput): any[] {
  const { prizes, profiles, profilesDetails, rules, random = Math.random } = input;

  prizes.forEach(prize => countSpainPrizeNominees(
    prizes,
    profiles,
    profilesDetails,
    prize.id === 7
      ? profiles
      : profiles.filter(profile => !rules.guestProfileIds.includes(profile.id)),
    prize.id,
    rules,
    prize.id === 8
      ? rules.frequentPlayerId
      : prize.id === 11
        ? rules.frequentCaptainId
        : '',
  ));

  updatePrizeStates(prizes);

  const winnerIds = prizes.map(prize => prize.activeLeaders[0]?.id || '');
  winnerIds.push(...rules.extraWinnerIds);

  const randomPrize = prizes[rules.randomPrizeIndex];
  const randomPrizeNominees = profilesDetails.filter(profile =>
    !winnerIds.includes(profile.id)
    && profile.results.subsCoef > 50
    && !randomPrize.excluded.includes(profile.id));

  randomPrize.nomineesArr = randomPrizeNominees;
  randomPrize.activeLeaders.push(randomPrizeNominees[Math.floor(random() * randomPrizeNominees.length)]);
  randomPrize.state = 1;

  return prizes;
}

export function calculateChampionsLeaguePrizes(input: PrizeCalculationInput): any[] {
  const { prizes, profilesDetails } = input;

  prizes.forEach((prize, prizeIndex) => {
    profilesDetails.forEach(profile => {
      profile.prizes[prize.id] = {
        value:
          prize.id === 1
            ? (profile.place_in_league.ByScore < 7 ? 0 : profile.score)
            : prize.id === 2
              ? (profile.squadDetails.max_medals_in_a_row < 2 ? 0 : profile.squadDetails.max_medals_in_a_row)
              : prize.id === 3
                ? (prize.nomineesArr?.[0] === profile.id ? 1 : 0)
                : prize.id === 4
                  ? (prize.nomineesArr?.[0] === profile.id ? 1 : 0)
                  : 0,
        sortParam: prize.id === 2 ? profile.score : profile.results.points,
      };
    });

    prize.nomineesArr = profilesDetails
      .filter(profile => profile.prizes[prize.id].value > 0)
      .sort((a, b) =>
        a.prizes[prize.id].value === b.prizes[prize.id].value
          ? b.prizes[prize.id].sortParam - a.prizes[prize.id].sortParam
          : b.prizes[prize.id].value - a.prizes[prize.id].value);

    prize.activeLeaders = prize.nomineesArr.filter(nominee =>
      (!prize.excluded || !prize.excluded.includes(nominee.id))
      && (!prize.isActivity || nominee.results.subsCoef > 50)
      && (prizeIndex !== 11 || nominee.prizes[prizeIndex].value >= 3));
  });

  updatePrizeStates(prizes);
  return prizes;
}

export function calculateWorldCupPrizes(input: PrizeCalculationInput): any[] {
  const { prizes, profilesDetails } = input;

  prizes.forEach((prize, prizeIndex) => {
    const sortValueAscending = prizeIndex === 2;

    profilesDetails.forEach(profile => {
      profile.prizes[prize.id] = {
        value:
          prize.id === 1
            ? (prize.defaultNomineesArr.includes(profile.id) ? 1 : 0)
            : prize.id === 2
              ? (profile.isMartinWC === 1 ? profile.score : 0)
              : prize.id === 3
                ? profile.score
                : prize.id === 4
                  ? (prize.defaultNomineesArr.includes(profile.id) ? 1 : 0)
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

    prize.nomineesArr = profilesDetails
      .filter(profile => profile.prizes[prize.id].value > 0)
      .sort((a, b) =>
        a.prizes[prize.id].value === b.prizes[prize.id].value
          ? b.prizes[prize.id].sortParam - a.prizes[prize.id].sortParam
          : (sortValueAscending ? -1 : 1) * (b.prizes[prize.id].value - a.prizes[prize.id].value));

    prize.activeLeaders = prize.nomineesArr.filter(nominee =>
      (!prize.excluded || !prize.excluded.includes(nominee.id))
      && (!prize.isActivity || nominee.results.subsCoef > 50));
  });

  updatePrizeStates(prizes);
  return prizes;
}
