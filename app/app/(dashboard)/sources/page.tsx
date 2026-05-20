'use client'

import { useEffect, useState } from 'react'
import SourceCard from '@/components/sources/SourceCard'
import ConnectModal from '@/components/sources/ConnectModal'

interface Source {
  id: string
  type: string
  label: string
  createdAt: string
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [deleteError, setDeleteError] = useState('')

  async function load() {
    try {
      const res = await fetch('/api/sources')
      if (!res.ok) throw new Error(`Failed to load sources: ${res.status}`)
      const data = await res.json()
      setSources(data)
    } catch (e) {
      setLoadError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    setDeleteError('')
    const res = await fetch(`/api/sources/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setDeleteError(`Failed to delete source: ${res.status}`)
      return
    }
    setSources(s => s.filter(x => x.id !== id))
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">My Data Sources</h1>
        <button
          onClick={() => setShowModal(true)}
          className="rounded bg-accent px-4 py-2 text-sm font-semibold text-black hover:bg-green-400 transition-colors"
        >
          + Connect source
        </button>
      </div>

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {loadError && <p className="text-sm text-red-400">{loadError}</p>}
      {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}

      {!loading && sources.length === 0 && (
        <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
          <p className="text-sm text-muted">No sources connected yet.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 text-sm text-accent hover:underline"
          >
            Connect your first source →
          </button>
        </div>
      )}

      <div className="space-y-3">
        {sources.map(s => (
          <SourceCard
            key={s.id}
            id={s.id}
            type={s.type}
            label={s.label}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {showModal && (
        <ConnectModal
          onClose={() => setShowModal(false)}
          onCreated={load}
        />
      )}
    </div>
  )
}
