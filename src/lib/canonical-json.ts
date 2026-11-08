/**
 * Canonical JSON serialization for deterministic SHA-256 snapshot hashing.
 * Recursively sorts object keys lexicographically and strips undefined properties.
 */
export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(sortValueRecursively(value));
}

function sortValueRecursively(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortValueRecursively);
  }

  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const sortedObj: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedObj[key] = sortValueRecursively(record[key]);
  }
  return sortedObj;
}
