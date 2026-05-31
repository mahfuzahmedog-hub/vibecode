'use client';
import { useState, useCallback, useEffect } from 'react';
import type { WorkflowSummary, McpStatus, ToolConfig } from '@/lib/types';

interface McpDeps {
  addLog: (msg: string) => void;
}

export function useMcp(deps: McpDeps) {
  const { addLog } = deps;
  const [mcpStatus, setMcpStatus] = useState<McpStatus>({ connected: false, connecting: false });
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [showWorkflows, setShowWorkflows] = useState(false);
  const [deployingToN8n, setDeployingToN8n] = useState(false);
  const [toolConfig, setToolConfig] = useState<ToolConfig>({ open: false, toolName: '', args: {}, result: null });

  const loadWorkflows = useCallback(async () => {
    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'executeTool', tool: 'n8n_workflow_list', args: {} }),
      });
      if (!res.ok) {
        addLog(`Failed to load workflows: ${res.statusText}`);
        return;
      }
      const data = await res.json();
      if (data.success && data.result?.workflows) {
        setWorkflows(data.result.workflows);
      }
    } catch (err) {
      addLog(`Failed to load workflows: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [addLog]);

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
  }, [addLog, loadWorkflows]);

  useEffect(() => {
    connectMcp();
  }, [connectMcp]);

  const toggleWorkflows = useCallback(async () => {
    if (!showWorkflows) await loadWorkflows();
    setShowWorkflows(prev => !prev);
  }, [showWorkflows, loadWorkflows]);

  const createWorkflowFromCode = useCallback(async (code: string, prompt: string) => {
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
  }, [addLog, loadWorkflows]);

  const deployViaMcp = useCallback(async (code: string, modelUsed: string) => {
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
  }, [addLog]);

  const openToolConfig = useCallback((toolName: string) => {
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
  }, [toolConfig.toolName, toolConfig.args, addLog]);

  const closeToolConfig = useCallback(() => {
    setToolConfig({ open: false, toolName: '', args: {}, result: null });
  }, []);

  const updateToolArgs = useCallback((args: Record<string, string>) => {
    setToolConfig(prev => ({ ...prev, args }));
  }, []);

  return {
    mcpStatus,
    workflows,
    showWorkflows,
    deployingToN8n,
    toolConfig,
    loadWorkflows,
    connectMcp,
    toggleWorkflows,
    createWorkflowFromCode,
    deployViaMcp,
    openToolConfig,
    executeConfiguredTool,
    closeToolConfig,
    updateToolArgs,
  };
}
