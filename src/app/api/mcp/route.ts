import { NextResponse } from 'next/server';
import { getMcpClient, McpError } from '@/lib/mcp-client';
import { mcpSchema } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = mcpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 });
    }

    const { action, tool, args, uri } = parsed.data;

    const serverUrl = process.env.N8N_MCP_SERVER_URL || 'http://localhost:8080';
    const client = getMcpClient(serverUrl);

    // Auto-connect if not ready
    if (!client.isReady()) {
      await client.connect();
    }

    switch (action) {
      case 'connect': {
        await client.connect();
        return NextResponse.json({ success: true, connected: true });
      }

      case 'disconnect': {
        await client.disconnect();
        return NextResponse.json({ success: true, connected: false });
      }

      case 'status': {
        return NextResponse.json({ connected: client.isReady() });
      }

      case 'listTools': {
        const tools = await client.listTools();
        return NextResponse.json({ tools });
      }

      case 'executeTool': {
        if (!tool) {
          return NextResponse.json({ error: 'tool name is required for executeTool action' }, { status: 400 });
        }
        const result = await client.executeTool(tool, args || {});
        return NextResponse.json({ success: true, tool, result });
      }

      case 'readResource': {
        if (!uri) {
          return NextResponse.json({ error: 'uri is required for readResource action' }, { status: 400 });
        }
        const resource = await client.readResource(uri);
        return NextResponse.json({ resource });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof McpError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}