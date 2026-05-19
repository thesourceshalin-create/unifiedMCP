import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleReadSheet, handleAppendRow, handleUpdateCell, handleDeleteRow, handleQueryRange } from '../../../src/tools/core.js'

vi.mock('../../../src/router.js', () => ({
  resolveConnector: vi.fn(),
}))

import { resolveConnector } from '../../../src/router.js'

const mockConnector = {
  listSheets: vi.fn(),
  describe: vi.fn(),
  query: vi.fn().mockResolvedValue([
    { _rowId: '2', Name: 'Alice', Revenue: 1200 },
    { _rowId: '3', Name: 'Bob', Revenue: 800 },
  ]),
  insert: vi.fn().mockResolvedValue(undefined),
  updateCell: vi.fn().mockResolvedValue(undefined),
  deleteRow: vi.fn().mockResolvedValue(undefined),
  createSheet: vi.fn(),
  renameSheet: vi.fn(),
  duplicateSheet: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(resolveConnector).mockResolvedValue({ connector: mockConnector as any, target: '/tmp/t.xlsx' })
})

describe('handleReadSheet', () => {
  it('returns rows as JSON', async () => {
    const result = await handleReadSheet({ source: 'excel', target: 'my-conn', sheet: 'Sales' })
    expect(result.isError).toBeFalsy()
    const rows = JSON.parse(result.content[0].text)
    expect(rows).toHaveLength(2)
    expect(rows[0].Name).toBe('Alice')
  })
})

describe('handleQueryRange', () => {
  it('passes filters to connector', async () => {
    await handleQueryRange({
      source: 'excel',
      target: 'my-conn',
      sheet: 'Sales',
      filters: [{ column: 'Revenue', operator: '>', value: 1000 }],
    })
    expect(mockConnector.query).toHaveBeenCalledWith(
      '/tmp/t.xlsx',
      'Sales',
      [{ column: 'Revenue', operator: '>', value: 1000 }],
      undefined
    )
  })

  it('passes limit to connector', async () => {
    await handleQueryRange({ source: 'excel', target: 'my-conn', sheet: 'Sales', limit: 5 })
    expect(mockConnector.query).toHaveBeenCalledWith('/tmp/t.xlsx', 'Sales', [], 5)
  })
})

describe('handleAppendRow', () => {
  it('calls insert on connector', async () => {
    await handleAppendRow({
      source: 'excel',
      target: 'my-conn',
      sheet: 'Sales',
      rows: [{ Name: 'Carol', Revenue: 1500 }],
    })
    expect(mockConnector.insert).toHaveBeenCalledWith('/tmp/t.xlsx', 'Sales', [{ Name: 'Carol', Revenue: 1500 }])
  })

  it('returns inserted count', async () => {
    const result = await handleAppendRow({
      source: 'excel', target: 'my-conn', sheet: 'Sales',
      rows: [{ Name: 'A' }, { Name: 'B' }],
    })
    expect(JSON.parse(result.content[0].text).inserted).toBe(2)
  })
})

describe('handleUpdateCell', () => {
  it('calls updateCell on connector', async () => {
    await handleUpdateCell({
      source: 'excel', target: 'my-conn', sheet: 'Sales',
      rowId: '2', column: 'Revenue', value: 9999,
    })
    expect(mockConnector.updateCell).toHaveBeenCalledWith('/tmp/t.xlsx', 'Sales', '2', 'Revenue', 9999)
  })
})

describe('handleDeleteRow', () => {
  it('calls deleteRow on connector', async () => {
    await handleDeleteRow({ source: 'excel', target: 'my-conn', sheet: 'Sales', rowId: '2' })
    expect(mockConnector.deleteRow).toHaveBeenCalledWith('/tmp/t.xlsx', 'Sales', '2')
  })
})
