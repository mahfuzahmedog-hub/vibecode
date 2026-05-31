'use client';
import { useRef, useCallback, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';

interface EditorPanelProps {
  code: string;
  onChange: (code: string) => void;
  isLoading: boolean;
}

export function EditorPanel({ code, onChange, isLoading }: EditorPanelProps) {
  const [displayCode, setDisplayCode] = useState(code);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDisplayCode(code), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [code]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) onChange(value);
  }, [onChange]);

  return (
    <div className="flex-1 flex flex-col bg-[#1e1e1e] border-r border-slate-800">
      <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span className="code-dot bg-red-500" />
          <span className="code-dot bg-yellow-500" />
          <span className="code-dot bg-green-500" />
          <span className="ml-2">vibe-output.code</span>
        </div>
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          defaultLanguage="javascript"
          theme="vs-dark"
          value={displayCode}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            padding: { top: 20 },
            scrollBeyondLastLine: false,
            readOnly: isLoading,
          }}
          aria-label="Code editor"
        />
      </div>
    </div>
  );
}
