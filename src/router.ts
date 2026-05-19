import { ExcelConnector } from './connectors/excel.js'
import { SheetsConnector } from './connectors/sheets.js'
import { AirtableConnector } from './connectors/airtable.js'
import { findConnection } from './connections.js'
import type { DataSource, SourceType, ExcelConfig, SheetsConfig, AirtableConfig } from './types.js'

const connectors: Record<SourceType, DataSource> = {
  excel: new ExcelConnector(),
  sheets: new SheetsConnector(),
  airtable: new AirtableConnector(),
}

export function getConnector(source: SourceType): DataSource {
  return connectors[source]
}

// Resolves a connection ID to its connector and resolved target.
// For Excel: target = file path string.
// For Sheets/Airtable: target = full config object (with API credentials).
export async function resolveConnector(
  source: SourceType,
  connectionId: string
): Promise<{ connector: DataSource; target: unknown }> {
  const connection = await findConnection(connectionId)
  if (!connection) {
    throw new Error(`Connection "${connectionId}" not found. Register it first with connect_source.`)
  }
  let target: unknown
  if (source === 'excel') {
    target = (connection.config as ExcelConfig).filePath
  } else {
    target = connection.config as SheetsConfig | AirtableConfig
  }
  return { connector: connectors[source], target }
}
