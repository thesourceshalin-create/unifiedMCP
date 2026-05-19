import cron from 'node-cron'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import type { Schedule } from '../types.js'
import { getConnector } from '../router.js'

const runningJobs = new Map<string, cron.ScheduledTask>()

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

async function runSummary(schedule: Schedule): Promise<void> {
  const connector = getConnector(schedule.source)
  const schema = await connector.describe(schedule.target, schedule.sheet)
  const outDir = schedule.delivery.dir
  await fs.mkdir(outDir, { recursive: true })
  const filename = `summary-${schedule.id}-${Date.now()}.json`
  await fs.writeFile(path.join(outDir, filename), JSON.stringify(schema, null, 2))
}

export async function addSchedule(params: { source: string; target: string; sheet: string; cron: string }): Promise<string> {
  const id = `sched-${Date.now()}`
  const full: Schedule = {
    id,
    type: 'summary',
    source: params.source as Schedule['source'],
    target: params.target,
    sheet: params.sheet,
    cron: params.cron,
    delivery: { type: 'file', dir: path.join(getMcpDir(), 'summaries') },
  }
  const schedules = await loadSchedules()
  schedules.push(full)
  await saveSchedules(schedules)
  const job = cron.schedule(params.cron, () => { runSummary(full).catch(console.error) })
  runningJobs.set(id, job)
  return id
}

export async function restoreSchedules(): Promise<void> {
  const schedules = await loadSchedules()
  for (const s of schedules.filter(s => s.type === 'summary' && s.cron)) {
    if (!runningJobs.has(s.id)) {
      const job = cron.schedule(s.cron!, () => { runSummary(s).catch(console.error) })
      runningJobs.set(s.id, job)
    }
  }
}

export async function removeSchedule(id: string): Promise<void> {
  const job = runningJobs.get(id)
  if (job) {
    job.stop()
    runningJobs.delete(id)
  }
  const schedules = await loadSchedules()
  await saveSchedules(schedules.filter(s => s.id !== id))
}
