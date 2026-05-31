'use client';
import { useRef, useCallback } from 'react';

export function useAutoFix() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const executeCode = useCallback((code: string) => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const errorCatcher = `
      <script>
        var targetOrigin = '${origin}';
        window.onerror = function(message, source, lineno, colno, error) {
          window.parent.postMessage({ type: 'RUNTIME_ERROR', error: message + ' at line ' + lineno }, targetOrigin);
          return true;
        };
        window.addEventListener('unhandledrejection', event => {
          window.parent.postMessage({ type: 'RUNTIME_ERROR', error: 'Unhandled Promise: ' + event.reason }, targetOrigin);
        });
      </script>
    `;

    const tailwindLink = `<script src="https://cdn.tailwindcss.com"></script>`;
    const bodyContent = code.includes('<html>') ? code : `<div id="root">${code}</div>`;

    iframe.srcdoc = `<!DOCTYPE html><html><head>${tailwindLink}${errorCatcher}</head><body>${bodyContent}</body></html>`;
  }, []);

  return { iframeRef, executeCode };
}
