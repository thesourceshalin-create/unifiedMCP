interface Props {
  id: string
  type: string
  label: string
  onDelete: (id: string) => void
}

const typeLabels: Record<string, { short: string; color: string }> = {
  excel: { short: 'xlsx', color: 'text-green-400' },
  sheets: { short: 'gsh', color: 'text-blue-400' },
  airtable: { short: 'air', color: 'text-orange-400' },
}

export default function SourceCard({ id, type, label, onDelete }: Props) {
  const meta = typeLabels[type] ?? { short: type, color: 'text-zinc-400' }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <span className={`text-xs font-semibold ${meta.color}`}>{meta.short}</span>
      <span className="flex-1 text-sm text-zinc-200">{label}</span>
      <span className="h-2 w-2 rounded-full bg-accent" title="Connected" />
      <button
        onClick={() => onDelete(id)}
        className="ml-2 text-xs text-muted hover:text-red-400 transition-colors"
      >
        Remove
      </button>
    </div>
  )
}
