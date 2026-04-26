import { encrypt, decrypt } from '@marketproads/crypto'

const TEST_KEY = '0'.repeat(64)

beforeAll(() => {
  process.env['ENCRYPTION_KEY'] = TEST_KEY
})

afterAll(() => {
  delete process.env['ENCRYPTION_KEY']
})

describe('AES-256-GCM encrypt/decrypt', () => {
  it('roundtrip: decrypt(encrypt(x)) === x', () => {
    const plain = 'my-secret-meta-token-12345'
    expect(decrypt(encrypt(plain))).toBe(plain)
  })

  it('encrypted output does not contain plaintext', () => {
    const plain = 'my-secret-token'
    expect(encrypt(plain)).not.toContain(plain)
  })

  it('produces unique ciphertexts for same input (random IV)', () => {
    const plain = 'same-input-every-time'
    expect(encrypt(plain)).not.toBe(encrypt(plain))
  })

  it('throws on tampered ciphertext (auth tag check)', () => {
    const original = encrypt('sensitive-data')
    const parts = original.split(':')
    parts[1] = 'a'.repeat(parts[1]!.length)
    expect(() => decrypt(parts.join(':'))).toThrow()
  })

  it('throws on invalid ciphertext format', () => {
    expect(() => decrypt('only:two')).toThrow('Invalid ciphertext format')
  })
})
