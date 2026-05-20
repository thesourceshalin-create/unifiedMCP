'use client'

import { useEffect, useState } from 'react'

interface Source {
  id: string
  label: string
}

interface Props {
  onSelect: (connectionId: string, sheet: string) => void
}

export default function SheetSelector({ onSelect }: Props) {
  const [sources, setSources] = useState<Source[]>([])
  const [connectionId, setConnectionId] = useState('')
  const [sheets, setSheets] = useState<string[]>([])
  const [sheet, setSheet] = useState('')
  const [loadingSheets, setLoadingSheets] = useState(false)

  useEffect(() => {
    fetch('/api/sources').then(r => r.json()).then(setSources)
  }, [])

  async function handleConnectionChange(id: string) {
    setConnectionId(id)
    setSheet('')
    setSheets([])
    if (!id) return
    setLoadingSheets(true)
    try {
      const res = await fetch(`/api/data/sheets?connectionId=${id}`)
      const data = await res.json()
      setSheets(Array.isArray(data) ? data : [])
    } finally {
      setLoadingSheets(false)
    }
  }

  function handleSheetChange(s: string) {
    setSheet(s)
    if (connectionId && s) onSelect(connectionId, s)
  }

  const selectClass = 'rounded border border-border bg-surface px-3 py-2 text-sm text-zinc-200 focus:border-accent focus:outline-none'

  return (
    <div className="flex items-center gap-3">
      <select value={connectionId} onChange={e => handleConnectionChange(e.target.value)} className={selectClass}>
        <option value="">Select source…</option>
        {sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <select value={sheet} onChange={e => handleSheetChange(e.target.value)} className={selectClass} disabled={!sheets.length}>
        <option value="">Select sheet…</option>
        {sheets.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      {loadingSheets && <span className="text-xs text-muted">Loading…</span>}
    </div>
  )
}
