export type AIProvider = 'openrouter' | 'openai' | 'anthropic' | 'google';

export interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  nodeCount: number;
  createdAt: string;
}

export interface McpStatus {
  connected: boolean;
  connecting: boolean;
}

export interface ToolConfig {
  open: boolean;
  toolName: string;
  args: Record<string, string>;
  result: unknown;
}

export type GenerationMode = 'code' | 'plan' | 'design';
