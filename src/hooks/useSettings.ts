'use client';
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'vibecoder_api_key';

export function useSettings() {
  const [apiKey, setApiKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setApiKey(saved);
      setKeySaved(true);
    }
  }, []);

  const saveApiKey = useCallback((key: string) => {
    const trimmed = key.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
      setApiKey(trimmed);
      setKeySaved(true);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setApiKey('');
      setKeySaved(false);
    }
  }, []);

  const getHeaders = useCallback((extra: Record<string, string> = {}): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
    const saved = apiKey || localStorage.getItem(STORAGE_KEY) || '';
    if (saved) headers['x-api-key'] = saved;
    return headers;
  }, [apiKey]);

  const clearApiKey = useCallback(() => {
    saveApiKey('');
  }, [saveApiKey]);

  return {
    apiKey,
    setApiKey,
    keySaved,
    settingsOpen,
    setSettingsOpen,
    showKey,
    setShowKey,
    saveApiKey,
    clearApiKey,
    getHeaders,
  };
}
