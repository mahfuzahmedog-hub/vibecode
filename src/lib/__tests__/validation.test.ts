import { describe, it, expect } from 'vitest';
import { generateSchema, planSchema, designSchema, deploySchema, mcpSchema, healthPostSchema } from '../validation';

describe('generateSchema', () => {
  it('accepts valid prompt', () => {
    const result = generateSchema.safeParse({ prompt: 'Build a button' });
    expect(result.success).toBe(true);
  });

  it('accepts valid error', () => {
    const result = generateSchema.safeParse({ error: 'TypeError: x is undefined' });
    expect(result.success).toBe(true);
  });

  it('rejects empty object', () => {
    const result = generateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts prompt with model', () => {
    const result = generateSchema.safeParse({ prompt: 'Build a button', model: 'gpt-4o' });
    expect(result.success).toBe(true);
  });

  it('rejects prompt over 10000 chars', () => {
    const result = generateSchema.safeParse({ prompt: 'x'.repeat(10001) });
    expect(result.success).toBe(false);
  });
});

describe('planSchema', () => {
  it('accepts valid prompt', () => {
    const result = planSchema.safeParse({ prompt: 'Plan an app' });
    expect(result.success).toBe(true);
  });

  it('rejects empty prompt', () => {
    const result = planSchema.safeParse({ prompt: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing prompt', () => {
    const result = planSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('designSchema', () => {
  it('accepts prompt with context', () => {
    const result = designSchema.safeParse({ prompt: 'Design a UI', context: 'B2B app' });
    expect(result.success).toBe(true);
  });

  it('accepts prompt without context', () => {
    const result = designSchema.safeParse({ prompt: 'Design a UI' });
    expect(result.success).toBe(true);
  });
});

describe('deploySchema', () => {
  it('accepts code', () => {
    const result = deploySchema.safeParse({ code: '<html></html>' });
    expect(result.success).toBe(true);
  });

  it('accepts code with useMcp', () => {
    const result = deploySchema.safeParse({ code: '<html></html>', useMcp: true });
    expect(result.success).toBe(true);
  });

  it('rejects empty code', () => {
    const result = deploySchema.safeParse({ code: '' });
    expect(result.success).toBe(false);
  });
});

describe('mcpSchema', () => {
  it('accepts connect action', () => {
    const result = mcpSchema.safeParse({ action: 'connect' });
    expect(result.success).toBe(true);
  });

  it('requires tool for executeTool', () => {
    const result = mcpSchema.safeParse({ action: 'executeTool' });
    expect(result.success).toBe(false);
  });

  it('accepts executeTool with tool', () => {
    const result = mcpSchema.safeParse({ action: 'executeTool', tool: 'n8n_workflow_list' });
    expect(result.success).toBe(true);
  });

  it('requires uri for readResource', () => {
    const result = mcpSchema.safeParse({ action: 'readResource' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown action', () => {
    const result = mcpSchema.safeParse({ action: 'fly' });
    expect(result.success).toBe(false);
  });
});

describe('healthPostSchema', () => {
  it('accepts valid apiKey', () => {
    const result = healthPostSchema.safeParse({ apiKey: 'sk-or-v1-xxxx' });
    expect(result.success).toBe(true);
  });

  it('rejects empty apiKey', () => {
    const result = healthPostSchema.safeParse({ apiKey: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing apiKey', () => {
    const result = healthPostSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
