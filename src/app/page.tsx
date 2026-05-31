'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Send, Rocket, Loader2, AlertCircle, Terminal, Play, RefreshCcw, Workflow, Plus, Settings2 } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { MODEL_PRIORITY } from '@/lib/openrouter';

interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  nodeCount: number;
  createdAt: string;
}

export default function VibeCodingPage() {
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState('// Your generated code will appear here...');
  const [isLoading, setIsLoading] = useState(false);
  const [modelUsed, setModelUsed] = useState('');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [mcpStatus, setMcpStatus] = useState<{ connected: boolean; connecting: boolean }>({ connected: false, connecting: false });
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [showWorkflows, setShowWorkflows] = useState(false);
  const [deployingToN8n, setDeployingToN8n] = useState(false);
  const [toolConfig, setToolConfig] = useState<{ open: boolean; toolName: string; args: Record<string, string>; result: unknown }>({ open: false, toolName: '', args: {}, result: null });
  const [mode, setMode] = useState<'code' | 'plan' | 'design'>('code');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50));
  };

  // MCP connection & workflow loading
  const loadWorkflows = useCallback(async () => {
    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'executeTool', tool: 'n8n_workflow_list', args: {} }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.result?.workflows) {
        setWorkflows(data.result.workflows);
      }
    } catch {
      // Silently fail - workflows may not be available
    }
  }, []);

  const connectMcp = useCallback(async () => {
    const mcpServerUrl = process.env.NEXT_PUBLIC_N8N_MCP_SERVER_URL;
    if (!mcpServerUrl || mcpServerUrl === 'your_n8n_mcp_server_url_here') {
      setMcpStatus({ connected: false, connecting: false });
      return;
    }

    setMcpStatus(prev => ({ ...prev, connecting: true }));
    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' }),
      });
      const data = await res.json();
      if (data.success) {
        setMcpStatus({ connected: true, connecting: false });
        addLog('Connected to n8n MCP server');
        loadWorkflows();
      } else {
        throw new Error(data.error || 'Connection failed');
      }
    } catch (error) {
      setMcpStatus({ connected: false, connecting: false });
      addLog(`MCP connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [loadWorkflows]);

  useEffect(() => {
    connectMcp();
  }, [connectMcp]);

  // Reveal workflow panel
  const toggleWorkflows = useCallback(async () => {
    if (!showWorkflows) {
      await loadWorkflows();
    }
    setShowWorkflows(prev => !prev);
  }, [showWorkflows, loadWorkflows]);

  // Create a workflow from the current code
  const createWorkflowFromCode = useCallback(async () => {
    if (!code || code === '// Your generated code will appear here...') return;

    setDeployingToN8n(true);
    addLog('Creating n8n workflow from generated code...');
    try {
      const workflowName = prompt
        ? `AI Generated: ${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}`
        : `VibeCoder Workflow ${new Date().toLocaleDateString()}`;

      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'executeTool',
          tool: 'n8n_workflow_create',
          args: {
            name: workflowName,
            nodes: [
              { name: 'Webhook', type: 'n8n-nodes-base.webhook', position: [250, 100], parameters: { path: 'vibecoder-trigger' } },
              { name: 'Execute Code', type: 'n8n-nodes-base.code', position: [250, 300], parameters: { jsCode: code } },
              { name: 'HTTP Response', type: 'n8n-nodes-base.httpRequest', position: [250, 500], parameters: { url: 'https://httpbin.org/post', method: 'POST' } },
            ],
            connections: {
              '1:main': [{ node: 'Execute Code', type: 'main', index: 0 }],
              '2:main': [{ node: 'HTTP Response', type: 'main', index: 0 }],
            },
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Workflow created: ${data.result.name} (${data.result.id})`);
        await loadWorkflows();
      } else {
        addLog(`Failed to create workflow: ${data.error}`);
      }
    } catch (error) {
      addLog(`Error creating workflow: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setDeployingToN8n(false);
    }
  }, [code, prompt, loadWorkflows]);

  // Deploy via MCP tool execution
  const deployViaMcp = useCallback(async () => {
    if (!code || code === '// Your generated code will appear here...') return;
    setDeployingToN8n(true);
    addLog('Deploying via MCP...');
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, model: modelUsed, useMcp: true }),
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Deploy via MCP: ${data.message}`);
      } else {
        addLog(`Deploy failed: ${data.error}`);
      }
    } catch (error) {
      addLog(`Deploy error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setDeployingToN8n(false);
    }
  }, [code, modelUsed]);

  // Tool config: open dialog to execute an MCP tool with custom args
  const openToolConfig = useCallback(async (toolName: string) => {
    setToolConfig({ open: true, toolName, args: { workflowId: '' }, result: null });
  }, []);

  const executeConfiguredTool = useCallback(async () => {
    setToolConfig(prev => ({ ...prev, result: 'Executing...' }));
    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'executeTool', tool: toolConfig.toolName, args: toolConfig.args }),
      });
      const data = await res.json();
      setToolConfig(prev => ({ ...prev, result: data.success ? data.result : data.error }));
      if (data.success) addLog(`Tool ${toolConfig.toolName} executed successfully`);
      else addLog(`Tool ${toolConfig.toolName} failed: ${data.error}`);
    } catch (error) {
      setToolConfig(prev => ({ ...prev, result: String(error) }));
    }
  }, [toolConfig.toolName, toolConfig.args]);

  const executeCode = () => {
    if (!iframeRef.current) return;

    // Inject a script to catch runtime errors and report them back to the parent
    const errorCatcher = `
      <script>
        window.onerror = function(message, source, lineno, colno, error) {
          window.parent.postMessage({ type: 'RUNTIME_ERROR', error: message + ' at line ' + lineno }, '*');
          return true;
        };
        window.addEventListener('unhandledrejection', event => {
          window.parent.postMessage({ type: 'RUNTIME_ERROR', error: 'Unhandled Promise: ' + event.reason }, '*');
        });
      </script>
    `;

    const finalDoc = `
      <!DOCTYPE html>
      <html>
        <head>
          <script src="https://cdn.tailwindcss.com"></script>
          ${errorCatcher}
        </head>
        <body>
          ${code.includes('<html>') ? code : `<div id="root">${code}</div>`}
        </body>
      </html>
    `;

    iframeRef.current.srcdoc = finalDoc;
  };

  const autoFix = useCallback(async (runtimeError: string) => {
    addLog('Auto-fixing error...');
    setIsLoading(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'RUNTIME_ERROR') {
        const errMsg = event.data.error;
        setError(`Runtime Error: ${errMsg}`);
        addLog(`Runtime error detected: ${errMsg}`);
        autoFix(errMsg);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [code, autoFix]);

  const handleGenerate = async () => {
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: trimmed, model: selectedModel }),
        });

        if (!response.ok) throw new Error(`${mode} request failed`);

        const data = await response.json();
        setCode(typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data));
        addLog(`${mode} response complete`);
      } else {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: trimmed, model: selectedModel }),
        });

        if (!response.ok) throw new Error('Generation failed');

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
        executeCode();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      addLog(`Error: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 glass px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg"><Sparkles className="w-5 h-5 text-white" /></div>
          <h1 className="text-xl font-bold tracking-tight">VibeCoder <span className="text-indigo-400 font-medium text-sm">Live</span></h1>
        </div>
         <div className="flex items-center gap-4">
           <div className="relative">
             <label className="text-xs text-slate-400">Model:</label>
             <select
               value={selectedModel || 'auto'}
               onChange={(e) => setSelectedModel(e.target.value === 'auto' ? null : e.target.value)}
               className="ml-2 px-3 py-1 bg-slate-800 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
             >
               <option value="auto">Auto (Fallback)</option>
               {MODEL_PRIORITY.map((model) => (
                 <option key={model} value={model}>
                   {model.split('/')[1].split(':')[0]} {/* Display friendly name */}
                 </option>
               ))}
             </select>
           </div>
           {modelUsed && (
             <div className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-full border border-slate-700 ml-3">
               Used: <span className="text-indigo-300 font-mono">{modelUsed}</span>
             </div>
           )}
           {/* MCP Status Indicator */}
           <div className="flex items-center gap-2 text-xs">
             <div className={`px-2 py-1 rounded-full ${mcpStatus.connected ? 'bg-green-600' : mcpStatus.connecting ? 'bg-yellow-500' : 'bg-red-500'}`}>
               <span className="mcp-dot animate-pulse" />
               <span className="ml-1">{mcpStatus.connected ? 'MCP Connected' : mcpStatus.connecting ? 'Connecting...' : 'MCP Disconnected'}</span>
             </div>
           </div>

           {/* Workflow buttons */}
           <button
             onClick={toggleWorkflows}
             className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95"
           >
             <Workflow className="w-4 h-4" /> {showWorkflows ? 'Close' : 'Workflows'}
             {workflows.length > 0 && <span className="ml-1 text-xs bg-slate-600 px-1.5 py-0.5 rounded-full">{workflows.length}</span>}
           </button>

           <button
             onClick={createWorkflowFromCode}
             disabled={deployingToN8n || !code || code === '// Your generated code will appear here...' || !mcpStatus.connected}
             className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95"
           >
             {deployingToN8n ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
             {deployingToN8n ? 'Creating...' : 'Create n8n Workflow'}
           </button>

           <button
             onClick={deployViaMcp}
             disabled={deployingToN8n || !code || code === '// Your generated code will appear here...' || !mcpStatus.connected}
             className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95"
           >
             <Rocket className="w-4 h-4" /> Deploy via MCP
           </button>

           <button onClick={() => executeCode()} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95">
             <Play className="w-4 h-4" /> Run Code
           </button>
         </div>
      </header>

      {/* Workflow Panel */}
      {showWorkflows && (
        <div className="border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2"><Workflow className="w-4 h-4 text-indigo-400" /> n8n Workflows</h2>
            <button onClick={loadWorkflows} className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
              <RefreshCcw className="w-3 h-3" /> Refresh
            </button>
          </div>
          {workflows.length === 0 ? (
            <p className="text-xs text-slate-500">No workflows found. Generate code and click &quot;Create n8n Workflow&quot; to add one.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {workflows.map((wf) => (
                <div key={wf.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3 hover:border-indigo-500/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${wf.active ? 'bg-green-900/50 text-green-300 border border-green-700' : 'bg-slate-700 text-slate-400'}`}>
                      {wf.active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-[10px] text-slate-500">{wf.nodeCount} nodes</span>
                  </div>
                  <p className="text-sm text-slate-200 font-medium truncate">{wf.name}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-[10px] text-slate-500 flex-1">Created {new Date(wf.createdAt).toLocaleDateString()}</p>
                    <button onClick={() => openToolConfig('n8n_workflow_get')} className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors" title="Configure tool"><Settings2 className="w-3 h-3" /></button>
                    <button onClick={() => openToolConfig('n8n_workflow_execute')} className="text-[10px] text-green-400 hover:text-green-300 transition-colors" title="Execute workflow"><Play className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Left: Input and Logs */}
        <div className="w-full lg:w-1/4 border-r border-slate-800 flex flex-col bg-slate-900/30">
          <div className="p-6 flex-1 flex flex-col gap-4 overflow-hidden">
             <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                  <button onClick={() => setMode('code')} className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${mode === 'code' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Code</button>
                  <button onClick={() => setMode('plan')} className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${mode === 'plan' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Plan</button>
                  <button onClick={() => setMode('design')} className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${mode === 'design' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Design</button>
                </div>
              </div>
              <textarea
                className="w-full h-32 p-4 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                placeholder="e.g. A futuristic cyberpunk landing page..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading || !prompt}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              {isLoading ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</> : <><Send className="w-5 h-5" /> {mode === 'code' ? 'Generate' : mode === 'plan' ? 'Analyze' : 'Advise'}</>}
            </button>

            <div className="flex-1 flex flex-col min-h-0 mt-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">
                <Terminal className="w-3 h-3" /> Working Log
              </div>
              <div className="flex-1 p-3 rounded-xl bg-black/50 border border-slate-800 font-mono text-[11px] text-slate-400 overflow-y-auto space-y-1">
                {logs.length === 0 && <span className="opacity-50">Waiting for input...</span>}
                {logs.map((log, i) => <div key={i} className="border-l border-slate-700 pl-2">{log}</div>)}
              </div>
            </div>
          </div>
        </div>

        {/* Middle: Editor */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e] border-r border-slate-800">
          <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span className="code-dot bg-red-500"></span><span className="code-dot bg-yellow-500"></span><span className="code-dot bg-green-500"></span>
              <span className="ml-2">vibe-output.code</span>
            </div>
          </div>
          <div className="flex-1">
            <Editor height="100%" defaultLanguage="javascript" theme="vs-dark" value={code} options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 20 }, scrollBeyondLastLine: false, readOnly: isLoading }} />
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="w-full lg:w-1/3 flex flex-col bg-slate-900">
          <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center justify-between text-slate-400 font-medium text-xs">
            <div className="flex items-center gap-2"><Play className="w-3 h-3 text-green-400" /> Live Preview</div>
            <button onClick={() => executeCode()} className="p-1 hover:bg-slate-700 rounded transition-colors"><RefreshCcw className="w-3 h-3 text-slate-400" /></button>
          </div>
          <iframe ref={iframeRef} className="flex-1 w-full h-full border-none" title="vibe-preview" />
        </div>
      </main>
      {/* Tool Config Modal */}
      {toolConfig.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2"><Settings2 className="w-4 h-4 text-indigo-400" /> Tool: {toolConfig.toolName}</h3>
              <button onClick={() => setToolConfig({ open: false, toolName: '', args: {}, result: null })} className="text-slate-500 hover:text-slate-300 text-lg">&times;</button>
            </div>

            <div className="space-y-3 mb-4">
              <label className="text-xs text-slate-400">Workflow ID</label>
              <input
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. wf_1"
                value={toolConfig.args.workflowId || ''}
                onChange={(e) => setToolConfig(prev => ({ ...prev, args: { ...prev.args, workflowId: e.target.value } }))}
              />
            </div>

            {toolConfig.result !== null && (
              <div className="mb-4 p-3 bg-black/50 border border-slate-700 rounded-lg max-h-40 overflow-y-auto">
                <pre className="text-[10px] text-slate-400 whitespace-pre-wrap">{typeof toolConfig.result === 'string' ? toolConfig.result : JSON.stringify(toolConfig.result, null, 2)}</pre>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={executeConfiguredTool} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
                Execute
              </button>
              <button onClick={() => setToolConfig({ open: false, toolName: '', args: {}, result: null })} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-6 right-6 p-4 bg-red-900/90 backdrop-blur-sm border border-red-600 rounded-2xl flex gap-3 text-white text-sm shadow-2xl animate-in slide-in-from-bottom-4">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="flex flex-col">
            <span className="font-bold">Issue Detected</span>
            <p className="opacity-90">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
