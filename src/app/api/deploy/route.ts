import { NextResponse } from 'next/server';
import { getMcpClient } from '@/lib/mcp-client';
import { deploySchema } from '@/lib/validation';

const deployWorkflowId = process.env.N8N_DEPLOY_WORKFLOW_ID || 'vibe_deploy';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = deploySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 });
    }

    const { code, model, useMcp } = parsed.data;

    // Option A: Deploy via MCP tool execution
    if (useMcp) {
      const mcpUrl = process.env.N8N_MCP_SERVER_URL;
      if (!mcpUrl || mcpUrl === 'your_n8n_mcp_server_url_here') {
        return NextResponse.json({ error: 'N8N_MCP_SERVER_URL is not configured. Please update .env.local' }, { status: 500 });
      }

      const client = getMcpClient(mcpUrl);
      await client.connect();

      const result = await client.executeTool('n8n_workflow_execute', {
        workflowId: deployWorkflowId,
        data: { code, model, timestamp: new Date().toISOString() },
      });

      return NextResponse.json({ success: true, message: 'Deployed via MCP', result });
    }

    // Option B: Deploy via direct n8n webhook (legacy)
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl || webhookUrl === 'your_n8n_webhook_url_here') {
      return NextResponse.json({
        error: 'No deployment method configured. Set N8N_WEBHOOK_URL for webhook deploy, N8N_MCP_SERVER_URL for MCP deploy.',
      }, { status: 500 });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, model, timestamp: new Date().toISOString(), action: 'vibe_deploy' }),
    });

    if (!response.ok) {
      throw new Error(`n8n webhook workflow failed: ${response.statusText}`);
    }

    return NextResponse.json({ success: true, message: 'Successfully triggered n8n deployment workflow via webhook!' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}