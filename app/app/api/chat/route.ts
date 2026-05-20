import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { anthropic, CHAT_TOOLS } from '@/lib/claude'
import { resolveWebConnector } from '@/lib/webConnector'
import type { QueryFilter } from '../../../../src/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { connectionId?: string; message?: string; history?: ChatMessage[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { connectionId, message, history = [] } = body
  if (!connectionId || !message) {
    return NextResponse.json({ error: 'Missing connectionId or message' }, { status: 400 })
  }

  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ]

  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  async function write(chunk: string) {
    await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'text', text: chunk })}\n\n`))
  }

  async function writeEvent(type: string, payload: object) {
    await writer.write(encoder.encode(`data: ${JSON.stringify({ type, ...payload })}\n\n`))
  }

  async function run() {
    try {
      let currentMessages = messages

      while (true) {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          tools: CHAT_TOOLS,
          messages: currentMessages,
        })

        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        )
        const textBlocks = response.content.filter(
          (b): b is Anthropic.TextBlock => b.type === 'text'
        )

        for (const block of textBlocks) {
          if (block.text) await write(block.text)
        }

        if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) break

        const toolResults: Anthropic.ToolResultBlockParam[] = []

        for (const toolUse of toolUseBlocks) {
          await writeEvent('tool_start', { toolName: toolUse.name })
          try {
            const result = await executeToolCall(toolUse, connectionId, userId)
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            })
            await writeEvent('tool_end', { toolName: toolUse.name })
          } catch (e) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: `Error: ${e instanceof Error ? e.message : String(e)}`,
              is_error: true,
            })
            await writeEvent('tool_error', { toolName: toolUse.name, error: e instanceof Error ? e.message : String(e) })
          }
        }

        currentMessages = [
          ...currentMessages,
          { role: 'assistant' as const, content: response.content },
          { role: 'user' as const, content: toolResults },
        ]
      }
    } catch (e) {
      await writeEvent('error', { message: e instanceof Error ? e.message : String(e) })
    } finally {
      await writer.close()
    }
  }

  run()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

async function executeToolCall(
  toolUse: Anthropic.ToolUseBlock,
  connectionId: string,
  userId: string
): Promise<unknown> {
  const input = toolUse.input as Record<string, unknown>
  const { connector, target, cleanup } = await resolveWebConnector(connectionId, userId)

  try {
    switch (toolUse.name) {
      case 'list_sheets':
        return await connector.listSheets(target)

      case 'read_sheet':
        return await connector.query(target, input.sheet as string)

      case 'query_range':
        return await connector.query(
          target,
          input.sheet as string,
          (input.filters as QueryFilter[] | undefined) ?? [],
          input.limit as number | undefined
        )

      case 'summarize_sheet':
        return await connector.describe(target, input.sheet as string)

      case 'find_duplicates': {
        const rows = await connector.query(target, input.sheet as string)
        const cols = (input.columns as string[] | undefined) ??
          Object.keys(rows[0] ?? {}).filter(k => k !== '_rowId')
        function rowKey(row: Record<string, unknown>) {
          return cols.map(c => String(row[c] ?? '')).join('||')
        }
        const groups = new Map<string, typeof rows>()
        for (const row of rows) {
          const key = rowKey(row as Record<string, unknown>)
          if (!groups.has(key)) groups.set(key, [])
          groups.get(key)!.push(row)
        }
        const duplicateGroups = [...groups.values()].filter(g => g.length > 1)
        return {
          duplicateCount: duplicateGroups.reduce((sum, g) => sum + g.length - 1, 0),
          groups: duplicateGroups,
        }
      }

      default:
        throw new Error(`Unknown tool: ${toolUse.name}`)
    }
  } finally {
    await cleanup()
  }
}
