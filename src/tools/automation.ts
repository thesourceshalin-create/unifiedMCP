import { resolveConnector } from '../router.js'
import { addSchedule } from '../automation/scheduler.js'
import { addAlert } from '../automation/poller.js'
import type { McpToolResult, QueryFilter, Row, SourceType } from '../types.js'

function matchesFilter(row: Row, filter: QueryFilter): boolean {
  const cell = row[filter.column]
  const val = filter.value
  switch (filter.operator) {
    case '=': return cell === val
    case '!=': return cell !== val
    case '>': return (cell as number) > (val as number)
    case '<': return (cell as number) < (val as number)
    case '>=': return (cell as number) >= (val as number)
    case '<=': return (cell as number) <= (val as number)
    case 'contains': return String(cell ?? '').includes(String(val))
    case 'not_contains': return !String(cell ?? '').includes(String(val))
    default: return true
  }
}

function applyFilters(rows: Row[], filters: QueryFilter[]): Row[] {
  if (filters.length === 0) return rows
  return rows.filter(row => filters.every(f => matchesFilter(row, f)))
}

function ok(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function err(msg: string): McpToolResult {
  return { content: [{ type: 'text', text: msg }], isError: true }
}

export async function handleBulkUpdate(params: Record<string, unknown>): Promise<McpToolResult> {
  try {
    const { connector, target } = await resolveConnector(params.source as SourceType, params.target as string)
    const sheet = params.sheet as string
    const filters = (params.filters ?? []) as QueryFilter[]
    const updates = params.updates as Record<string, unknown>

    const allRows = await connector.query(target, sheet, filters)
    const matchedRows = applyFilters(allRows, filters)
    for (const row of matchedRows) {
      for (const [column, value] of Object.entries(updates)) {
        await connector.updateCell(target, sheet, row._rowId, column, value as any)
      }
    }

    return ok({ updatedCount: matchedRows.length })
  } catch (e) { return err((e as Error).message) }
}

export async function handleScheduleSummary(params: Record<string, unknown>): Promise<McpToolResult> {
  try {
    const scheduleId = await addSchedule({
      source: params.source as string,
      target: params.target as string,
      sheet: params.sheet as string,
      cron: params.cron as string,
    })
    return ok({ scheduleId })
  } catch (e) { return err((e as Error).message) }
}

export async function handleSetAlert(params: Record<string, unknown>): Promise<McpToolResult> {
  try {
    const alertId = await addAlert({
      source: params.source as string,
      target: params.target as string,
      sheet: params.sheet as string,
      column: params.column as string,
      condition: params.condition as string,
      pollIntervalMs: params.pollIntervalMs as number | undefined,
    })
    return ok({ alertId })
  } catch (e) { return err((e as Error).message) }
}
