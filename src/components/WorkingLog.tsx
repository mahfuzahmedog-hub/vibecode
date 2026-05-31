'use client';
import { Terminal } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface WorkingLogProps {
  logs: string[];
}

export function WorkingLog({ logs }: WorkingLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">
        <Terminal className="w-3 h-3" /> Working Log
      </div>
      <div
        className="flex-1 p-3 rounded-xl bg-black/50 border border-slate-800 font-mono text-[11px] text-slate-400 overflow-y-auto space-y-1"
        role="log"
        aria-live="polite"
        aria-label="Working log"
      >
        {logs.length === 0 && <span className="opacity-50">Waiting for input...</span>}
        {logs.map((log, i) => <div key={i} className="border-l border-slate-700 pl-2">{log}</div>)}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
