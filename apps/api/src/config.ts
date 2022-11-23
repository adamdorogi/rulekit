import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve(__dirname, '../../../.env') })

function secret(name: string, localValue: string): string {
  const value = process.env[name]
  if (process.env.NODE_ENV === 'production' && (!value || value.length < 32)) {
    throw new Error(`${name} must have at least 32 characters`)
  }
  return value || localValue
}

export const settings = {
  port: Number(process.env.PORT || 4000),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: secret('JWT_SECRET', 'rulekit-local-jwt-change-before-production'),
  cookieSecret: secret('COOKIE_SECRET', 'rulekit-local-cookie-change-before-production'),
  signingKey: secret('WEBHOOK_SIGNING_KEY', 'rulekit-local-signing-change-before-production'),
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:3000',
  secureCookie: process.env.COOKIE_SECURE === 'true'
    || (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false'),
}
