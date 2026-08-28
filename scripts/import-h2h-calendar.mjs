import { readFile, writeFile } from 'node:fs/promises';

const [sourceUrl, seasonFilePath] = process.argv.slice(2);
if (!sourceUrl || !seasonFilePath) {
  throw new Error('Usage: npm run import:h2h-calendar -- <full_info URL> <season JSON>');
}

const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`H2H API returned HTTP ${response.status}`);

const payload = await response.json();
if (payload?.result !== 1 || !payload.data?.matches || !payload.data?.players) {
  throw new Error('H2H API returned an invalid full_info response');
}

const file = JSON.parse(await readFile(seasonFilePath, 'utf8'));
const configuredIds = new Set(file.config.profiles.map(String));
const apiIds = new Set(Object.keys(payload.data.players));
assertSameIds(configuredIds, apiIds);

const leagueByProfile = new Map();
for (const stage of file.config.stages) {
  for (const league of stage.leagues) {
    for (const profileId of league.profiles) leagueByProfile.set(String(profileId), league.name);
  }
}

const matches = {};
for (const [tour, apiMatches] of Object.entries(payload.data.matches)) {
  const seen = new Set();
  matches[tour] = apiMatches.map(apiMatch => {
    const home = String(apiMatch.home_player);
    const away = String(apiMatch.away_player);
    if (!configuredIds.has(home) || !configuredIds.has(away)) {
      throw new Error(`Unknown profile in tour ${tour}: ${home} — ${away}`);
    }
    if (seen.has(home) || seen.has(away)) {
      throw new Error(`Duplicate profile in tour ${tour}: ${home} — ${away}`);
    }
    if (leagueByProfile.get(home) !== leagueByProfile.get(away)) {
      throw new Error(`Cross-league match in tour ${tour}: ${home} — ${away}`);
    }
    seen.add(home);
    seen.add(away);
    return { home, away };
  });

  if (seen.size !== configuredIds.size) {
    throw new Error(`Tour ${tour} covers ${seen.size} of ${configuredIds.size} profiles`);
  }
}

file.config.id = String(payload.data.id);
file.config.squad_link = sourceUrl;
file.config.matches = matches;
await writeFile(seasonFilePath, `${JSON.stringify(file, null, 2)}\n`, 'utf8');

console.log(
  `Imported ${Object.keys(matches).length} tours and ${Object.values(matches).flat().length} matches `
  + `for ${configuredIds.size} profiles (tournament ${file.config.id}).`,
);

function assertSameIds(configuredIds, apiIds) {
  const missing = [...configuredIds].filter(id => !apiIds.has(id));
  const extra = [...apiIds].filter(id => !configuredIds.has(id));
  if (missing.length || extra.length) {
    throw new Error(`Profile mismatch. Missing: ${missing.join(', ') || '-'}; extra: ${extra.join(', ') || '-'}`);
  }
}
