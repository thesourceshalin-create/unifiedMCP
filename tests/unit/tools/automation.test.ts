import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleBulkUpdate, handleScheduleSummary, handleSetAlert } from '../../../src/tools/automation.js'

vi.mock('../../../src/router.js', () => ({ resolveConnector: vi.fn() }))
vi.mock('../../../src/automation/scheduler.js', () => ({ addSchedule: vi.fn().mockResolvedValue('sched-1') }))
vi.mock('../../../src/automation/poller.js', () => ({ addAlert: vi.fn().mockResolvedValue('alert-1') }))

import { resolveConnector } from '../../../src/router.js'
import { addSchedule } from '../../../src/automation/scheduler.js'
import { addAlert } from '../../../src/automation/poller.js'

const rows = [
  { _rowId: '2', Name: 'Alice', Revenue: 1200, Active: true },
  { _rowId: '3', Name: 'Bob', Revenue: 800, Active: false },
]

const mockConnector = {
  query: vi.fn().mockImplementation((_target: string, _sheet: string, filters: any[]) => {
    if (!filters || filters.length === 0) return Promise.resolve(rows)
    return Promise.resolve(rows.filter(row =>
      filters.every((f: any) => {
        const cell = (row as any)[f.column]
        switch (f.operator) {
          case '=': return cell === f.value
          case '!=': return cell !== f.value
          default: return true
        }
      })
    ))
  }),
  updateCell: vi.fn().mockResolvedValue(undefined),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(resolveConnector).mockResolvedValue({ connector: mockConnector as any, target: '/t.xlsx' })
})

describe('handleBulkUpdate', () => {
  it('updates all rows matching filter', async () => {
    const result = await handleBulkUpdate({
      source: 'excel', target: 'my-conn', sheet: 'Sales',
      filters: [{ column: 'Active', operator: '=', value: false }],
      updates: { Active: true },
    })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.updatedCount).toBe(1)
  })

  it('calls updateCell for each matched row and each update column', async () => {
    await handleBulkUpdate({
      source: 'excel', target: 'my-conn', sheet: 'Sales',
      filters: [],
      updates: { Active: false },
    })
    expect(mockConnector.updateCell).toHaveBeenCalledTimes(2)
  })
})

describe('handleScheduleSummary', () => {
  it('calls addSchedule and returns schedule id', async () => {
    const result = await handleScheduleSummary({
      source: 'excel', target: 'my-conn', sheet: 'Sales',
      cron: '0 9 * * 1',
    })
    expect(addSchedule).toHaveBeenCalledWith({
      source: 'excel', target: 'my-conn', sheet: 'Sales', cron: '0 9 * * 1',
    })
    expect(JSON.parse(result.content[0].text).scheduleId).toBe('sched-1')
  })
})

describe('handleSetAlert', () => {
  it('calls addAlert and returns alert id', async () => {
    const result = await handleSetAlert({
      source: 'excel', target: 'my-conn', sheet: 'Sales',
      column: 'Revenue', condition: 'value > 1000',
    })
    expect(addAlert).toHaveBeenCalledWith({
      source: 'excel', target: 'my-conn', sheet: 'Sales',
      column: 'Revenue', condition: 'value > 1000',
      pollIntervalMs: undefined,
    })
    expect(JSON.parse(result.content[0].text).alertId).toBe('alert-1')
  })
})
