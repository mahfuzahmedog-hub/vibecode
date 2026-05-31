'use client';
import { Workflow, RefreshCcw, Settings2, Play } from 'lucide-react';
import type { WorkflowSummary } from '@/lib/types';

interface WorkflowPanelProps {
  show: boolean;
  workflows: WorkflowSummary[];
  onRefresh: () => void;
  onOpenTool: (toolName: string) => void;
}

export function WorkflowPanel({ show, workflows, onRefresh, onOpenTool }: WorkflowPanelProps) {
  if (!show) return null;

  return (
    <div className="border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
          <Workflow className="w-4 h-4 text-indigo-400" /> n8n Workflows
        </h2>
        <button onClick={onRefresh} className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1" aria-label="Refresh workflows">
          <RefreshCcw className="w-3 h-3" /> Refresh
        </button>
      </div>
      {workflows.length === 0 ? (
        <p className="text-xs text-slate-500">
          No workflows found. Generate code and click &quot;Create n8n Workflow&quot; to add one.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {workflows.map((wf) => (
            <div key={wf.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3 hover:border-indigo-500/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  wf.active ? 'bg-green-900/50 text-green-300 border border-green-700' : 'bg-slate-700 text-slate-400'
                }`}>
                  {wf.active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-[10px] text-slate-500">{wf.nodeCount} nodes</span>
              </div>
              <p className="text-sm text-slate-200 font-medium truncate">{wf.name}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-slate-500 flex-1">
                  Created {new Date(wf.createdAt).toLocaleDateString()}
                </span>
                <button onClick={() => onOpenTool('n8n_workflow_get')} className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors" aria-label="Configure tool">
                  <Settings2 className="w-3 h-3" />
                </button>
                <button onClick={() => onOpenTool('n8n_workflow_execute')} className="text-[10px] text-green-400 hover:text-green-300 transition-colors" aria-label="Execute workflow">
                  <Play className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
