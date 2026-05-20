# Unified MCP — Web App Design

**Date:** 2026-05-20
**Status:** Approved

---

## Overview

A SaaS web application that gives external customers a visual interface to the Unified MCP backend. Users connect their Excel files, Google Sheets, and Airtable bases, then interact with their data through two modes: an AI chat interface (powered by Claude) and a visual data explorer (table view with filtering).

The app is built as a Next.js application inside the existing `unified-mcp` monorepo, sharing tool handler logic directly from `src/tools/`.

---

## Architecture

```
unified-mcp/
├── src/                    ← existing MCP server (stdio, Claude Desktop) — unchanged
│   ├── tools/              ← tool handlers shared with the web app
│   ├── connectors/
│   └── ...
├── app/                    ← NEW: Next.js SaaS web app
│   ├── app/                ← Next.js App Router
│   │   ├── (auth)/         ← Clerk sign-in / sign-up pages
│   │   ├── (dashboard)/
│   │   │   ├── sources/    ← Source management (home)
│   │   │   ├── chat/       ← AI chat interface
│   │   │   └── explorer/   ← Data table explorer
│   │   └── api/
│   │       ├── chat/       ← Streaming chat endpoint (Claude API)
│   │       ├── sources/    ← CRUD for user connections
│   │       └── data/       ← Data query endpoints
│   ├── components/
│   │   ├── layout/         ← Sidebar, Shell
│   │   ├── chat/           ← ChatInput, MessageList, ToolCallIndicator
│   │   ├── explorer/       ← DataTable, FilterBar, SheetSelector
│   │   └── sources/        ← SourceCard, ConnectModal
│   ├── lib/
│   │   ├── claude.ts       ← Anthropic SDK client + tool definitions
│   │   ├── db.ts           ← Prisma client
│   │   └── connections.ts  ← Per-user connection helpers (DB-backed, scoped by userId)
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
└── package.json            ← existing MCP package (unchanged)
```

**Key architectural principle:** Next.js API routes import tool handlers from `../../src/tools/` directly. No separate server process. The MCP stdio server for Claude Desktop is completely untouched.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Auth | Clerk |
| Database | PostgreSQL via Prisma (Neon or Supabase) |
| AI | Anthropic SDK (`claude-sonnet-4-6`) with `tool_use` |
| Styling | Tailwind CSS — dark zinc palette, emerald green accents |
| Deployment | Vercel |

---

## Visual Design

**Style:** Dark zinc + green — near-black backgrounds (`#09090b`), zinc card surfaces (`#18181b`), emerald green accents (`#10b981`). Terminal-inspired, developer-friendly. Similar to Vercel dashboard.

**Layout:** Sidebar + Main Panel
- Persistent left sidebar: logo, nav links (Sources, Chat, Explorer), active source picker at the bottom
- Main area switches between the three views
- No top navbar — sidebar owns navigation entirely

---

## Pages & Routes

### `/sources` — Home (dashboard)
Lists all of the user's connected sources as cards showing source type (xlsx/sheets/airtable), label, and connection status. "Connect source" button opens a modal with a 3-step wizard: pick type → enter credentials → confirm.

### `/chat` — AI Chat
Full-height chat interface. Sidebar shows a source selector dropdown (which source Claude queries). Messages stream in real time via the `/api/chat` streaming endpoint. Claude uses `tool_use` to call the MCP tool handlers; the UI shows a small "Querying Diamond Tracker…" indicator while tools are running. Users can switch sources mid-conversation.

### `/explorer` — Data Explorer
Source + sheet dropdowns at the top. Below: a paginated data table rendered from `query_range` results. Filter bar lets users add column filters (column, operator, value) which are passed to `query_range`. No inline editing in v1.

### `/sources/connect` — Connect Modal (overlay)
Three-panel type picker (Excel / Google Sheets / Airtable), then type-specific credential fields, then a test + save step.

- **Excel:** User uploads the `.xlsx` file. The app stores it in Vercel Blob (or S3). The connection stores the blob URL; the Excel connector fetches it by URL when querying.
- **Google Sheets:** Shows the OAuth URL; user authorises and pastes back the auth code.
- **Airtable:** User pastes API key + base ID; app validates against Airtable API before saving.

---

## Data Model

Connections are stored per-user in PostgreSQL instead of the local `~/.unified-mcp/connections.json` file.

```prisma
model Connection {
  id        String   @id @default(cuid())
  userId    String                          // Clerk user ID
  type      String                          // "excel" | "sheets" | "airtable"
  label     String
  config    Json                            // encrypted at rest
  createdAt DateTime @default(now())

  @@index([userId])
}
```

The `config` field stores the same structure as the existing connection config types (`ExcelConfig`, `SheetsConfig`, `AirtableConfig`). Sensitive fields (API keys, refresh tokens) are encrypted before storage using a server-side secret.

The existing `src/connections.ts` continues to work unchanged for the Claude Desktop / stdio flow (local JSON file). The web app uses its own `app/lib/connections.ts` which reads/writes from the database scoped by Clerk `userId` — the two storage layers are independent.

---

## API Routes

### `POST /api/chat` — streaming
Accepts `{ connectionId, message, history }`. Calls Anthropic SDK with the MCP tools registered as Claude tools. Streams the response using Vercel AI SDK streaming. When Claude emits a `tool_use` block, the route calls the corresponding tool handler from `src/tools/` and feeds the result back.

### `GET /api/sources` — list user's connections
### `POST /api/sources` — create connection (calls connect_source logic)
### `DELETE /api/sources/[id]` — remove connection

### `GET /api/data/sheets?connectionId=&sheet=` — list sheets
### `GET /api/data/rows?connectionId=&sheet=&filters=&limit=` — query rows (Explorer)

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Source unreachable (file moved, token expired) | Red badge on source card; chat returns actionable error message |
| Google OAuth token expired | `AUTH_EXPIRED` response triggers re-auth modal |
| Claude API error | Toast notification; message shows "Something went wrong, try again" |
| Invalid filter in Explorer | Inline validation before API call; no silent failures |

---

## Out of Scope (v1)

- Billing / subscription tiers
- Inline cell editing in Explorer
- CSV / Parquet support
- Scheduled summaries / alerts UI (automation tools exist in MCP but no UI)
- Mobile layout
- Team / org sharing of connections

---

## Future Extensions

- Billing via Stripe when ready to monetise
- Webhook delivery for alerts
- Cross-source queries in chat
- CSV upload support
- Shareable public data views
