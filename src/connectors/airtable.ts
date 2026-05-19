import type { DataSource, Row, SheetSchema, ColumnSchema, QueryFilter, AirtableConfig } from '../types.js'

const BASE_URL = 'https://api.airtable.com/v0'
const META_URL = 'https://api.airtable.com/v0/meta/bases'

async function airtableFetch(url: string, apiKey: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Airtable API error ${res.status}: ${body}`)
  }
  return res.json()
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

export class AirtableConnector implements DataSource {
  async listSheets(target: unknown): Promise<string[]> {
    const config = target as AirtableConfig
    const data = await airtableFetch(
      `${META_URL}/${config.baseId}/tables`,
      config.apiKey
    ) as { tables: { name: string }[] }
    return data.tables.map(t => t.name)
  }

  async describe(target: unknown, sheet: string): Promise<SheetSchema> {
    const config = target as AirtableConfig
    const data = await airtableFetch(
      `${META_URL}/${config.baseId}/tables`,
      config.apiKey
    ) as { tables: { name: string; fields: { name: string; type: string }[] }[] }
    const table = data.tables.find(t => t.name === sheet)
    if (!table) throw new Error(`Table "${sheet}" not found`)

    const records = await airtableFetch(
      `${BASE_URL}/${config.baseId}/${encodeURIComponent(sheet)}?maxRecords=100`,
      config.apiKey
    ) as { records: { id: string; fields: Record<string, unknown> }[] }

    const columns: ColumnSchema[] = table.fields.map(f => {
      const samples = records.records
        .map(r => r.fields[f.name])
        .filter(v => v !== undefined && v !== null)
        .slice(0, 3) as (string | number | boolean | null)[]
      return {
        name: f.name,
        type: f.type === 'number' || f.type === 'currency' || f.type === 'percent' ? 'number'
          : f.type === 'checkbox' ? 'boolean'
          : 'string',
        nullCount: 0,
        sampleValues: samples,
      }
    })

    return { name: sheet, rowCount: records.records.length, columns }
  }

  async query(target: unknown, sheet: string, filters: QueryFilter[] = [], limit?: number): Promise<Row[]> {
    const config = target as AirtableConfig
    const params = new URLSearchParams()
    if (limit) params.set('maxRecords', String(limit))

    const data = await airtableFetch(
      `${BASE_URL}/${config.baseId}/${encodeURIComponent(sheet)}${params.toString() ? '?' + params : ''}`,
      config.apiKey
    ) as { records: { id: string; fields: Record<string, unknown> }[] }

    const rows: Row[] = data.records.map(r => ({
      _rowId: r.id,
      ...Object.fromEntries(
        Object.entries(r.fields).map(([k, v]) => [k, v as string | number | boolean | null])
      ),
    }))

    return applyFilters(rows, filters)
  }

  async insert(target: unknown, sheet: string, rows: Omit<Row, '_rowId'>[]): Promise<void> {
    const config = target as AirtableConfig
    const records = rows.map(r => ({ fields: r }))
    await airtableFetch(
      `${BASE_URL}/${config.baseId}/${encodeURIComponent(sheet)}`,
      config.apiKey,
      { method: 'POST', body: JSON.stringify({ records }) }
    )
  }

  async updateCell(target: unknown, sheet: string, rowId: string, column: string, value: string | number | boolean | null): Promise<void> {
    const config = target as AirtableConfig
    await airtableFetch(
      `${BASE_URL}/${config.baseId}/${encodeURIComponent(sheet)}/${rowId}`,
      config.apiKey,
      { method: 'PATCH', body: JSON.stringify({ fields: { [column]: value } }) }
    )
  }

  async deleteRow(target: unknown, sheet: string, rowId: string): Promise<void> {
    const config = target as AirtableConfig
    void sheet
    await airtableFetch(
      `${BASE_URL}/${config.baseId}/${encodeURIComponent(sheet)}/${rowId}`,
      config.apiKey,
      { method: 'DELETE' }
    )
  }

  async createSheet(_target: unknown, _name: string): Promise<void> {
    throw new Error('Creating Airtable tables via API is not supported in v1')
  }

  async renameSheet(_target: unknown, _oldName: string, _newName: string): Promise<void> {
    throw new Error('Renaming Airtable tables via API is not supported in v1')
  }

  async duplicateSheet(_target: unknown, _name: string, _newName: string): Promise<void> {
    throw new Error('Duplicating Airtable tables via API is not supported in v1')
  }
}
