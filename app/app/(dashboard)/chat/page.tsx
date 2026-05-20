'use client'

import { useEffect, useRef, useState } from 'react'
import MessageList from '@/components/chat/MessageList'
import ChatInput from '@/components/chat/ChatInput'

interface Source {
  id: string
  label: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [connectionId, setConnectionId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/sources')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: Source[]) => {
        setSources(data)
        if (data.length > 0) setConnectionId(data[0].id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, activeToolCall])

  const activeSource = sources.find(s => s.id === connectionId)

  async function handleSend(message: string) {
    if (!connectionId) return
    setMessages(prev => [...prev, { role: 'user', content: message }])
    setSending(true)
    setStreamingText('')
    setActiveToolCall(null)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, message, history: messages }),
      })

      if (!res.body) throw new Error('No response body')

      let assistantText = ''
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const events = buf.split('\n\n')
        buf = events.pop() ?? ''
        for (const event of events) {
          const line = event.split('\n').find(l => l.startsWith('data: '))
          if (!line) continue
          let parsed: { type: string; [k: string]: unknown }
          try {
            parsed = JSON.parse(line.slice(6))
          } catch {
            continue
          }
          if (parsed.type === 'error') {
            throw new Error(parsed.message as string)
          }
          if (parsed.type === 'text') {
            assistantText += parsed.text as string
            setStreamingText(assistantText)
          } else if (parsed.type === 'tool_start') {
            setActiveToolCall(parsed.toolName as string)
          } else if (parsed.type === 'tool_end' || parsed.type === 'tool_error') {
            setActiveToolCall(null)
          }
        }
      }

      if (assistantText) {
        setMessages(prev => [...prev, { role: 'assistant', content: assistantText }])
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
      }])
    } finally {
      setStreamingText('')
      setActiveToolCall(null)
      setSending(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="text-xs text-muted">Source:</span>
        <select
          value={connectionId}
          onChange={e => setConnectionId(e.target.value)}
          className="rounded border border-border bg-surface px-3 py-1.5 text-sm text-zinc-200 focus:border-accent focus:outline-none"
        >
          {sources.length === 0 && <option value="">No sources — connect one first</option>}
          {sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {messages.length === 0 && !sending && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted">
          {connectionId
            ? `Ask anything about ${activeSource?.label ?? 'your data'}…`
            : 'Connect a source on the Sources page first.'}
        </div>
      )}

      <MessageList
        messages={messages}
        streamingText={streamingText}
        activeToolCall={activeToolCall}
        sourceName={activeSource?.label ?? ''}
      />

      <div ref={bottomRef} />

      <ChatInput
        onSend={handleSend}
        disabled={sending || !connectionId}
        placeholder={connectionId ? `Ask about ${activeSource?.label ?? 'your data'}…` : 'Select a source first'}
      />
    </div>
  )
}
