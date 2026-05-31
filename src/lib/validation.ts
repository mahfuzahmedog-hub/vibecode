import { z } from 'zod';

export const generateSchema = z.object({
  prompt: z.string().min(1).max(10000).optional(),
  error: z.string().max(5000).optional().nullable(),
  model: z.string().max(200).optional().nullable(),
}).refine(data => data.prompt || data.error, {
  message: 'Prompt or error is required',
});

export const planSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(10000),
  model: z.string().max(200).optional().nullable(),
});

export const designSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(10000),
  context: z.string().max(20000).optional().nullable(),
  model: z.string().max(200).optional().nullable(),
});

export const deploySchema = z.object({
  code: z.string().min(1),
  model: z.string().optional(),
  useMcp: z.boolean().optional(),
});

export const mcpSchema = z.object({
  action: z.enum(['connect', 'disconnect', 'status', 'listTools', 'executeTool', 'readResource']),
  tool: z.string().optional(),
  args: z.record(z.string(), z.unknown()).optional(),
  uri: z.string().optional(),
}).refine(data => {
  if (data.action === 'executeTool') return !!data.tool;
  if (data.action === 'readResource') return !!data.uri;
  return true;
}, {
  message: 'Missing required field for action',
});

export const healthPostSchema = z.object({
  apiKey: z.string().min(1, 'apiKey is required'),
});
