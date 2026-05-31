'use client';
import { useImperativeHandle, forwardRef, useCallback } from 'react';
import { Play, RefreshCcw } from 'lucide-react';

interface PreviewPanelProps {
  onExecute: () => void;
}

export const PreviewPanel = forwardRef<HTMLIFrameElement, PreviewPanelProps>(
  function PreviewPanel({ onExecute }, ref) {
    return (
      <div className="w-full lg:w-1/3 flex flex-col bg-slate-900">
        <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center justify-between text-slate-400 font-medium text-xs">
          <div className="flex items-center gap-2">
            <Play className="w-3 h-3 text-green-400" /> Live Preview
          </div>
          <button
            onClick={onExecute}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
            aria-label="Refresh preview"
          >
            <RefreshCcw className="w-3 h-3 text-slate-400" />
          </button>
        </div>
        <iframe
          ref={ref}
          className="flex-1 w-full h-full border-none"
          title="vibe-preview"
          sandbox="allow-scripts"
        />
      </div>
    );
  }
);
