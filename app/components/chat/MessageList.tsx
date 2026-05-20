import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
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

const markdownComponents: Components = {
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-surface px-2 py-1 text-left font-semibold text-zinc-100">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-2 py-1 align-top text-zinc-300">{children}</td>
  ),
  p: ({ children }) => <p className="my-1">{children}</p>,
  ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="my-0.5">{children}</li>,
  code: ({ children }) => (
    <code className="rounded bg-surface px-1 py-0.5 text-xs text-zinc-200">{children}</code>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-accent underline">
      {children}
    </a>
  ),
  h1: ({ children }) => <h3 className="my-1 font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="my-1 font-semibold">{children}</h3>,
  h3: ({ children }) => <h3 className="my-1 font-semibold">{children}</h3>,
}

function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {children}
    </ReactMarkdown>
  )
}

export default function MessageList({ messages, streamingText, activeToolCall, sourceName }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
      {messages.map((msg, i) => (
        <div
          key={`${msg.role}-${i}-${msg.content.slice(0, 20)}`}
          className={`max-w-2xl rounded-lg px-4 py-3 text-sm leading-relaxed ${
            msg.role === 'user'
              ? 'self-end border border-border bg-surface text-zinc-200'
              : 'self-start border-l-2 border-accent bg-accent-dim text-accent-text'
          }`}
        >
          {msg.role === 'user' ? msg.content : <Markdown>{msg.content}</Markdown>}
        </div>
      ))}
      {activeToolCall && (
        <ToolCallIndicator toolName={activeToolCall} sourceName={sourceName} />
      )}
      {streamingText && (
        <div className="max-w-2xl self-start rounded-lg border-l-2 border-accent bg-accent-dim px-4 py-3 text-sm leading-relaxed text-accent-text">
          <Markdown>{streamingText}</Markdown>
          <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-accent" />
        </div>
      )}
    </div>
  )
}
