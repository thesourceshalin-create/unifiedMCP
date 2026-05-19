import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleListSheets, handleCreateSheet, handleRenameSheet, handleDuplicateSheet } from '../../../src/tools/management.js'

vi.mock('../../../src/router.js', () => ({ resolveConnector: vi.fn() }))
import { resolveConnector } from '../../../src/router.js'

const mockConnector = {
  listSheets: vi.fn().mockResolvedValue(['Sheet1', 'Sheet2']),
  createSheet: vi.fn().mockResolvedValue(undefined),
  renameSheet: vi.fn().mockResolvedValue(undefined),
  duplicateSheet: vi.fn().mockResolvedValue(undefined),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(resolveConnector).mockResolvedValue({ connector: mockConnector as any, target: '/t.xlsx' })
})

describe('handleListSheets', () => {
  it('returns sheet names as JSON', async () => {
    const result = await handleListSheets({ source: 'excel', target: 'my-conn' })
    expect(result.isError).toBeFalsy()
    expect(JSON.parse(result.content[0].text)).toEqual(['Sheet1', 'Sheet2'])
  })
})

describe('handleCreateSheet', () => {
  it('calls createSheet on connector and returns name', async () => {
    const result = await handleCreateSheet({ source: 'excel', target: 'my-conn', name: 'NewSheet' })
    expect(mockConnector.createSheet).toHaveBeenCalledWith('/t.xlsx', 'NewSheet')
    expect(JSON.parse(result.content[0].text).created).toBe('NewSheet')
  })
})

describe('handleRenameSheet', () => {
  it('calls renameSheet on connector', async () => {
    await handleRenameSheet({ source: 'excel', target: 'my-conn', oldName: 'Sheet1', newName: 'Renamed' })
    expect(mockConnector.renameSheet).toHaveBeenCalledWith('/t.xlsx', 'Sheet1', 'Renamed')
  })
})

describe('handleDuplicateSheet', () => {
  it('calls duplicateSheet on connector', async () => {
    await handleDuplicateSheet({ source: 'excel', target: 'my-conn', name: 'Sheet1', newName: 'Copy' })
    expect(mockConnector.duplicateSheet).toHaveBeenCalledWith('/t.xlsx', 'Sheet1', 'Copy')
  })
})
