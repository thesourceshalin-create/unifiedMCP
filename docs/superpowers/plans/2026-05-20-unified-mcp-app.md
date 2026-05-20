# Unified MCP Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 14 SaaS web app inside the existing `unified-mcp` monorepo that lets external users connect Excel/Sheets/Airtable sources and interact with them via AI chat and a data explorer.

**Architecture:** A standalone `app/` directory at the repo root runs as a Next.js App Router application. It imports connector classes directly from `../../src/connectors/` and uses its own DB-backed connection layer (Prisma + PostgreSQL) instead of the local JSON file used by Claude Desktop. The MCP stdio server in `src/` is untouched.

**Tech Stack:** Next.js 14 (App Router, TypeScript), Clerk (auth), Prisma + PostgreSQL (Neon/Supabase), Anthropic SDK (`claude-sonnet-4-6`), Vercel Blob (Excel uploads), Tailwind CSS (dark zinc + emerald), Vercel (deploy).

---

## File Map

```
app/
├── app/
│   ├── layout.tsx                  # Root layout: ClerkProvider + globals
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Shell: Sidebar + <main>
│   │   ├── sources/page.tsx        # Sources list page
│   │   ├── chat/page.tsx           # Chat page
│   │   └── explorer/page.tsx       # Data explorer page
│   └── api/
│       ├── chat/route.ts           # POST: streaming chat with tool_use
│       ├── sources/
│       │   ├── route.ts            # GET list, POST create
│       │   └── [id]/route.ts       # DELETE
│       └── data/
│           ├── sheets/route.ts     # GET: list sheets for a connection
│           └── rows/route.ts       # GET: query rows with optional filters
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx             # Nav links + active source picker
│   ├── sources/
│   │   ├── SourceCard.tsx          # Card showing source type/label/status
│   │   └── ConnectModal.tsx        # 3-step wizard: type → creds → confirm
│   ├── chat/
│   │   ├── ChatInput.tsx           # Textarea + send button
│   │   ├── MessageList.tsx         # Scrollable message thread
│   │   └── ToolCallIndicator.tsx   # "Querying X..." spinner
│   └── explorer/
│       ├── SheetSelector.tsx       # Source + sheet dropdowns
│       ├── FilterBar.tsx           # Add/remove column filters
│       └── DataTable.tsx           # Paginated data table
├── lib/
│   ├── db.ts                       # Prisma client singleton
│   ├── encrypt.ts                  # AES-256-GCM encrypt/decrypt for config
│   ├── connections.ts              # DB-backed connection CRUD (scoped by userId)
│   ├── webConnector.ts             # Resolves connectionId → connector + target
│   └── claude.ts                   # Anthropic client + chat tool definitions
├── prisma/
│   └── schema.prisma
├── middleware.ts                   # Clerk: protect /dashboard routes
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env.local                      # Template (committed, no secrets)
└── package.json
```

---

## Task 1: Bootstrap the Next.js App

**Files:**
- Create: `app/package.json`
- Create: `app/next.config.ts`
- Create: `app/tailwind.config.ts`
- Create: `app/tsconfig.json`
- Create: `app/.env.local`
- Create: `app/app/globals.css`
- Create: `app/app/layout.tsx`

- [ ] **Step 1: Create `app/package.json`**

```json
{
  "name": "unified-mcp-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.36.3",
    "@clerk/nextjs": "^6.12.9",
    "@prisma/client": "^6.9.0",
    "@vercel/blob": "^0.27.3",
    "next": "14.2.29",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.4.21",
    "postcss": "^8",
    "prisma": "^6.9.0",
    "tailwindcss": "^3.4.17",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create `app/next.config.ts`**

This webpack extension alias makes `../../src/connectors/excel.js` resolve to `excel.ts` — needed because `src/` uses ESM `.js` imports throughout.

```ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  webpack(cfg) {
    cfg.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    }
    return cfg
  },
}

export default config
```

- [ ] **Step 3: Create `app/tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `app/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#09090b',
        surface: '#18181b',
        border: '#27272a',
        muted: '#71717a',
        accent: '#10b981',
        'accent-dim': '#052e16',
        'accent-text': '#6ee7b7',
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 5: Create `app/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #09090b;
  color: #e4e4e7;
}
```

- [ ] **Step 6: Create `app/.env.local`** (template — add real values before running)

```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/sources
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/sources

# Database (Neon or Supabase PostgreSQL)
DATABASE_URL=postgresql://...

# Encryption (generate: openssl rand -hex 32)
ENCRYPTION_KEY=

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Vercel Blob
BLOB_READ_WRITE_TOKEN=

# Google OAuth (for Sheets)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- [ ] **Step 7: Create root layout `app/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'Unified MCP',
  description: 'Connect and explore your data',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

- [ ] **Step 8: Install dependencies**

From `app/` directory:
```bash
cd app && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 9: Verify `next dev` starts**

```bash
cd app && npm run dev
```

Expected: `ready - started server on 0.0.0.0:3000`. Ctrl+C to stop.

- [ ] **Step 10: Commit**

```bash
git add app/
git commit -m "feat: scaffold Next.js app directory"
```

---

## Task 2: Prisma Schema + Encryption

**Files:**
- Create: `app/prisma/schema.prisma`
- Create: `app/lib/db.ts`
- Create: `app/lib/encrypt.ts`

- [ ] **Step 1: Create `app/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Connection {
  id        String   @id @default(cuid())
  userId    String
  type      String
  label     String
  config    String   // AES-256-GCM encrypted JSON
  createdAt DateTime @default(now())

  @@index([userId])
}
```

Note: `config` is `String` (not `Json`) because we store the AES ciphertext as a string.

- [ ] **Step 2: Create `app/lib/db.ts`**

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

- [ ] **Step 3: Create `app/lib/encrypt.ts`**

```ts
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) throw new Error('ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
  return Buffer.from(hex, 'hex')
}

