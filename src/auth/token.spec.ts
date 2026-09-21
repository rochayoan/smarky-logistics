import { describe, expect, it } from 'vitest';
import { generateApiToken, hashApiToken, tokenPrefix } from './token.js';

describe('API token security', () => {
  it('generates an sml token with at least 32 random bytes of payload', () => {
    const token = generateApiToken();
    expect(token.startsWith('sml_')).toBe(true);
    expect(Buffer.from(token.slice(4), 'base64url')).toHaveLength(32);
  });
  it('hashes deterministically and keeps distinct tokens distinct', () => {
    const first = generateApiToken();
    const second = generateApiToken();
    expect(hashApiToken(first)).toBe(hashApiToken(first));
    expect(hashApiToken(first)).not.toBe(hashApiToken(second));
    expect(tokenPrefix(first)).not.toBe(first);
  });
});
