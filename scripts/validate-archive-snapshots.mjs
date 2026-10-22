import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const seasonsRoot = path.join(root, 'src/assets/data/seasons');
const errors = [];
const seasonConfigs = [];

const seasonDirectories = await readdir(seasonsRoot, { withFileTypes: true });
for (const seasonDirectory of seasonDirectories.filter(entry => entry.isDirectory())) {
  const directory = path.join(seasonsRoot, seasonDirectory.name);
  const files = await readdir(directory, { withFileTypes: true });
  for (const fileEntry of files.filter(entry => entry.isFile() && entry.name.endsWith('.json'))) {
    const filePath = path.join(directory, fileEntry.name);
    const season = JSON.parse(await readFile(filePath, 'utf8'));
    const source = season.config?.dataSource;
    seasonConfigs.push({ filePath, config: season.config });
    if (source?.lifecycle !== 'archived') continue;
    if (!source.snapshot?.manifestUrl || !source.snapshot?.viewUrl) {
      errors.push(`${filePath}: archived data source has no manifest/view URL`);
      continue;
    }

    const manifestPath = assetPath(source.snapshot.manifestUrl);
    const viewPath = assetPath(source.snapshot.viewUrl);
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      const viewContents = await readFile(viewPath);
      const view = JSON.parse(viewContents.toString('utf8'));
      if (manifest.schemaVersion !== source.snapshot.schemaVersion || view.schemaVersion !== source.snapshot.schemaVersion) {
        errors.push(`${filePath}: snapshot schema versions do not match`);
      }
      if (manifest.datasetId !== view.datasetId) {
        errors.push(`${filePath}: manifest and view dataset ids do not match`);
      }
      const profileIds = new Set((view.profiles ?? []).map(profile => profile.id));
      if (profileIds.size !== manifest.counts?.profiles) {
        errors.push(`${filePath}: profile count does not match the manifest`);
      }
      const referencedProfileIds = [
        ...Object.values(view.leagueProfileIds ?? {}).flat(),
        ...(view.squadDetails ?? []).map(squad => squad.profileId),
        ...(view.prizes ?? []).flatMap(prize => [
          ...(prize.nomineeIds ?? []),
          ...(prize.activeLeaderIds ?? []),
        ]),
      ];
      const missingProfileId = referencedProfileIds.find(id => !profileIds.has(id));
      if (missingProfileId) {
        errors.push(`${filePath}: snapshot references unknown profile ${missingProfileId}`);
      }
      if (Object.keys(view.sportPlayersByTour ?? {}).length !== manifest.counts?.tours) {
        errors.push(`${filePath}: tour statistics count does not match the manifest`);
      }
      for (const [relativePath, expectedHash] of Object.entries(manifest.files ?? {})) {
        if (typeof expectedHash !== 'string' || !expectedHash.startsWith('sha256:')) continue;
        const snapshotFilePath = path.join(path.dirname(manifestPath), relativePath);
        const contents = relativePath === 'view.json' ? viewContents : await readFile(snapshotFilePath);
        const actualHash = `sha256:${createHash('sha256').update(contents).digest('hex')}`;
        if (expectedHash !== actualHash) errors.push(`${filePath}: ${relativePath} checksum is invalid`);
      }
    } catch (error) {
      errors.push(`${filePath}: ${error.message}`);
    }
  }
}

const tournamentCatalog = JSON.parse(await readFile(path.join(root, 'src/assets/data/tournaments.json'), 'utf8'));
const tournamentsById = new Map(tournamentCatalog.map(tournament => [tournament.id, tournament]));
for (const { filePath, config } of seasonConfigs) {
  const ids = config.catalogTournamentIds ?? [];
  if (!ids.length) continue;
  const tournaments = ids.map(id => tournamentsById.get(id)).filter(Boolean);
  if (tournaments.length !== ids.length) {
    errors.push(`${filePath}: one or more catalogTournamentIds do not exist`);
    continue;
  }
  const allCompleted = tournaments.every(tournament => tournament.status === 'completed');
  if (allCompleted && config.dataSource?.lifecycle !== 'archived') {
    errors.push(`${filePath}: completed catalog tournaments require an archived snapshot`);
  }
  if (!allCompleted && config.dataSource?.lifecycle === 'archived') {
    errors.push(`${filePath}: a mutable catalog tournament cannot use an archived snapshot`);
  }
}

const legacyConstsPath = path.join(root, 'src/assets/data/consts.json');
const legacyConsts = JSON.parse(await readFile(legacyConstsPath, 'utf8'));
for (const config of legacyConsts.league ?? []) {
  if (config.data_source?.lifecycle !== 'archived') continue;
  for (const field of ['squad_link', 'squad_link_2']) {
    const url = config[field];
    if (!url) continue;
    if (/^https?:\/\//.test(url)) {
      errors.push(`${legacyConstsPath}: archived ${config.type}.${field} still points to the external API`);
      continue;
    }
    try {
      await readFile(assetPath(url));
    } catch (error) {
      errors.push(`${legacyConstsPath}: ${config.type}.${field} is unavailable (${error.message})`);
    }
  }
  const manifestUrl = config.data_source.manifest;
  if (!manifestUrl) {
    errors.push(`${legacyConstsPath}: archived ${config.type} has no manifest`);
    continue;
  }
  try {
    const manifest = JSON.parse(await readFile(assetPath(manifestUrl), 'utf8'));
    if (!manifest.source?.fullInfo?.length) {
      errors.push(`${legacyConstsPath}: ${config.type} manifest has no recovery API source`);
    }
  } catch (error) {
    errors.push(`${legacyConstsPath}: ${config.type} manifest is unavailable (${error.message})`);
  }
}

if (errors.length) {
  console.error(`Archive validation failed:\n- ${errors.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Archive snapshots are valid');
}

function assetPath(url) {
  const relative = url.replace(/^\/?assets\//, '');
  return path.join(root, 'src/assets', relative);
}
