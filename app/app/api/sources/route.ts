import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { listConnections, createConnection } from '@/lib/connections'
import type { WebConfig } from '@/lib/connections'

export async function GET() {
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
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { type: string; label: string; config: WebConfig }
  const { type, label, config } = body

  if (!type || !label || !config) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const conn = await createConnection(userId, type, label, config)
  return NextResponse.json({ id: conn.id, type: conn.type, label: conn.label, createdAt: conn.createdAt }, { status: 201 })
}
