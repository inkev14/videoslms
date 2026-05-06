import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { arbeitsschritteApi, monteureApi } from '../api/client.js'
import { kwToLabel, getCurrentKW, getKWRange } from '../utils/kw.js'
import { getAuftragBorderClass, getAuftragBadgeClass } from '../utils/colors.js'

const SCHRITT_TYPEN = [
  'Demontage', 'Reinigen', 'Sandstrahlen', 'Montage Baugruppe',
  'Montage', 'Auswärts', 'Qualitätskontrolle', 'Sonstiges',
]
const TEILE_STATUS_OPTIONS = ['Vorhanden', 'Bestellt', 'Fehlt', 'N/A']
const STATUS_OPTIONS = ['Offen', 'In Arbeit', 'Warten Teile', 'Blockiert', 'Erledigt']

function getAmpelColor(schritt) {
  if (schritt.abgeschlossen) return 'green'
  if (schritt.teile_status === 'Fehlt') return 'red'
  if (schritt.teile_status === 'Bestellt') return 'yellow'
  if (schritt.status === 'Blockiert') return 'red'
  return 'green'
}

function AmpelDot({ color }) {
  const cls = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-400',
    green: 'bg-green-500',
  }[color] || 'bg-gray-300'
  return <span className={`inline-block w-3 h-3 rounded-full ${cls}`} title={color} />
}

