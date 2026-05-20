interface Props {
  toolName: string
  sourceName: string
}

const TOOL_LABELS: Record<string, string> = {
  list_sheets: 'Listing sheets',
  read_sheet: 'Reading sheet',
  query_range: 'Querying data',
  summarize_sheet: 'Summarizing sheet',
  find_duplicates: 'Finding duplicates',
}

export default function ToolCallIndicator({ toolName, sourceName }: Props) {
  const label = TOOL_LABELS[toolName] ?? toolName
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
      <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
      {label} in {sourceName}…
    </div>
  )
}
