import { google } from 'googleapis'
import type { DataSource, Row, SheetSchema, ColumnSchema, QueryFilter, SheetsConfig } from '../types.js'

function buildClient(config: SheetsConfig) {
  const auth = new google.auth.OAuth2(config.clientId, config.clientSecret)
  auth.setCredentials({ refresh_token: config.refreshToken })
  return google.sheets({ version: 'v4', auth })
}

function coerce(val: string): string | number | boolean | null {
  if (val === '' || val === undefined) return null
  if (val === 'TRUE') return true
  if (val === 'FALSE') return false
  const n = Number(val)
  return isNaN(n) ? val : n
}

function applyFilters(rows: Row[], filters: QueryFilter[]): Row[] {
  return rows.filter(row =>
    filters.every(f => {
      const v = row[f.column]
      const fv = f.value
      switch (f.operator) {
        case '=': return v === fv
        case '!=': return v !== fv
        case '>': return typeof v === 'number' && typeof fv === 'number' && v > fv
        case '<': return typeof v === 'number' && typeof fv === 'number' && v < fv
        case '>=': return typeof v === 'number' && typeof fv === 'number' && v >= fv
        case '<=': return typeof v === 'number' && typeof fv === 'number' && v <= fv
        case 'contains': return typeof v === 'string' && typeof fv === 'string' && v.includes(fv)
        case 'not_contains': return typeof v === 'string' && typeof fv === 'string' && !v.includes(fv)
        default: return false
      }
    })
  )
}

function colIndexToLetter(index: number): string {
  let letter = ''
  let n = index + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    n = Math.floor((n - 1) / 26)
  }
  return letter
}

export class SheetsConnector implements DataSource {
  async listSheets(target: unknown): Promise<string[]> {
    const config = target as SheetsConfig
    const client = buildClient(config)
    const res = await client.spreadsheets.get({ spreadsheetId: config.spreadsheetId })
    return (res.data.sheets ?? []).map(s => s.properties?.title ?? '')
  }

  async describe(target: unknown, sheet: string): Promise<SheetSchema> {
    const config = target as SheetsConfig
    const client = buildClient(config)
    const res = await client.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: sheet,
    })
    const values = res.data.values ?? []
    const headers = (values[0] ?? []).map(String)
    const dataRows = values.slice(1)

    const columns: ColumnSchema[] = headers.map((name, i) => {
      const colVals = dataRows.map(r => coerce((r[i] as string) ?? ''))
      const nonNull = colVals.filter(v => v !== null)
      const types = new Set(nonNull.map(v => typeof v))
      const type = types.size === 1
        ? (types.has('number') ? 'number' : types.has('boolean') ? 'boolean' : 'string')
        : 'unknown'
      return {
        name,
        type: type as ColumnSchema['type'],
        nullCount: colVals.length - nonNull.length,
        sampleValues: nonNull.slice(0, 3),
      }
    })

    return { name: sheet, rowCount: dataRows.length, columns }
  }

  async query(target: unknown, sheet: string, filters: QueryFilter[] = [], limit?: number): Promise<Row[]> {
    const config = target as SheetsConfig
    const client = buildClient(config)
    const res = await client.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: sheet,
    })
    const values = res.data.values ?? []
    const headers = (values[0] ?? []).map(String)
    const dataRows = values.slice(1)

    let rows: Row[] = dataRows.map((r, i) => {
      const row: Row = { _rowId: String(i + 2) }
      headers.forEach((h, j) => { row[h] = coerce((r[j] as string) ?? '') })
      return row
    })

    rows = applyFilters(rows, filters)
    if (limit !== undefined) rows = rows.slice(0, limit)
    return rows
  }

  async insert(target: unknown, sheet: string, rows: Omit<Row, '_rowId'>[]): Promise<void> {
    const config = target as SheetsConfig
    const client = buildClient(config)
    // Fetch headers to ensure correct column order
    const headerRes = await client.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: `${sheet}!1:1`,
    })
    const headers = ((headerRes.data.values?.[0] ?? []) as string[]).map(String)
    const values = rows.map(r => headers.map(h => (r as Record<string, unknown>)[h] ?? null))
    await client.spreadsheets.values.append({
      spreadsheetId: config.spreadsheetId,
      range: sheet,
      valueInputOption: 'RAW',
      requestBody: { values },
    })
  }

  async updateCell(target: unknown, sheet: string, rowId: string, column: string, value: string | number | boolean | null): Promise<void> {
    const config = target as SheetsConfig
    const client = buildClient(config)
    const res = await client.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: `${sheet}!1:1`,
    })
    const headers = ((res.data.values?.[0] ?? []) as string[]).map(String)
    const colIndex = headers.indexOf(column)
    if (colIndex === -1) throw new Error(`Column "${column}" not found`)
    const colLetter = colIndexToLetter(colIndex)
    await client.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range: `${sheet}!${colLetter}${rowId}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[value]] },
    })
  }

  async deleteRow(target: unknown, sheet: string, rowId: string): Promise<void> {
    const config = target as SheetsConfig
    const client = buildClient(config)
    const meta = await client.spreadsheets.get({ spreadsheetId: config.spreadsheetId })
    const sheetMeta = meta.data.sheets?.find(s => s.properties?.title === sheet)
    if (!sheetMeta) throw new Error(`Sheet "${sheet}" not found`)
    const sheetId = sheetMeta.properties!.sheetId!
    await client.spreadsheets.batchUpdate({
      spreadsheetId: config.spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: Number(rowId) - 1, endIndex: Number(rowId) },
          },
        }],
      },
    })
  }

  async createSheet(target: unknown, name: string): Promise<void> {
    const config = target as SheetsConfig
    const client = buildClient(config)
    await client.spreadsheets.batchUpdate({
      spreadsheetId: config.spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: name } } }] },
    })
  }

  async renameSheet(target: unknown, oldName: string, newName: string): Promise<void> {
    const config = target as SheetsConfig
    const client = buildClient(config)
    const meta = await client.spreadsheets.get({ spreadsheetId: config.spreadsheetId })
    const sheetMeta = meta.data.sheets?.find(s => s.properties?.title === oldName)
    if (!sheetMeta) throw new Error(`Sheet "${oldName}" not found`)
    await client.spreadsheets.batchUpdate({
      spreadsheetId: config.spreadsheetId,
      requestBody: {
        requests: [{
          updateSheetProperties: {
            properties: { sheetId: sheetMeta.properties!.sheetId, title: newName },
            fields: 'title',
          },
        }],
      },
    })
  }

  async duplicateSheet(target: unknown, name: string, newName: string): Promise<void> {
    const config = target as SheetsConfig
    const client = buildClient(config)
    const meta = await client.spreadsheets.get({ spreadsheetId: config.spreadsheetId })
    const sheetMeta = meta.data.sheets?.find(s => s.properties?.title === name)
    if (!sheetMeta) throw new Error(`Sheet "${name}" not found`)
    await client.spreadsheets.batchUpdate({
      spreadsheetId: config.spreadsheetId,
      requestBody: {
        requests: [{
          duplicateSheet: {
            sourceSheetId: sheetMeta.properties!.sheetId,
            newSheetName: newName,
          },
        }],
      },
    })
  }
}
