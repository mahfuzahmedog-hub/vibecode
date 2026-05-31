@AGENTS.md

# VibeCoder AI — Anchored Summary

## Goal
AI-powered code generation app with auto-heal, multi-model fallback, n8n MCP workflow automation, and premium BYOK (Bring Your Own Key) system.

## Tech Stack
- Next.js 16 (App Router + Turbopack), React 19, TypeScript 5
- Tailwind CSS v4, Monaco Editor, Lucide React
- OpenRouter API (free models) + OpenAI / Anthropic / Google (premium BYOK)
- n8n via MCP (Model Context Protocol) — mock mode by default
- Zod v4 validation, Vitest for testing

## Progress

### Phase 0 — Model Discovery + Settings
- `scripts/model-discovery.mjs`: auto-discovers working free OpenRouter models, caches to `.heal-cache/`
- In-app API key settings modal (localStorage + `x-api-key` header)
- 21 working free models discovered and cached

### Phase 1 — Security + Stability
- `postMessage('*')` → `window.location.origin` origin check
- Error boundary wrapping root layout
- Rate limiting (30 req/min/IP) via proxy.ts
- Monaco editor debounce (300ms) to prevent render storms
- Iframe sandbox: `allow-scripts` only

### Phase A — Foundation Redesign
- 9 components + 5 custom hooks + shared types
- Proper dependency injection between hooks
- All components have aria labels, keyboard support, focus management

### Phase B — Security Headers + Validation
- Security headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- Zod v4 validation on all 6 API routes
- Request timeouts: 120s streaming, 60s sync
- All silent catch blocks now log errors

### Phase C — Performance
- Monaco editor 300ms debounce
- Streaming code generation (code mode)

### Phase D — Accessibility
- useFocusTrap hook with Tab/Shift+Tab cycling
- Focus traps on SettingsModal and ToolConfigModal

### Phase E — Sloppy Fixes
- LICENSE file created (MIT)
- .env.example created with documentation
- MCP status labels fixed (live/connecting/off)
- README rewritten for startup positioning
- .gitignore: unignored .env.example

### Phase 1.1 — Premium Multi-Provider API Keys
- `src/lib/ai-client.ts`: unified client for OpenRouter, OpenAI, Anthropic, Google
- Both streaming (code) and sync (plan/design) modes for all providers
- Provider selector in settings modal with key format hints and links
- Backend routes read `x-api-provider` header and route accordingly
- Falls back to server-side OpenRouter env vars when no user key set

### Phase 1.2 — Output Management
- Copy code button with checkmark feedback
- Download as HTML file
- Open in new tab preview

### Phase 1.3 — Quality of Life
- Dark/light/system theme toggle with data-theme attribute
- 11 curated prompt templates across all 3 modes
- Template dropdown in prompt panel

### Phase 1.4 — Testing Foundation
- Vitest with 28 tests across 3 test files
- Test config with @/ path alias
- npm test / npm run test:watch scripts
- Zero lint errors, 6 warnings (all in scripts/)

## Key Files
- `src/lib/ai-client.ts` — unified AI client (all 4 providers)
- `src/lib/openrouter.ts` — OpenRouter-specific (server-side fallback)
- `src/lib/validation.ts` — Zod schemas for all API routes
- `src/lib/types.ts` — shared TypeScript types (including AIProvider)
- `src/hooks/useSettings.ts` — API key + provider in localStorage
- `src/hooks/useTheme.ts` — dark/light/system theme toggle
- `src/hooks/useCodeGeneration.ts` — generation orchestration
- `src/proxy.ts` — rate limiter + security headers
- `src/components/SettingsModal.tsx` — provider selector + key entry
- `src/components/EditorPanel.tsx` — Monaco editor + export buttons
- `src/components/PromptPanel.tsx` — prompt input + mode tabs + templates
- `scripts/dev.mjs` — self-healing dev server
- `scripts/build.mjs` — self-healing build

## Environment
- Win32, path has space in "vs code" — use quotes in terminal
- .env* is gitignored (except .env.example)
- .env.local has 4 OpenRouter keys + MCP urls (placeholder)
- GitHub: https://github.com/mahfuzahmedog-hub/vibecode

## Build Status
- `npm run build` — passes with zero errors
- `npm run lint` — zero errors (6 warnings in scripts/)
- `npm test` — 28/28 passing
