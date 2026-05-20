import ExcelJS from 'exceljs'
import type { DataSource, Row, SheetSchema, ColumnSchema, QueryFilter } from '../types.js'


/**
 * Find the actual header row in a worksheet.
 * Scans the first 20 rows for the first row with 2+ non-null cells whose values
 * are not all identical (which would indicate a merged title/description row).
 * Falls back to row 1 if nothing better is found.
 */
function findHeaderRow(ws: ExcelJS.Worksheet): number {
  for (let r = 1; r <= Math.min(20, ws.rowCount); r++) {
    const row = ws.getRow(r)
    const values: string[] = []
    row.eachCell({ includeEmpty: false }, cell => {
      if (cell.value !== null && cell.value !== undefined) {
        values.push(String(cell.value))
      }
    })
    if (values.length >= 2 && new Set(values).size >= 2) return r
  }
  return 1
}

function matchesFilter(value: unknown, filter: QueryFilter): boolean {
  const v = value as string | number | boolean | null
  const f = filter.value
  switch (filter.operator) {
    case '=': return v === f
    case '!=': return v !== f
    case '>': return typeof v === 'number' && typeof f === 'number' && v > f
    case '<': return typeof v === 'number' && typeof f === 'number' && v < f
    case '>=': return typeof v === 'number' && typeof f === 'number' && v >= f
    case '<=': return typeof v === 'number' && typeof f === 'number' && v <= f
    case 'contains': return typeof v === 'string' && typeof f === 'string' && v.includes(f)
    case 'not_contains': return typeof v === 'string' && typeof f === 'string' && !v.includes(f)
    default: return false
  }
}

export class ExcelConnector implements DataSource {
  async listSheets(target: unknown): Promise<string[]> {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(target as string)
    return wb.worksheets.map(ws => ws.name)
  }

  async describe(target: unknown, sheet: string): Promise<SheetSchema> {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(target as string)
    const ws = wb.getWorksheet(sheet)
    if (!ws) throw new Error(`Sheet "${sheet}" not found in ${target}`)

    const headerRowNum = findHeaderRow(ws)
    const columnNames: string[] = []
    ws.getRow(headerRowNum).eachCell({ includeEmpty: false }, cell => {
      columnNames.push(String(cell.value ?? ''))
    })

    const columnStats: Map<string, { nullCount: number; samples: (string | number | boolean | null)[]; type: Set<string> }> =
      new Map(columnNames.map(n => [n, { nullCount: 0, samples: [], type: new Set() }]))

    let rowCount = 0
    ws.eachRow((row, rowNum) => {
      if (rowNum <= headerRowNum) return
      rowCount++
      columnNames.forEach((name, i) => {
        const cell = row.getCell(i + 1)
        const val = cell.value
        const stats = columnStats.get(name)!
        if (val === null || val === undefined) {
          stats.nullCount++
        } else {
          if (stats.samples.length < 3) stats.samples.push(val as string | number | boolean)
          stats.type.add(typeof val)
        }
      })
    })

    const columns: ColumnSchema[] = columnNames.map(name => {
      const stats = columnStats.get(name)!
      const types = [...stats.type]
      const type = types.length === 1
        ? (types[0] === 'number' ? 'number' : types[0] === 'boolean' ? 'boolean' : 'string')
        : 'unknown'
      return { name, type: type as ColumnSchema['type'], nullCount: stats.nullCount, sampleValues: stats.samples }
    })

    return { name: sheet, rowCount, columns }
  }

  async query(target: unknown, sheet: string, filters: QueryFilter[] = [], limit?: number): Promise<Row[]> {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(target as string)
    const ws = wb.getWorksheet(sheet)
    if (!ws) throw new Error(`Sheet "${sheet}" not found in ${target}`)

    const headerRowNum = findHeaderRow(ws)
    const columnNames: string[] = []
    ws.getRow(headerRowNum).eachCell({ includeEmpty: false }, cell => {
      columnNames.push(String(cell.value ?? ''))
    })

    const results: Row[] = []
    ws.eachRow((row, rowNum) => {
      if (rowNum <= headerRowNum) return
      if (limit !== undefined && results.length >= limit) return

      const record: Row = { _rowId: String(rowNum) }
      columnNames.forEach((name, i) => {
        const val = row.getCell(i + 1).value
        record[name] = val === null || val === undefined ? null : val as string | number | boolean
      })

      const passes = filters.every(f => matchesFilter(record[f.column], f))
      if (passes) results.push(record)
    })

    return results
  }

  async insert(target: unknown, sheet: string, rows: Omit<Row, '_rowId'>[]): Promise<void> {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(target as string)
    const ws = wb.getWorksheet(sheet)
    if (!ws) throw new Error(`Sheet "${sheet}" not found in ${target}`)
    const headerRow = ws.getRow(1)
    const columnNames: string[] = []
    headerRow.eachCell(cell => { columnNames.push(String(cell.value ?? '')) })
    for (const row of rows) {
      const arr = columnNames.map(name => (row as Record<string, unknown>)[name] ?? null)
      ws.addRow(arr)
    }
    await wb.xlsx.writeFile(target as string)
  }

  async updateCell(target: unknown, sheet: string, rowId: string, column: string, value: string | number | boolean | null): Promise<void> {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(target as string)
    const ws = wb.getWorksheet(sheet)
    if (!ws) throw new Error(`Sheet "${sheet}" not found in ${target}`)
    const headerRow = ws.getRow(1)
    let colIndex = -1
    headerRow.eachCell((cell, i) => { if (String(cell.value) === column) colIndex = i })
    if (colIndex === -1) throw new Error(`Column "${column}" not found`)
    ws.getRow(Number(rowId)).getCell(colIndex).value = value
    await wb.xlsx.writeFile(target as string)
  }

  async deleteRow(target: unknown, sheet: string, rowId: string): Promise<void> {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(target as string)
    const ws = wb.getWorksheet(sheet)
    if (!ws) throw new Error(`Sheet "${sheet}" not found in ${target}`)
    ws.spliceRows(Number(rowId), 1)
    await wb.xlsx.writeFile(target as string)
  }

  async createSheet(target: unknown, name: string): Promise<void> {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(target as string)
    wb.addWorksheet(name)
    await wb.xlsx.writeFile(target as string)
  }

  async renameSheet(target: unknown, oldName: string, newName: string): Promise<void> {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(target as string)
    const ws = wb.getWorksheet(oldName)
    if (!ws) throw new Error(`Sheet "${oldName}" not found in ${target}`)
    ws.name = newName
    await wb.xlsx.writeFile(target as string)
  }

  async duplicateSheet(target: unknown, name: string, newName: string): Promise<void> {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(target as string)
    const src = wb.getWorksheet(name)
    if (!src) throw new Error(`Sheet "${name}" not found in ${target}`)
    const dest = wb.addWorksheet(newName)
    src.eachRow((row, rowNum) => {
      const newRow = dest.getRow(rowNum)
      row.eachCell((cell, colNum) => {
        newRow.getCell(colNum).value = cell.value
      })
      newRow.commit()
    })
    await wb.xlsx.writeFile(target as string)
  }
}
