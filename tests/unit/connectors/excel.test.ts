import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import { fileURLToPath } from 'url'
import { promises as fs } from 'fs'
import os from 'os'
import { ExcelConnector } from '../../../src/connectors/excel.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(__dirname, '../../../fixtures/test.xlsx')

const connector = new ExcelConnector()

describe('ExcelConnector.listSheets', () => {
  it('returns sheet names', async () => {
    const sheets = await connector.listSheets(FIXTURE)
    expect(sheets).toEqual(['Sales', 'Inventory'])
  })
})

describe('ExcelConnector.describe', () => {
  it('returns schema for a sheet', async () => {
    const schema = await connector.describe(FIXTURE, 'Sales')
    expect(schema.name).toBe('Sales')
    expect(schema.rowCount).toBe(3)
    expect(schema.columns.map(c => c.name)).toEqual(['Name', 'Revenue', 'Active'])
  })
})

describe('ExcelConnector.query', () => {
  it('returns all rows when no filter', async () => {
    const rows = await connector.query(FIXTURE, 'Sales')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ _rowId: '2', Name: 'Alice', Revenue: 1200 })
  })

  it('filters rows by equality', async () => {
    const rows = await connector.query(FIXTURE, 'Sales', [
      { column: 'Active', operator: '=', value: true },
    ])
    expect(rows).toHaveLength(2)
    expect(rows.map(r => r.Name)).toEqual(['Alice', 'Carol'])
  })

  it('filters rows by numeric comparison', async () => {
    const rows = await connector.query(FIXTURE, 'Sales', [
      { column: 'Revenue', operator: '>', value: 1000 },
    ])
    expect(rows).toHaveLength(2)
  })

  it('respects limit param', async () => {
    const rows = await connector.query(FIXTURE, 'Sales', [], 1)
    expect(rows).toHaveLength(1)
  })
})

describe('ExcelConnector write operations', () => {
  let tempFile: string

  beforeEach(async () => {
    tempFile = path.join(os.tmpdir(), `unified-mcp-test-${Date.now()}.xlsx`)
    await fs.copyFile(FIXTURE, tempFile)
  })

  afterEach(async () => {
    await fs.rm(tempFile, { force: true })
  })

  it('insert appends rows', async () => {
    await connector.insert(tempFile, 'Sales', [{ Name: 'Dave', Revenue: 2000, Active: true }])
    const rows = await connector.query(tempFile, 'Sales')
    expect(rows).toHaveLength(4)
    expect(rows[3]).toMatchObject({ Name: 'Dave', Revenue: 2000 })
  })

  it('updateCell changes a cell value', async () => {
    const before = await connector.query(tempFile, 'Sales')
    const rowId = before[0]._rowId
    await connector.updateCell(tempFile, 'Sales', rowId, 'Revenue', 9999)
    const after = await connector.query(tempFile, 'Sales')
    expect(after[0].Revenue).toBe(9999)
  })

  it('deleteRow removes a row', async () => {
    const before = await connector.query(tempFile, 'Sales')
    await connector.deleteRow(tempFile, 'Sales', before[0]._rowId)
    const after = await connector.query(tempFile, 'Sales')
    expect(after).toHaveLength(2)
    expect(after.map(r => r.Name)).not.toContain('Alice')
  })

  it('createSheet adds a new sheet', async () => {
    await connector.createSheet(tempFile, 'NewSheet')
    const sheets = await connector.listSheets(tempFile)
    expect(sheets).toContain('NewSheet')
  })

  it('renameSheet renames a sheet', async () => {
    await connector.renameSheet(tempFile, 'Sales', 'Revenue')
    const sheets = await connector.listSheets(tempFile)
    expect(sheets).toContain('Revenue')
    expect(sheets).not.toContain('Sales')
  })

  it('duplicateSheet copies a sheet', async () => {
    await connector.duplicateSheet(tempFile, 'Sales', 'SalesCopy')
    const sheets = await connector.listSheets(tempFile)
    expect(sheets).toContain('SalesCopy')
    const rows = await connector.query(tempFile, 'SalesCopy')
    expect(rows).toHaveLength(3)
  })
})
