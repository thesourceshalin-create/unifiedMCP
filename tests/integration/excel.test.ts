import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { ExcelConnector } from '../../src/connectors/excel.js'

const skip = !process.env.RUN_INTEGRATION
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(__dirname, '../../fixtures/test.xlsx')
const connector = new ExcelConnector()
let tempFile: string

beforeAll(async () => {
  tempFile = path.join(os.tmpdir(), `excel-int-${Date.now()}.xlsx`)
  await fs.copyFile(FIXTURE, tempFile)
})

afterAll(async () => {
  await fs.rm(tempFile, { force: true })
})

describe.skipIf(skip)('Excel integration — full CRUD', () => {
  it('lists sheets', async () => {
    const sheets = await connector.listSheets(tempFile)
    expect(sheets).toContain('Sales')
  })

  it('inserts, queries, updates, and deletes a row', async () => {
    await connector.insert(tempFile, 'Sales', [{ Name: 'IntTest', Revenue: 9001, Active: true }])

    const rows = await connector.query(tempFile, 'Sales', [
      { column: 'Name', operator: '=', value: 'IntTest' },
    ])
    expect(rows).toHaveLength(1)

    await connector.updateCell(tempFile, 'Sales', rows[0]._rowId, 'Revenue', 1)
    const updated = await connector.query(tempFile, 'Sales', [
      { column: 'Name', operator: '=', value: 'IntTest' },
    ])
    expect(updated[0].Revenue).toBe(1)

    await connector.deleteRow(tempFile, 'Sales', rows[0]._rowId)
    const after = await connector.query(tempFile, 'Sales', [
      { column: 'Name', operator: '=', value: 'IntTest' },
    ])
    expect(after).toHaveLength(0)
  })
})
