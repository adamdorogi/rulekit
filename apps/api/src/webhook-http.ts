import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { isIP } from 'node:net'
import { signature } from './crypto'
import { HttpError } from './errors'

export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) {
    const [a, b, c] = address.split('.').map(Number)
    return a !== 0 && a !== 10 && a !== 127 && a < 224
      && !(a === 100 && b >= 64 && b <= 127)
      && !(a === 169 && b === 254)
      && !(a === 172 && b >= 16 && b <= 31)
      && !(a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99)))
      && !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
      && !(a === 203 && b === 0 && c === 113)
  }
  if (family === 6) {
    const [first, second] = address.toLowerCase().split(':').map((part) => parseInt(part || '0', 16))
    return first >= 0x2000 && first < 0x4000 && first !== 0x2002
      && !(first === 0x2001 && (second <= 0x1ff || second === 0xdb8))
      && !(first === 0x3fff && second <= 0x0fff)
  }
  return false
}

export function endpointURL(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new HttpError(400, 'Enter a public HTTPS endpoint')
  }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (
    url.protocol !== 'https:' || url.username || url.password || url.hash
    || (url.port && url.port !== '443')
    || (isIP(host) ? !isPublicAddress(host) : !host.includes('.') || /(?:^|\.)(?:local|localhost|internal)\.?$/i.test(host))
  ) {
    throw new HttpError(400, 'Enter a public HTTPS endpoint')
  }
  return url
}

export async function deliverWebhook(raw: string, body: string, eventId: string, secret: string): Promise<number> {
  const url = endpointURL(raw)
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = await lookup(host, { all: true })
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Endpoint DNS did not resolve to public addresses')
  }
  const { address, family } = addresses[0]
  return new Promise((resolve, reject) => {
    const outgoing = request(url, {
      method: 'POST',
      agent: false,
      family,
      signal: AbortSignal.timeout(8000),
      // Keep TLS verification on the original hostname, but connect to the checked address.
      lookup: (_hostname, _options, callback) => callback(null, address, family),
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        'x-rulekit-event-id': eventId,
        'x-rulekit-signature': signature(body, secret),
      },
    }, (response) => {
      resolve(response.statusCode || 0)
      response.destroy()
    })
    outgoing.on('error', reject)
    outgoing.end(body)
  })
}
