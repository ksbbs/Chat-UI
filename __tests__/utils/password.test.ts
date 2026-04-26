import { describe, it, expect, vi } from 'vitest';

// Mock DB module to prevent initialization errors
vi.mock('@/app/db', () => ({
  db: {
    query: {},
  },
}));

import { verifyPassword } from '@/app/utils/password';

describe('verifyPassword', () => {
  it('returns true for correct password', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('mypassword', 10);
    const result = await verifyPassword('mypassword', hash);
    expect(result).toBe(true);
  });

  it('returns false for incorrect password', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('mypassword', 10);
    const result = await verifyPassword('wrongpassword', hash);
    expect(result).toBe(false);
  });

  it('returns false for empty password against a hash', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('mypassword', 10);
    const result = await verifyPassword('', hash);
    expect(result).toBe(false);
  });
});
