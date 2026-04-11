'use strict';

const { AppError } = require('../errors/AppError');
const versionRepository = require('../repositories/version.repository');

function parseVersionId(value) {
  // updateVersion can only increment plain integer version ids.
  const versionId = Number(value);

  if (!Number.isSafeInteger(versionId)) {
    throw new AppError(422, 'version_id must be an integer before it can be updated');
  }

  return versionId;
}

async function getVersion({ supabaseClient }) {
  // version_log is the source of truth for frontend cache invalidation.
  const { data, error } = await versionRepository.getVersionRow({ supabaseClient });

  if (error) {
    throw new AppError(502, 'Failed to read version from Supabase', error);
  }

  if (!data) {
    throw new AppError(404, 'version_id was not found in version_log');
  }

  return data.value;
}

async function updateVersion({ supabaseClient }) {
  // Read first so every DB-changing workflow can bump the cache version by 1.
  const currentVersion = parseVersionId(await getVersion({ supabaseClient }));
  const nextVersion = currentVersion + 1;

  const { data, error } = await versionRepository.updateVersionValue({
    supabaseClient,
    value: nextVersion,
  });

  if (error) {
    throw new AppError(502, 'Failed to update version in Supabase', error);
  }

  if (!data) {
    throw new AppError(404, 'version_id was not found in version_log');
  }

  return data.value;
}

module.exports = {
  getVersion,
  updateVersion,
};
