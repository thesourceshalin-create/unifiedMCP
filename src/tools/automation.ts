import { resolveConnector } from '../router.js'
import { addSchedule, removeSchedule } from '../automation/scheduler.js'
import { addAlert, removeAlert } from '../automation/poller.js'
import type { McpToolResult, QueryFilter, SourceType } from '../types.js'

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

    const matchedRows = await connector.query(target, sheet, filters)
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

export async function handleRemoveSchedule(params: Record<string, unknown>): Promise<McpToolResult> {
  try {
    const id = params.id as string
    await removeSchedule(id)
    await removeAlert(id)
    return ok({ removed: id })
  } catch (e) { return err((e as Error).message) }
}
