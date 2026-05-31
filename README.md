# VibeCoder AI

Describe the feel and functionality of a website in natural language and have AI generate full source code. Built with Next.js, OpenRouter, Monaco Editor, and optional n8n MCP integration for workflow automation.

## Features
- **Natural Language Input** — describe your "vibe", AI generates production-ready code
- **Model Fallback** — automatically switches between free OpenRouter models on rate limits
- **Monaco Editor** — professional code editor with live preview
- **Auto-fix** — runtime errors trigger automatic AI correction
- **n8n MCP Integration** — create, list, execute, and manage n8n workflows via Model Context Protocol
- **Deploy via MCP** — send generated code to n8n workflow execution

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4
- **Editor**: @monaco-editor/react
- **Icons**: Lucide React
- **AI**: OpenRouter API (free models)
- **Automation**: n8n via MCP (Model Context Protocol)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Copy to `.env.local`:

```env
# OpenRouter (comma-separated for rate-limit fallback)
OPENROUTER_API_KEYS=key1,key2,key3

# n8n webhook deploy (legacy)
N8N_WEBHOOK_URL=https://your-n8n.app/webhook/vibe-deploy

# n8n MCP integration (optional)
N8N_MCP_SERVER_URL=http://localhost:3001/mcp
NEXT_PUBLIC_N8N_MCP_SERVER_URL=http://localhost:3001/mcp
N8N_MCP_ENABLED=false
```

Set `N8N_MCP_ENABLED=true` to use the real `@modelcontextprotocol/sdk`. When disabled, the app runs in mock mode with simulated workflows.

## Models

Priority list (all free):
1. `qwen/qwen3-coder:free`
2. `openrouter/owl-alpha`
3. `deepseek/deepseek-chat`
4. `poolside/laguna-m1:free`

## MCP Deployment (for real n8n)

```bash
docker run -p 3001:3000 ghcr.io/czlonkowski/n8n-mcp:latest
```

Then set `N8N_MCP_SERVER_URL=http://localhost:3001/mcp` and `N8N_MCP_ENABLED=true`.

## API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/generate` | Stream code generation |
| `POST /api/plan` | Strategic guidance (CEO role) |
| `POST /api/design` | Design advice (Designer role) |
| `POST /api/deploy` | Deploy via webhook or MCP |
| `POST /api/mcp` | Execute any MCP tool |

## License

MIT
