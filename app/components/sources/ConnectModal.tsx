'use client'

import { useState } from 'react'

interface Props {
  onClose: () => void
  onCreated: () => void
}

type Step = 'pick' | 'configure' | 'saving'
type SourceType = 'excel' | 'sheets' | 'airtable'

const SOURCE_TYPES: { type: SourceType; label: string; icon: string }[] = [
  { type: 'excel', label: 'Excel', icon: '📗' },
  { type: 'sheets', label: 'Google Sheets', icon: '📊' },
  { type: 'airtable', label: 'Airtable', icon: '🗂️' },
]

export default function ConnectModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>('pick')
  const [sourceType, setSourceType] = useState<SourceType | null>(null)
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')

  // Excel fields
  const [excelFile, setExcelFile] = useState<File | null>(null)

  // Sheets fields
  const [sheetsId, setSheetsId] = useState('')
  const [sheetsAuthCode, setSheetsAuthCode] = useState('')
  const [oauthUrl, setOauthUrl] = useState('')

  // Airtable fields
  const [airtableKey, setAirtableKey] = useState('')
  const [airtableBase, setAirtableBase] = useState('')

  async function handlePick(type: SourceType) {
    setSourceType(type)
    setError('')
    if (type === 'sheets') {
      const res = await fetch('/api/sources/sheets-auth-url')
      const { url } = await res.json()
      setOauthUrl(url)
    }
    setStep('configure')
  }

  async function handleConnect() {
    if (!label.trim()) { setError('Enter a label'); return }
    setError('')
    setStep('saving')

    try {
      if (sourceType === 'excel') {
        if (!excelFile) { setError('Select a file'); setStep('configure'); return }
        const formData = new FormData()
        formData.append('file', excelFile)
        const blobRes = await fetch('/api/blob/upload', { method: 'POST', body: formData })
        if (!blobRes.ok) throw new Error('Upload failed')
        const { url: blobUrl } = await blobRes.json()
        await saveConnection({ type: 'excel', blobUrl })
      } else if (sourceType === 'sheets') {
        const tokenRes = await fetch('/api/sources/sheets-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authCode: sheetsAuthCode, spreadsheetId: sheetsId }),
        })
        if (!tokenRes.ok) throw new Error('OAuth exchange failed')
        const { config } = await tokenRes.json()
        await saveConnection(config)
      } else if (sourceType === 'airtable') {
        await saveConnection({ type: 'airtable', apiKey: airtableKey, baseId: airtableBase })
      }
      onCreated()
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setStep('configure')
    }
  }

  async function saveConnection(config: object) {
    const res = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: sourceType, label, config }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Failed to save connection')
    }
  }

  const inputClass = 'mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-zinc-100 placeholder-muted focus:border-accent focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-100">Connect a data source</h2>
          <button onClick={onClose} className="text-muted hover:text-white">✕</button>
        </div>

        {step === 'pick' && (
          <div className="grid grid-cols-3 gap-3">
            {SOURCE_TYPES.map(s => (
              <button
                key={s.type}
                onClick={() => handlePick(s.type)}
                className="flex flex-col items-center rounded-lg border border-border bg-background p-4 hover:border-accent transition-colors"
              >
                <span className="text-2xl">{s.icon}</span>
                <span className="mt-2 text-xs text-muted">{s.label}</span>
              </button>
            ))}
          </div>
        )}

        {step === 'configure' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted">Label</label>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Diamond Tracker"
                className={inputClass}
              />
            </div>

            {sourceType === 'excel' && (
              <div>
                <label className="text-xs text-muted">Excel file (.xlsx)</label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={e => setExcelFile(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full text-sm text-zinc-300"
                />
              </div>
            )}

            {sourceType === 'sheets' && (
              <>
                <div>
                  <label className="text-xs text-muted">Spreadsheet ID</label>
                  <input
                    value={sheetsId}
                    onChange={e => setSheetsId(e.target.value)}
                    placeholder="From the Google Sheets URL"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted">Step 1: Authorize</label>
                  <a
                    href={oauthUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block rounded bg-accent-dim px-3 py-2 text-center text-xs text-accent hover:bg-green-900 transition-colors"
                  >
                    Open Google Auth →
                  </a>
                </div>
                <div>
                  <label className="text-xs text-muted">Step 2: Paste auth code</label>
                  <input
                    value={sheetsAuthCode}
                    onChange={e => setSheetsAuthCode(e.target.value)}
                    placeholder="Paste code from Google"
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {sourceType === 'airtable' && (
              <>
                <div>
                  <label className="text-xs text-muted">API Key</label>
                  <input
                    value={airtableKey}
                    onChange={e => setAirtableKey(e.target.value)}
                    placeholder="pat..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted">Base ID</label>
                  <input
                    value={airtableBase}
                    onChange={e => setAirtableBase(e.target.value)}
                    placeholder="app..."
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep('pick')}
                className="flex-1 rounded border border-border py-2 text-sm text-muted hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleConnect}
                className="flex-1 rounded bg-accent py-2 text-sm font-semibold text-black hover:bg-green-400 transition-colors"
              >
                Connect
              </button>
            </div>
          </div>
        )}

        {step === 'saving' && (
          <p className="text-center text-sm text-muted py-6">Connecting…</p>
        )}
      </div>
    </div>
  )
}
