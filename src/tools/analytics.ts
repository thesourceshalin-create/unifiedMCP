import { resolveConnector } from '../router.js'
import type { McpToolResult, Row, SourceType } from '../types.js'

function ok(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function err(msg: string): McpToolResult {
  return { content: [{ type: 'text', text: msg }], isError: true }
}

function rowKey(row: Row, columns: string[]): string {
  return columns.map(c => String(row[c] ?? '')).join('||')
}

export async function handleSummarizeSheet(params: Record<string, unknown>): Promise<McpToolResult> {
  try {
    const { connector, target } = await resolveConnector(params.source as SourceType, params.target as string)
    const schema = await connector.describe(target, params.sheet as string)
    return ok(schema)
  } catch (e) { return err((e as Error).message) }
}

export async function handleFindDuplicates(params: Record<string, unknown>): Promise<McpToolResult> {
  try {
    const { connector, target } = await resolveConnector(params.source as SourceType, params.target as string)
    const rows = await connector.query(target, params.sheet as string)
    const columns = (params.columns as string[] | undefined)
      ?? Object.keys(rows[0] ?? {}).filter(k => k !== '_rowId')

    const groups = new Map<string, Row[]>()
    for (const row of rows) {
      const key = rowKey(row, columns)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(row)
    }

    const duplicateGroups = [...groups.values()].filter(g => g.length > 1)
    return ok({
      duplicateCount: duplicateGroups.reduce((sum, g) => sum + g.length - 1, 0),
      groups: duplicateGroups,
    })
  } catch (e) { return err((e as Error).message) }
}

export async function handleCompareRanges(params: Record<string, unknown>): Promise<McpToolResult> {
  try {
    const rangeA = params.rangeA as { source: SourceType; target: string; sheet: string }
    const rangeB = params.rangeB as { source: SourceType; target: string; sheet: string }

    const [resolvedA, resolvedB] = await Promise.all([
      resolveConnector(rangeA.source, rangeA.target),
      resolveConnector(rangeB.source, rangeB.target),
    ])
    const [rowsA, rowsB] = await Promise.all([
      resolvedA.connector.query(resolvedA.target, rangeA.sheet),
      resolvedB.connector.query(resolvedB.target, rangeB.sheet),
    ])

    const allCols = [...new Set([
      ...Object.keys(rowsA[0] ?? {}),
      ...Object.keys(rowsB[0] ?? {}),
    ])].filter(k => k !== '_rowId')

    const keysB = new Set(rowsB.map(r => rowKey(r, allCols)))
    const keysA = new Set(rowsA.map(r => rowKey(r, allCols)))

    const onlyInA = rowsA.filter(r => !keysB.has(rowKey(r, allCols)))
    const onlyInB = rowsB.filter(r => !keysA.has(rowKey(r, allCols)))

    return ok({ onlyInA, onlyInB, totalA: rowsA.length, totalB: rowsB.length })
  } catch (e) { return err((e as Error).message) }
}
