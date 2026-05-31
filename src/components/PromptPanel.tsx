'use client';
import { Loader2, Send } from 'lucide-react';
import { WorkingLog } from './WorkingLog';
import type { GenerationMode } from '@/lib/types';

interface PromptPanelProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  mode: GenerationMode;
  onModeChange: (mode: GenerationMode) => void;
  isLoading: boolean;
  logs: string[];
  onGenerate: () => void;
}

export function PromptPanel({ prompt, onPromptChange, mode, onModeChange, isLoading, logs, onGenerate }: PromptPanelProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onGenerate();
    }
  };

  return (
    <div className="w-full lg:w-1/4 border-r border-slate-800 flex flex-col bg-slate-900/30">
      <div className="p-6 flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700" role="tablist" aria-label="Generation mode">
              {(['code', 'plan', 'design'] as GenerationMode[]).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  aria-controls={`${m}-panel`}
                  onClick={() => onModeChange(m)}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors capitalize ${
                    mode === m ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className="w-full h-32 p-4 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
            placeholder="e.g. A futuristic cyberpunk landing page..."
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Generation prompt"
          />
          <div className="text-[10px] text-slate-500 text-right -mt-2">Ctrl+Enter to generate</div>
        </div>

        <button
          onClick={onGenerate}
          disabled={isLoading || !prompt.trim()}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
          ) : (
            <><Send className="w-5 h-5" /> {mode === 'code' ? 'Generate' : mode === 'plan' ? 'Analyze' : 'Advise'}</>
          )}
        </button>

        <WorkingLog logs={logs} />
      </div>
    </div>
  );
}
