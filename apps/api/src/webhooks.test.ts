import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { canonicalJson, signature } from './crypto'
import { endpointURL, isPublicAddress } from './webhook-http'

test('HMAC uses the exact raw payload bytes', () => {
  assert.equal(
    signature('The quick brown fox jumps over the lazy dog', 'key'),
    'sha256=f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8',
  )
})

test('webhooks accept public HTTPS destinations', () => {
  assert.equal(endpointURL('https://receiver.example/webhook').href, 'https://receiver.example/webhook')
  assert.equal(isPublicAddress('8.8.8.8'), true)
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true)
  for (const address of ['0.0.0.0', '127.0.0.1', '10.0.0.2', '192.168.1.2', '169.254.169.254', '100.100.100.200', '::1', '::ffff:127.0.0.1', 'fc00::1', '2001:db8::1']) {
    assert.equal(isPublicAddress(address), false, address)
  }
  for (const url of ['http://receiver.example', 'https://127.0.0.1', 'https://[::1]', 'https://localhost.', 'https://user@receiver.example']) {
    assert.throws(() => endpointURL(url))
  }
})

test('canonical JSON sorts keys without changing array order', () => {
  assert.equal(canonicalJson({ z: [2, 1], x: { y: 1, a: 2 } }), '{"x":{"a":2,"y":1},"z":[2,1]}')
})
