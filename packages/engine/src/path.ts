export const missing = Symbol('missing field');

const own = Object.prototype.hasOwnProperty;

export function resolvePath(input: unknown, path: readonly string[]): unknown {
  let cursor = input;
  for (const key of path) {
    if (typeof cursor !== 'object') return missing;
    if (Array.isArray(cursor) && !/^(0|[1-9][0-9]*)$/.test(key)) return missing;
    if (!own.call(cursor, key)) return missing;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}
