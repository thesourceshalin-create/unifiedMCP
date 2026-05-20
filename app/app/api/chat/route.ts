import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { getAnthropic, CHAT_TOOLS } from '@/lib/claude'
import { resolveWebConnector } from '@/lib/webConnector'
import type { QueryFilter } from '@/lib/webConnector'

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

  const { connectionId, message, history } = body

  if (!connectionId) return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 })
  if (!message || typeof message !== 'string') return NextResponse.json({ error: 'Missing message' }, { status: 400 })
  if (message.length > 10000) return NextResponse.json({ error: 'Message too long (max 10000 chars)' }, { status: 400 })
  if (!Array.isArray(history)) return NextResponse.json({ error: 'history must be an array' }, { status: 400 })

  // Validate each history item and cap at 50 entries
  const validRoles = new Set(['user', 'assistant'])
  const validatedHistory = history.slice(-50).filter(
    (h): h is ChatMessage => h && typeof h === 'object' && validRoles.has(h.role) && typeof h.content === 'string'
  )

  const messages: Anthropic.MessageParam[] = [
    ...validatedHistory.map(h => ({ role: h.role, content: h.content })),
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
      let iterations = 0

      while (true) {
        if (req.signal.aborted) break
        if (++iterations > 10) break

        let response: Anthropic.Message | undefined
        try {
          response = await getAnthropic().messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: 'You are a helpful data assistant with access to the user\'s connected data source. Use the provided tools to answer questions accurately based on the actual data. Do not invent or guess data values.',
            tools: CHAT_TOOLS,
            messages: currentMessages,
          }, { signal: req.signal })
        } catch (e) {
          if (req.signal.aborted) break // client disconnected, clean exit
          throw e // real error, propagate to outer catch
        }
        if (!response) break

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

        // Execute tool calls — resolve connector once per turn to avoid multiple file downloads
        const toolResults: Anthropic.ToolResultBlockParam[] = []
        const { connector, target, cleanup } = await resolveWebConnector(connectionId as string, userId as string)
        try {
          for (const toolUse of toolUseBlocks) {
            await writeEvent('tool_start', { toolName: toolUse.name })
            try {
              const result = await executeToolCall(toolUse, connector, target)
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
        } finally {
          await cleanup()
        }

        currentMessages = [
          ...currentMessages,
          { role: 'assistant' as const, content: response.content },
          { role: 'user' as const, content: toolResults },
        ]
      }
    } catch (e) {
      console.error('[POST /api/chat] stream error', e)
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
  connector: Awaited<ReturnType<typeof resolveWebConnector>>['connector'],
  target: Awaited<ReturnType<typeof resolveWebConnector>>['target'],
): Promise<unknown> {
  const input = toolUse.input as Record<string, unknown>

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
      const rowKey = (row: Record<string, unknown>) =>
        cols.map(c => String(row[c] ?? '')).join('||')
      const groups = new Map<string, typeof rows>()
      for (const row of rows) {
        const key = rowKey(row as Record<string, unknown>)
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(row)
      }
      const duplicateGroups = Array.from(groups.values()).filter(g => g.length > 1)
      return {
        duplicateCount: duplicateGroups.reduce((sum, g) => sum + g.length - 1, 0),
        groups: duplicateGroups,
      }
    }

    default:
      throw new Error(`Unknown tool: ${toolUse.name}`)
  }
}
