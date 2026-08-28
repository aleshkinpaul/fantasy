import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { gzipSync, gunzipSync } from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'src', 'testing', 'season-2025-26');
let baseUrl = process.env.FANTASY_BASE_URL;
let debugPort = process.env.FANTASY_DEBUG_PORT ? Number(process.env.FANTASY_DEBUG_PORT) : undefined;
const MODE = process.argv[2] ?? 'verify';

const COMPETITIONS = [
  { key: 'spain', route: '/spain/new?year=2025', profiles: 49, tours: 38, prizes: 21 },
  { key: 'champions-league', route: '/champions-league/new?year=2025', profiles: 48, tours: 17, prizes: 4 },
  { key: 'world-cup', route: '/world-cup/new?year=2025', profiles: 32, tours: 8, prizes: 9 },
];

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.webSocketUrl);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });

    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result);
        return;
      }

      const callbacks = this.listeners.get(message.method) ?? [];
      callbacks.forEach(callback => callback(message.params));
    });
    this.socket.addEventListener('close', () => {
      const error = new Error(`CDP connection closed: ${this.webSocketUrl}`);
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, callback) {
    const callbacks = this.listeners.get(method) ?? [];
    callbacks.push(callback);
    this.listeners.set(method, callbacks);
  }

  close() {
    this.socket?.close();
  }
}

async function createPage() {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Cannot create browser page: HTTP ${response.status}`);
  const target = await response.json();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  return { client, target };
}

async function closePage(targetId) {
  await fetch(`http://127.0.0.1:${debugPort}/json/close/${targetId}`);
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForEndpoint(url, timeoutMs, processLogs = []) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'no response'}\n${processLogs.slice(-20).join('')}`);
}

async function resolveEdgePath() {
  const candidates = [
    process.env.EDGE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next platform-specific location.
    }
  }
  throw new Error('Microsoft Edge was not found. Set EDGE_PATH explicitly.');
}

function stopProcessTree(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    return;
  }
  child.kill('SIGTERM');
}

async function startInfrastructure() {
  const appPort = await findFreePort();
  debugPort = await findFreePort();
  baseUrl = `http://127.0.0.1:${appPort}`;
  const logs = [];
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'fantasy-season-regression-'));

  const server = spawn(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['start', '--', '--port', String(appPort), '--host', '127.0.0.1'],
    {
      cwd: ROOT,
      windowsHide: true,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  server.stdout.on('data', chunk => logs.push(chunk.toString()));
  server.stderr.on('data', chunk => logs.push(chunk.toString()));

  try {
    await waitForEndpoint(baseUrl, 120_000, logs);
    const edgePath = await resolveEdgePath();
    const edge = spawn(edgePath, [
      '--headless',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--no-first-run',
      '--no-sandbox',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${temporaryDirectory}`,
      'about:blank',
    ], { windowsHide: true, stdio: 'ignore' });

    try {
      await waitForEndpoint(`http://127.0.0.1:${debugPort}/json/version`, 30_000);
    } catch (error) {
      stopProcessTree(edge);
      throw error;
    }

    return async () => {
      stopProcessTree(edge);
      stopProcessTree(server);
      const resolvedTemp = path.resolve(temporaryDirectory);
      if (resolvedTemp.startsWith(path.resolve(os.tmpdir()))) {
        await rm(resolvedTemp, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
      }
    };
  } catch (error) {
    stopProcessTree(server);
    await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
    throw error;
  }
}

function responseKey(url) {
  const parsed = new URL(url);
  if (parsed.pathname.startsWith('/assets/data/')) return `local:${parsed.pathname}`;
  if (parsed.hostname === 'fantasy-h2h.ru') return `api:${parsed.pathname}${parsed.search}`;
  return null;
}

function relevantResponse(url) {
  const key = responseKey(url);
  return key?.startsWith('api:') || key?.startsWith('local:/assets/data/seasons/');
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  }
  return response.result.value;
}

async function installDeterministicRuntime(client) {
  // Prize 14 ("Отскок года") intentionally chooses a random eligible profile.
  // A fixed value keeps regression output reproducible without changing production code.
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'Math.random = () => 0.3141592653589793;',
  });
}

