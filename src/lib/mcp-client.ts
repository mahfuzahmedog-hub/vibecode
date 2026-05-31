import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpResource {
  uri: string;
  mimeType: string;
  text: string;
}

export class McpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpError';
  }
}

function isMcpEnabled(): boolean {
  return process.env.N8N_MCP_ENABLED === 'true';
}

function getServerUrl(): string | null {
  const url = process.env.N8N_MCP_SERVER_URL || '';
  if (!url || url === 'your_n8n_mcp_server_url_here') return null;
  return url;
}

export class N8nMcpClient {
  private realClient: Client | null = null;
  private realTransport: StreamableHTTPClientTransport | null = null;
  private mockConnected = false;
  private serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  async connect(): Promise<void> {
    if (this.isReady()) return;

    if (isMcpEnabled() && getServerUrl()) {
      await this.connectReal();
    } else {
      await this.connectMock();
    }
  }

  private async connectReal(): Promise<void> {
    const url = new URL(this.serverUrl);
    this.realTransport = new StreamableHTTPClientTransport(url);
    this.realClient = new Client({ name: 'vibecoder-mcp', version: '0.1.0' });
    await this.realClient.connect(this.realTransport);
  }

  private async connectMock(): Promise<void> {
    await new Promise(r => setTimeout(r, 100));
    this.mockConnected = true;
  }

  async disconnect(): Promise<void> {
    if (this.realTransport) {
      await this.realTransport.close().catch(() => {});
      this.realTransport = null;
      this.realClient = null;
    }
    this.mockConnected = false;
  }

  isReady(): boolean {
    return this.mockConnected || this.realClient !== null;
  }

