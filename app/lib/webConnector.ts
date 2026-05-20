import { writeFile, mkdir, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
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
    const tmpPath = join(dir, `${connectionId}-${randomUUID()}.xlsx`)
    await writeFile(tmpPath, buf)
    return {
      connector: connectorMap.excel,
      target: tmpPath,
      cleanup: async () => { try { await unlink(tmpPath) } catch (e) { console.error('cleanup failed', e) } },
    }
  }

  if (config.type === 'sheets') {
    const { spreadsheetId, refreshToken, clientId, clientSecret } = config
    return {
      connector: connectorMap.sheets,
      target: { spreadsheetId, refreshToken, clientId, clientSecret },
      cleanup: async () => {},
    }
  }

  if (config.type === 'airtable') {
    const { baseId, apiKey } = config
    return {
      connector: connectorMap.airtable,
      target: { baseId, apiKey },
      cleanup: async () => {},
    }
  }

  throw new Error(`Unknown connection type: ${(config as { type: string }).type}`)
}