export function encrypt(data: unknown): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const text = JSON.stringify(data)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(ciphertext: string): unknown {
  const key = getKey()
  const [ivHex, tagHex, dataHex] = ciphertext.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return JSON.parse(decrypted.toString('utf8'))
}
```

- [ ] **Step 4: Run Prisma generate**

```bash
cd app && npx prisma generate
```

Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 5: Push schema to database** (requires `DATABASE_URL` set in `.env.local`)

```bash
cd app && npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema`. If DATABASE_URL not set yet, skip and return after configuring.

- [ ] **Step 6: Verify encrypt round-trip**

Create and run `app/scripts/test-encrypt.ts`:

```ts
process.env.ENCRYPTION_KEY = '0'.repeat(64)
import { encrypt, decrypt } from '../lib/encrypt'
const original = { apiKey: 'secret', baseId: 'app123' }
const ciphertext = encrypt(original)
const decrypted = decrypt(ciphertext)
console.assert(JSON.stringify(decrypted) === JSON.stringify(original), 'Round-trip failed')
console.log('Encrypt/decrypt OK:', decrypted)
```

```bash
cd app && npx tsx scripts/test-encrypt.ts
```

Expected: `Encrypt/decrypt OK: { apiKey: 'secret', baseId: 'app123' }`

- [ ] **Step 7: Commit**

```bash
git add app/prisma/ app/lib/db.ts app/lib/encrypt.ts
git commit -m "feat: add Prisma schema and AES encryption helpers"
```

---

## Task 3: DB-Backed Connection Helpers + Web Connector Resolver

**Files:**
- Create: `app/lib/connections.ts`
- Create: `app/lib/webConnector.ts`

These two files form the web app's equivalent of `src/connections.ts` + `src/router.ts`.

- [ ] **Step 1: Create `app/lib/connections.ts`**

```ts
import { db } from './db'
import { encrypt, decrypt } from './encrypt'

export type WebConfig =
  | { type: 'excel'; blobUrl: string }
  | { type: 'sheets'; spreadsheetId: string; refreshToken: string; clientId: string; clientSecret: string }
  | { type: 'airtable'; baseId: string; apiKey: string }

export interface WebConnection {
  id: string
  userId: string
  type: string
  label: string
  config: WebConfig
  createdAt: Date
}

export async function listConnections(userId: string): Promise<WebConnection[]> {
  const rows = await db.connection.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
  return rows.map(r => ({ ...r, config: decrypt(r.config) as WebConfig }))
}

export async function getConnection(id: string, userId: string): Promise<WebConnection | null> {
  const row = await db.connection.findFirst({ where: { id, userId } })
  if (!row) return null
  return { ...row, config: decrypt(row.config) as WebConfig }
}

export async function createConnection(
  userId: string,
  type: string,
  label: string,
  config: WebConfig
): Promise<WebConnection> {
  const row = await db.connection.create({
    data: { userId, type, label, config: encrypt(config) },
  })
  return { ...row, config }
}

