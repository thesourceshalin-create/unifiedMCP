import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import type { Connection } from './types.js'

function getMcpDir(): string {
  return process.env.UNIFIED_MCP_DIR ?? path.join(os.homedir(), '.unified-mcp')
}

function getConnectionsPath(): string {
  return path.join(getMcpDir(), 'connections.json')
}

export async function loadConnections(): Promise<Connection[]> {
  try {
    const raw = await fs.readFile(getConnectionsPath(), 'utf-8')
    return JSON.parse(raw) as Connection[]
  } catch {
    return []
  }
}

export async function saveConnection(connection: Connection): Promise<void> {
  await fs.mkdir(getMcpDir(), { recursive: true })
  const existing = await loadConnections()
  const updated = existing.filter(c => c.id !== connection.id)
  updated.push(connection)
  await fs.writeFile(getConnectionsPath(), JSON.stringify(updated, null, 2))
}

export async function removeConnection(id: string): Promise<void> {
  await fs.mkdir(getMcpDir(), { recursive: true })
  const existing = await loadConnections()
  const updated = existing.filter(c => c.id !== id)
  await fs.writeFile(getConnectionsPath(), JSON.stringify(updated, null, 2))
}

export async function findConnection(id: string): Promise<Connection | undefined> {
  const all = await loadConnections()
  return all.find(c => c.id === id)
}
