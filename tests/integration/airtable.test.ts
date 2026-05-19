// Requires env vars: AIRTABLE_API_KEY, AIRTABLE_BASE_ID
import { describe, it, expect } from 'vitest'
import { AirtableConnector } from '../../src/connectors/airtable.js'
import type { AirtableConfig } from '../../src/types.js'

const skip = !process.env.RUN_INTEGRATION ||
  !process.env.AIRTABLE_API_KEY ||
  !process.env.AIRTABLE_BASE_ID
const connector = new AirtableConnector()

const config: AirtableConfig = {
  apiKey: process.env.AIRTABLE_API_KEY ?? '',
  baseId: process.env.AIRTABLE_BASE_ID ?? '',
}

describe.skipIf(skip)('Airtable integration', () => {
  it('lists tables', async () => {
    const tables = await connector.listSheets(config)
    expect(tables.length).toBeGreaterThan(0)
  }, 15000)

  it('queries records from first table', async () => {
    const tables = await connector.listSheets(config)
    const rows = await connector.query(config, tables[0])
    expect(Array.isArray(rows)).toBe(true)
  }, 15000)
})
