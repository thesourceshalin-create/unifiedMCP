'use client'

import { useState } from 'react'
import type { QueryFilter, FilterOperator } from '../../../src/types'

const OPERATORS: FilterOperator[] = ['=', '!=', '>', '<', '>=', '<=', 'contains', 'not_contains']

interface Props {
  columns: string[]
  onFiltersChange: (filters: QueryFilter[]) => void
}

export default function FilterBar({ columns, onFiltersChange }: Props) {
  const [filters, setFilters] = useState<QueryFilter[]>([])

  function addFilter() {
    const f: QueryFilter = { column: columns[0] ?? '', operator: '=', value: '' }
    const next = [...filters, f]
    setFilters(next)
    onFiltersChange(next)
  }

  function updateFilter(i: number, patch: Partial<QueryFilter>) {
    const next = filters.map((f, idx) => idx === i ? { ...f, ...patch } : f)
    setFilters(next)
    onFiltersChange(next)
  }

  function removeFilter(i: number) {
    const next = filters.filter((_, idx) => idx !== i)
    setFilters(next)
    onFiltersChange(next)
  }

  const inputClass = 'rounded border border-border bg-surface px-2 py-1 text-xs text-zinc-200 focus:border-accent focus:outline-none'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((f, i) => (
        <div key={i} className="flex items-center gap-1 rounded border border-border bg-surface px-2 py-1">
          <select value={f.column} onChange={e => updateFilter(i, { column: e.target.value })} className={inputClass}>
            {columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={f.operator} onChange={e => updateFilter(i, { operator: e.target.value as FilterOperator })} className={inputClass}>
            {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
          <input
            value={String(f.value)}
            onChange={e => updateFilter(i, { value: e.target.value })}
            placeholder="value"
            className={`${inputClass} w-24`}
          />
          <button onClick={() => removeFilter(i)} className="ml-1 text-muted hover:text-red-400">✕</button>
        </div>
      ))}
      <button
        onClick={addFilter}
        disabled={columns.length === 0}
        className="rounded border border-border px-3 py-1 text-xs text-accent hover:border-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        + Filter
      </button>
    </div>
  )
}