async function waitUntilReady(client, competition, networkState) {
  const deadline = Date.now() + 300_000;
  let lastState;

  while (Date.now() < deadline) {
    lastState = await evaluate(client, `(() => {
      const element = document.querySelector('app-league-h2h-page');
      if (!element || !globalThis.ng?.getComponent) {
        return { ready: false, reason: 'component is not available' };
      }
      const component = ng.getComponent(element);
      const prizes = component.consts?.prizes ?? [];
      return {
        ready: component.profilesDetails?.length === ${competition.profiles}
          && component.lastTour === ${competition.tours}
          && prizes.length === ${competition.prizes}
          && prizes.every(prize => Array.isArray(prize.nomineesArr) && Array.isArray(prize.activeLeaders)),
        profiles: component.profilesDetails?.length ?? 0,
        tours: component.lastTour ?? 0,
        prizes: prizes.length,
        completedPrizes: prizes.filter(prize => Array.isArray(prize.activeLeaders)).length,
      };
    })()`);

    const idleFor = Date.now() - networkState.lastActivity;
    if (lastState.ready && networkState.pending.size === 0 && idleFor >= 2_000) return;
    await delay(500);
  }

  throw new Error(`${competition.key} did not become ready: ${JSON.stringify(lastState)}`);
}

function extractionExpression() {
  return `(() => {
    const component = ng.getComponent(document.querySelector('app-league-h2h-page'));
    const marker = value => JSON.parse(JSON.stringify(value, (_key, item) => {
      if (item === undefined) return '__undefined__';
      if (typeof item === 'number' && Number.isNaN(item)) return '__NaN__';
      if (item === Infinity) return '__Infinity__';
      if (item === -Infinity) return '__-Infinity__';
      return item;
    }));
    const resultFields = profile => ({
      id: profile.id,
      score: profile.score,
      isMartin: profile.isMartin,
      isMartinWC: profile.isMartinWC,
      leagues: profile.leagues,
      place_in_league: profile.place_in_league,
      results: profile.results,
    });
    const standingFields = profile => ({
      id: profile.id,
      score: profile.score,
      leagues: profile.leagues,
      place_in_league: profile.place_in_league,
      wins: profile.results?.wins,
      draws: profile.results?.draws,
      loses: profile.results?.loses,
      points: profile.results?.points,
      fo: profile.results?.fo,
      missed_fo: profile.results?.missed_fo,
      diff_fo: profile.results?.diff_fo,
    });
    const prizeProfile = (profile, prizeId) => ({
      id: profile.id ?? profile.profileId,
      value: profile.prizes?.[prizeId]?.value,
      sortParam: profile.prizes?.[prizeId]?.sortParam,
    });

    const matches = Object.entries(component.consts.matches ?? {}).map(([tour, items]) => ({
      tour: Number(tour),
      matches: items.map(match => ({
        home: match.home,
        away: match.away,
        home_score: match.home_score,
        away_score: match.away_score,
        result: match.result,
      })),
    }));

    const standings = Object.fromEntries(
      Object.entries(component.leaguesRatings ?? {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, profiles]) => [name, profiles.map(standingFields)])
    );

    const cup = {
      config: component.consts.cup ? {
        name: component.consts.cup.name,
        matchesTours: component.consts.cup.matchesTours,
        matchesToursNames: component.consts.cup.matchesToursNames,
        matches: component.consts.cup.matches,
      } : null,
      profiles: component.profilesDetails.map(profile => ({
        id: profile.id,
        cup: profile.results?.cup ?? null,
      })),
    };

    const prizes = (component.consts.prizes ?? []).map(prize => ({
      id: prize.id,
      state: prize.state,
      nominees: (prize.nomineesArr ?? []).map(profile => prizeProfile(profile, prize.id)),
      activeLeaders: (prize.activeLeaders ?? []).map(profile => prizeProfile(profile, prize.id)),
    }));

    const squads = component.squadsDetails.value.map(squad => ({
      id: squad.id,
      name: squad.name,
      score: squad.score,
      diff: squad.diff,
      rating_of_prize_positions: squad.rating_of_prize_positions,
      gold_medals: squad.gold_medals,
      silver_medals: squad.silver_medals,
      bronze_medals: squad.bronze_medals,
      medals_count: squad.medals_count,
      medals_arr: squad.medals_arr,
      max_medals_in_a_row: squad.max_medals_in_a_row,
      cur_medals_in_a_row: squad.cur_medals_in_a_row,
      totalPlaces: squad.totalPlaces,
      team_id: squad.team_id,
      rating: squad.rating,
    }));

    const normalizedInput = {
      lastTour: component.lastTour,
      competitionType: component.competitionType,
      drawGap: component.consts.drawGap ?? 0,
      profiles: component.profilesDetails.map(profile => ({
        id: profile.id,
        name: profile.name,
        nick: profile.nick,
        sex: profile.sex,
        url: profile.url,
        logo: profile.logo,
        team: profile.team,
        isMartin: profile.isMartin,
        isMartinWC: profile.isMartinWC,
        legacySpecialResults: {
          portugezePoints: profile.results?.portugezePoints,
          larinPoints: profile.results?.larinPoints,
          uniqueUsedPlayers: profile.results?.uniqueUsedPlayers,
        },
      })),
    };

    return JSON.stringify(marker({
      normalizedInput,
      golden: {
        matches,
        standings,
        cup,
        prizes,
        squads,
        profiles: component.profilesDetails.map(resultFields),
      },
    }));
  })()`;
}

