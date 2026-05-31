import { describe, it, expect } from 'vitest';
import { AI_PROVIDER_MODELS, AI_PROVIDER_LABELS } from '../ai-client';

describe('AI_PROVIDER_MODELS', () => {
  it('has all four providers', () => {
    const providers = Object.keys(AI_PROVIDER_MODELS);
    expect(providers).toEqual(['openrouter', 'openai', 'anthropic', 'google']);
  });

  it('each provider has at least one model', () => {
    for (const models of Object.values(AI_PROVIDER_MODELS)) {
      expect(models.length).toBeGreaterThan(0);
    }
  });

  it('all model strings are non-empty', () => {
    for (const models of Object.values(AI_PROVIDER_MODELS)) {
      for (const model of models) {
        expect(typeof model).toBe('string');
        expect(model.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('AI_PROVIDER_LABELS', () => {
  it('has all four providers', () => {
    const providers = Object.keys(AI_PROVIDER_LABELS);
    expect(providers).toEqual(['openrouter', 'openai', 'anthropic', 'google']);
  });

  it('all labels are non-empty strings', () => {
    for (const label of Object.values(AI_PROVIDER_LABELS)) {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
