import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AirtableConnector } from '../../../src/connectors/airtable.js'

const FAKE_CONFIG = { baseId: 'appABC', apiKey: 'patXYZ' }

global.fetch = vi.fn()

function mockFetch(data: unknown) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response)
}

const connector = new AirtableConnector()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AirtableConnector.listSheets', () => {
  it('returns table names from base schema', async () => {
    mockFetch({ tables: [{ name: 'Contacts', fields: [] }, { name: 'Projects', fields: [] }] })
    const sheets = await connector.listSheets(FAKE_CONFIG)
    expect(sheets).toEqual(['Contacts', 'Projects'])
  })
})

describe('AirtableConnector.query', () => {
  it('returns records as rows', async () => {
    mockFetch({
      records: [
        { id: 'rec1', fields: { Name: 'Alice', Revenue: 1200 } },
        { id: 'rec2', fields: { Name: 'Bob', Revenue: 800 } },
      ],
    })
    const rows = await connector.query(FAKE_CONFIG, 'Contacts')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ _rowId: 'rec1', Name: 'Alice', Revenue: 1200 })
  })
})

describe('AirtableConnector.insert', () => {
  it('posts new records', async () => {
    mockFetch({ records: [{ id: 'rec3', fields: { Name: 'Carol' } }] })
    await connector.insert(FAKE_CONFIG, 'Contacts', [{ Name: 'Carol', Revenue: 1500 }])
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('Contacts'),
      expect.objectContaining({ method: 'POST' })
    )
  })
})

describe('AirtableConnector.updateCell', () => {
  it('patches a record field', async () => {
    mockFetch({ id: 'rec1', fields: { Revenue: 9999 } })
    await connector.updateCell(FAKE_CONFIG, 'Contacts', 'rec1', 'Revenue', 9999)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('rec1'),
      expect.objectContaining({ method: 'PATCH' })
    )
  })
})
