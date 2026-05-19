import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleSummarizeSheet, handleCompareRanges, handleFindDuplicates } from '../../../src/tools/analytics.js'

vi.mock('../../../src/router.js', () => ({ resolveConnector: vi.fn() }))
import { resolveConnector } from '../../../src/router.js'

const rows = [
  { _rowId: '2', Name: 'Alice', Revenue: 1200, Active: true },
  { _rowId: '3', Name: 'Bob', Revenue: 800, Active: false },
  { _rowId: '4', Name: 'Alice', Revenue: 1200, Active: true },
]

const mockConnector = {
  describe: vi.fn().mockResolvedValue({
    name: 'Sales', rowCount: 3,
    columns: [{ name: 'Name', type: 'string', nullCount: 0, sampleValues: ['Alice'] }],
  }),
  query: vi.fn().mockResolvedValue(rows),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(resolveConnector).mockResolvedValue({ connector: mockConnector as any, target: '/t.xlsx' })
})

describe('handleSummarizeSheet', () => {
  it('returns schema with stats', async () => {
    const result = await handleSummarizeSheet({ source: 'excel', target: 'my-conn', sheet: 'Sales' })
    expect(result.isError).toBeFalsy()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.rowCount).toBe(3)
    expect(parsed.columns[0].name).toBe('Name')
  })
})

describe('handleFindDuplicates', () => {
  it('finds duplicate rows across specified columns', async () => {
    const result = await handleFindDuplicates({
      source: 'excel', target: 'my-conn', sheet: 'Sales',
      columns: ['Name', 'Revenue'],
    })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.duplicateCount).toBe(1)
    expect(parsed.groups).toHaveLength(1)
  })

  it('uses all non-_rowId columns when columns param omitted', async () => {
    const result = await handleFindDuplicates({ source: 'excel', target: 'my-conn', sheet: 'Sales' })
    expect(result.isError).toBeFalsy()
  })
})

describe('handleCompareRanges', () => {
  it('returns diff between two identical ranges as no differences', async () => {
    const result = await handleCompareRanges({
      rangeA: { source: 'excel', target: 'my-conn', sheet: 'Sales' },
      rangeB: { source: 'excel', target: 'my-conn', sheet: 'Sales' },
    })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.onlyInA).toHaveLength(0)
    expect(parsed.onlyInB).toHaveLength(0)
  })

  it('returns rows only in A when B is empty', async () => {
    vi.mocked(resolveConnector)
      .mockResolvedValueOnce({ connector: mockConnector as any, target: '/t.xlsx' })
      .mockResolvedValueOnce({ connector: { ...mockConnector, query: vi.fn().mockResolvedValue([]) } as any, target: '/t.xlsx' })

    const result = await handleCompareRanges({
      rangeA: { source: 'excel', target: 'conn-a', sheet: 'Sales' },
      rangeB: { source: 'excel', target: 'conn-b', sheet: 'Sales' },
    })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.onlyInA.length).toBeGreaterThan(0)
    expect(parsed.onlyInB).toHaveLength(0)
  })
})
