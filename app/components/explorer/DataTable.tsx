'use client'

import type { Row } from '../../../src/types'

interface Props {
  rows: Row[]
  loading: boolean
}

const PAGE_SIZE = 50

export default function DataTable({ rows, loading }: Props) {
  const columns = rows.length > 0
    ? Object.keys(rows[0]).filter(k => k !== '_rowId')
    : []

  if (loading) {
    return <div className="flex h-48 items-center justify-center text-sm text-muted">Loading…</div>
  }

  if (!rows.length) {
    return <div className="flex h-48 items-center justify-center text-sm text-muted">No data. Select a source and sheet above.</div>
  }

  return (
    <div className="overflow-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface">
            {columns.map(col => (
              <th key={col} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, PAGE_SIZE).map(row => (
            <tr key={row._rowId} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
              {columns.map(col => (
                <td key={col} className="px-3 py-2 text-zinc-300 whitespace-nowrap">
                  {row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > PAGE_SIZE && (
        <div className="border-t border-border px-4 py-2 text-xs text-muted">
          Showing {PAGE_SIZE} of {rows.length} rows
        </div>
      )}
    </div>
  )
}
