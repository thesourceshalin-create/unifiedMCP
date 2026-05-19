import { resolveConnector } from '../router.js'
import type { McpToolResult, QueryFilter, SourceType } from '../types.js'

function ok(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function err(msg: string): McpToolResult {
  return { content: [{ type: 'text', text: msg }], isError: true }
}

async function base(params: Record<string, unknown>) {
  const { connector, target } = await resolveConnector(
    params.source as SourceType,
    params.target as string
  )
  return { connector, target, sheet: params.sheet as string }
}

export async function handleReadSheet(params: Record<string, unknown>): Promise<McpToolResult> {
  try {
    const { connector, target, sheet } = await base(params)
    const rows = await connector.query(target, sheet)
    return ok(rows)
  } catch (e) { return err((e as Error).message) }
}

export async function handleQueryRange(params: Record<string, unknown>): Promise<McpToolResult> {
  try {
    const { connector, target, sheet } = await base(params)
    const filters = (params.filters ?? []) as QueryFilter[]
    const limit = params.limit as number | undefined
    const rows = await connector.query(target, sheet, filters, limit)
    return ok(rows)
  } catch (e) { return err((e as Error).message) }
}

export async function handleAppendRow(params: Record<string, unknown>): Promise<McpToolResult> {
  try {
    const { connector, target, sheet } = await base(params)
    const rows = params.rows as Record<string, unknown>[]
    await connector.insert(target, sheet, rows as any)
    return ok({ inserted: rows.length })
  } catch (e) { return err((e as Error).message) }
}

export async function handleUpdateCell(params: Record<string, unknown>): Promise<McpToolResult> {
  try {
    const { connector, target, sheet } = await base(params)
    await connector.updateCell(target, sheet, params.rowId as string, params.column as string, params.value as any)
    return ok({ updated: true })
  } catch (e) { return err((e as Error).message) }
}

export async function handleDeleteRow(params: Record<string, unknown>): Promise<McpToolResult> {
  try {
    const { connector, target, sheet } = await base(params)
    await connector.deleteRow(target, sheet, params.rowId as string)
    return ok({ deleted: true })
  } catch (e) { return err((e as Error).message) }
}
