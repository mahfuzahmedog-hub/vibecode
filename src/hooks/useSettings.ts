'use client';
import { useState, useCallback } from 'react';
import type { AIProvider } from '@/lib/types';

const KEY_STORAGE = 'vibecoder_api_key';
const PROVIDER_STORAGE = 'vibecoder_provider';

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function readProvider(): AIProvider {
  const saved = readStorage(PROVIDER_STORAGE);
  if (saved === 'openai' || saved === 'anthropic' || saved === 'google' || saved === 'openrouter') return saved;
  return 'openrouter';
}

export function useSettings() {
  const [apiKey, setApiKeyState] = useState(() => readStorage(KEY_STORAGE) || '');
  const [provider, setProviderState] = useState<AIProvider>(readProvider);
  const [keySaved, setKeySaved] = useState(() => !!readStorage(KEY_STORAGE));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
  }, []);

  const saveApiKey = useCallback((key: string) => {
    if (key.trim()) {
      try { localStorage.setItem(KEY_STORAGE, key.trim()); } catch { /* localStorage unavailable */ }
      setKeySaved(true);
      setApiKeyState(key.trim());
    }
  }, []);

  const clearApiKey = useCallback(() => {
    try {
      localStorage.removeItem(KEY_STORAGE);
      localStorage.removeItem(PROVIDER_STORAGE);
    } catch { /* localStorage unavailable */ }
    setKeySaved(false);
    setApiKeyState('');
    setProviderState('openrouter');
  }, []);

  const setProvider = useCallback((p: AIProvider) => {
    try { localStorage.setItem(PROVIDER_STORAGE, p); } catch { /* localStorage unavailable */ }
    setProviderState(p);
  }, []);

  const getHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const storedKey = localStorage.getItem(KEY_STORAGE);
      if (storedKey) {
        headers['x-api-key'] = storedKey;
        headers['x-api-provider'] = localStorage.getItem(PROVIDER_STORAGE) || 'openrouter';
      }
    } catch { /* localStorage unavailable */ }
    return headers;
  }, []);

  return {
    apiKey, setApiKey,
    provider, setProvider,
    keySaved, setKeySaved,
    settingsOpen, setSettingsOpen,
    showKey, setShowKey,
    saveApiKey,
    clearApiKey,
    getHeaders,
  };
}
