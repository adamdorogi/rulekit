export function equal(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null) return false;
  if (typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;

  const leftEntries = Object.entries(left);
  const rightKeys = Object.keys(right);
  if (leftEntries.length !== rightKeys.length) return false;
  return leftEntries.every(([key, value]) =>
    Object.prototype.hasOwnProperty.call(right, key) &&
    equal(value, (right as Record<string, unknown>)[key])
  );
}
