import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: { authCode?: string; spreadsheetId?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { authCode, spreadsheetId } = body
    if (!authCode || !spreadsheetId) {
      return NextResponse.json({ error: 'Missing authCode or spreadsheetId' }, { status: 400 })
    }

    const { google } = await import('googleapis')
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/sources/sheets-callback`
    )
    const { tokens } = await oauth2.getToken(authCode)
    if (!tokens.refresh_token) {
      return NextResponse.json(
        { error: 'No refresh_token returned. Try revoking access and re-authorising.' },
        { status: 400 }
      )
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
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
