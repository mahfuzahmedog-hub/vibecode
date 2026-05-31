'use client';
import React, { useCallback, useEffect } from 'react';
import { useLogs } from '@/hooks/useLogs';
import { useSettings } from '@/hooks/useSettings';
import { useAutoFix } from '@/hooks/useAutoFix';
import { useCodeGeneration } from '@/hooks/useCodeGeneration';
import { useMcp } from '@/hooks/useMcp';
import { Header } from '@/components/Header';
import { WorkflowPanel } from '@/components/WorkflowPanel';
import { PromptPanel } from '@/components/PromptPanel';
import { EditorPanel } from '@/components/EditorPanel';
import { PreviewPanel } from '@/components/PreviewPanel';
import { ToolConfigModal } from '@/components/ToolConfigModal';
import { SettingsModal } from '@/components/SettingsModal';
import { ErrorToast } from '@/components/ErrorToast';

export default function VibeCodingPage() {
  const { logs, addLog } = useLogs();
  const { apiKey, keySaved, settingsOpen, showKey, setSettingsOpen, setShowKey, setApiKey, saveApiKey, clearApiKey, getHeaders } = useSettings();
  const { iframeRef, executeCode } = useAutoFix();
  const {
    prompt, setPrompt, code, setCode, isLoading, setIsLoading,
    modelUsed, setModelUsed, selectedModel, setSelectedModel,
    error, setError, mode, setMode, handleGenerate,
  } = useCodeGeneration({ getHeaders, addLog, executeCode });
  const {
    mcpStatus, workflows, showWorkflows, deployingToN8n, toolConfig,
    toggleWorkflows, createWorkflowFromCode, deployViaMcp,
    openToolConfig, executeConfiguredTool, closeToolConfig, updateToolArgs, loadWorkflows,
  } = useMcp({ addLog });

  // Auto-fix: triggered by runtime errors from the preview iframe
  const autoFix = useCallback(async (runtimeError: string) => {
    addLog('Auto-fixing error...');
    setIsLoading(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ error: runtimeError }),
      });

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

      addLog('Auto-fix complete.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Auto-fix failed: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders, addLog, setCode, setIsLoading, setError]);

  const autoFixRef = React.useRef(autoFix);
  autoFixRef.current = autoFix;

  // Listen for runtime errors from iframe
  useEffect(() => {
    const origin = window.location.origin;
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      if (event.data.type === 'RUNTIME_ERROR') {
        const errMsg = event.data.error;
        setError(`Runtime Error: ${errMsg}`);
        addLog(`Runtime error detected: ${errMsg}`);
        autoFixRef.current(errMsg);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [addLog, setError]);

  const handleRunCode = useCallback(() => {
    executeCode(code);
  }, [executeCode, code]);

  const isDefaultCode = code === '// Your generated code will appear here...';
  const hasCode = !isDefaultCode && code.length > 0;
  const canDeploy = hasCode && mcpStatus.connected && !deployingToN8n;

  const handleCreateWorkflow = useCallback(() => {
    createWorkflowFromCode(code, prompt);
  }, [createWorkflowFromCode, code, prompt]);

  const handleDeploy = useCallback(() => {
    deployViaMcp(code, modelUsed);
  }, [deployViaMcp, code, modelUsed]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        modelUsed={modelUsed}
        mcpStatus={mcpStatus}
        keySaved={keySaved}
        workflowsCount={workflows.length}
        showWorkflows={showWorkflows}
        onToggleWorkflows={toggleWorkflows}
        onOpenSettings={() => setSettingsOpen(true)}
        onCreateWorkflow={handleCreateWorkflow}
        onDeploy={handleDeploy}
        onRunCode={handleRunCode}
        canDeploy={canDeploy}
        deployingToN8n={deployingToN8n}
        hasCode={hasCode}
      />

      <WorkflowPanel
        show={showWorkflows}
        workflows={workflows}
        onRefresh={loadWorkflows}
        onOpenTool={openToolConfig}
      />

      <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <PromptPanel
          prompt={prompt}
          onPromptChange={setPrompt}
          mode={mode}
          onModeChange={setMode}
          isLoading={isLoading}
          logs={logs}
          onGenerate={handleGenerate}
        />

        <EditorPanel
          code={code}
          onChange={setCode}
          isLoading={isLoading}
        />

        <PreviewPanel ref={iframeRef} onExecute={handleRunCode} />
      </main>

      <ToolConfigModal
        config={toolConfig}
        onClose={closeToolConfig}
        onUpdateArgs={updateToolArgs}
        onExecute={executeConfiguredTool}
      />

      <SettingsModal
        open={settingsOpen}
        apiKey={apiKey}
        keySaved={keySaved}
        showKey={showKey}
        onClose={() => setSettingsOpen(false)}
        onApiKeyChange={setApiKey}
        onSaveKey={saveApiKey}
        onClearKey={clearApiKey}
        onToggleShowKey={() => setShowKey(!showKey)}
      />

      <ErrorToast error={error} onDismiss={() => setError(null)} />
    </div>
  );
}
