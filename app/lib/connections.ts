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
