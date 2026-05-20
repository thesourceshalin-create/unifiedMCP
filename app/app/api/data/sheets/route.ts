import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { resolveWebConnector } from '@/lib/webConnector'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const connectionId = req.nextUrl.searchParams.get('connectionId')
    if (!connectionId) return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 })

    const { connector, target, cleanup } = await resolveWebConnector(connectionId, userId)
    try {
      const sheets = await connector.listSheets(target)
      return NextResponse.json(sheets)
    } finally {
      await cleanup()
    }
  } catch (e) {
    const message = (e as Error).message
    if (message.includes('not found')) return NextResponse.json({ error: message }, { status: 404 })
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
