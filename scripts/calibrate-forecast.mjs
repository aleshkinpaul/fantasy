import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { loadTypeScriptModule } from './lib/load-typescript-module.mjs';

const root = resolve(import.meta.dirname, '..');
const testingRoot = join(root, 'src', 'testing', 'season-2025-26');
const competitions = ['spain', 'champions-league', 'world-cup'];
const ratingModule = loadTypeScriptModule(
  join(root, 'src', 'app', 'competition', 'domain', 'rating-calculator.ts'),
);
const forecastModule = loadTypeScriptModule(
  join(root, 'src', 'app', 'match-center', 'forecast-calculator.ts'),
);

const records = competitions.flatMap(readCompetitionRecords);
const train = records.filter(record => !record.isHoldout);
const holdout = records.filter(record => record.isHoldout);
const coarse = search(train, {
  strengthScale: sequence(0, 0.8, 0.04),
  drawIntercept: sequence(-1.8, -0.2, 0.08),
  drawDistancePenalty: sequence(0, 0.4, 0.04),
});
const refined = search(train, {
  strengthScale: sequenceAround(coarse.strengthScale, 0.05, 0.01, 0),
  drawIntercept: sequenceAround(coarse.drawIntercept, 0.1, 0.02),
  drawDistancePenalty: sequenceAround(coarse.drawDistancePenalty, 0.05, 0.01, 0),
});
const finalCalibration = search(records, {
  strengthScale: sequenceAround(refined.strengthScale, 0.05, 0.01, 0),
  drawIntercept: sequenceAround(refined.drawIntercept, 0.1, 0.02),
  drawDistancePenalty: sequenceAround(refined.drawDistancePenalty, 0.05, 0.01, 0),
});

process.stdout.write(`${JSON.stringify({
  samples: { total: records.length, train: train.length, holdout: holdout.length },
  fittedOnTrain: refined,
  trainMetrics: metrics(train, refined),
  holdoutMetrics: metrics(holdout, refined),
  fittedOnAllData: finalCalibration,
  allDataMetrics: metrics(records, finalCalibration),
  neutralBaseline: metrics(records, {
    strengthScale: 0,
    drawIntercept: Math.log(0.16 / 0.42),
    drawDistancePenalty: 0,
  }),
}, null, 2)}\n`);

function readCompetitionRecords(competition) {
  const input = readJson(join(testingRoot, competition, 'normalized-input.json'));
  const tours = readJson(join(testingRoot, competition, 'matches.json'));
  const holdoutStart = Math.floor(tours.length * 0.8) + 1;

  return tours.flatMap(({ tour, matches }) => {
    const ratings = ratingModule.calculateFormRatings(input.profiles, tour - 1);
    const ratedTourCount = ratingModule.getRatingTourNumbers(input.profiles, tour - 1).length;
    return matches.map(match => ({
      homeRating: ratings[match.home] ?? 5,
      awayRating: ratings[match.away] ?? 5,
      drawGap: input.drawGap,
      ratedTourCount,
      outcomeIndex: match.result === 1 ? 0 : match.result === 0 ? 1 : 2,
      isHoldout: tour >= holdoutStart,
    }));
  });
}

function search(samples, ranges) {
  let best;
  for (const strengthScale of ranges.strengthScale) {
    for (const drawIntercept of ranges.drawIntercept) {
      for (const drawDistancePenalty of ranges.drawDistancePenalty) {
        const calibration = { strengthScale, drawIntercept, drawDistancePenalty };
        const logLoss = calculateLogLoss(samples, calibration);
        if (!best || logLoss < best.logLoss) best = { ...calibration, logLoss };
      }
    }
  }
  return roundObject(best);
}

function metrics(samples, calibration) {
  let correct = 0;
  let brierSum = 0;
  const outcomeCounts = [0, 0, 0];
  const probabilitySums = [0, 0, 0];
  samples.forEach(sample => {
    const probabilities = probabilitiesFor(sample, calibration);
    const prediction = probabilities.indexOf(Math.max(...probabilities));
    if (prediction === sample.outcomeIndex) correct++;
    outcomeCounts[sample.outcomeIndex]++;
    probabilities.forEach((probability, index) => {
      probabilitySums[index] += probability;
      brierSum += (probability - Number(index === sample.outcomeIndex)) ** 2;
    });
  });
  return {
    logLoss: round(calculateLogLoss(samples, calibration)),
    brier: round(brierSum / samples.length),
    accuracy: round(correct / samples.length),
    actualOutcomeShare: outcomeCounts.map(count => round(count / samples.length)),
    predictedOutcomeShare: probabilitySums.map(sum => round(sum / samples.length)),
  };
}

function calculateLogLoss(samples, calibration) {
  return -samples.reduce((sum, sample) => {
    const probability = probabilitiesFor(sample, calibration)[sample.outcomeIndex];
    return sum + Math.log(Math.max(probability, 1e-12));
  }, 0) / samples.length;
}

function probabilitiesFor(sample, calibration) {
  return forecastModule.calculateRatingProbabilityValues(
    sample.homeRating,
    sample.awayRating,
    sample.drawGap,
    sample.ratedTourCount,
    calibration,
  );
}

function sequence(start, end, step) {
  const values = [];
  for (let value = start; value <= end + step / 2; value += step) values.push(round(value));
  return values;
}

function sequenceAround(center, radius, step, min = -Infinity) {
  return sequence(Math.max(min, center - radius), center + radius, step);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function roundObject(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, round(item)]));
}
