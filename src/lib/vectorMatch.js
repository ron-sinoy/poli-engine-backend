'use strict';

// In-backend replacement for the migration-002 match RPCs, which the live DB
// never got. Vectors are fetched in pages (a single select of every 3072-dim
// vector, ~39KB serialized each, is what blew the Supabase statement timeout)
// and ranked here with the same cosine the RPCs would have used.

// pgvector columns arrive from PostgREST serialized as a string like "[0.1,0.2]".
function parseVector(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  return denominator === 0 ? 0 : dot / denominator;
}

// Pages through buildPageQuery(from, to) until a short page, collecting rows.
async function fetchAllPages({ buildPageQuery, pageSize }) {
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildPageQuery(from, from + pageSize - 1);

    if (error) {
      return { data: null, error };
    }

    rows.push(...(data || []));

    if (!data || data.length < pageSize) {
      return { data: rows, error: null };
    }
  }
}

// Mirrors the RPC output shape: drops the vectors column, adds `score`, and
// returns the top matchCount rows. Rows whose vector fails to parse or whose
// dimension differs from the query (legacy placeholders) are skipped.
function rankByCosine({ rows, queryVector, matchCount }) {
  return rows
    .map(({ vectors, ...rest }) => {
      const vector = parseVector(vectors);

      if (!vector || vector.length !== queryVector.length) {
        return null;
      }

      return { ...rest, score: cosineSimilarity(queryVector, vector) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, matchCount);
}

module.exports = { parseVector, cosineSimilarity, fetchAllPages, rankByCosine };
