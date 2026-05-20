import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { listConnections, createConnection } from '@/lib/connections'
import type { WebConfig } from '@/lib/connections'

const VALID_TYPES = ['excel', 'sheets', 'airtable'] as const

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const connections = await listConnections(userId)
    const safe = connections.map(c => ({
      id: c.id,
      type: c.type,
      label: c.label,
      createdAt: c.createdAt,
    }))
    return NextResponse.json(safe)
  } catch (e) {
    console.error('[GET /api/sources]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: { type?: unknown; label?: unknown; config?: unknown }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { type, label, config } = body as { type: string; label: string; config: WebConfig }

    if (!type || !label || !config) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 })
    }

    const conn = await createConnection(userId, type, label, config)
    return NextResponse.json({ id: conn.id, type: conn.type, label: conn.label, createdAt: conn.createdAt }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