async function captureCompetition(competition) {
  const { client, target } = await createPage();
  const responses = new Map();
  const requests = new Map();
  const capturePromises = new Set();
  const networkState = { pending: new Set(), lastActivity: Date.now() };

  client.on('Network.requestWillBeSent', event => {
    networkState.lastActivity = Date.now();
    if (relevantResponse(event.request.url)) {
      requests.set(event.requestId, {
        key: responseKey(event.request.url),
        url: event.request.url,
      });
      networkState.pending.add(event.requestId);
    }
  });

  client.on('Network.responseReceived', event => {
    const request = requests.get(event.requestId);
    if (!request) return;
    request.status = event.response.status;
    request.mimeType = event.response.mimeType;
  });

  const finishRequest = event => {
    const request = requests.get(event.requestId);
    if (!request) return;
    networkState.lastActivity = Date.now();
    networkState.pending.delete(event.requestId);

    const promise = client.send('Network.getResponseBody', { requestId: event.requestId })
      .then(bodyResult => {
        const body = bodyResult.base64Encoded
          ? Buffer.from(bodyResult.body, 'base64').toString('utf8')
          : bodyResult.body;
        responses.set(request.key, {
          url: request.url,
          status: request.status ?? 200,
          mimeType: request.mimeType ?? 'application/json',
          body: JSON.parse(body),
        });
      })
      .finally(() => capturePromises.delete(promise));
    capturePromises.add(promise);
  };

  client.on('Network.loadingFinished', finishRequest);
  client.on('Network.loadingFailed', event => {
    networkState.pending.delete(event.requestId);
    networkState.lastActivity = Date.now();
  });

  try {
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable', { maxTotalBufferSize: 100_000_000, maxResourceBufferSize: 10_000_000 });
    await installDeterministicRuntime(client);
    await client.send('Page.navigate', { url: `${baseUrl}${competition.route}` });
    await waitUntilReady(client, competition, networkState);
    await Promise.all([...capturePromises]);

    const extracted = JSON.parse(await evaluate(client, extractionExpression()));
    const directory = path.join(OUTPUT_ROOT, competition.key);
    await mkdir(directory, { recursive: true });

    const responseFixture = {
      competition: competition.key,
      route: competition.route,
      responses: Object.fromEntries([...responses.entries()].sort(([left], [right]) => left.localeCompare(right))),
    };

    await writeFile(
      path.join(directory, 'responses.json.gz'),
      gzipSync(`${JSON.stringify(responseFixture)}\n`, { level: 9 })
    );
    await writeFile(path.join(directory, 'normalized-input.json'), `${JSON.stringify(extracted.normalizedInput, null, 2)}\n`);

    for (const [name, value] of Object.entries(extracted.golden)) {
      await writeFile(path.join(directory, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
    }

    const hashes = {};
    for (const [name, value] of Object.entries(extracted.golden)) {
      hashes[`${name}.json`] = createHash('sha256').update(`${JSON.stringify(value, null, 2)}\n`).digest('hex');
    }
    await writeFile(path.join(directory, 'hashes.json'), `${JSON.stringify(hashes, null, 2)}\n`);

    return {
      competition: competition.key,
      responses: responses.size,
      hashes,
    };
  } finally {
    client.close();
    await closePage(target.id);
  }
}

async function loadFixtures(competition) {
  const directory = path.join(OUTPUT_ROOT, competition.key);
  const fixture = JSON.parse(gunzipSync(
    await readFile(path.join(directory, 'responses.json.gz'))
  ).toString('utf8'));
  const golden = {};
  for (const name of ['matches', 'standings', 'cup', 'prizes', 'squads', 'profiles']) {
    golden[name] = JSON.parse(await readFile(path.join(directory, `${name}.json`), 'utf8'));
  }
  return { fixture, golden };
}

function findDifference(expected, actual, currentPath = '$') {
  if (Object.is(expected, actual)) return null;
  if (typeof expected !== typeof actual || expected === null || actual === null) {
    return { path: currentPath, expected, actual };
  }
  if (typeof expected !== 'object') return { path: currentPath, expected, actual };

  if (Array.isArray(expected) !== Array.isArray(actual)) return { path: currentPath, expected, actual };
  if (Array.isArray(expected)) {
    if (expected.length !== actual.length) {
      return { path: `${currentPath}.length`, expected: expected.length, actual: actual.length };
    }
    for (let index = 0; index < expected.length; index++) {
      const difference = findDifference(expected[index], actual[index], `${currentPath}[${index}]`);
      if (difference) return difference;
    }
    return null;
  }

  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(actual);
  if (expectedKeys.join('|') !== actualKeys.join('|')) {
    return { path: `${currentPath}.__keys`, expected: expectedKeys, actual: actualKeys };
  }
  for (const key of expectedKeys) {
    const difference = findDifference(expected[key], actual[key], `${currentPath}.${key}`);
    if (difference) return difference;
  }
  return null;
}

async function verifyCompetition(competition) {
  const { fixture, golden } = await loadFixtures(competition);
  const { client, target } = await createPage();
  const networkState = { pending: new Set(), lastActivity: Date.now() };
  let failure;

  client.on('Fetch.requestPaused', event => {
    const key = responseKey(event.request.url);
    const stored = key ? fixture.responses[key] : null;
    const action = stored
      ? client.send('Fetch.fulfillRequest', {
          requestId: event.requestId,
          responseCode: stored.status,
          responseHeaders: [
            { name: 'Content-Type', value: stored.mimeType || 'application/json' },
            { name: 'Access-Control-Allow-Origin', value: '*' },
          ],
          body: Buffer.from(JSON.stringify(stored.body)).toString('base64'),
        })
      : client.send('Fetch.continueRequest', { requestId: event.requestId });
    action.catch(error => { failure = error; });
  });

  client.on('Network.requestWillBeSent', event => {
    if (!relevantResponse(event.request.url)) return;
    networkState.pending.add(event.requestId);
    networkState.lastActivity = Date.now();
  });
  const finish = event => {
    networkState.pending.delete(event.requestId);
    networkState.lastActivity = Date.now();
  };
  client.on('Network.loadingFinished', finish);
  client.on('Network.loadingFailed', finish);

  try {
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');
    await installDeterministicRuntime(client);
    await client.send('Fetch.enable', {
      patterns: [
        { urlPattern: '*://fantasy-h2h.ru/*', requestStage: 'Request' },
        { urlPattern: '*://127.0.0.1:*/assets/data/*', requestStage: 'Request' },
        { urlPattern: '*://localhost:*/assets/data/*', requestStage: 'Request' },
      ],
    });
    await client.send('Page.navigate', { url: `${baseUrl}${competition.route}` });
    await waitUntilReady(client, competition, networkState);
    if (failure) throw failure;

    const extracted = JSON.parse(await evaluate(client, extractionExpression()));
    const hashes = {};
    for (const [name, expected] of Object.entries(golden)) {
      const actual = extracted.golden[name];
      const difference = findDifference(expected, actual);
      if (difference) {
        throw new Error(`${competition.key}/${name}.json differs at ${difference.path}: expected ${JSON.stringify(difference.expected)}, received ${JSON.stringify(difference.actual)}`);
      }
      hashes[`${name}.json`] = createHash('sha256').update(`${JSON.stringify(actual, null, 2)}\n`).digest('hex');
    }
    return { competition: competition.key, hashes };
  } finally {
    client.close();
    await closePage(target.id);
  }
}

async function main() {
  if (!['capture', 'verify'].includes(MODE)) {
    throw new Error('Usage: node scripts/season-regression.mjs <capture|verify>');
  }

  const managesInfrastructure = !baseUrl && !debugPort;
  if (!managesInfrastructure && (!baseUrl || !debugPort)) {
    throw new Error('Set both FANTASY_BASE_URL and FANTASY_DEBUG_PORT, or neither.');
  }
  const cleanup = managesInfrastructure ? await startInfrastructure() : async () => {};

  try {
    const results = [];
    for (const competition of COMPETITIONS) {
      process.stdout.write(`${MODE} ${competition.key}... `);
      const result = MODE === 'capture'
        ? await captureCompetition(competition)
        : await verifyCompetition(competition);
      results.push(result);
      process.stdout.write('ok\n');
    }

    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } finally {
    await cleanup();
  }
}

main().catch(error => {
  console.error(error.stack ?? error);
  process.exitCode = 1;
});
