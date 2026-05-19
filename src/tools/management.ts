import { resolveConnector } from '../router.js'
import type { McpToolResult, SourceType } from '../types.js'

function ok(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function err(msg: string): McpToolResult {
  return { content: [{ type: 'text', text: msg }], isError: true }
}

export async function handleListSheets(params: Record<string, unknown>): Promise<McpToolResult> {
  try {
    const { connector, target } = await resolveConnector(params.source as SourceType, params.target as string)
    const sheets = await connector.listSheets(target)
    return ok(sheets)
  } catch (e) { return err((e as Error).message) }
}

export async function handleCreateSheet(params: Record<string, unknown>): Promise<McpToolResult> {
  try {
    const { connector, target } = await resolveConnector(params.source as SourceType, params.target as string)
    await connector.createSheet(target, params.name as string)
    return ok({ created: params.name })
  } catch (e) { return err((e as Error).message) }
}

export async function handleRenameSheet(params: Record<string, unknown>): Promise<McpToolResult> {
  try {
    const { connector, target } = await resolveConnector(params.source as SourceType, params.target as string)
    await connector.renameSheet(target, params.oldName as string, params.newName as string)
    return ok({ renamed: { from: params.oldName, to: params.newName } })
  } catch (e) { return err((e as Error).message) }
}

export async function handleDuplicateSheet(params: Record<string, unknown>): Promise<McpToolResult> {
  try {
    const { connector, target } = await resolveConnector(params.source as SourceType, params.target as string)
    await connector.duplicateSheet(target, params.name as string, params.newName as string)
    return ok({ duplicated: { from: params.name, to: params.newName } })
  } catch (e) { return err((e as Error).message) }
}
