import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { deleteConnection, getConnection } from '@/lib/connections'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await getConnection(params.id, userId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await deleteConnection(params.id, userId)
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
