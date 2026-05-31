import { describe, it, expect } from 'vitest';
import { FALLBACK_MODELS } from '../models';

describe('FALLBACK_MODELS', () => {
  it('contains at least one model', () => {
    expect(FALLBACK_MODELS.length).toBeGreaterThan(0);
  });

  it('all models are strings with IDs', () => {
    for (const model of FALLBACK_MODELS) {
      expect(typeof model).toBe('string');
      expect(model.length).toBeGreaterThan(5);
      expect(model).toMatch(/\/|:/);
    }
  });
});
