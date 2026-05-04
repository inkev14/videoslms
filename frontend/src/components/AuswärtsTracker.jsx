import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { auswärtsApi } from '../api/client.js'
import { getAuftragBadgeClass } from '../utils/colors.js'

const AUSWARTS_STATUS = ['Ausstehend', 'Unterwegs', 'Zurück', 'Verzögert']

function StatusBadge({ status }) {
  const map = {
    'Ausstehend': { cls: 'bg-gray-100 text-gray-600', dot: '⚪' },
    'Unterwegs': { cls: 'bg-yellow-100 text-yellow-800', dot: '🟡' },
    'Zurück': { cls: 'bg-green-100 text-green-800', dot: '🟢' },
    'Verzögert': { cls: 'bg-red-100 text-red-800', dot: '🔴' },
  }
  const { cls, dot } = map[status] || map['Ausstehend']
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {dot} {status || 'Ausstehend'}
    </span>
  )
}

function InlineDateEdit({ value, onSave, placeholder = 'Datum…' }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value || '')

  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        className="border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => { onSave(val || null); setEditing(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { onSave(val || null); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
      />
    )
  }
  return (
    <button onClick={() => setEditing(true)} className="text-left text-xs hover:underline hover:text-blue-600">
      {value ? new Date(value).toLocaleDateString('de-DE') : <span className="text-gray-300 italic">{placeholder}</span>}
    </button>
  )
}

function AuswärtsRow({ item, onUpdate, onDelete }) {
  const isOverdue = item.erw_rueckkehr &&
    new Date(item.erw_rueckkehr) < new Date() &&
    item.status !== 'Zurück'

  const badgeCls = getAuftragBadgeClass(item.auftrag_id || item.auftrag?.id)

  const handleUpdate = (field, value) => {
    onUpdate(item.id, { ...item, [field]: value })
  }

  return (
    <tr className={`border-b border-gray-100 hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ring-1 ring-inset ${badgeCls}`}>
          {item.auftrag?.id || item.auftrag_id || '–'}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">{item.auftrag?.kunde || '–'}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{item.schritt?.bezeichnung || item.schritt_bezeichnung || '–'}</td>
      <td className="px-4 py-3">
        <input
          type="text"
          className="text-sm border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full min-w-[120px]"
          value={item.dienstleister || ''}
          onChange={e => handleUpdate('dienstleister', e.target.value)}
          onBlur={e => onUpdate(item.id, { ...item, dienstleister: e.target.value })}
          placeholder="Dienstleister"
        />
      </td>
      <td className="px-4 py-3">
        <InlineDateEdit
          value={item.abgeschickt}
          onSave={v => handleUpdate('abgeschickt', v)}
          placeholder="Abschicken…"
        />
      </td>
      <td className="px-4 py-3">
        <div className={isOverdue ? 'text-red-600 font-semibold' : ''}>
          <InlineDateEdit
            value={item.erw_rueckkehr}
            onSave={v => handleUpdate('erw_rueckkehr', v)}
            placeholder="Erw. Rückkehr…"
          />
          {isOverdue && <div className="text-xs text-red-500 mt-0.5">Überfällig!</div>}
        </div>
      </td>
      <td className="px-4 py-3">
        <InlineDateEdit
          value={item.zurueck}
          onSave={v => handleUpdate('zurueck', v)}
          placeholder="Zurückgekehrt…"
        />
      </td>
      <td className="px-4 py-3">
        <select
          className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          value={item.status || 'Ausstehend'}
          onChange={e => handleUpdate('status', e.target.value)}
        >
          {AUSWARTS_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onDelete(item.id)}
          className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
        >
          Löschen
        </button>
      </td>
    </tr>
  )
}

function NewAuswärtsForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    auftrag_id: '',
    schritt_bezeichnung: '',
    dienstleister: '',
    abgeschickt: '',
    erw_rueckkehr: '',
    status: 'Ausstehend',
  })

  const handleSubmit = () => {
    if (!form.auftrag_id.trim()) return toast.error('Auftrags-Nr erforderlich')
    onSave(form)
  }

  return (
    <tr className="bg-blue-50 border-b border-blue-100">
      <td className="px-4 py-2">
        <input
          type="text"
          autoFocus
          className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none w-24"
          value={form.auftrag_id}
          onChange={e => setForm(f => ({ ...f, auftrag_id: e.target.value }))}
          placeholder="AUF-001 *"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="text"
          className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none w-24"
          value={form.auftrag?.kunde || ''}
          placeholder="–"
          disabled
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="text"
          className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none w-32"
          value={form.schritt_bezeichnung}
          onChange={e => setForm(f => ({ ...f, schritt_bezeichnung: e.target.value }))}
          placeholder="Schritt"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="text"
          className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none w-32"
          value={form.dienstleister}
          onChange={e => setForm(f => ({ ...f, dienstleister: e.target.value }))}
          placeholder="Dienstleister"
        />
      </td>
      <td className="px-4 py-2">
        <input type="date" className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none"
          value={form.abgeschickt} onChange={e => setForm(f => ({ ...f, abgeschickt: e.target.value }))} />
      </td>
      <td className="px-4 py-2">
        <input type="date" className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none"
          value={form.erw_rueckkehr} onChange={e => setForm(f => ({ ...f, erw_rueckkehr: e.target.value }))} />
      </td>
      <td className="px-4 py-2" />
      <td className="px-4 py-2">
        <select className="border border-blue-300 rounded px-1.5 py-1 text-xs focus:outline-none bg-white"
          value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
          {AUSWARTS_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td />
      <td className="px-4 py-2">
        <div className="flex gap-1">
          <button onClick={handleSubmit} className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Hinzufügen</button>
          <button onClick={onCancel} className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">Abbrechen</button>
        </div>
      </td>
    </tr>
  )
}

export default function AuswärtsTracker() {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const { data: auswarts = [], isLoading } = useQuery({
    queryKey: ['auswarts', statusFilter],
    queryFn: () => auswärtsApi.getAll(statusFilter ? { status: statusFilter } : {}),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => auswärtsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auswarts'] })
      toast.success('Gespeichert')
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => auswärtsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auswarts'] })
      toast.success('Gelöscht')
    },
    onError: (err) => toast.error(err.message),
  })

  const createMutation = useMutation({
    mutationFn: (data) => auswärtsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auswarts'] })
      toast.success('Auswärts-Eintrag angelegt')
      setAdding(false)
    },
    onError: (err) => toast.error(err.message),
  })

  const handleUpdate = (id, data) => updateMutation.mutate({ id, data })
  const handleDelete = (id) => {
    if (window.confirm('Eintrag wirklich löschen?')) deleteMutation.mutate(id)
  }

  const overdueCount = auswarts.filter(a =>
    a.erw_rueckkehr && new Date(a.erw_rueckkehr) < new Date() && a.status !== 'Zurück'
  ).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Auswärts-Tracker</h2>
          <p className="text-sm text-gray-500">Externe Bearbeitung und Versand</p>
        </div>
        <div className="flex items-center gap-3">
          {overdueCount > 0 && (
            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
              {overdueCount} überfällig
            </span>
          )}
          <select
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">Alle Status</option>
            {AUSWARTS_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => setAdding(true)}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            <span className="text-lg leading-none">+</span> Neuer Eintrag
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Lade Auswärts-Daten…
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Auftrag</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kunde</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Schritt</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dienstleister</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Abgeschickt</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Erw. Rückkehr</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Zurück</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status ändern</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {adding && (
                  <NewAuswärtsForm
                    onSave={(data) => createMutation.mutate(data)}
                    onCancel={() => setAdding(false)}
                  />
                )}
                {auswarts.length === 0 && !adding ? (
                  <tr>
                    <td colSpan={10} className="text-center py-16 text-gray-400">
                      <p className="text-lg font-medium">Keine Auswärts-Einträge</p>
                      <p className="text-sm mt-1">Klicken Sie auf „Neuer Eintrag" um zu beginnen.</p>
                    </td>
                  </tr>
                ) : (
                  auswarts.map(item => (
                    <AuswärtsRow
                      key={item.id}
                      item={item}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
