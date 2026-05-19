import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SheetsConnector } from '../../../src/connectors/sheets.js'

vi.mock('googleapis', () => {
  const mockValues = {
    get: vi.fn(),
    append: vi.fn(),
    update: vi.fn(),
  }
  const mockSpreadsheets = {
    get: vi.fn(),
    values: mockValues,
    batchUpdate: vi.fn(),
  }
  return {
    google: {
      auth: {
        OAuth2: vi.fn().mockImplementation(() => ({
          setCredentials: vi.fn(),
        })),
      },
      sheets: vi.fn().mockReturnValue({ spreadsheets: mockSpreadsheets }),
    },
  }
})

import { google } from 'googleapis'

const FAKE_CONFIG = {
  spreadsheetId: 'sheet-abc',
  refreshToken: 'refresh-token',
  clientId: 'client-id',
  clientSecret: 'client-secret',
}

const connector = new SheetsConnector()

function getMockSheets() {
  return vi.mocked(google.sheets({} as any)).spreadsheets
}

describe('SheetsConnector.listSheets', () => {
  it('returns sheet names from spreadsheet metadata', async () => {
    getMockSheets().get.mockResolvedValue({
      data: { sheets: [{ properties: { title: 'Sheet1' } }, { properties: { title: 'Sheet2' } }] },
    } as any)

    const sheets = await connector.listSheets(FAKE_CONFIG)
    expect(sheets).toEqual(['Sheet1', 'Sheet2'])
  })
})

describe('SheetsConnector.query', () => {
  it('returns rows from a range', async () => {
    getMockSheets().values.get.mockResolvedValue({
      data: {
        values: [
          ['Name', 'Revenue'],
          ['Alice', '1200'],
          ['Bob', '800'],
        ],
      },
    } as any)

    const rows = await connector.query(FAKE_CONFIG, 'Sheet1')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ _rowId: '2', Name: 'Alice' })
  })

  it('coerces numeric strings to numbers', async () => {
    getMockSheets().values.get.mockResolvedValue({
      data: { values: [['Score'], ['42'], ['3.14']] },
    } as any)
    const rows = await connector.query(FAKE_CONFIG, 'Sheet1')
    expect(rows[0].Score).toBe(42)
    expect(rows[1].Score).toBe(3.14)
  })
})

describe('SheetsConnector.insert', () => {
  it('calls values.append', async () => {
    getMockSheets().values.append.mockResolvedValue({ data: {} } as any)
    await connector.insert(FAKE_CONFIG, 'Sheet1', [{ Name: 'Carol', Revenue: 1500 }])
    expect(getMockSheets().values.append).toHaveBeenCalledWith(
      expect.objectContaining({ range: 'Sheet1', valueInputOption: 'RAW' })
    )
  })
})
