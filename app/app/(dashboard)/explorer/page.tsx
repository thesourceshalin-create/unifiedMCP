'use client'

import { useState } from 'react'
import SheetSelector from '@/components/explorer/SheetSelector'
import FilterBar from '@/components/explorer/FilterBar'
import DataTable from '@/components/explorer/DataTable'
import type { Row, QueryFilter } from '../../../../src/types'

export default function ExplorerPage() {
  const [connectionId, setConnectionId] = useState('')
  const [sheet, setSheet] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [filters, setFilters] = useState<QueryFilter[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function fetchRows(cid: string, s: string, f: QueryFilter[]) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ connectionId: cid, sheet: s })
      if (f.length) params.set('filters', JSON.stringify(f))
      const res = await fetch(`/api/data/rows?${params}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      const data: Row[] = await res.json()
      setRows(data)
      setColumns(data.length > 0 ? Object.keys(data[0]).filter(k => k !== '_rowId') : [])
    } catch (e) {
      setError((e as Error).message)
      setRows([])
      setColumns([])
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(cid: string, s: string) {
    setConnectionId(cid)
    setSheet(s)
    setFilters([])
    fetchRows(cid, s, [])
  }

  function handleFiltersChange(f: QueryFilter[]) {
    setFilters(f)
    if (connectionId && sheet) fetchRows(connectionId, sheet, f)
  }

  return (
    <div className="flex h-full flex-col p-6 gap-4">
      <h1 className="text-lg font-semibold text-zinc-100">Data Explorer</h1>
      <SheetSelector onSelect={handleSelect} />
      {columns.length > 0 && (
        <FilterBar columns={columns} onFiltersChange={handleFiltersChange} />
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex-1 overflow-auto">
        <DataTable rows={rows} loading={loading} />
      </div>
    </div>
  )
}
