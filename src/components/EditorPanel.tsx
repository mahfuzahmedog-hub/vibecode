'use client';
import { useRef, useCallback, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Copy, Download, ExternalLink, Check } from 'lucide-react';

interface EditorPanelProps {
  code: string;
  onChange: (code: string) => void;
  isLoading: boolean;
}

export function EditorPanel({ code, onChange, isLoading }: EditorPanelProps) {
  const [displayCode, setDisplayCode] = useState(code);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDisplayCode(code), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [code]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) onChange(value);
  }, [onChange]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard not available */ }
  }, [displayCode]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([displayCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vibecoder-output.html';
    a.click();
    URL.revokeObjectURL(url);
  }, [displayCode]);

  const handleOpenPreview = useCallback(() => {
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(displayCode);
      w.document.close();
    }
  }, [displayCode]);

  const isDefault = displayCode === '// Your generated code will appear here...';

  return (
    <div className="flex-1 flex flex-col bg-[#1e1e1e] border-r border-slate-800">
      <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span className="code-dot bg-red-500" />
          <span className="code-dot bg-yellow-500" />
          <span className="code-dot bg-green-500" />
          <span className="ml-2">vibe-output.code</span>
        </div>
        <div className="flex items-center gap-1">
          {!isDefault && (
            <>
              <button
                onClick={handleCopy}
                className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                aria-label={copied ? 'Copied' : 'Copy code'}
                title="Copy code"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleDownload}
                className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                aria-label="Download as HTML"
                title="Download as HTML"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleOpenPreview}
                className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                aria-label="Open in new tab"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </>
          )}
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
