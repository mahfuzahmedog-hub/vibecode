'use client';
import { useState, useCallback } from 'react';
import { Key, Eye, EyeOff, Check } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import type { AIProvider } from '@/lib/types';
import { AI_PROVIDER_LABELS } from '@/lib/ai-client';

interface SettingsModalProps {
  open: boolean;
  apiKey: string;
  provider: AIProvider;
  keySaved: boolean;
  showKey: boolean;
  onClose: () => void;
  onApiKeyChange: (key: string) => void;
  onProviderChange: (provider: AIProvider) => void;
  onSaveKey: (key: string) => void;
  onClearKey: () => void;
  onToggleShowKey: () => void;
}

export function SettingsModal({
  open,
  apiKey,
  provider,
  keySaved,
  showKey,
  onClose,
  onApiKeyChange,
  onProviderChange,
  onSaveKey,
  onClearKey,
  onToggleShowKey,
}: SettingsModalProps) {
  const [localKey, setLocalKey] = useState(apiKey);
  const [localProvider, setLocalProvider] = useState(provider);
  const trapRef = useFocusTrap(open);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  const handleSave = useCallback(() => {
    onProviderChange(localProvider);
    onSaveKey(localKey);
    onClose();
  }, [localKey, localProvider, onSaveKey, onProviderChange, onClose]);

  if (!open) return null;

  const providerKeyHint: Record<AIProvider, string> = {
    openrouter: 'sk-or-v1-...',
    openai: 'sk-proj-...',
    anthropic: 'sk-ant-...',
    google: 'AIza...',
  };

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="API Key Settings"
    >
      <div
        className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-400" /> API Keys
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg" aria-label="Close settings">&times;</button>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          {keySaved
            ? 'Your key is stored in localStorage and never sent to our servers. Keys are sent directly to the AI provider.'
            : 'Enter your API key from any supported provider. It is stored in your browser (localStorage) and sent directly to the provider.'}
        </p>

        <div className="space-y-3 mb-4">
          <label htmlFor="provider-select" className="text-xs text-slate-400">AI Provider</label>
          <select
            id="provider-select"
            value={localProvider}
            onChange={(e) => setLocalProvider(e.target.value as AIProvider)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {(Object.keys(AI_PROVIDER_LABELS) as AIProvider[]).map((p) => (
              <option key={p} value={p}>{AI_PROVIDER_LABELS[p]}</option>
            ))}
          </select>

          <label htmlFor="api-key-input" className="text-xs text-slate-400">API Key</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="api-key-input"
                type={showKey ? 'text' : 'password'}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                placeholder={providerKeyHint[localProvider]}
                value={localKey}
                onChange={(e) => { setLocalKey(e.target.value); onApiKeyChange(e.target.value); }}
                autoFocus
              />
              <button
                onClick={onToggleShowKey}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                tabIndex={-1}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">Get OpenRouter key</a>
            <span className="text-slate-600">|</span>
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">OpenAI</a>
            <span className="text-slate-600">|</span>
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">Anthropic</a>
            <span className="text-slate-600">|</span>
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">Google</a>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!localKey.trim()}
            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {keySaved && localKey.trim() ? <><Check className="w-4 h-4" /> Saved</> : 'Save Key'}
          </button>
          {keySaved && (
            <button
              onClick={() => { onClearKey(); setLocalKey(''); setLocalProvider('openrouter'); }}
              className="px-4 py-2 bg-red-900/30 hover:bg-red-800/50 text-red-400 rounded-lg text-sm transition-colors"
            >
              Clear
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
