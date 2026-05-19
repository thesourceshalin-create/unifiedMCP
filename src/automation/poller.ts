import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import type { Schedule, QueryFilter } from '../types.js'
import { getConnector } from '../router.js'

function getMcpDir(): string {
  return process.env.UNIFIED_MCP_DIR ?? path.join(os.homedir(), '.unified-mcp')
}

async function loadSchedules(): Promise<Schedule[]> {
  try {
    return JSON.parse(await fs.readFile(path.join(getMcpDir(), 'schedules.json'), 'utf-8')) as Schedule[]
  } catch { return [] }
}

async function saveSchedules(schedules: Schedule[]): Promise<void> {
  await fs.mkdir(getMcpDir(), { recursive: true })
  await fs.writeFile(path.join(getMcpDir(), 'schedules.json'), JSON.stringify(schedules, null, 2))
}

function parseCondition(condition: string, column: string): QueryFilter {
  const match = condition.match(/value\s*(>|<|>=|<=|=|!=|contains|not_contains)\s*(.+)/)
  if (!match) throw new Error(`Invalid condition: ${condition}`)
  const [, operator, rawValue] = match
  const trimmed = rawValue.trim().replace(/^['"]|['"]$/g, '')
  const value: string | number = isNaN(Number(trimmed)) ? trimmed : Number(trimmed)
  return { column, operator: operator as QueryFilter['operator'], value }
}

async function checkAlert(alert: Schedule): Promise<void> {
  if (!alert.column || !alert.condition) return
  const filter = parseCondition(alert.condition, alert.column)
  const connector = getConnector(alert.source)
  const rows = await connector.query(alert.target, alert.sheet, [filter])
  if (rows.length === 0) return
  const outDir = alert.delivery.dir
  await fs.mkdir(outDir, { recursive: true })
  const filename = `alert-${alert.id}-${Date.now()}.json`
  await fs.writeFile(path.join(outDir, filename), JSON.stringify({ alert, matchedRows: rows }, null, 2))
}

export async function addAlert(params: { source: string; target: string; sheet: string; column: string; condition: string; pollIntervalMs?: number }): Promise<string> {
  const id = `alert-${Date.now()}`
  const full: Schedule = {
    id,
    type: 'alert',
    source: params.source as Schedule['source'],
    target: params.target,
    sheet: params.sheet,
    column: params.column,
    condition: params.condition,
    pollIntervalMs: params.pollIntervalMs ?? 300000,
    delivery: { type: 'file', dir: path.join(getMcpDir(), 'alerts') },
  }
  const schedules = await loadSchedules()
  schedules.push(full)
  await saveSchedules(schedules)
  setInterval(() => { checkAlert(full).catch(console.error) }, full.pollIntervalMs)
  return id
}

export async function restoreAlerts(): Promise<void> {
  const schedules = await loadSchedules()
  for (const s of schedules.filter(s => s.type === 'alert')) {
    setInterval(() => { checkAlert(s).catch(console.error) }, s.pollIntervalMs ?? 300000)
  }
}