  async listTools(): Promise<McpTool[]> {
    this.ensureConnected();

    if (this.realClient) {
      const result = await this.realClient.listTools();
      return result.tools.map(t => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema as McpTool['inputSchema'],
      }));
    }

    return this.mockTools();
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    this.ensureConnected();

    if (this.realClient) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await this.realClient.callTool({ name, arguments: args });
      if (result.content && Array.isArray(result.content)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textContent = result.content.find((c: any) => c.type === 'text');
        if (textContent && typeof textContent.text === 'string') {
          try { return JSON.parse(textContent.text); } catch { return textContent.text; }
        }
      }
      return result;
    }

    return this.mockExecute(name, args);
  }

  async readResource(uri: string): Promise<McpResource> {
    this.ensureConnected();

    if (this.realClient) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await this.realClient.readResource({ uri });
      const content = result.contents?.[0];
      if (content && typeof content.text === 'string') {
        return { uri: content.uri, mimeType: content.mimeType || 'text/plain', text: content.text };
      }
      throw new McpError(`Resource ${uri} returned no text content`);
    }

    return this.mockReadResource(uri);
  }

  // Private helpers

  private ensureConnected(): void {
    if (!this.isReady()) throw new McpError('MCP client not connected');
  }

  // ---- Mock implementations ----

  private mockTools(): McpTool[] {
    return [
      {
        name: 'n8n_workflow_list',
        description: 'List all n8n workflows, with optional filters',
        inputSchema: { type: 'object', properties: { activeOnly: { type: 'boolean', description: 'Only return active workflows' }, limit: { type: 'number', description: 'Max workflows to return' } } },
      },
      {
        name: 'n8n_workflow_get',
        description: 'Get a single workflow by ID',
        inputSchema: { type: 'object', properties: { workflowId: { type: 'string', description: 'The workflow ID' } }, required: ['workflowId'] },
      },
      {
        name: 'n8n_workflow_create',
        description: 'Create a new n8n workflow from a JSON definition',
        inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Workflow name' }, nodes: { type: 'array', description: 'Array of node configurations' }, connections: { type: 'object', description: 'Connection map defining how nodes link together' } }, required: ['name', 'nodes', 'connections'] },
      },
      {
        name: 'n8n_workflow_update',
        description: 'Update an existing n8n workflow',
        inputSchema: { type: 'object', properties: { workflowId: { type: 'string', description: 'Workflow ID to update' }, name: { type: 'string', description: 'New name' }, nodes: { type: 'array', description: 'Updated node configurations' }, active: { type: 'boolean', description: 'Set workflow active/inactive' } }, required: ['workflowId'] },
      },
      {
        name: 'n8n_workflow_delete',
        description: 'Delete an n8n workflow',
        inputSchema: { type: 'object', properties: { workflowId: { type: 'string', description: 'Workflow ID to delete' } }, required: ['workflowId'] },
      },
      {
        name: 'n8n_workflow_execute',
        description: 'Execute an existing workflow with optional input data',
        inputSchema: { type: 'object', properties: { workflowId: { type: 'string', description: 'Workflow ID to execute' }, data: { type: 'object', description: 'Input data for execution' } }, required: ['workflowId'] },
      },
      {
        name: 'n8n_node_types',
        description: 'List available node types with their properties and examples',
        inputSchema: { type: 'object', properties: { category: { type: 'string', description: 'Filter by category (e.g. trigger, action, ai)' } } },
      },
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async mockExecute(name: string, args: any): Promise<any> {
    await new Promise(r => setTimeout(r, 200));
    switch (name) {
      case 'n8n_workflow_list': return this.mockListWorkflows(args);
      case 'n8n_workflow_get': return this.mockGetWorkflow(args);
      case 'n8n_workflow_create': return this.mockCreateWorkflow(args);
      case 'n8n_workflow_update': return this.mockUpdateWorkflow(args);
      case 'n8n_workflow_delete': return this.mockDeleteWorkflow(args);
      case 'n8n_workflow_execute': return this.mockExecuteWorkflow(args);
      case 'n8n_node_types': return this.mockListNodeTypes(args);
      default: throw new McpError(`Unknown tool: ${name}`);
    }
  }

  private async mockReadResource(uri: string): Promise<McpResource> {
    if (uri === 'n8n://nodes/catalog') {
      return {
        uri, mimeType: 'application/json',
        text: JSON.stringify({ categories: [{ name: 'Triggers', nodes: [{ type: 'n8n-nodes-base.webhook', name: 'Webhook', description: 'Starts workflow via HTTP call' }, { type: 'n8n-nodes-base.scheduleTrigger', name: 'Schedule', description: 'Runs on a cron schedule' }] }, { name: 'Actions', nodes: [{ type: 'n8n-nodes-base.httpRequest', name: 'HTTP Request', description: 'Make HTTP requests' }, { type: 'n8n-nodes-base.set', name: 'Set', description: 'Set data values' }, { type: 'n8n-nodes-base.if', name: 'IF', description: 'Conditional routing' }] }] }, null, 2),
      };
    }
    if (uri.startsWith('n8n://workflows/')) {
      const id = uri.split('/').pop();
      return { uri, mimeType: 'application/json', text: JSON.stringify(this.sampleWorkflow(id!), null, 2) };
    }
    throw new McpError(`Resource not found: ${uri}`);
  }

  private sampleWorkflow(id: string) {
    return {
      id, name: `Sample Workflow ${id}`, active: true,
      nodes: [
        { id: '1', name: 'Webhook', type: 'n8n-nodes-base.webhook', position: [250, 100], parameters: { path: 'webhook-path' } },
        { id: '2', name: 'Set Data', type: 'n8n-nodes-base.set', position: [250, 300], parameters: { values: { message: 'Hello from n8n!' } } },
      ],
      connections: { '1:main': [{ node: '2', type: 'main', index: 0 }] },
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mockListWorkflows(args: Record<string, any>) {
    const workflows = [
      { id: 'wf_1', name: 'Deploy to GitHub Pages', active: true, nodeCount: 4, createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: 'wf_2', name: 'Deploy to Cloudflare Pages', active: true, nodeCount: 4, createdAt: new Date(Date.now() - 172800000).toISOString() },
      { id: 'wf_3', name: 'Send Notification Email', active: false, nodeCount: 2, createdAt: new Date(Date.now() - 259200000).toISOString() },
      { id: 'wf_4', name: 'Sync Data to PostgreSQL', active: true, nodeCount: 5, createdAt: new Date(Date.now() - 345600000).toISOString() },
      { id: 'wf_5', name: 'Slack Alert on Error', active: false, nodeCount: 3, createdAt: new Date(Date.now() - 432000000).toISOString() },
    ];
    let filtered = workflows;
    if (args.activeOnly) filtered = filtered.filter((w: { active: boolean }) => w.active);
    if (args.limit) filtered = filtered.slice(0, args.limit);
    return { workflows: filtered, totalCount: workflows.length };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mockGetWorkflow(args: Record<string, any>) {
    if (!args.workflowId) throw new McpError('workflowId is required');
    return this.sampleWorkflow(args.workflowId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mockCreateWorkflow(args: Record<string, any>) {
    if (!args.name) throw new McpError('name is required');
    if (!args.nodes) throw new McpError('nodes is required');
    if (!args.connections) throw new McpError('connections is required');
    const id = `wf_${Date.now()}`;
    return {
      success: true, id, name: args.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nodes: args.nodes.map((n: any, i: number) => ({ ...n, id: String(i + 1) })),
      connections: args.connections, active: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      url: `https://n8n.example.com/workflow/${id}`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mockUpdateWorkflow(args: Record<string, any>) {
    if (!args.workflowId) throw new McpError('workflowId is required');
    return { success: true, id: args.workflowId, name: args.name || 'Updated Workflow', active: args.active !== undefined ? args.active : false, updatedAt: new Date().toISOString() };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mockDeleteWorkflow(args: Record<string, any>) {
    if (!args.workflowId) throw new McpError('workflowId is required');
    return { success: true, message: `Workflow ${args.workflowId} deleted` };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mockExecuteWorkflow(args: Record<string, any>) {
    if (!args.workflowId) throw new McpError('workflowId is required');
    return {
      success: true, executionId: `exec_${Date.now()}`, workflowId: args.workflowId, status: 'completed',
      startedAt: new Date(Date.now() - 5000).toISOString(), completedAt: new Date().toISOString(),
      output: { result: 'Workflow executed successfully' },
      logs: [`[${new Date(Date.now() - 5000).toISOString()}] Workflow started`, `[${new Date().toISOString()}] Workflow completed`],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mockListNodeTypes(args: Record<string, any>) {
    const allNodes = [
      { type: 'n8n-nodes-base.webhook', name: 'Webhook', category: 'trigger', description: 'Receive HTTP requests' },
      { type: 'n8n-nodes-base.scheduleTrigger', name: 'Schedule', category: 'trigger', description: 'Cron-based scheduling' },
      { type: 'n8n-nodes-base.httpRequest', name: 'HTTP Request', category: 'action', description: 'Make API calls' },
      { type: 'n8n-nodes-base.set', name: 'Set', category: 'action', description: 'Set values on data' },
      { type: 'n8n-nodes-base.if', name: 'IF', category: 'action', description: 'Conditional branching' },
      { type: 'n8n-nodes-base.code', name: 'Code', category: 'action', description: 'Run JavaScript/Python' },
      { type: 'n8n-nodes-base.github', name: 'GitHub', category: 'action', description: 'GitHub API operations' },
      { type: 'n8n-nodes-base.postgres', name: 'PostgreSQL', category: 'action', description: 'PostgreSQL queries' },
    ];
    if (args.category) return { nodeTypes: allNodes.filter(n => n.category === args.category) };
    return { nodeTypes: allNodes };
  }
}

// Singleton factory
let clientInstance: N8nMcpClient | null = null;

export function getMcpClient(serverUrl: string): N8nMcpClient {
  if (!clientInstance) {
    clientInstance = new N8nMcpClient(serverUrl);
  }
  return clientInstance;
}

export function resetMcpClient(): void {
  clientInstance = null;
}