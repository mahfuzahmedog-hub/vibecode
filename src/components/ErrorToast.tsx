'use client';
import { AlertCircle } from 'lucide-react';

interface ErrorToastProps {
  error: string | null;
  onDismiss: () => void;
}

export function ErrorToast({ error, onDismiss }: ErrorToastProps) {
  if (!error) return null;

  return (
    <div
      className="fixed bottom-6 right-6 p-4 bg-red-900/90 backdrop-blur-sm border border-red-600 rounded-2xl flex gap-3 text-white text-sm shadow-2xl animate-in slide-in-from-bottom-4 z-50"
      role="alert"
    >
      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex flex-col">
        <span className="font-bold">Issue Detected</span>
        <p className="opacity-90">{error}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-white/60 hover:text-white ml-2 self-start"
        aria-label="Dismiss error"
      >
        &times;
      </button>
    </div>
  );
}
