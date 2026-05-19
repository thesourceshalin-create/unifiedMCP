import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { handleConnectSource, handleListConnectedSources, handleDisconnectSource } from '../../../src/tools/auth.js'

const TEST_DIR = path.join(os.tmpdir(), 'auth-test-' + Date.now())

beforeEach(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true })
  process.env.UNIFIED_MCP_DIR = TEST_DIR
})

afterEach(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true })
  delete process.env.UNIFIED_MCP_DIR
})

describe('handleConnectSource — excel', () => {
  it('connects an Excel source by file path', async () => {
    const xlsxPath = path.join(TEST_DIR, 'test.xlsx')
    await fs.writeFile(xlsxPath, Buffer.alloc(0))

    const result = await handleConnectSource({
      source: 'excel',
      id: 'my-excel',
      label: 'My Excel',
      filePath: xlsxPath,
    })
    expect(result.isError).toBeFalsy()
    expect(result.content[0].text).toContain('my-excel')
  })

  it('returns error when Excel file path does not exist', async () => {
    const result = await handleConnectSource({
      source: 'excel',
      id: 'bad-excel',
      label: 'Bad',
      filePath: '/nonexistent/file.xlsx',
    })
    expect(result.isError).toBe(true)
  })
})

describe('handleConnectSource — airtable', () => {
  it('connects Airtable with apiKey and baseId after validation', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tables: [] }),
      text: async () => '{"tables":[]}',
    } as unknown as Response)

    const result = await handleConnectSource({
      source: 'airtable',
      id: 'my-airtable',
      label: 'My Airtable',
      apiKey: 'patXYZ',
      baseId: 'appABC',
    })
    expect(result.isError).toBeFalsy()
    expect(result.content[0].text).toContain('my-airtable')
  })

  it('returns error when Airtable validation fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Unauthorized',
    } as unknown as Response)

    const result = await handleConnectSource({
      source: 'airtable',
      id: 'bad-airtable',
      label: 'Bad',
      apiKey: 'bad-key',
      baseId: 'appABC',
    })
    expect(result.isError).toBe(true)
  })
})

describe('handleListConnectedSources', () => {
  it('returns empty list when no connections', async () => {
    const result = await handleListConnectedSources()
    expect(JSON.parse(result.content[0].text)).toEqual([])
  })

  it('lists connections without secrets', async () => {
    const conn = {
      id: 'test', type: 'airtable' as const, label: 'Test',
      config: { baseId: 'app1', apiKey: 'SECRET_KEY' }
    }
    await fs.writeFile(path.join(TEST_DIR, 'connections.json'), JSON.stringify([conn]))
    const result = await handleListConnectedSources()
    expect(result.content[0].text).not.toContain('SECRET_KEY')
    expect(result.content[0].text).toContain('test')
  })
})

describe('handleDisconnectSource', () => {
  it('removes a connection by id', async () => {
    const xlsxPath = path.join(TEST_DIR, 'test.xlsx')
    await fs.writeFile(xlsxPath, Buffer.alloc(0))
    await handleConnectSource({ source: 'excel', id: 'to-remove', label: 'X', filePath: xlsxPath })

    const result = await handleDisconnectSource({ id: 'to-remove' })
    expect(result.isError).toBeFalsy()

    const list = await handleListConnectedSources()
    expect(list.content[0].text).not.toContain('to-remove')
  })
})
