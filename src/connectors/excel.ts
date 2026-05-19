import { createRequire } from 'module'
import { createReadStream } from 'fs'
import ExcelJS from 'exceljs'
import type { DataSource, Row, SheetSchema, ColumnSchema, QueryFilter } from '../types.js'

// Access ExcelJS internals via createRequire (they are CommonJS modules)
const _require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unzip: any = _require('unzipper')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WorkbookXform: any = _require('exceljs/lib/xlsx/xform/book/workbook-xform')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RelationshipsXform: any = _require('exceljs/lib/xlsx/xform/core/relationships-xform')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const iterateStream: any = _require('exceljs/lib/utils/iterate-stream')

interface WorkbookMeta {
  workbookRels: unknown[]
  workbookModel: { sheets: { name: string; id: number; state: string; rId: string }[] }
  sharedStrings: (string | { richText: unknown[] })[] | null
}

/**
 * First pass: scan the zip to extract workbook metadata (rels, sheet names, shared strings).
 * This is lightweight — it does NOT read worksheet XML — so it is still O(metadata) not O(rows).
 * The second pass (WorkbookReader) then streams worksheet rows with the metadata pre-seeded,
 * which avoids the ExcelJS bug where sheet names are not resolved when xl/workbook.xml appears
 * after xl/worksheets/sheet*.xml in the zip's central directory.
 */
async function preloadMeta(filePath: string): Promise<WorkbookMeta> {
  const stream = createReadStream(filePath)
  const zip = unzip.Parse({ forceStream: true })
  stream.pipe(zip)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let workbookRels: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let workbookModel: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sharedStrings: any = null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const entry of zip as AsyncIterable<any>) {
    if (entry.path === 'xl/_rels/workbook.xml.rels') {
      const xform = new RelationshipsXform()
      workbookRels = await xform.parseStream(iterateStream(entry))
    } else if (entry.path === 'xl/workbook.xml') {
      const xform = new WorkbookXform()
      await xform.parseStream(iterateStream(entry))
      workbookModel = xform.model
    } else if (entry.path === 'xl/sharedStrings.xml') {
      // Parse shared strings using the same logic WorkbookReader uses for 'cache' mode.
      // We build the array manually so it exactly matches what WorksheetReader expects:
      // each element is either a plain string (simple cell) or {richText:[...]} (rich text).
      sharedStrings = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parseSax: any = _require('exceljs/lib/utils/parse-sax')
      let text: string | null = null
      const richText: unknown[] = []
      let font: Record<string, unknown> | null = null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const events of parseSax(iterateStream(entry)) as AsyncIterable<any[]>) {
        for (const { eventType, value } of events) {
          if (eventType === 'opentag') {
            const node = value
            if (node.name === 't') text = null
            else if (node.name === 'si') { font = null; richText.length = 0; text = null }
          } else if (eventType === 'text') {
            text = text ? text + (value as string) : (value as string)
          } else if (eventType === 'closetag') {
            const name = (value as { name: string }).name
            if (name === 'r') {
              richText.push({ font, text })
              font = null; text = null
            } else if (name === 'si') {
              sharedStrings.push(richText.length ? { richText: [...richText] } : text)
              richText.length = 0; font = null; text = null
            }
          }
        }
      }
    } else {
      entry.autodrain()
    }
  }

  return { workbookRels: workbookRels ?? [], workbookModel: workbookModel ?? { sheets: [] }, sharedStrings }
}

/**
 * Create a WorkbookReader pre-seeded with the metadata from the first pass.
 * Pre-seeding model + workbookRels + sharedStrings ensures that worksheets are
 * always processed inline with correct sheet names and shared-string resolution,
 * regardless of zip entry order.
 */
async function makeReader(
  filePath: string,
  opts: { styles?: 'cache' | 'ignore' } = {}
): Promise<ExcelJS.stream.xlsx.WorkbookReader> {
  const meta = await preloadMeta(filePath)

  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: opts.styles ?? 'ignore',
    worksheets: 'emit',
  })

  // Pre-seed internal state so _parseWorksheet has what it needs on first encounter.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = reader as any
  r.model = meta.workbookModel
  r.workbookRels = meta.workbookRels
  if (meta.sharedStrings !== null) r.sharedStrings = meta.sharedStrings

  return reader
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
    const filePath = target as string
    const reader = await makeReader(filePath)
    const names: string[] = []
    for await (const ws of reader) {
      names.push(ws.name)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _row of ws) { /* drain */ }
    }
    return names
  }

  async describe(target: unknown, sheet: string): Promise<SheetSchema> {
    const filePath = target as string
    const reader = await makeReader(filePath, { styles: 'cache' })
    for await (const ws of reader) {
      if (ws.name !== sheet) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _row of ws) { /* drain */ }
        continue
      }
      let columnNames: string[] = []
      const statsMap = new Map<string, { nullCount: number; samples: (string | number | boolean | null)[]; types: Set<string> }>()
      let rowCount = 0

      for await (const row of ws) {
        if (row.number === 1) {
          row.eachCell(cell => { columnNames.push(String(cell.value ?? '')) })
          columnNames.forEach(n => statsMap.set(n, { nullCount: 0, samples: [], types: new Set() }))
          continue
        }
        rowCount++
        columnNames.forEach((name, i) => {
          const val = row.getCell(i + 1).value
          const stats = statsMap.get(name)!
          if (val === null || val === undefined) {
            stats.nullCount++
          } else {
            if (stats.samples.length < 3) stats.samples.push(val as string | number | boolean)
            stats.types.add(typeof val)
          }
        })
      }

      const columns: ColumnSchema[] = columnNames.map(name => {
        const stats = statsMap.get(name)!
        const types = [...stats.types]
        const type = types.length === 1
          ? (types[0] === 'number' ? 'number' : types[0] === 'boolean' ? 'boolean' : 'string')
          : 'unknown'
        return { name, type: type as ColumnSchema['type'], nullCount: stats.nullCount, sampleValues: stats.samples }
      })

      return { name: sheet, rowCount, columns }
    }
    throw new Error(`Sheet "${sheet}" not found in ${filePath}`)
  }

  async query(target: unknown, sheet: string, filters: QueryFilter[] = [], limit?: number): Promise<Row[]> {
    const filePath = target as string
    const reader = await makeReader(filePath)
    for await (const ws of reader) {
      if (ws.name !== sheet) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _row of ws) { /* drain */ }
        continue
      }
      let columnNames: string[] = []
      const results: Row[] = []

      for await (const row of ws) {
        if (row.number === 1) {
          row.eachCell(cell => { columnNames.push(String(cell.value ?? '')) })
          continue
        }
        if (limit !== undefined && results.length >= limit) continue

        const record: Row = { _rowId: String(row.number) }
        columnNames.forEach((name, i) => {
          const val = row.getCell(i + 1).value
          record[name] = val === null || val === undefined ? null : val as string | number | boolean
        })

        const passes = filters.every(f => matchesFilter(record[f.column], f))
        if (passes) results.push(record)
      }

      return results
    }
    throw new Error(`Sheet "${sheet}" not found in ${filePath}`)
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
