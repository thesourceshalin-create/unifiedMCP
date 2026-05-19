import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import {
  loadConnections,
  saveConnection,
  removeConnection,
  findConnection,
} from '../../src/connections.js'
import type { Connection } from '../../src/types.js'

const TEST_DIR = path.join(os.tmpdir(), 'unified-mcp-test-' + Date.now())

const mockConnection: Connection = {
  id: 'test-excel',
  type: 'excel',
  label: 'Test Excel',
  config: { filePath: '/tmp/test.xlsx' },
}

beforeEach(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true })
  process.env.UNIFIED_MCP_DIR = TEST_DIR
})

afterEach(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true })
  delete process.env.UNIFIED_MCP_DIR
})

describe('loadConnections', () => {
  it('returns empty array when file does not exist', async () => {
    expect(await loadConnections()).toEqual([])
  })
})

describe('saveConnection', () => {
  it('persists a connection to disk', async () => {
    await saveConnection(mockConnection)
    const loaded = await loadConnections()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]).toEqual(mockConnection)
  })

  it('overwrites a connection with the same id', async () => {
    await saveConnection(mockConnection)
    await saveConnection({ ...mockConnection, label: 'Updated' })
    const loaded = await loadConnections()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].label).toBe('Updated')
  })
})

describe('removeConnection', () => {
  it('removes a connection by id', async () => {
    await saveConnection(mockConnection)
    await removeConnection('test-excel')
    expect(await loadConnections()).toEqual([])
  })

  it('does nothing if id does not exist', async () => {
    await saveConnection(mockConnection)
    await removeConnection('nonexistent')
    expect(await loadConnections()).toHaveLength(1)
  })
})

describe('findConnection', () => {
  it('returns connection by id', async () => {
    await saveConnection(mockConnection)
    const found = await findConnection('test-excel')
    expect(found).toEqual(mockConnection)
  })

  it('returns undefined if not found', async () => {
    expect(await findConnection('nonexistent')).toBeUndefined()
  })
})
