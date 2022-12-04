import { createHash, createHmac, randomBytes } from 'node:crypto'

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function canonicalJson(value: unknown): string {
  const sorted = JSON.stringify(value, (_key, item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    return Object.fromEntries(Object.entries(item).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0))
  })
  if (sorted === undefined) throw new TypeError('Expected a JSON value')
  return sorted
}

export function newAPIKey(): string {
  return `rk_live_${randomBytes(32).toString('base64url')}`
}