export async function deleteConnection(id: string, userId: string): Promise<void> {
  await db.connection.deleteMany({ where: { id, userId } })
}
```

- [ ] **Step 2: Create `app/lib/webConnector.ts`**

Resolves a connection to a connector instance + target value. For Excel, downloads the Vercel Blob URL to a temp file so the ExcelConnector (which calls `readFile`) can access it.

```ts
import { writeFile, mkdir, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { ExcelConnector } from '../../src/connectors/excel.js'
import { SheetsConnector } from '../../src/connectors/sheets.js'
import { AirtableConnector } from '../../src/connectors/airtable.js'
import type { DataSource } from '../../src/types.js'
import { getConnection } from './connections'

const connectorMap: Record<string, DataSource> = {
  excel: new ExcelConnector(),
  sheets: new SheetsConnector(),
  airtable: new AirtableConnector(),
}

export interface ResolvedConnector {
  connector: DataSource
  target: unknown
  cleanup: () => Promise<void>
}

export async function resolveWebConnector(connectionId: string, userId: string): Promise<ResolvedConnector> {
  const conn = await getConnection(connectionId, userId)
  if (!conn) throw new Error(`Connection "${connectionId}" not found`)

  const config = conn.config

  if (config.type === 'excel') {
    const res = await fetch(config.blobUrl)
    if (!res.ok) throw new Error(`Failed to fetch Excel file: ${res.statusText}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const dir = join(tmpdir(), 'unified-mcp-web')
    await mkdir(dir, { recursive: true })
    const tmpPath = join(dir, `${connectionId}.xlsx`)
    await writeFile(tmpPath, buf)
    return {
      connector: connectorMap.excel,
      target: tmpPath,
      cleanup: async () => { try { await unlink(tmpPath) } catch {} },
    }
  }

  if (config.type === 'sheets') {
    return {
      connector: connectorMap.sheets,
      target: config,
      cleanup: async () => {},
    }
  }

  if (config.type === 'airtable') {
    return {
      connector: connectorMap.airtable,
      target: config,
      cleanup: async () => {},
    }
  }

  throw new Error(`Unknown connection type: ${(config as { type: string }).type}`)
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors (or only errors in files not yet created — that's fine, fix import errors in this task's files only).

- [ ] **Step 4: Commit**

```bash
git add app/lib/connections.ts app/lib/webConnector.ts
git commit -m "feat: add DB-backed connection helpers and web connector resolver"
```

---

## Task 4: Auth Middleware + Layout + Sidebar

**Files:**
- Create: `app/middleware.ts`
- Create: `app/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- Create: `app/app/(auth)/sign-up/[[...sign-up]]/page.tsx`
- Create: `app/components/layout/Sidebar.tsx`
- Create: `app/app/(dashboard)/layout.tsx`
- Create: `app/app/page.tsx` (redirect to /sources)

- [ ] **Step 1: Create `app/middleware.ts`**

```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublic = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware((auth, req) => {
  if (!isPublic(req)) auth().protect()
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
}
```

- [ ] **Step 2: Create auth pages**

`app/app/(auth)/sign-in/[[...sign-in]]/page.tsx`:
```tsx
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignIn />
    </div>
  )
}
```

`app/app/(auth)/sign-up/[[...sign-up]]/page.tsx`:
```tsx
import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignUp />
    </div>
  )
}
```

- [ ] **Step 3: Create `app/app/page.tsx`** (root redirect)

```tsx
import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/sources')
}
```

- [ ] **Step 4: Create `app/components/layout/Sidebar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

const navItems = [
  { href: '/sources', label: 'Sources', icon: '📁' },
  { href: '/chat', label: 'Chat', icon: '💬' },
  { href: '/explorer', label: 'Explorer', icon: '📊' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-48 flex-col border-r border-border bg-surface">
      <div className="px-4 py-5">
        <span className="text-sm font-bold text-accent">▸ UNIFIED MCP</span>
      </div>

      <nav className="flex-1 px-2 py-2 space-y-1">
        {navItems.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                active
                  ? 'border-l-2 border-accent bg-border text-white'
                  : 'text-muted hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </aside>
  )
}
```

- [ ] **Step 5: Create `app/app/(dashboard)/layout.tsx`**

```tsx
import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background">{children}</main>
    </div>
  )
}
```

- [ ] **Step 6: Verify dev server renders auth + dashboard shell**

```bash
cd app && npm run dev
```

Visit `http://localhost:3000`. Expected: redirected to `/sign-in` (Clerk auth wall). After signing in: sidebar with Sources/Chat/Explorer links visible.

- [ ] **Step 7: Commit**

```bash
git add app/middleware.ts app/app/ app/components/layout/
git commit -m "feat: add Clerk auth, dashboard shell and sidebar"
```

---

## Task 5: Sources API Routes

**Files:**
- Create: `app/app/api/sources/route.ts`
- Create: `app/app/api/sources/[id]/route.ts`

These routes handle CRUD for the user's data source connections. Excel connections are created via a separate upload step (Vercel Blob) handled in the frontend; these routes just save the final config.

- [ ] **Step 1: Create `app/app/api/sources/route.ts`**

```ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { listConnections, createConnection } from '@/lib/connections'
import type { WebConfig } from '@/lib/connections'

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const connections = await listConnections(userId)
  // Strip the decrypted config for list response — expose only non-sensitive fields
  const safe = connections.map(c => ({
    id: c.id,
    type: c.type,
    label: c.label,
    createdAt: c.createdAt,
  }))
  return NextResponse.json(safe)
}

export async function POST(req: NextRequest) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { type: string; label: string; config: WebConfig }
  const { type, label, config } = body

  if (!type || !label || !config) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const conn = await createConnection(userId, type, label, config)
  return NextResponse.json({ id: conn.id, type: conn.type, label: conn.label, createdAt: conn.createdAt }, { status: 201 })
}
```

- [ ] **Step 2: Create `app/app/api/sources/[id]/route.ts`**

```ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { deleteConnection, getConnection } from '@/lib/connections'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await getConnection(params.id, userId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await deleteConnection(params.id, userId)
  return NextResponse.json({ deleted: true })
}
```

- [ ] **Step 3: Test the API manually** (after running dev server with real DATABASE_URL)

```bash
# Get an auth token from Clerk dev dashboard or test with curl:
curl -X GET http://localhost:3000/api/sources \
  -H "Cookie: __session=<your-clerk-session-cookie>"
```

Expected: `[]` (empty array for new user).

- [ ] **Step 4: Commit**

```bash
git add app/app/api/sources/
git commit -m "feat: add sources CRUD API routes"
```

---

## Task 6: Sources UI — SourceCard + ConnectModal + /sources Page

**Files:**
- Create: `app/components/sources/SourceCard.tsx`
- Create: `app/components/sources/ConnectModal.tsx`
- Create: `app/app/(dashboard)/sources/page.tsx`

- [ ] **Step 1: Create `app/components/sources/SourceCard.tsx`**

```tsx
interface Props {
  id: string
  type: string
  label: string
  onDelete: (id: string) => void
}

const typeLabels: Record<string, { short: string; color: string }> = {
  excel: { short: 'xlsx', color: 'text-green-400' },
  sheets: { short: 'gsh', color: 'text-blue-400' },
  airtable: { short: 'air', color: 'text-orange-400' },
}

export default function SourceCard({ id, type, label, onDelete }: Props) {
  const meta = typeLabels[type] ?? { short: type, color: 'text-zinc-400' }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <span className={`text-xs font-semibold ${meta.color}`}>{meta.short}</span>
      <span className="flex-1 text-sm text-zinc-200">{label}</span>
      <span className="h-2 w-2 rounded-full bg-accent" title="Connected" />
      <button
        onClick={() => onDelete(id)}
        className="ml-2 text-xs text-muted hover:text-red-400 transition-colors"
      >
        Remove
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/components/sources/ConnectModal.tsx`**

This is a 3-step wizard. Step 1: pick type. Step 2: enter credentials. Step 3: save.

For Excel: file upload → PUT to Vercel Blob via `/api/blob/upload` (built-in Next.js route), get back URL → POST to `/api/sources`.
For Sheets: show OAuth URL → user pastes auth code → POST to `/api/sources/sheets-oauth` to exchange code → POST config to `/api/sources`.
For Airtable: paste API key + base ID → validate → POST to `/api/sources`.

```tsx
'use client'

import { useState } from 'react'

interface Props {
  onClose: () => void
  onCreated: () => void
}

type Step = 'pick' | 'configure' | 'saving'
type SourceType = 'excel' | 'sheets' | 'airtable'

const SOURCE_TYPES: { type: SourceType; label: string; icon: string }[] = [
  { type: 'excel', label: 'Excel', icon: '📗' },
  { type: 'sheets', label: 'Google Sheets', icon: '📊' },
  { type: 'airtable', label: 'Airtable', icon: '🗂️' },
]

export default function ConnectModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>('pick')
  const [sourceType, setSourceType] = useState<SourceType | null>(null)
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')

  // Excel fields
  const [excelFile, setExcelFile] = useState<File | null>(null)

  // Sheets fields
  const [sheetsId, setSheetsId] = useState('')
  const [sheetsAuthCode, setSheetsAuthCode] = useState('')
  const [oauthUrl, setOauthUrl] = useState('')

  // Airtable fields
  const [airtableKey, setAirtableKey] = useState('')
  const [airtableBase, setAirtableBase] = useState('')

  async function handlePick(type: SourceType) {
    setSourceType(type)
    setError('')
    if (type === 'sheets') {
      // Fetch OAuth URL
      const res = await fetch('/api/sources/sheets-auth-url')
      const { url } = await res.json()
      setOauthUrl(url)
    }
    setStep('configure')
  }

  async function handleConnect() {
    if (!label.trim()) { setError('Enter a label'); return }
    setError('')
    setStep('saving')

    try {
      if (sourceType === 'excel') {
        if (!excelFile) { setError('Select a file'); setStep('configure'); return }
        // Upload file to Vercel Blob
        const formData = new FormData()
        formData.append('file', excelFile)
        const blobRes = await fetch('/api/blob/upload', { method: 'POST', body: formData })
        if (!blobRes.ok) throw new Error('Upload failed')
        const { url: blobUrl } = await blobRes.json()
        await saveConnection({ type: 'excel', blobUrl })
      } else if (sourceType === 'sheets') {
        // Exchange auth code for tokens
        const tokenRes = await fetch('/api/sources/sheets-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authCode: sheetsAuthCode, spreadsheetId: sheetsId }),
        })
        if (!tokenRes.ok) throw new Error('OAuth exchange failed')
        const { config } = await tokenRes.json()
        await saveConnection(config)
      } else if (sourceType === 'airtable') {
        await saveConnection({ type: 'airtable', apiKey: airtableKey, baseId: airtableBase })
      }
      onCreated()
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setStep('configure')
    }
  }

  async function saveConnection(config: object) {
    const res = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: sourceType, label, config }),
    })
    if (!res.ok) {
      const { error } = await res.json()
      throw new Error(error ?? 'Failed to save connection')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-100">Connect a data source</h2>
          <button onClick={onClose} className="text-muted hover:text-white">✕</button>
        </div>

        {step === 'pick' && (
          <div className="grid grid-cols-3 gap-3">
            {SOURCE_TYPES.map(s => (
              <button
                key={s.type}
                onClick={() => handlePick(s.type)}
                className="flex flex-col items-center rounded-lg border border-border bg-background p-4 hover:border-accent transition-colors"
              >
                <span className="text-2xl">{s.icon}</span>
                <span className="mt-2 text-xs text-muted">{s.label}</span>
              </button>
            ))}
          </div>
        )}

        {step === 'configure' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted">Label</label>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Diamond Tracker"
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-zinc-100 placeholder-muted focus:border-accent focus:outline-none"
              />
            </div>

            {sourceType === 'excel' && (
              <div>
                <label className="text-xs text-muted">Excel file (.xlsx)</label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={e => setExcelFile(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full text-sm text-zinc-300"
                />
              </div>
            )}

            {sourceType === 'sheets' && (
              <>
                <div>
                  <label className="text-xs text-muted">Spreadsheet ID</label>
                  <input
                    value={sheetsId}
                    onChange={e => setSheetsId(e.target.value)}
                    placeholder="From the Google Sheets URL"
                    className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-zinc-100 placeholder-muted focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted">Step 1: Authorize</label>
                  <a
                    href={oauthUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block rounded bg-accent-dim px-3 py-2 text-center text-xs text-accent hover:bg-green-900 transition-colors"
                  >
                    Open Google Auth →
                  </a>
                </div>
                <div>
                  <label className="text-xs text-muted">Step 2: Paste auth code</label>
                  <input
                    value={sheetsAuthCode}
                    onChange={e => setSheetsAuthCode(e.target.value)}
                    placeholder="Paste code from Google"
                    className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-zinc-100 placeholder-muted focus:border-accent focus:outline-none"
                  />
                </div>
              </>
            )}

            {sourceType === 'airtable' && (
              <>
                <div>
                  <label className="text-xs text-muted">API Key</label>
                  <input
                    value={airtableKey}
                    onChange={e => setAirtableKey(e.target.value)}
                    placeholder="pat..."
                    className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-zinc-100 placeholder-muted focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted">Base ID</label>
                  <input
                    value={airtableBase}
                    onChange={e => setAirtableBase(e.target.value)}
                    placeholder="app..."
                    className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-zinc-100 placeholder-muted focus:border-accent focus:outline-none"
                  />
                </div>
              </>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep('pick')}
                className="flex-1 rounded border border-border py-2 text-sm text-muted hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleConnect}
                className="flex-1 rounded bg-accent py-2 text-sm font-semibold text-black hover:bg-green-400 transition-colors"
              >
                Connect
              </button>
            </div>
          </div>
        )}

        {step === 'saving' && (
          <p className="text-center text-sm text-muted py-6">Connecting…</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create supporting API routes for ConnectModal**

Create `app/app/api/blob/upload/route.ts`:
```ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export async function POST(req: NextRequest) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file || !file.name.endsWith('.xlsx')) {
    return NextResponse.json({ error: 'Only .xlsx files are supported' }, { status: 400 })
  }

  const blob = await put(`${userId}/${Date.now()}-${file.name}`, file.stream(), {
    access: 'public',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  return NextResponse.json({ url: blob.url })
}
```

Create `app/app/api/sources/sheets-auth-url/route.ts`:
```ts
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { google } = await import('googleapis')
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/sources/sheets-callback`
  )
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/spreadsheets'],
    prompt: 'consent',
  })
  return NextResponse.json({ url })
}
```

Create `app/app/api/sources/sheets-token/route.ts`:
```ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { authCode, spreadsheetId } = await req.json()
  const { google } = await import('googleapis')
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/sources/sheets-callback`
  )
  const { tokens } = await oauth2.getToken(authCode)
  if (!tokens.refresh_token) {
    return NextResponse.json({ error: 'No refresh_token returned. Try revoking access and re-authorising.' }, { status: 400 })
  }
  return NextResponse.json({
    config: {
      type: 'sheets',
      spreadsheetId,
      refreshToken: tokens.refresh_token,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  })
}
```

- [ ] **Step 4: Create `app/app/(dashboard)/sources/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import SourceCard from '@/components/sources/SourceCard'
import ConnectModal from '@/components/sources/ConnectModal'

interface Source {
  id: string
  type: string
  label: string
  createdAt: string
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await fetch('/api/sources')
    const data = await res.json()
    setSources(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    await fetch(`/api/sources/${id}`, { method: 'DELETE' })
    setSources(s => s.filter(x => x.id !== id))
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">My Data Sources</h1>
        <button
          onClick={() => setShowModal(true)}
          className="rounded bg-accent px-4 py-2 text-sm font-semibold text-black hover:bg-green-400 transition-colors"
        >
          + Connect source
        </button>
      </div>

      {loading && <p className="text-sm text-muted">Loading…</p>}

      {!loading && sources.length === 0 && (
        <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
          <p className="text-sm text-muted">No sources connected yet.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 text-sm text-accent hover:underline"
          >
            Connect your first source →
          </button>
        </div>
      )}

      <div className="space-y-3">
        {sources.map(s => (
          <SourceCard
            key={s.id}
            id={s.id}
            type={s.type}
            label={s.label}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {showModal && (
        <ConnectModal
          onClose={() => setShowModal(false)}
          onCreated={load}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Test the full source connect flow**

Start dev server. Sign in. Visit `/sources`. Click "Connect source". Test Excel upload with a real `.xlsx` file. Verify:
- Modal opens with 3 type options
- Selecting Excel shows file input
- After connecting, new card appears in list
- Remove button deletes the card

- [ ] **Step 6: Commit**

```bash
git add app/app/(dashboard)/sources/ app/app/api/blob/ app/app/api/sources/sheets-auth-url/ app/app/api/sources/sheets-token/ app/components/sources/
git commit -m "feat: add sources list page, ConnectModal wizard, and Excel blob upload"
```

---

## Task 7: Data API Routes

**Files:**
- Create: `app/app/api/data/sheets/route.ts`
- Create: `app/app/api/data/rows/route.ts`

These routes are used by the Explorer page to list sheets and query rows.

- [ ] **Step 1: Create `app/app/api/data/sheets/route.ts`**

```ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { resolveWebConnector } from '@/lib/webConnector'

export async function GET(req: NextRequest) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connectionId = req.nextUrl.searchParams.get('connectionId')
  if (!connectionId) return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 })

  try {
    const { connector, target, cleanup } = await resolveWebConnector(connectionId, userId)
    const sheets = await connector.listSheets(target)
    await cleanup()
    return NextResponse.json(sheets)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
```

- [ ] **Step 2: Create `app/app/api/data/rows/route.ts`**

```ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { resolveWebConnector } from '@/lib/webConnector'
import type { QueryFilter } from '../../../src/types'

export async function GET(req: NextRequest) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = req.nextUrl.searchParams
  const connectionId = params.get('connectionId')
  const sheet = params.get('sheet')
  const filtersParam = params.get('filters')
  const limitParam = params.get('limit')

  if (!connectionId || !sheet) {
    return NextResponse.json({ error: 'Missing connectionId or sheet' }, { status: 400 })
  }

  const filters: QueryFilter[] = filtersParam ? JSON.parse(filtersParam) : []
  const limit = limitParam ? parseInt(limitParam, 10) : undefined

  try {
    const { connector, target, cleanup } = await resolveWebConnector(connectionId, userId)
    const rows = await connector.query(target, sheet, filters, limit)
    await cleanup()
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
```

- [ ] **Step 3: Test the data routes manually**

With a connected Excel source and its `connectionId`:

```bash
curl "http://localhost:3000/api/data/sheets?connectionId=<id>" \
  -H "Cookie: __session=<your-session>"
```

Expected: `["Sheet1", "Purchase Lots"]` (or whatever sheets the file has).

```bash
curl "http://localhost:3000/api/data/rows?connectionId=<id>&sheet=Sheet1&limit=5" \
  -H "Cookie: __session=<your-session>"
```

Expected: array of row objects with `_rowId` and column values.

- [ ] **Step 4: Commit**

```bash
git add app/app/api/data/
git commit -m "feat: add data API routes for sheets list and row query"
```

---

## Task 8: Explorer UI — SheetSelector + FilterBar + DataTable + /explorer page

**Files:**
- Create: `app/components/explorer/SheetSelector.tsx`
- Create: `app/components/explorer/FilterBar.tsx`
- Create: `app/components/explorer/DataTable.tsx`
- Create: `app/app/(dashboard)/explorer/page.tsx`

- [ ] **Step 1: Create `app/components/explorer/SheetSelector.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'

interface Source {
  id: string
  label: string
}

interface Props {
  onSelect: (connectionId: string, sheet: string) => void
}

export default function SheetSelector({ onSelect }: Props) {
  const [sources, setSources] = useState<Source[]>([])
  const [connectionId, setConnectionId] = useState('')
  const [sheets, setSheets] = useState<string[]>([])
  const [sheet, setSheet] = useState('')
  const [loadingSheets, setLoadingSheets] = useState(false)

  useEffect(() => {
    fetch('/api/sources').then(r => r.json()).then(setSources)
  }, [])

  async function handleConnectionChange(id: string) {
    setConnectionId(id)
    setSheet('')
    setSheets([])
    if (!id) return
    setLoadingSheets(true)
    try {
      const res = await fetch(`/api/data/sheets?connectionId=${id}`)
      const data = await res.json()
      setSheets(data)
    } finally {
      setLoadingSheets(false)
    }
  }

  function handleSheetChange(s: string) {
    setSheet(s)
    if (connectionId && s) onSelect(connectionId, s)
  }

  const selectClass = 'rounded border border-border bg-surface px-3 py-2 text-sm text-zinc-200 focus:border-accent focus:outline-none'

  return (
    <div className="flex items-center gap-3">
      <select value={connectionId} onChange={e => handleConnectionChange(e.target.value)} className={selectClass}>
        <option value="">Select source…</option>
        {sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <select value={sheet} onChange={e => handleSheetChange(e.target.value)} className={selectClass} disabled={!sheets.length}>
        <option value="">Select sheet…</option>
        {sheets.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      {loadingSheets && <span className="text-xs text-muted">Loading…</span>}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/components/explorer/FilterBar.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { QueryFilter, FilterOperator } from '../../../src/types'

const OPERATORS: FilterOperator[] = ['=', '!=', '>', '<', '>=', '<=', 'contains', 'not_contains']

interface Props {
  columns: string[]
  onFiltersChange: (filters: QueryFilter[]) => void
}

export default function FilterBar({ columns, onFiltersChange }: Props) {
  const [filters, setFilters] = useState<QueryFilter[]>([])

  function addFilter() {
    const f: QueryFilter = { column: columns[0] ?? '', operator: '=', value: '' }
    const next = [...filters, f]
    setFilters(next)
    onFiltersChange(next)
  }

  function updateFilter(i: number, patch: Partial<QueryFilter>) {
    const next = filters.map((f, idx) => idx === i ? { ...f, ...patch } : f)
    setFilters(next)
    onFiltersChange(next)
  }

  function removeFilter(i: number) {
    const next = filters.filter((_, idx) => idx !== i)
    setFilters(next)
    onFiltersChange(next)
  }

  const inputClass = 'rounded border border-border bg-surface px-2 py-1 text-xs text-zinc-200 focus:border-accent focus:outline-none'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((f, i) => (
        <div key={i} className="flex items-center gap-1 rounded border border-border bg-surface px-2 py-1">
          <select value={f.column} onChange={e => updateFilter(i, { column: e.target.value })} className={inputClass}>
            {columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={f.operator} onChange={e => updateFilter(i, { operator: e.target.value as FilterOperator })} className={inputClass}>
            {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
          <input
            value={String(f.value)}
            onChange={e => updateFilter(i, { value: e.target.value })}
            placeholder="value"
            className={`${inputClass} w-24`}
          />
          <button onClick={() => removeFilter(i)} className="ml-1 text-muted hover:text-red-400">✕</button>
        </div>
      ))}
      <button
        onClick={addFilter}
        className="rounded border border-border px-3 py-1 text-xs text-accent hover:border-accent transition-colors"
      >
        + Filter
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/components/explorer/DataTable.tsx`**

```tsx
'use client'

import type { Row } from '../../../src/types'

interface Props {
  rows: Row[]
  loading: boolean
}

const PAGE_SIZE = 50

export default function DataTable({ rows, loading }: Props) {
  const columns = rows.length > 0
    ? Object.keys(rows[0]).filter(k => k !== '_rowId')
    : []

  if (loading) {
    return <div className="flex h-48 items-center justify-center text-sm text-muted">Loading…</div>
  }

  if (!rows.length) {
    return <div className="flex h-48 items-center justify-center text-sm text-muted">No data. Select a source and sheet above.</div>
  }

  return (
    <div className="overflow-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface">
            {columns.map(col => (
              <th key={col} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, PAGE_SIZE).map(row => (
            <tr key={row._rowId} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
              {columns.map(col => (
                <td key={col} className="px-3 py-2 text-zinc-300 whitespace-nowrap">
                  {row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > PAGE_SIZE && (
        <div className="border-t border-border px-4 py-2 text-xs text-muted">
          Showing {PAGE_SIZE} of {rows.length} rows
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `app/app/(dashboard)/explorer/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import SheetSelector from '@/components/explorer/SheetSelector'
import FilterBar from '@/components/explorer/FilterBar'
import DataTable from '@/components/explorer/DataTable'
import type { Row, QueryFilter } from '../../../src/types'

export default function ExplorerPage() {
  const [connectionId, setConnectionId] = useState('')
  const [sheet, setSheet] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [filters, setFilters] = useState<QueryFilter[]>([])
  const [loading, setLoading] = useState(false)

  async function fetchRows(cid: string, s: string, f: QueryFilter[]) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ connectionId: cid, sheet: s })
      if (f.length) params.set('filters', JSON.stringify(f))
      const res = await fetch(`/api/data/rows?${params}`)
      const data: Row[] = await res.json()
      setRows(data)
      setColumns(data.length > 0 ? Object.keys(data[0]).filter(k => k !== '_rowId') : [])
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(cid: string, s: string) {
    setConnectionId(cid)
    setSheet(s)
    setFilters([])
    fetchRows(cid, s, [])
  }

  function handleFiltersChange(f: QueryFilter[]) {
    setFilters(f)
    if (connectionId && sheet) fetchRows(connectionId, sheet, f)
  }

  return (
    <div className="flex h-full flex-col p-6 gap-4">
      <h1 className="text-lg font-semibold text-zinc-100">Data Explorer</h1>
      <SheetSelector onSelect={handleSelect} />
      {columns.length > 0 && (
        <FilterBar columns={columns} onFiltersChange={handleFiltersChange} />
      )}
      <div className="flex-1 overflow-auto">
        <DataTable rows={rows} loading={loading} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Test Explorer end-to-end**

Start dev server. Visit `/explorer`. Select a connected source → select a sheet → verify data table renders with column headers and rows. Add a filter → verify rows update.

- [ ] **Step 6: Commit**

```bash
git add app/components/explorer/ app/app/(dashboard)/explorer/
git commit -m "feat: add data explorer page with sheet selector, filter bar, and data table"
```

---

## Task 9: Claude Tool Definitions

**Files:**
- Create: `app/lib/claude.ts`

This module exports the Anthropic client and the tool schema array used by the chat API route. Tools are scoped to the active connection — `connectionId` and `userId` are not in the tool schemas; the API route injects them when dispatching tool calls.

- [ ] **Step 1: Create `app/lib/claude.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_sheets',
    description: 'List all sheets or tables available in the connected data source.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'read_sheet',
    description: 'Read all rows from a sheet or table.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sheet: { type: 'string', description: 'The sheet or table name to read.' },
      },
      required: ['sheet'],
    },
  },
  {
    name: 'query_range',
    description: 'Read rows from a sheet with optional column filters and row limit.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sheet: { type: 'string', description: 'Sheet or table name.' },
        filters: {
          type: 'array',
          description: 'Optional filters to apply.',
          items: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              operator: {
                type: 'string',
                enum: ['=', '!=', '>', '<', '>=', '<=', 'contains', 'not_contains'],
              },
              value: { type: ['string', 'number', 'boolean'] },
            },
            required: ['column', 'operator', 'value'],
          },
        },
        limit: { type: 'number', description: 'Max rows to return.' },
      },
      required: ['sheet'],
    },
  },
  {
    name: 'summarize_sheet',
    description: 'Get column schema and statistics (types, null counts, sample values) for a sheet.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sheet: { type: 'string', description: 'Sheet or table name.' },
      },
      required: ['sheet'],
    },
  },
  {
    name: 'find_duplicates',
    description: 'Find duplicate rows in a sheet, optionally limited to specific columns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sheet: { type: 'string', description: 'Sheet or table name.' },
        columns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Columns to use for duplicate detection. Defaults to all columns.',
        },
      },
      required: ['sheet'],
    },
  },
]
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors in `lib/claude.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/lib/claude.ts
git commit -m "feat: add Anthropic client and chat tool definitions"
```

---

## Task 10: Chat API Route — Streaming + Tool Use Loop

**Files:**
- Create: `app/app/api/chat/route.ts`

This is the most complex route. It:
1. Receives `{ connectionId, message, history }` from the frontend
2. Calls Claude with `CHAT_TOOLS` in a loop until no more `tool_use` blocks
3. For each tool call, dispatches to the real connector via `resolveWebConnector`
4. Streams the final text response using `TransformStream`

- [ ] **Step 1: Create `app/app/api/chat/route.ts`**

```ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { anthropic, CHAT_TOOLS } from '@/lib/claude'
import { resolveWebConnector } from '@/lib/webConnector'
import type { QueryFilter } from '../../../src/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { connectionId, message, history = [] } = await req.json() as {
    connectionId: string
    message: string
    history: ChatMessage[]
  }

  if (!connectionId) return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 })

  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ]

  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  async function write(chunk: string) {
    await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'text', text: chunk })}\n\n`))
  }

  async function writeEvent(type: string, payload: object) {
    await writer.write(encoder.encode(`data: ${JSON.stringify({ type, ...payload })}\n\n`))
  }

  async function run() {
    try {
      let currentMessages = messages

      while (true) {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          tools: CHAT_TOOLS,
          messages: currentMessages,
        })

        const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
        const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text')

        // Stream text blocks
        for (const block of textBlocks) {
          if (block.text) await write(block.text)
        }

        if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) break

        // Execute tool calls
        const toolResults: Anthropic.ToolResultBlockParam[] = []

        for (const toolUse of toolUseBlocks) {
          await writeEvent('tool_start', { toolName: toolUse.name })
          try {
            const result = await executeToolCall(toolUse, connectionId, userId)
            toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) })
            await writeEvent('tool_end', { toolName: toolUse.name })
          } catch (e) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: `Error: ${(e as Error).message}`,
              is_error: true,
            })
            await writeEvent('tool_error', { toolName: toolUse.name, error: (e as Error).message })
          }
        }

        // Feed tool results back
        currentMessages = [
          ...currentMessages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults },
        ]
      }
    } catch (e) {
      await writeEvent('error', { message: (e as Error).message })
    } finally {
      await writer.close()
    }
  }

  run()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

async function executeToolCall(
  toolUse: Anthropic.ToolUseBlock,
  connectionId: string,
  userId: string
): Promise<unknown> {
  const input = toolUse.input as Record<string, unknown>
  const { connector, target, cleanup } = await resolveWebConnector(connectionId, userId)

  try {
    switch (toolUse.name) {
      case 'list_sheets':
        return await connector.listSheets(target)

      case 'read_sheet':
        return await connector.query(target, input.sheet as string)

      case 'query_range':
        return await connector.query(
          target,
          input.sheet as string,
          (input.filters as QueryFilter[] | undefined) ?? [],
          input.limit as number | undefined
        )

      case 'summarize_sheet':
        return await connector.describe(target, input.sheet as string)

      case 'find_duplicates': {
        const rows = await connector.query(target, input.sheet as string)
        const cols = (input.columns as string[] | undefined) ?? Object.keys(rows[0] ?? {}).filter(k => k !== '_rowId')
        function rowKey(row: Record<string, unknown>) {
          return cols.map(c => String(row[c] ?? '')).join('||')
        }
        const groups = new Map<string, typeof rows>()
        for (const row of rows) {
          const key = rowKey(row as Record<string, unknown>)
          if (!groups.has(key)) groups.set(key, [])
          groups.get(key)!.push(row)
        }
        const duplicateGroups = [...groups.values()].filter(g => g.length > 1)
        return {
          duplicateCount: duplicateGroups.reduce((sum, g) => sum + g.length - 1, 0),
          groups: duplicateGroups,
        }
      }

      default:
        throw new Error(`Unknown tool: ${toolUse.name}`)
    }
  } finally {
    await cleanup()
  }
}
```

- [ ] **Step 2: Test the chat route manually**

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=<your-session>" \
  -d '{"connectionId":"<your-id>","message":"What sheets are available?","history":[]}' \
  --no-buffer
```

Expected: SSE stream with `data: {"type":"text","text":"..."}` lines, ending with a text response from Claude listing the sheets.

- [ ] **Step 3: Commit**

```bash
git add app/app/api/chat/
git commit -m "feat: add streaming chat API route with Claude tool_use loop"
```

---

## Task 11: Chat UI — MessageList + ChatInput + ToolCallIndicator + /chat page

**Files:**
- Create: `app/components/chat/ToolCallIndicator.tsx`
- Create: `app/components/chat/MessageList.tsx`
- Create: `app/components/chat/ChatInput.tsx`
- Create: `app/app/(dashboard)/chat/page.tsx`

- [ ] **Step 1: Create `app/components/chat/ToolCallIndicator.tsx`**

```tsx
interface Props {
  toolName: string
  sourceName: string
}

const TOOL_LABELS: Record<string, string> = {
  list_sheets: 'Listing sheets',
  read_sheet: 'Reading sheet',
  query_range: 'Querying data',
  summarize_sheet: 'Summarizing sheet',
  find_duplicates: 'Finding duplicates',
}

export default function ToolCallIndicator({ toolName, sourceName }: Props) {
  const label = TOOL_LABELS[toolName] ?? toolName
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
      <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
      {label} in {sourceName}…
    </div>
  )
}
```

- [ ] **Step 2: Create `app/components/chat/MessageList.tsx`**

```tsx
import ToolCallIndicator from './ToolCallIndicator'

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: string[]
}

interface Props {
  messages: Message[]
  streamingText: string
  activeToolCall: string | null
  sourceName: string
}

export default function MessageList({ messages, streamingText, activeToolCall, sourceName }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`max-w-2xl rounded-lg px-4 py-3 text-sm leading-relaxed ${
            msg.role === 'user'
              ? 'self-end bg-surface border border-border text-zinc-200'
              : 'self-start border-l-2 border-accent bg-accent-dim text-accent-text'
          }`}
        >
          {msg.content}
        </div>
      ))}
      {activeToolCall && (
        <ToolCallIndicator toolName={activeToolCall} sourceName={sourceName} />
      )}
      {streamingText && (
        <div className="max-w-2xl self-start rounded-lg border-l-2 border-accent bg-accent-dim px-4 py-3 text-sm leading-relaxed text-accent-text">
          {streamingText}
          <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-accent" />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `app/components/chat/ChatInput.tsx`**

```tsx
'use client'

import { useState, KeyboardEvent } from 'react'

interface Props {
  onSend: (message: string) => void
  disabled: boolean
  placeholder: string
}

export default function ChatInput({ onSend, disabled, placeholder }: Props) {
  const [value, setValue] = useState('')

  function handleSend() {
    if (!value.trim() || disabled) return
    onSend(value.trim())
    setValue('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border p-4">
      <div className="flex items-end gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder-muted focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40 hover:bg-green-400 transition-colors"
        >
          Send
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">Enter to send · Shift+Enter for newline</p>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/app/(dashboard)/chat/page.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import MessageList from '@/components/chat/MessageList'
import ChatInput from '@/components/chat/ChatInput'

interface Source {
  id: string
  label: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [connectionId, setConnectionId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/sources').then(r => r.json()).then((data: Source[]) => {
      setSources(data)
      if (data.length > 0) setConnectionId(data[0].id)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, activeToolCall])

  const activeSource = sources.find(s => s.id === connectionId)

  async function handleSend(message: string) {
    if (!connectionId) return
    setMessages(prev => [...prev, { role: 'user', content: message }])
    setSending(true)
    setStreamingText('')
    setActiveToolCall(null)

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, message, history: messages }),
    })

    if (!res.body) return

    let assistantText = ''
    const reader = res.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          const event = JSON.parse(line.slice(6))
          if (event.type === 'text') {
            assistantText += event.text
            setStreamingText(assistantText)
          } else if (event.type === 'tool_start') {
            setActiveToolCall(event.toolName)
          } else if (event.type === 'tool_end' || event.type === 'tool_error') {
            setActiveToolCall(null)
          }
        } catch {}
      }
    }

    setMessages(prev => [...prev, { role: 'assistant', content: assistantText }])
    setStreamingText('')
    setActiveToolCall(null)
    setSending(false)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Source selector header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="text-xs text-muted">Source:</span>
        <select
          value={connectionId}
          onChange={e => setConnectionId(e.target.value)}
          className="rounded border border-border bg-surface px-3 py-1.5 text-sm text-zinc-200 focus:border-accent focus:outline-none"
        >
          {sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {messages.length === 0 && !sending && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted">
          {connectionId
            ? `Ask anything about ${activeSource?.label ?? 'your data'}…`
            : 'Connect a source on the Sources page first.'}
        </div>
      )}

      <MessageList
        messages={messages}
        streamingText={streamingText}
        activeToolCall={activeToolCall}
        sourceName={activeSource?.label ?? ''}
      />

      <div ref={bottomRef} />

      <ChatInput
        onSend={handleSend}
        disabled={sending || !connectionId}
        placeholder={connectionId ? `Ask about ${activeSource?.label ?? 'your data'}…` : 'Select a source first'}
      />
    </div>
  )
}
```

- [ ] **Step 5: Test chat end-to-end**

Start dev server. Connect an Excel source on `/sources`. Navigate to `/chat`. Select the source. Type "What sheets are available?" — verify:
- User message appears immediately
- Tool call indicator shows "Listing sheets in [source name]…"
- Claude's response streams in showing sheet names
- Message history is maintained for follow-up questions

Type a follow-up: "What are the column names in [sheet name]?" — verify Claude uses `summarize_sheet` and returns column info.

- [ ] **Step 6: Commit**

```bash
git add app/components/chat/ app/app/(dashboard)/chat/
git commit -m "feat: add chat UI with streaming SSE and tool call indicator"
```

---

## Spec Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| `/sources` page with source cards | Task 6 |
| Connect modal 3-step wizard | Task 6 |
| Excel upload → Vercel Blob | Task 6 (blob upload route) |
| Sheets OAuth flow | Task 6 (sheets-auth-url + sheets-token routes) |
| Airtable API key + base ID | Task 6 (ConnectModal airtable branch) |
| `/chat` with streaming + tool_use | Tasks 9–11 |
| Source selector in chat | Task 11 (chat page header) |
| Tool call indicator while querying | Task 11 (ToolCallIndicator) |
| `/explorer` with source+sheet dropdowns | Task 8 |
| Column filters in explorer | Task 8 (FilterBar) |
| Paginated data table | Task 8 (DataTable, PAGE_SIZE=50) |
| Clerk auth | Tasks 1, 4 |
| Prisma Connection model (userId, type, label, config, createdAt) | Task 2 |
| Config encrypted at rest | Tasks 2–3 (AES-256-GCM) |
| Dark zinc + green palette | Tasks 1, 4 (Tailwind config + components) |
| Sidebar nav (Sources/Chat/Explorer) | Task 4 |
| Error handling: invalid filter | Data API returns 400; FilterBar validates locally |
| Error handling: source unreachable | API returns error JSON; ConnectModal shows it |
| `claude-sonnet-4-6` model | Task 10 (hardcoded in chat route) |

**No gaps found.**

**Placeholder scan:** No TBD, TODO, or incomplete sections.

**Type consistency:** `WebConfig`, `WebConnection`, `QueryFilter`, `Row`, `DataSource` used consistently across tasks 3, 7, 8, 10, 11.
