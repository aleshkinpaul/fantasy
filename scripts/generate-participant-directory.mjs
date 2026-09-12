import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataRoot = path.join(projectRoot, 'src', 'assets', 'data');
const outputPath = path.join(dataRoot, 'participants.json');
const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });

const seasonPaths = [
  'seasons/2025-26/spain.json',
  'seasons/2025-26/champions-league.json',
  'seasons/2025-26/world-cup.json',
  'seasons/2026-27/spain.json',
  'seasons/2026-27/champions-league.json',
];

const achievements = readJson('achievements.json');
const retro = readJson('retro-tournaments.json');
const archiveCups = readJson('archive-cups.json');
const legacyProfiles = readJson('profiles.json')['2024'] ?? [];
const seasons = seasonPaths
  .map(relativePath => readJson(relativePath))
  .sort((left, right) => left.config.yearStart - right.config.yearStart || left.config.type.localeCompare(right.config.type));

const groups = new Map();
const profileOwners = new Map();
const nameOwners = new Map();

for (const participant of achievements.participants) {
  const group = createGroup(participant.id, participant.name, true);
  for (const profileId of participant.profileIds) attachProfile(group, profileId);
}

const observations = [
  ...retro.tournaments.flatMap(tournament => tournament.standings.map(standing => ({
    participantId: standing.participantId,
    profileId: standing.profileId,
    name: standing.participantName,
  }))),
  ...archiveCups.tournaments.flatMap(tournament => tournament.rounds.flatMap(round =>
    round.matches.flatMap(match => [match.first, match.second]).map(team => ({
      profileId: team.profileId,
      name: team.participantName,
    })),
  )),
  ...legacyProfiles.map(profile => ({ profileId: profile.id, name: profile.name })),
  ...seasons.flatMap(season => season.profiles.map(profile => ({
    profileId: profile.id,
    name: profile.name,
  }))),
];

for (const observation of observations) mergeObservation(observation);

const participants = Array.from(groups.values())
  .map(group => ({
    participantId: group.participantId,
    name: group.name,
    profileIds: Array.from(group.profileIds),
  }))
  .filter(participant => participant.name && participant.profileIds.length)
  .sort(compareParticipants);

const registry = `${JSON.stringify({ version: 1, participants }, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
  if (current !== registry) {
    console.error('Participant directory is outdated. Run: npm run participants:generate');
    process.exitCode = 1;
  } else {
    console.log(`Participant directory is current: ${participants.length} participants`);
  }
} else {
  fs.writeFileSync(outputPath, registry, 'utf8');
  console.log(`Generated ${path.relative(projectRoot, outputPath)} with ${participants.length} participants`);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(dataRoot, relativePath), 'utf8'));
}

function createGroup(participantId, name, lockedName = false) {
  let uniqueId = participantId;
  let suffix = 2;
  while (groups.has(uniqueId)) uniqueId = `${participantId}-${suffix++}`;

  const group = {
    participantId: uniqueId,
    name: normalizeWhitespace(name),
    lockedName,
    profileIds: new Set(),
  };
  groups.set(uniqueId, group);
  attachName(group, name);
  return group;
}

function mergeObservation({ participantId, profileId, name }) {
  const normalizedProfileId = normalizeWhitespace(profileId);
  const normalizedName = normalizeWhitespace(name);
  if (!normalizedProfileId || !normalizedName) return;

  let group = profileOwners.get(normalizedProfileId);
  if (!group && participantId) group = groups.get(participantId);
  if (!group) {
    const candidates = nameOwners.get(normalizeName(normalizedName));
    if (candidates?.size === 1) group = candidates.values().next().value;
  }
  if (!group) group = createGroup(participantId || `profile-${normalizedProfileId}`, normalizedName);

  attachProfile(group, normalizedProfileId);
  attachName(group, normalizedName);
  if (!group.lockedName) group.name = normalizedName;
}

function attachProfile(group, profileId) {
  const normalizedProfileId = normalizeWhitespace(profileId);
  const owner = profileOwners.get(normalizedProfileId);
  if (owner && owner !== group) {
    throw new Error(`Profile ${normalizedProfileId} belongs to both ${owner.participantId} and ${group.participantId}`);
  }
  group.profileIds.add(normalizedProfileId);
  profileOwners.set(normalizedProfileId, group);
}

function attachName(group, name) {
  const key = normalizeName(name);
  if (!key) return;
  const owners = nameOwners.get(key) ?? new Set();
  owners.add(group);
  nameOwners.set(key, owners);
}

function compareParticipants(left, right) {
  return collator.compare(surname(left.name), surname(right.name))
    || collator.compare(left.name, right.name)
    || left.participantId.localeCompare(right.participantId);
}

function surname(name) {
  return normalizeWhitespace(name).split(' ').at(-1) ?? name;
}

function normalizeName(value) {
  return normalizeWhitespace(value).toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
}

function normalizeWhitespace(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}
