import { describe, expect, it } from 'vitest';

import { userInitials } from './user-initials';

describe('userInitials', () => {
  it('takes the first letter of each of the first two words, uppercased', () => {
    expect(userInitials('Platform Administrator')).toBe('PA');
    expect(userInitials('Ana Souza')).toBe('AS');
  });

  it('skips a leading bracket/code and finds the first real letter inside the word', () => {
    expect(userInitials('[AUDIT-A3] Usuário escopo Controles')).not.toMatch(/[[\]]/);
    expect(userInitials('[AUDIT-A3] Usuário escopo Controles')).toBe('AU');
  });

  it('is Unicode-aware: an accented first letter is preserved, not stripped or replaced', () => {
    expect(userInitials('Íris Costa')).toBe('ÍC');
    expect(userInitials('Émile Núñez')).toBe('ÉN');
  });

  it('falls back to a single initial when only one word carries a letter', () => {
    expect(userInitials('Madonna')).toBe('M');
  });

  it('falls back to "?" when the name carries no letter at all', () => {
    expect(userInitials('123 456')).toBe('?');
    expect(userInitials('')).toBe('?');
  });
});
