import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { resolveWebConnector } from '@/lib/webConnector'
import type { QueryFilter } from '../../../../src/types'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = req.nextUrl.searchParams
    const connectionId = params.get('connectionId')
    const sheet = params.get('sheet')

    if (!connectionId || !sheet) {
      return NextResponse.json({ error: 'Missing connectionId or sheet' }, { status: 400 })
    }

    const filtersParam = params.get('filters')
    const limitParam = params.get('limit')

    let filters: QueryFilter[] = []
    if (filtersParam) {
      try {
        filters = JSON.parse(filtersParam)
      } catch {
        return NextResponse.json({ error: 'Invalid filters JSON' }, { status: 400 })
      }
    }

    const limit = limitParam ? parseInt(limitParam, 10) : undefined
    if (limit !== undefined && (isNaN(limit) || limit < 1)) {
      return NextResponse.json({ error: 'limit must be a positive integer' }, { status: 400 })
    }

    const { connector, target, cleanup } = await resolveWebConnector(connectionId, userId)
    try {
      const rows = await connector.query(target, sheet, filters, limit)
      return NextResponse.json(rows)
    } finally {
      await cleanup()
    }
  } catch (e) {
    const message = (e as Error).message
    if (message.includes('not found')) return NextResponse.json({ error: message }, { status: 404 })
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
