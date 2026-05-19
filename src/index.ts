import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import { handleConnectSource, handleListConnectedSources, handleDisconnectSource } from './tools/auth.js'
import { handleReadSheet, handleAppendRow, handleUpdateCell, handleDeleteRow, handleQueryRange } from './tools/core.js'
import { handleSummarizeSheet, handleCompareRanges, handleFindDuplicates } from './tools/analytics.js'
import { handleListSheets, handleCreateSheet, handleRenameSheet, handleDuplicateSheet } from './tools/management.js'
import { handleBulkUpdate, handleScheduleSummary, handleSetAlert, handleRemoveSchedule } from './tools/automation.js'
import { restoreSchedules, removeSchedule } from './automation/scheduler.js'
import { restoreAlerts, removeAlert } from './automation/poller.js'

const server = new McpServer({ name: 'unified-mcp', version: '1.0.0' })

const sourceEnum = z.enum(['excel', 'sheets', 'airtable'])
const filterSchema = z.object({
  column: z.string(),
  operator: z.enum(['=', '!=', '>', '<', '>=', '<=', 'contains', 'not_contains']),
  value: z.union([z.string(), z.number(), z.boolean()]),
})
const baseParams = { source: sourceEnum, target: z.string(), sheet: z.string() }
const rangeSchema = z.object({ source: sourceEnum, target: z.string(), sheet: z.string() })

// Auth tools
server.tool('connect_source', 'Register a new data source connection', {
  source: sourceEnum,
  id: z.string(),
  label: z.string(),
  filePath: z.string().optional(),
  apiKey: z.string().optional(),
  baseId: z.string().optional(),
  spreadsheetId: z.string().optional(),
}, async (p) => handleConnectSource(p as Record<string, unknown>))

server.tool('list_connected_sources', 'List all saved connections', {},
  async () => handleListConnectedSources())

server.tool('disconnect_source', 'Remove a connection', { id: z.string() },
  async (p) => handleDisconnectSource(p as Record<string, unknown>))

// Core tools
server.tool('read_sheet', 'Read all rows from a sheet/table', baseParams,
  async (p) => handleReadSheet(p as Record<string, unknown>))

server.tool('query_range', 'Fetch rows matching filter conditions', {
  ...baseParams,
  filters: z.array(filterSchema).optional(),
  limit: z.number().optional(),
}, async (p) => handleQueryRange(p as Record<string, unknown>))

server.tool('append_row', 'Add one or more rows to a sheet', {
  ...baseParams,
  rows: z.array(z.record(z.unknown())),
}, async (p) => handleAppendRow(p as Record<string, unknown>))

server.tool('update_cell', 'Update a specific cell by row ID and column', {
  ...baseParams,
  rowId: z.string(),
  column: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
}, async (p) => handleUpdateCell(p as Record<string, unknown>))

server.tool('delete_row', 'Delete a row by ID', {
  ...baseParams,
  rowId: z.string(),
}, async (p) => handleDeleteRow(p as Record<string, unknown>))

// Analytics tools
server.tool('summarize_sheet', 'Get schema and statistics for a sheet', baseParams,
  async (p) => handleSummarizeSheet(p as Record<string, unknown>))

server.tool('compare_ranges', 'Diff two ranges — same or cross-source', {
  rangeA: rangeSchema,
  rangeB: rangeSchema,
}, async (p) => handleCompareRanges(p as Record<string, unknown>))

server.tool('find_duplicates', 'Find duplicate rows in a sheet', {
  ...baseParams,
  columns: z.array(z.string()).optional(),
}, async (p) => handleFindDuplicates(p as Record<string, unknown>))

// Management tools
server.tool('list_sheets', 'List all sheets or tables in a source', {
  source: sourceEnum,
  target: z.string(),
}, async (p) => handleListSheets(p as Record<string, unknown>))

server.tool('create_sheet', 'Create a new sheet or table', {
  source: sourceEnum,
  target: z.string(),
  name: z.string(),
}, async (p) => handleCreateSheet(p as Record<string, unknown>))

server.tool('rename_sheet', 'Rename a sheet or table', {
  source: sourceEnum,
  target: z.string(),
  oldName: z.string(),
  newName: z.string(),
}, async (p) => handleRenameSheet(p as Record<string, unknown>))

server.tool('duplicate_sheet', 'Copy a sheet within the same source', {
  source: sourceEnum,
  target: z.string(),
  name: z.string(),
  newName: z.string(),
}, async (p) => handleDuplicateSheet(p as Record<string, unknown>))

// Automation tools
server.tool('bulk_update', 'Update all rows matching a filter condition', {
  ...baseParams,
  filters: z.array(filterSchema),
  updates: z.record(z.unknown()),
}, async (p) => handleBulkUpdate(p as Record<string, unknown>))

server.tool('schedule_summary', 'Schedule a recurring summary of a sheet', {
  ...baseParams,
  cron: z.string(),
}, async (p) => handleScheduleSummary(p as Record<string, unknown>))

server.tool('set_alert', 'Trigger an alert when a column condition is met', {
  ...baseParams,
  column: z.string(),
  condition: z.string(),
  pollIntervalMs: z.number().optional(),
}, async (p) => handleSetAlert(p as Record<string, unknown>))

server.tool('remove_schedule', 'Stop and remove a scheduled summary or alert by id', {
  id: z.string(),
}, async (p) => handleRemoveSchedule(p as Record<string, unknown>))

// Restore persisted schedules and alerts on startup
await restoreSchedules()
await restoreAlerts()

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('Unified MCP server running on stdio')
