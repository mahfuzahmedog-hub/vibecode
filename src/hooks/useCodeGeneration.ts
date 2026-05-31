'use client';
import { useState, useCallback } from 'react';
import type { GenerationMode } from '@/lib/types';

interface CodeGenDeps {
  getHeaders: () => Record<string, string>;
  addLog: (msg: string) => void;
  executeCode: (code: string) => void;
}

export function useCodeGeneration(deps: CodeGenDeps) {
  const { getHeaders, addLog, executeCode } = deps;
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState('// Your generated code will appear here...');
  const [isLoading, setIsLoading] = useState(false);
  const [modelUsed, setModelUsed] = useState('');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<GenerationMode>('code');

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCode('');
    addLog(`Starting ${mode} generation...`);

    try {
      if (mode === 'plan' || mode === 'design') {
        const response = await fetch(`/api/${mode}`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ prompt: trimmed, model: selectedModel }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          let errMsg: string;
          try { errMsg = JSON.parse(errBody).error || errBody; } catch { errMsg = errBody || `${mode} request failed`; }
          throw new Error(errMsg);
        }

        const data = await response.json();
        setCode(typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data));
        addLog(`${mode} response complete`);
      } else {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ prompt: trimmed, model: selectedModel }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          let errMsg: string;
          try { errMsg = JSON.parse(errBody).error || errBody; } catch { errMsg = errBody || 'Generation failed'; }
          throw new Error(errMsg);
        }

        const model = response.headers.get('X-Model') || 'Unknown';
        setModelUsed(model);
        addLog(`Model selected: ${model}`);

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader available');

        let accumulatedCode = '';
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          accumulatedCode += chunk;
          setCode(accumulatedCode);
        }

        addLog('Code generation complete!');
        executeCode(accumulatedCode);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      addLog(`Error: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [prompt, mode, selectedModel, getHeaders, addLog, executeCode]);

  return {
    prompt, setPrompt,
    code, setCode,
    isLoading, setIsLoading,
    modelUsed, setModelUsed,
    selectedModel, setSelectedModel,
    error, setError,
    mode, setMode,
    handleGenerate,
  };
}
