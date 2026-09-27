import { describe, expect, it } from 'vitest';
import { FULL_NAME_PATTERN, normaliseMobile } from '../src/services/profile.js';
import { duplicateTaskIds, unknownTaskIds } from '../src/services/tasks.js';

describe('normaliseMobile', () => {
  it('accepts the shapes people type and returns one canonical form', () => {
    const accepted = [
      '9876543210',
      '+919876543210',
      '+91 98765 43210',
      '91 98765 43210',
      '098765-43210',
      '(+91) 98765.43210',
      '  9876543210  ',
    ];

    for (const input of accepted) {
      expect(normaliseMobile(input), input).toBe('+919876543210');
    }
  });

  it('accepts every valid Indian leading digit', () => {
    for (const first of ['6', '7', '8', '9']) {
      expect(normaliseMobile(`${first}876543210`)).toBe(`+91${first}876543210`);
    }
  });

  it('rejects a leading digit below six', () => {
    for (const first of ['0', '1', '2', '3', '4', '5']) {
      expect(normaliseMobile(`${first}876543210`), first).toBeNull();
    }
  });

  it('rejects wrong lengths', () => {
    expect(normaliseMobile('987654321')).toBeNull();
    expect(normaliseMobile('98765432100')).toBeNull();
    expect(normaliseMobile('+9198765432101')).toBeNull();
    expect(normaliseMobile('')).toBeNull();
  });

  it('rejects letters and other country codes', () => {
    expect(normaliseMobile('98765abcde')).toBeNull();
    expect(normaliseMobile('+14155552671')).toBeNull();
  });

  it('is idempotent, so re-saving a stored number is safe', () => {
    const once = normaliseMobile('+91 98765 43210');
    expect(once).not.toBeNull();
    expect(normaliseMobile(once ?? '')).toBe(once);
  });
});

describe('FULL_NAME_PATTERN', () => {
  it('accepts real names, including non-Latin scripts', () => {
    for (const name of ['Asha Menon', "D'Souza", 'Jean-Luc', 'R. K. Narayan', 'आशा मेनन']) {
      expect(FULL_NAME_PATTERN.test(name), name).toBe(true);
    }
  });

  it('rejects digits and symbols', () => {
    for (const name of ['Asha3', 'user@example.com', 'Asha_Menon', '<script>']) {
      expect(FULL_NAME_PATTERN.test(name), name).toBe(false);
    }
  });
});

describe('task selection rules', () => {
  it('lists unknown ids in the order they were sent', () => {
    expect(unknownTaskIds([3, 99, 1, 42], [1, 3])).toEqual([99, 42]);
  });

  it('returns nothing when every id exists', () => {
    expect(unknownTaskIds([1, 2], [1, 2, 3])).toEqual([]);
  });

  it('reports each duplicate once', () => {
    expect(duplicateTaskIds([1, 2, 2, 3, 3, 3])).toEqual([2, 3]);
    expect(duplicateTaskIds([1, 2, 3])).toEqual([]);
  });
});
