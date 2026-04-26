# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HiveChat is a team-oriented AI chat application for small/medium teams. It supports multiple AI providers (OpenAI, Claude, Gemini, DeepSeek, etc.) with group-based access control, MCP tool calling, web search, and a full admin panel. Bilingual UI (en/zh) via `next-intl`.

## Development Commands

- `npm run dev` - Start dev server on port 3000
- `npm run build` - Production build (`output: 'standalone'` in next.config.mjs)
- `npm run lint` - ESLint
- `npm run initdb` - Push DB schema + seed all data (providers → models → bots → groups; order matters due to foreign keys)
- `npm run db:seedProvider|seedModel|seedBot|seedGroup` - Individual seed scripts

No test framework is configured.

## Architecture

### Tech Stack
- Next.js 14 App Router · React 18 · TypeScript
- PostgreSQL with Drizzle ORM (neon-http on Vercel, postgres-js locally)
- NextAuth v5 beta (JWT strategy) · Zustand state · Ant Design + Tailwind CSS

### Streaming Architecture (the core flow)

```
Client → Provider.chat() → POST /api/completions
  → route.ts reads X-Provider/X-Model headers → proxies to real AI API
  → proxyOpenAiStream | proxyClaudeStream | proxyGeminiStream
  → Parse SSE, re-emit transformed SSE with metadata (isDone, messageId)
  → Client receives via onUpdate callback
  → On isDone: save message to DB, update token usage
```

Each AI provider has its own streaming proxy (`app/api/completions/proxy*.ts`) because SSE formats differ. The completions route uses custom headers (`X-Provider`, `X-Model`, `X-Chat-Id`) rather than URL params for routing.

**Tool calling loop**: When AI returns `tool_calls`, the client calls each MCP tool via `callMCPTool()`, appends results as messages, then re-calls `/api/completions` recursively until the AI returns a final response.

**Thinking content**: Special parsing for `<think>` tags that may span streaming chunks (handles OpenAI, DeepSeek, 智谱 formats).

### Key Directories (non-obvious organization)

- `app/provider/` - LLM provider classes (OpenAIProvider, ClaudeProvider, GeminiProvider, OpenAIResponseProvider) implementing the `LLMApi` interface from `types/llm.ts`
- `app/services/` - MCPService (singleton client manager with connection/tool-call timeouts), WebSearchService
- `app/webSearchProvider/` - Tavily, Jina, Bocha search providers with factory pattern
- `app/utils/mcpToolsClient.ts` - Converts MCP tools to/from provider-specific formats (OpenAI, Anthropic, Gemini)
- `app/utils/mcpToolsServer.ts` - Server-side tool execution via MCPService
- `app/hooks/chat/useChat.ts` - Main chat hook orchestrating message flow
- `app/chat/actions/` - Server Actions for chat, message, and bot CRUD
- `app/admin/` - Admin panel with sub-pages: llm, bot, users, mcp, search, system
- `app/db/schema.ts` - All Drizzle table definitions; `relations.ts` for ORM relations
- `types/` - Shared TypeScript types including error hierarchy (InvalidAPIKeyError, OverQuotaError, TimeoutError) and MCP error system with severity levels
- `locales/` - Translation JSON files (en.json, zh.json); language stored in cookie `language=en|zh`

### Database Patterns

- Schema: `app/db/schema.ts` · Relations: `app/db/relations.ts` · Connection: `app/db/index.ts`
- `getDbInstance()` switches between neon-http (Vercel) and postgres-js (local) based on environment
- Message `content` is stored as JSON to support multi-modal (text + images)
- Chat IDs use nanoid with custom alphabet: `customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 10)`
- `initdb` uses `drizzle-orm push` (not migrations); seed order matters: providers → models → bots → groups

### Authentication

- Config: `auth.ts` · Middleware: `middleware.ts` (exports auth as middleware for all routes)
- Providers: Credentials (email/password), Feishu, WeCom, DingTalk — each conditionally enabled via env vars (`FEISHU_AUTH_STATUS=ON`, etc.)
- JWT stores `id`, `isAdmin`, `provider`; session exposes these to the client
- `/auth/setup` page only accessible before any admin exists; requires `ADMIN_CODE` env var

### State Management (Zustand stores in `app/store/`)

- `modelList.ts` - Maintains both `modelList` (by name) and `modelListRealId` (by DB ID); persists last selection to localStorage as `lastSelectedModel` (format: `providerId|modelId`)
- `chat.ts` - Current chat state; syncs settings to server via `updateChatInServer`
- `mcp.ts` - MCP server selection and tool filtering
- `userSettings.ts` - User preferences (e.g., messageSendShortcut)

## Environment Variables

Required: `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_CODE`, `NEXTAUTH_URL`
Optional auth: `FEISHU_*`, `WECOM_*`, `DINGDING_*` (enabled when respective `*_AUTH_STATUS=ON`)
Template: `.env.example`

## Deployment

- **Docker**: Multi-stage Dockerfile (Node 22 Alpine), docker-compose with PostgreSQL 16. Init SQL in `docker/hivechat_init.sql`
- **Standalone**: `output: 'standalone'` in next.config.mjs; run `node server.js` from `.next/standalone`

### Vercel + Neon PostgreSQL 部署与升级

**首次部署：**

1. 在 [neon.tech](https://neon.tech) 创建 PostgreSQL 数据库，拿到 `DATABASE_URL`（用 pooled 连接）
2. 将代码 push 到 GitHub，在 Vercel 导入该项目
3. 配置 Vercel 环境变量：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | Neon 连接串 |
| `AUTH_SECRET` | `openssl rand -base64 32` 生成 |
| `ADMIN_CODE` | 自定义管理员授权码 |
| `NEXTAUTH_URL` | Vercel 域名（如 `https://xxx.vercel.app`） |
| `AUTH_TRUST_HOST` | `true` |
| `EMAIL_AUTH_STATUS` | `ON` |

4. 部署完成后访问 `/auth/setup`，用 ADMIN_CODE 创建管理员
5. 在管理后台配置 AI provider 和 model
6. 如需预置模型数据，本地执行一次 `DATABASE_URL=<Neon连接串> npm run initdb`（只跑一次）

**后续升级（自动部署）：**

`vercel.json` 的 buildCommand 为 `next build && npx drizzle-kit push --force`：
- `next build` — 构建应用
- `drizzle-kit push --force` — 自动同步 schema 变更到数据库，**不会覆盖已有数据**

流程：`本地改代码 → git push → Vercel 自动构建部署 + schema 同步 → 无需额外干预`

注意：`initdb`（含 seed）仅首次或需要重置数据时手动执行，不纳入自动构建，避免覆盖线上配置。
