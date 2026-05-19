// Requires env vars: GOOGLE_SPREADSHEET_ID, GOOGLE_REFRESH_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
import { describe, it, expect } from 'vitest'
import { SheetsConnector } from '../../src/connectors/sheets.js'
import type { SheetsConfig } from '../../src/types.js'

const skip = !process.env.RUN_INTEGRATION || !process.env.GOOGLE_SPREADSHEET_ID
const connector = new SheetsConnector()

const config: SheetsConfig = {
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID ?? '',
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? '',
  clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
}

describe.skipIf(skip)('Google Sheets integration', () => {
  it('lists sheets', async () => {
    const sheets = await connector.listSheets(config)
    expect(sheets.length).toBeGreaterThan(0)
  })

  it('queries rows from first sheet', async () => {
    const sheets = await connector.listSheets(config)
    const rows = await connector.query(config, sheets[0])
    expect(Array.isArray(rows)).toBe(true)
  })
})
