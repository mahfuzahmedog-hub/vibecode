'use client';
import { useCallback } from 'react';
import { Settings2 } from 'lucide-react';
import type { ToolConfig } from '@/lib/types';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface ToolConfigModalProps {
  config: ToolConfig;
  onClose: () => void;
  onUpdateArgs: (args: Record<string, string>) => void;
  onExecute: () => void;
}

export function ToolConfigModal({ config, onClose, onUpdateArgs, onExecute }: ToolConfigModalProps) {
  const trapRef = useFocusTrap(config.open);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  if (!config.open) return null;

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Tool Configuration"
    >
      <div
        className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-indigo-400" /> Tool: {config.toolName}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg" aria-label="Close tool config">&times;</button>
        </div>

        <div className="space-y-3 mb-4">
          <label htmlFor="tool-workflow-id" className="text-xs text-slate-400">Workflow ID</label>
          <input
            id="tool-workflow-id"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. wf_1"
            value={config.args.workflowId || ''}
            onChange={(e) => onUpdateArgs({ ...config.args, workflowId: e.target.value })}
            autoFocus
          />
        </div>

        {config.result !== null && (
          <div className="mb-4 p-3 bg-black/50 border border-slate-700 rounded-lg max-h-40 overflow-y-auto">
            <pre className="text-[10px] text-slate-400 whitespace-pre-wrap">
              {typeof config.result === 'string' ? config.result : JSON.stringify(config.result, null, 2)}
            </pre>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onExecute} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
            Execute
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
