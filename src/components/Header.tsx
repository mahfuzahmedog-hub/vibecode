'use client';
import { Sparkles, Workflow, Plus, Rocket, Play, Key, Sun, Moon, Monitor } from 'lucide-react';
import { MODEL_PRIORITY } from '@/lib/models';
import type { McpStatus } from '@/lib/types';

type Theme = 'system' | 'light' | 'dark';

interface HeaderProps {
  selectedModel: string | null;
  onModelChange: (model: string | null) => void;
  modelUsed: string;
  mcpStatus: McpStatus;
  keySaved: boolean;
  workflowsCount: number;
  showWorkflows: boolean;
  onToggleWorkflows: () => void;
  onOpenSettings: () => void;
  onCreateWorkflow: () => void;
  onDeploy: () => void;
  onRunCode: () => void;
  canDeploy: boolean;
  deployingToN8n: boolean;
  hasCode: boolean;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Header({
  selectedModel, onModelChange, modelUsed,   mcpStatus, keySaved,
  workflowsCount, showWorkflows, onToggleWorkflows, onOpenSettings,
  onCreateWorkflow, onDeploy, onRunCode,
  canDeploy, deployingToN8n, hasCode, theme, onToggleTheme,
}: HeaderProps) {
  return (
    <header className="border-b border-slate-800 glass px-6 py-4 flex justify-between items-center sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <div className="bg-indigo-600 p-2 rounded-lg"><Sparkles className="w-5 h-5 text-white" /></div>
        <h1 className="text-xl font-bold tracking-tight">
          VibeCoder <span className="text-indigo-400 font-medium text-sm">Live</span>
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSettings}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 ${
            keySaved
              ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/50'
              : 'bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300'
          }`}
          aria-label={keySaved ? 'API Key configured — click to change' : 'No API Key — click to add'}
        >
          <Key className="w-3.5 h-3.5" />
          {keySaved ? 'Key Set' : 'Add Key'}
        </button>

        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all active:scale-95"
          aria-label={`Theme: ${theme}`}
          title={`Theme: ${theme}`}
        >
          {theme === 'dark' ? <Moon className="w-4 h-4" /> : theme === 'light' ? <Sun className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
        </button>

        <div className="relative">
          <label htmlFor="model-select" className="text-xs text-slate-400 sr-only">Model:</label>
          <select
            id="model-select"
            value={selectedModel || 'auto'}
            onChange={(e) => onModelChange(e.target.value === 'auto' ? null : e.target.value)}
            className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
            aria-label="Select model"
          >
            <option value="auto">Auto (Fallback)</option>
            {MODEL_PRIORITY.map((model) => (
              <option key={model} value={model}>
                {model.split('/')[1].split(':')[0]}
              </option>
            ))}
          </select>
        </div>

        {modelUsed && (
          <div className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-full border border-slate-700">
            Used: <span className="text-indigo-300 font-mono">{modelUsed}</span>
          </div>
        )}

        <div
          className="flex items-center gap-2 text-xs"
          aria-live="polite"
          aria-label={`MCP status: ${mcpStatus.connected ? 'Connected' : mcpStatus.connecting ? 'Connecting' : 'Disconnected'}`}
        >
          <div className={`px-2 py-1 rounded-full flex items-center gap-1 ${
            mcpStatus.connected ? 'bg-green-600' : mcpStatus.connecting ? 'bg-yellow-500' : 'bg-slate-600'
          }`}>
            <span className={`w-2 h-2 rounded-full bg-white inline-block ${mcpStatus.connecting ? 'animate-pulse' : ''}`} />
          <span className="ml-1">
            {mcpStatus.connected ? 'MCP Live' : mcpStatus.connecting ? 'Connecting' : 'MCP Off'}
          </span>
          </div>
        </div>

        <button
          onClick={onToggleWorkflows}
          className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95"
          aria-expanded={showWorkflows}
          aria-label={showWorkflows ? 'Close workflows' : 'Open workflows'}
        >
          <Workflow className="w-4 h-4" /> {showWorkflows ? 'Close' : 'Workflows'}
          {workflowsCount > 0 && (
            <span className="ml-1 text-xs bg-slate-600 px-1.5 py-0.5 rounded-full">{workflowsCount}</span>
          )}
        </button>

        <button
          onClick={onCreateWorkflow}
          disabled={!hasCode || !mcpStatus.connected || deployingToN8n}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95"
          aria-label="Create n8n workflow from code"
        >
          {deployingToN8n ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
          {deployingToN8n ? 'Creating...' : 'Create n8n'}
        </button>

        <button
          onClick={onDeploy}
          disabled={!canDeploy || deployingToN8n}
          className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95"
          aria-label="Deploy via MCP"
        >
          <Rocket className="w-4 h-4" /> Deploy
        </button>

        <button
          onClick={onRunCode}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95"
          aria-label="Run code in preview"
        >
          <Play className="w-4 h-4" /> Run
        </button>
      </div>
    </header>
  );
}
