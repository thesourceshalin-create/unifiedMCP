import ToolCallIndicator from './ToolCallIndicator'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  messages: Message[]
  streamingText: string
  activeToolCall: string | null
  sourceName: string
}

export default function MessageList({ messages, streamingText, activeToolCall, sourceName }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`max-w-2xl rounded-lg px-4 py-3 text-sm leading-relaxed ${
            msg.role === 'user'
              ? 'self-end bg-surface border border-border text-zinc-200'
              : 'self-start border-l-2 border-accent bg-accent-dim text-accent-text'
          }`}
        >
          {msg.content}
        </div>
      ))}
      {activeToolCall && (
        <ToolCallIndicator toolName={activeToolCall} sourceName={sourceName} />
      )}
      {streamingText && (
        <div className="max-w-2xl self-start rounded-lg border-l-2 border-accent bg-accent-dim px-4 py-3 text-sm leading-relaxed text-accent-text">
          {streamingText}
          <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-accent" />
        </div>
      )}
    </div>
  )
}
