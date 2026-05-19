import { promises as fs } from 'fs'
import path from 'path'
import { saveConnection, removeConnection, loadConnections } from '../connections.js'
import type { Connection, McpToolResult } from '../types.js'

function ok(text: string): McpToolResult {
  return { content: [{ type: 'text', text }] }
}

function err(text: string): McpToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}

function redact(conn: Connection): Record<string, unknown> {
  const config = { ...(conn.config as Record<string, unknown>) }
  delete config['apiKey']
  delete config['refreshToken']
  delete config['clientSecret']
  return { id: conn.id, type: conn.type, label: conn.label, config }
}

export async function handleConnectSource(params: Record<string, unknown>): Promise<McpToolResult> {
  const { source, id, label } = params as { source: string; id: string; label: string }

  try {
    let connection: Connection

    if (source === 'excel') {
      const filePath = params.filePath as string
      if (!filePath) return err('filePath is required for Excel connections')
      const resolved = path.resolve(filePath)
      if (!resolved.toLowerCase().endsWith('.xlsx')) {
        return err('Excel connections require a .xlsx file path')
      }
      try {
        await fs.access(resolved)
      } catch {
        return err(`File not found: ${resolved}`)
      }
      connection = { id, type: 'excel', label, config: { filePath: resolved } }

    } else if (source === 'airtable') {
      const { apiKey, baseId } = params as { apiKey: string; baseId: string }
      const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!res.ok) return err(`Airtable validation failed: HTTP ${res.status}`)
      connection = { id, type: 'airtable', label, config: { baseId, apiKey } }

    } else if (source === 'sheets') {
      const clientId = process.env.GOOGLE_CLIENT_ID
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET
      const spreadsheetId = params.spreadsheetId as string
      if (!clientId || !clientSecret) {
        return err('Google Sheets auth requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables. Set them and try again.')
      }
      if (!spreadsheetId) {
        return err('spreadsheetId is required for Google Sheets connections')
      }
      // Return OAuth URL for user to complete auth
      const { google } = await import('googleapis')
      const oauth2 = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:8080/callback')
      const authUrl = oauth2.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/spreadsheets'],
      })
      return ok(`To connect Google Sheets, open this URL in your browser:\n${authUrl}\n\nAfter authorising, call connect_source again with source="sheets_callback" and the authorization code.`)

    } else {
      return err(`Unknown source type: ${source}. Must be 'excel', 'sheets', or 'airtable'.`)
    }

    await saveConnection(connection)
    return ok(`Connected "${label}" (${source}) with id "${id}"`)
  } catch (e) {
    return err(`Failed to connect: ${(e as Error).message}`)
  }
}

export async function handleListConnectedSources(): Promise<McpToolResult> {
  const connections = await loadConnections()
  const safe = connections.map(redact)
  return ok(JSON.stringify(safe, null, 2))
}

export async function handleDisconnectSource(params: Record<string, unknown>): Promise<McpToolResult> {
  const { id } = params as { id: string }
  await removeConnection(id)
  return ok(`Disconnected "${id}"`)
}
