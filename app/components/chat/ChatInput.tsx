'use client'

import { useState, KeyboardEvent } from 'react'

interface Props {
  onSend: (message: string) => void
  disabled: boolean
  placeholder: string
}

export default function ChatInput({ onSend, disabled, placeholder }: Props) {
  const [value, setValue] = useState('')

  function handleSend() {
    if (!value.trim() || disabled) return
    onSend(value.trim())
    setValue('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border p-4">
      <div className="flex items-end gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder-muted focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40 hover:bg-green-400 transition-colors"
        >
          Send
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">Enter to send · Shift+Enter for newline</p>
    </div>
  )
}
