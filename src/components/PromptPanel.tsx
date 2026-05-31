'use client';
import { useState, useCallback, useRef } from 'react';
import { Loader2, Send, ChevronDown } from 'lucide-react';
import { WorkingLog } from './WorkingLog';
import type { GenerationMode } from '@/lib/types';

const PROMPT_TEMPLATES: Record<GenerationMode, { label: string; prompt: string }[]> = {
  code: [
    { label: 'Landing page', prompt: 'A modern landing page with hero section, features grid, and call-to-action. Use Tailwind CSS.' },
    { label: 'Dashboard', prompt: 'A data dashboard with sidebar navigation, charts, stats cards, and a dark theme.' },
    { label: 'Form', prompt: 'A multi-step form with validation, progress bar, and success state.' },
    { label: 'API route', prompt: 'A REST API endpoint with CRUD operations, error handling, and input validation.' },
    { label: 'Component', prompt: 'A reusable React component with TypeScript props, loading state, and empty state.' },
  ],
  plan: [
    { label: 'Architecture', prompt: 'Plan the architecture for a SaaS platform with multi-tenancy, billing, and real-time features.' },
    { label: 'Migration', prompt: 'Create a migration plan from a monolithic Express app to microservices on Kubernetes.' },
    { label: 'Startup MVP', prompt: 'Plan the MVP for a developer tool that helps teams automate their CI/CD pipelines.' },
  ],
  design: [
    { label: 'Design System', prompt: 'Advise on a design system for a B2B analytics platform targeting enterprise customers.' },
    { label: 'UX Flow', prompt: 'Design the user flow for a code generation tool from prompt to deployment.' },
    { label: 'Mobile First', prompt: 'Provide design guidance for a mobile-first developer dashboard.' },
  ],
};

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
  const [showTemplates, setShowTemplates] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onGenerate();
    }
  };

  const selectTemplate = useCallback((t: string) => {
    onPromptChange(t);
    setShowTemplates(false);
  }, [onPromptChange]);

  const templates = PROMPT_TEMPLATES[mode];

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
          <div className="flex items-center justify-between -mt-2">
            <span className="text-[10px] text-slate-500">Ctrl+Enter to generate</span>
            <div className="relative" ref={templateRef}>
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
              >
                Templates <ChevronDown className="w-3 h-3" />
              </button>
              {showTemplates && (
                <div className="absolute bottom-full right-0 mb-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                  {templates.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => selectTemplate(t.prompt)}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      <span className="font-medium text-indigo-400">{t.label}</span>
                      <p className="text-slate-500 truncate mt-0.5">{t.prompt}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
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