function StatusBadge({ schritt }) {
  if (schritt.abgeschlossen) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Erledigt</span>
  }
  const s = schritt.status || 'Offen'
  const map = {
    'Offen': 'bg-gray-100 text-gray-700',
    'In Arbeit': 'bg-blue-100 text-blue-800',
    'Warten Teile': 'bg-orange-100 text-orange-800',
    'Blockiert': 'bg-red-100 text-red-800',
    'Erledigt': 'bg-green-100 text-green-800',
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[s] || 'bg-gray-100 text-gray-700'}`}>{s}</span>
}

function KWCell({ schritt, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(schritt.geplant_kw || '')

  const handleConfirm = () => {
    if (value !== schritt.geplant_kw) {
      onSave(schritt.id, value)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          className="w-20 border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleConfirm()
            if (e.key === 'Escape') setEditing(false)
          }}
          autoFocus
          placeholder="KW23"
        />
        <button onClick={handleConfirm} className="text-green-600 hover:text-green-800 text-xs">✓</button>
        <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
      </div>
    )
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className="text-blue-600 hover:underline text-xs font-medium"
    >
      {schritt.geplant_kw ? kwToLabel(schritt.geplant_kw) : <span className="text-gray-400 italic">–</span>}
    </button>
  )
}

export default function PlanungsListe() {
  const queryClient = useQueryClient()
  const currentYear = new Date().getFullYear()
  const kwOptions = getKWRange(currentYear)

  const [filters, setFilters] = useState({
    kw_von: '',
    kw_bis: '',
    monteur_id: '',
    typ: '',
    status: '',
    teile_status: '',
  })

  const { data: schritte = [], isLoading } = useQuery({
    queryKey: ['arbeitsschritte', filters],
    queryFn: () => {
      const params = {}
      if (filters.kw_von) params.kw_von = filters.kw_von
      if (filters.kw_bis) params.kw_bis = filters.kw_bis
      if (filters.monteur_id) params.monteur_id = filters.monteur_id
      if (filters.typ) params.typ = filters.typ
      if (filters.status) params.status = filters.status
      if (filters.teile_status) params.teile_status = filters.teile_status
      return arbeitsschritteApi.getAll(params)
    },
  })

  const { data: monteure = [] } = useQuery({
    queryKey: ['monteure'],
    queryFn: monteureApi.getAll,
  })

  const verschiebenMutation = useMutation({
    mutationFn: ({ id, kw }) => arbeitsschritteApi.verschieben(id, kw),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['arbeitsschritte'] })
      if (data?.liefertermin_gefaehrdet) {
        toast.error('Achtung: Liefertermin gefährdet durch Verschiebung!')
      } else {
        toast.success('KW verschoben')
      }
    },
    onError: (err) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => arbeitsschritteApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['arbeitsschritte'] })
      toast.success('Gespeichert')
    },
    onError: (err) => toast.error(err.message),
  })

  const handleKWChange = (id, kw) => {
    verschiebenMutation.mutate({ id, kw })
  }

  const handleFieldUpdate = (schritt, field, value) => {
    const { auftrag, ampel, status, kunde, liefertermin, ...clean } = schritt
    updateMutation.mutate({ id: schritt.id, data: { ...clean, [field]: value } })
  }

  const resetFilters = () => setFilters({
    kw_von: '', kw_bis: '', monteur_id: '', typ: '', status: '', teile_status: '',
  })

  const sorted = useMemo(() => {
    return [...schritte].sort((a, b) => {
      const ka = a.geplant_kw || ''
      const kb = b.geplant_kw || ''
      return ka.localeCompare(kb)
    })
  }, [schritte])

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">KW von</label>
            <select
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.kw_von}
              onChange={e => setFilters(f => ({ ...f, kw_von: e.target.value }))}
            >
              <option value="">Alle</option>
              {kwOptions.map(kw => <option key={kw} value={kw}>{kwToLabel(kw)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">KW bis</label>
            <select
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.kw_bis}
              onChange={e => setFilters(f => ({ ...f, kw_bis: e.target.value }))}
            >
              <option value="">Alle</option>
              {kwOptions.map(kw => <option key={kw} value={kw}>{kwToLabel(kw)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Monteur</label>
            <select
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.monteur_id}
              onChange={e => setFilters(f => ({ ...f, monteur_id: e.target.value }))}
            >
              <option value="">Alle</option>
              {monteure.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Typ</label>
            <select
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.typ}
              onChange={e => setFilters(f => ({ ...f, typ: e.target.value }))}
            >
              <option value="">Alle</option>
              {SCHRITT_TYPEN.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            >
              <option value="">Alle</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Teile-Status</label>
            <select
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.teile_status}
              onChange={e => setFilters(f => ({ ...f, teile_status: e.target.value }))}
            >
              <option value="">Alle</option>
              {TEILE_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button
            onClick={resetFilters}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Filter zurücksetzen
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
              Lade Daten…
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg font-medium">Keine Schritte gefunden</p>
              <p className="text-sm mt-1">Passen Sie die Filter an oder legen Sie Aufträge an.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">Ampel</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Auftrag</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kunde</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Getriebe</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Typ</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Bezeichnung</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Monteur</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">KW</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Teile</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Bemerkung</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">✓</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((schritt) => {
                  const auftragId = schritt.auftrag_id || schritt.auftrag?.id
                  const borderCls = getAuftragBorderClass(auftragId)
                  const badgeCls = getAuftragBadgeClass(auftragId)
                  const ampel = getAmpelColor(schritt)
                  return (
                    <tr
                      key={schritt.id}
                      className={`hover:bg-gray-50 border-l-4 ${borderCls} ${schritt.abgeschlossen ? 'opacity-60' : ''}`}
                    >
                      <td className="px-3 py-2.5">
                        <AmpelDot color={ampel} />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ring-1 ring-inset ${badgeCls}`}>
                          {schritt.auftrag?.id || auftragId || '–'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                        {schritt.auftrag?.kunde || '–'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs whitespace-nowrap">
                        {schritt.auftrag?.getriebe_bezeichnung || '–'}
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          className="text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                          value={schritt.typ || ''}
                          onChange={e => handleFieldUpdate(schritt, 'typ', e.target.value)}
                        >
                          {SCHRITT_TYPEN.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-xs truncate">
                        {schritt.bezeichnung || '–'}
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                          value={schritt.monteur_id || ''}
                          onChange={e => handleFieldUpdate(schritt, 'monteur_id', e.target.value || null)}
                        >
                          <option value="">– kein –</option>
                          {monteure.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <KWCell schritt={schritt} onSave={handleKWChange} />
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                          value={schritt.teile_status || 'N/A'}
                          onChange={e => handleFieldUpdate(schritt, 'teile_status', e.target.value)}
                        >
                          {TEILE_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge schritt={schritt} />
                      </td>
                      <td className="px-3 py-2.5 max-w-xs">
                        <BemerkungCell schritt={schritt} onSave={handleFieldUpdate} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={!!schritt.abgeschlossen}
                          onChange={e => handleFieldUpdate(schritt, 'abgeschlossen', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {!isLoading && sorted.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
            {sorted.length} Schritt{sorted.length !== 1 ? 'e' : ''} angezeigt
          </div>
        )}
      </div>
    </div>
  )
}

function BemerkungCell({ schritt, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(schritt.bemerkungen || '')

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          className="border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none w-40"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              onSave(schritt, 'bemerkungen', value)
              setEditing(false)
            }
            if (e.key === 'Escape') setEditing(false)
          }}
          onBlur={() => {
            onSave(schritt, 'bemerkungen', value)
            setEditing(false)
          }}
          autoFocus
        />
      </div>
    )
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className="text-left text-gray-500 text-xs hover:text-gray-800 truncate max-w-[10rem] block"
      title={schritt.bemerkungen}
    >
      {schritt.bemerkungen || <span className="text-gray-300 italic">Bemerkung…</span>}
    </button>
  )
}
