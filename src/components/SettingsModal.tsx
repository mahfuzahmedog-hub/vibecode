'use client';
import { useState, useEffect, useCallback } from 'react';
import { Key, Eye, EyeOff, Check } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  apiKey: string;
  keySaved: boolean;
  showKey: boolean;
  onClose: () => void;
  onApiKeyChange: (key: string) => void;
  onSaveKey: (key: string) => void;
  onClearKey: () => void;
  onToggleShowKey: () => void;
}

export function SettingsModal({
  open,
  apiKey,
  keySaved,
  showKey,
  onClose,
  onApiKeyChange,
  onSaveKey,
  onClearKey,
  onToggleShowKey,
}: SettingsModalProps) {
  const [localKey, setLocalKey] = useState(apiKey);

  useEffect(() => { setLocalKey(apiKey); }, [apiKey]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  const handleSave = useCallback(() => {
    onSaveKey(localKey);
    onClose();
  }, [localKey, onSaveKey, onClose]);

  if (!open) return null;

  return (
    <div
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
            <Key className="w-4 h-4 text-indigo-400" /> API Key
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg" aria-label="Close settings">&times;</button>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Enter your OpenRouter API key. It will be stored in your browser (localStorage) and
          sent with every request. Never commit keys to git.
        </p>

        <div className="space-y-3 mb-4">
          <label htmlFor="api-key-input" className="text-xs text-slate-400">OpenRouter API Key</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="api-key-input"
                type={showKey ? 'text' : 'password'}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                placeholder="sk-or-v1-..."
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
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">Get a key</a>
            <span className="text-slate-600">|</span>
            <span>No key = uses server-side env vars</span>
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
              onClick={() => { onClearKey(); setLocalKey(''); }}
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
