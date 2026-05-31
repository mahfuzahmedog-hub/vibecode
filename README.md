# VibeCoder AI

AI-powered code generation with auto-heal, multi-model fallback, and n8n workflow automation.

Describe your app in plain English — VibeCoder generates production-ready code, auto-fixes runtime errors, and optionally deploys via n8n MCP.

## Features

- **Natural language to code** — describe the "vibe", get working code
- **Multi-model fallback** — 21+ free models auto-discovered; premium tier unlocks OpenAI/Anthropic/Google with your own keys
- **Three modes** — Code (streaming generation), Plan (architecture advice), Design (UI/UX guidance)
- **Monaco Editor** — professional code editor with syntax highlighting, live preview
- **Auto-fix** — runtime errors detected in the preview iframe trigger automatic AI correction
- **n8n MCP integration** — create, list, execute, and manage n8n workflows via Model Context Protocol
- **Self-healing infrastructure** — auto-discovers working models, auto-installs missing binaries, auto-restarts on crash
- **Bring Your Own Key** — use OpenRouter free models by default, or connect your OpenAI/Anthropic/Google keys for premium models

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router + Turbopack) |
| Language | TypeScript + React 19 |
| Styling | Tailwind CSS v4 |
| Editor | @monaco-editor/react |
| Icons | Lucide React |
| AI Backend | OpenRouter (free) + OpenAI / Anthropic / Google (BYOK) |
| Automation | n8n via MCP (Model Context Protocol) |
| Validation | Zod v4 |
| CI/CD | GitHub Actions (auto-heal, model discovery) |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Quick Start

1. **Free tier:** Works immediately with built-in free models
2. **Bring your own key:** Click the key icon in the header, enter your OpenRouter/OpenAI/Anthropic key
3. **Type a prompt:** e.g. "A futuristic cyberpunk dashboard with live data charts"
4. **Watch it generate:** streaming code appears in the Monaco Editor
5. **Preview:** code auto-executes in the live preview panel
6. **Auto-fix:** any runtime error triggers automatic correction

## Environment Variables

Copy `.env.example` to `.env.local`:

```env
# OpenRouter (comma-separated for rate-limit fallback)
OPENROUTER_API_KEYS=sk-or-v1-xxx,sk-or-v1-yyy

# n8n MCP integration (optional)
N8N_MCP_SERVER_URL=http://localhost:3001/mcp
N8N_MCP_ENABLED=false
```

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/generate` | POST | Stream code generation (Code mode) |
| `/api/plan` | POST | Strategic planning (Plan mode) |
| `/api/design` | POST | Design guidance (Design mode) |
| `/api/deploy` | POST | Deploy via webhook or MCP |
| `/api/mcp` | POST | Execute any MCP tool |
| `/api/health` | GET | System status (keys, models, MCP, platform) |
| `/api/health` | POST | Validate a user-supplied API key |

## Premium Features

| Feature | Free | BYOK Premium |
|---------|------|-------------|
| Models | Built-in free models | OpenAI GPT-4o, Anthropic Claude, Google Gemini, any OpenRouter model |
| Generations | Rate-limited (10/day) | Unlimited (your own key limits) |
| Auto-fix | 1 retry | 5 retries |
| Provider | OpenRouter only | OpenAI + Anthropic + Google + OpenRouter |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Self-healing dev server with auto-restart |
| `npm run build` | Self-healing build with dependency checks |
| `npm run discover-models` | Refresh cached model list |
| `npm run lint` | Run ESLint |

## Architecture

```
User Prompt → [PromptPanel] → [useCodeGeneration]
  → POST /api/generate → [openrouter.ts]
    → OpenRouter API → streaming → Monaco Editor → iframe preview

Runtime Error → iframe postMessage → autoFix → re-generate via AI

MCP: useMcp ↔ /api/mcp ↔ mcp-client.ts ↔ n8n MCP server (or mock)
```

## License

MIT
