import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { saveConnection, removeConnection, loadConnections } from '../../src/connections.js'
import { handleReadSheet, handleAppendRow, handleQueryRange } from '../../src/tools/core.js'
import { handleSummarizeSheet } from '../../src/tools/analytics.js'
import { handleListSheets } from '../../src/tools/management.js'
import { handleBulkUpdate } from '../../src/tools/automation.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_DIR = path.join(os.tmpdir(), 'e2e-test-' + Date.now())
const FIXTURE = path.resolve(__dirname, '../../fixtures/test.xlsx')
const CONN_ID = 'e2e-excel'
let tempFile: string

beforeAll(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true })
  process.env.UNIFIED_MCP_DIR = TEST_DIR
  tempFile = path.join(TEST_DIR, 'e2e.xlsx')
  await fs.copyFile(FIXTURE, tempFile)
  // Register the connection so resolveConnector can find it
  await saveConnection({
    id: CONN_ID,
    type: 'excel',
    label: 'E2E Excel',
    config: { filePath: tempFile },
  })
})

afterAll(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true })
  delete process.env.UNIFIED_MCP_DIR
})

describe('Full Excel agent workflow', () => {
  it('list_sheets: returns sheet names', async () => {
    const result = await handleListSheets({ source: 'excel', target: CONN_ID })
    const sheets = JSON.parse(result.content[0].text)
    expect(sheets).toContain('Sales')
    expect(sheets).toContain('Inventory')
  })

  it('summarize_sheet: returns schema with correct row count and columns', async () => {
    const result = await handleSummarizeSheet({ source: 'excel', target: CONN_ID, sheet: 'Sales' })
    const schema = JSON.parse(result.content[0].text)
    expect(schema.rowCount).toBe(3)
    expect(schema.columns.map((c: { name: string }) => c.name)).toContain('Revenue')
  })

  it('query_range: filters rows by Revenue > 1000', async () => {
    const result = await handleQueryRange({
      source: 'excel', target: CONN_ID, sheet: 'Sales',
      filters: [{ column: 'Revenue', operator: '>', value: 1000 }],
    })
    const rows = JSON.parse(result.content[0].text)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r: { Revenue: number }) => r.Revenue > 1000)).toBe(true)
  })

  it('append_row: adds a new row', async () => {
    const result = await handleAppendRow({
      source: 'excel', target: CONN_ID, sheet: 'Sales',
      rows: [{ Name: 'Dave', Revenue: 2000, Active: true }],
    })
    expect(JSON.parse(result.content[0].text).inserted).toBe(1)

    const all = await handleReadSheet({ source: 'excel', target: CONN_ID, sheet: 'Sales' })
    expect(JSON.parse(all.content[0].text)).toHaveLength(4)
  })

  it('bulk_update: updates matching rows', async () => {
    const result = await handleBulkUpdate({
      source: 'excel', target: CONN_ID, sheet: 'Sales',
      filters: [{ column: 'Name', operator: '=', value: 'Dave' }],
      updates: { Revenue: 9999 },
    })
    expect(JSON.parse(result.content[0].text).updatedCount).toBe(1)

    const check = await handleQueryRange({
      source: 'excel', target: CONN_ID, sheet: 'Sales',
      filters: [{ column: 'Name', operator: '=', value: 'Dave' }],
    })
    expect(JSON.parse(check.content[0].text)[0].Revenue).toBe(9999)
  })

  it('disconnect: removes connection', async () => {
    await removeConnection(CONN_ID)
    const conns = await loadConnections()
    expect(conns.find(c => c.id === CONN_ID)).toBeUndefined()
  })
})
